import cron from 'node-cron'
import { randomBytes } from 'crypto'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { sendText } from './whatsapp.js'
import {
  upsertSession, getAgendamentosComSlot, wasReminderSent, markReminderSent,
  insertRescheduleToken, getEncaixeByEspecialidade, markEncaixeNotificado,
  deleteOldMessageLogs, cleanOldSessions, cleanupExpiredTokens,
  cleanupOldProcessedMessages, logJob
} from './db.js'
import { logger } from '../utils/logger.js'
import { msg, hasMsg } from '../utils/messages.js'
import { runBackup } from '../scripts/backup.js'

const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`

const __dirname = dirname(fileURLToPath(import.meta.url))

function getDoctorsConfig() {
  return JSON.parse(readFileSync(join(__dirname, '../config/doctors.json'), 'utf-8'))
}

// ─── Helpers de formatação ────────────────────────────────────────────────────

export function fmtHora(datetimeStr) {
  const d = new Date(datetimeStr)
  return `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`
}

export function fmtData(datetimeStr) {
  const d = new Date(datetimeStr)
  const dia = String(d.getDate()).padStart(2, '0')
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const ano = d.getFullYear()
  const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
  return { data: `${dia}/${mes}/${ano}`, diaSemana: dias[d.getDay()] }
}

// ─── Wrappers de resiliência para jobs agendados ──────────────────────────────

// Retry com backoff — garante que falhas transitórias não silenciam o job
async function runJob(name, fn, maxRetries = 2) {
  const start = Date.now()
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await fn()
      logJob(name, 'SUCCESS', Date.now() - start, null)
      return
    } catch (err) {
      logger.error({ job: name, attempt, maxRetries, err: err.message }, 'Falha no job agendado')
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, attempt * 2000))
      } else {
        logJob(name, 'FAILED', Date.now() - start, err.message)
        logger.error({ job: name }, 'Job falhou em todas as tentativas — verifique o serviço manualmente')
      }
    }
  }
}

// Evita sobreposição: se o job ainda está rodando, pula esta rodada
const _runningJobs = new Set()
async function runExclusive(name, fn) {
  if (_runningJobs.has(name)) {
    logger.warn({ job: name }, 'Job ainda em execução — rodada ignorada')
    return
  }
  _runningJobs.add(name)
  try { await runJob(name, fn) }
  finally { _runningJobs.delete(name) }
}

// ─── 1. AGENDA DO MÉDICO — enviada diariamente às 8h (para o dia seguinte) ───

async function enviarAgendaMedicos() {
  const { doctors } = getDoctorsConfig()
  const activeDoctors = doctors.filter(d => d.active && d.whatsapp && d.whatsapp !== 'PREENCHER_NUMERO_COM_DDI')

  const amanha = new Date()
  amanha.setDate(amanha.getDate() + 1)
  amanha.setHours(0, 0, 0, 0)
  const amanhaFim = new Date(amanha)
  amanhaFim.setHours(23, 59, 59, 999)

  const { diaSemana, data } = fmtData(amanha.toISOString())

  for (const doctor of activeDoctors) {
    const appointments = getAgendamentosComSlot({
      dateMin: amanha.toISOString(),
      dateMax: amanhaFim.toISOString()
    }).filter(a => a.medico_id === doctor.id)

    if (appointments.length === 0) {
      await sendText(doctor.whatsapp, msg('agenda_medico_vazia', { diaSemana, data }))
      logger.info({ doctorId: doctor.id }, 'Agenda enviada ao médico — dia livre')
      continue
    }

    const cabecalho = msg('agenda_medico_cabecalho', { diaSemana, data })
    const linhas = appointments.map((a, i) => `${i + 1}. *${fmtHora(a.slot_datetime)}* — ${a.nome}`).join('\n')
    const rodape = msg('agenda_medico_rodape', { total: appointments.length })
    await sendText(doctor.whatsapp, `${cabecalho}\n\n${linhas}\n${rodape}`)
    logger.info({ doctorId: doctor.id, total: appointments.length }, 'Agenda enviada ao médico')
  }
}

// ─── 2. LEMBRETES AO PACIENTE — 24h e 2h antes ───────────────────────────────

async function verificarLembretes() {
  const now = Date.now()
  const JANELA = 10 * 60 * 1000

  const min24h = new Date(now + 24 * 60 * 60 * 1000 - JANELA)
  const max24h = new Date(now + 24 * 60 * 60 * 1000 + JANELA)
  const min2h  = new Date(now +  2 * 60 * 60 * 1000 - JANELA)
  const max2h  = new Date(now +  2 * 60 * 60 * 1000 + JANELA)

  const candidatos = getAgendamentosComSlot({
    dateMin: new Date(now).toISOString(),
    dateMax: new Date(now + 25 * 60 * 60 * 1000).toISOString()
  })

  for (const ag of candidatos) {
    if (!ag.phone) continue
    const slotMs = new Date(ag.slot_datetime).getTime()
    const { diaSemana, data } = fmtData(ag.slot_datetime)
    const hora = fmtHora(ag.slot_datetime)
    const vars = {
      nome: ag.nome,
      medico: ag.medico_nome || 'Médico da Atos Saúde',
      especialidade: ag.especialidade || 'Consulta médica',
      diaSemana, data, hora
    }

    if (slotMs >= min24h.getTime() && slotMs <= max24h.getTime() && !wasReminderSent(ag.id, 'PATIENT_24H')) {
      const token = randomBytes(16).toString('hex')
      insertRescheduleToken(token, ag.id)
      const linkRemarcar = `${BASE_URL}/remarcar/${token}`
      const msgKey = hasMsg('lembrete_24h_remarcar') ? 'lembrete_24h_remarcar' : 'lembrete_24h'
      await sendText(ag.phone, msg(msgKey, { ...vars, linkRemarcar }))
      markReminderSent(ag.id, 'PATIENT_24H')
      logger.info({ agId: ag.id, phone: ag.phone }, 'Lembrete 24h enviado ao paciente')
    }

    if (slotMs >= min2h.getTime() && slotMs <= max2h.getTime() && !wasReminderSent(ag.id, 'PATIENT_2H')) {
      const token = randomBytes(16).toString('hex')
      insertRescheduleToken(token, ag.id)
      const linkRemarcar = `${BASE_URL}/remarcar/${token}`
      const msgKey = hasMsg('lembrete_2h_remarcar') ? 'lembrete_2h_remarcar' : 'lembrete_2h'
      await sendText(ag.phone, msg(msgKey, { ...vars, linkRemarcar }))
      markReminderSent(ag.id, 'PATIENT_2H')
      logger.info({ agId: ag.id, phone: ag.phone }, 'Lembrete 2h enviado ao paciente')
    }
  }
}

// ─── 3. PESQUISA DE SATISFAÇÃO — 3 horas após a consulta ─────────────────────

async function verificarPesquisas() {
  const now = Date.now()
  const JANELA = 10 * 60 * 1000
  const min3h = new Date(now - 3 * 60 * 60 * 1000 - JANELA)
  const max3h = new Date(now - 3 * 60 * 60 * 1000 + JANELA)

  const candidatos = getAgendamentosComSlot({
    dateMin: min3h.toISOString(),
    dateMax: max3h.toISOString()
  }).filter(a => a.tipo === 'CONSULTA')

  for (const ag of candidatos) {
    if (!ag.phone || wasReminderSent(ag.id, 'PESQUISA_3H')) continue

    await sendText(ag.phone, msg('pesquisa_pergunta', { nome: ag.nome }))
    await upsertSession(ag.phone, {
      flow: 'PESQUISA',
      step: 'AGUARDANDO_NOTA',
      agendamento_id: String(ag.id),
      nome: ag.nome,
      medico_nome: ag.medico_nome,
      especialidade: ag.especialidade
    })
    markReminderSent(ag.id, 'PESQUISA_3H')
    logger.info({ agId: ag.id, phone: ag.phone }, 'Pesquisa de satisfação enviada')
  }
}

// ─── 4. Notificar fila de encaixe quando slot cancelado ──────────────────────
// Chamado externamente quando um agendamento é cancelado
export async function notificarEncaixe(agendamento) {
  if (!agendamento?.especialidade && !agendamento?.medico_id) return
  const candidatos = getEncaixeByEspecialidade(agendamento.especialidade, agendamento.medico_id)
  if (candidatos.length === 0) return

  const { diaSemana, data } = fmtData(agendamento.slot_datetime)
  const hora = fmtHora(agendamento.slot_datetime)
  const { doctors } = getDoctorsConfig()
  const doc = doctors.find(d => d.id === agendamento.medico_id)

  for (const candidato of candidatos) {
    await sendText(candidato.phone, msg('encaixe_vaga_disponivel', {
      nome: candidato.nome || 'paciente',
      especialidade: agendamento.especialidade || 'Consulta',
      medico: doc?.nome || agendamento.medico_nome || 'Médico',
      diaSemana, data, hora
    }))
    await upsertSession(candidato.phone, {
      flow: 'ENCAIXE',
      step: 'AGUARDANDO_ENCAIXE',
      especialidade: agendamento.especialidade,
      medico_id: agendamento.medico_id,
      medico_nome: doc?.nome || agendamento.medico_nome,
      slot_escolhido: agendamento.slot_datetime,
      agendamento_id: String(agendamento.id)
    })
    markEncaixeNotificado(candidato.id)
    logger.info({ phone: candidato.phone, agId: agendamento.id }, 'Fila de encaixe notificada')
    break // notifica apenas o primeiro da fila; outros aguardam próxima vaga
  }
}

// ─── Inicialização dos jobs ───────────────────────────────────────────────────

export function initScheduler() {
  // Agenda diária dos médicos — 8h horário de Brasília
  cron.schedule('0 8 * * *', () => runExclusive('agenda-medicos', enviarAgendaMedicos), {
    timezone: 'America/Sao_Paulo'
  })

  // Lembretes 24h e 2h — a cada 15min, com controle de sobreposição
  cron.schedule('*/15 * * * *', () => runExclusive('lembretes', verificarLembretes), {
    timezone: 'America/Sao_Paulo'
  })

  // Pesquisa de satisfação — a cada 15min, com controle de sobreposição
  cron.schedule('*/15 * * * *', () => runExclusive('pesquisas', verificarPesquisas), {
    timezone: 'America/Sao_Paulo'
  })

  // Limpeza LGPD — sessões inativas >30min + mensagens >90 dias + tokens revogados — 3h Brasília
  cron.schedule('0 3 * * *', () => runJob('limpeza', () => {
    cleanOldSessions(30)
    deleteOldMessageLogs(90)
    cleanupExpiredTokens()
    cleanupOldProcessedMessages(7)
    logger.info('Scheduler: limpeza — sessões expiradas, mensagens >90 dias, tokens revogados e mensagens processadas')
  }), { timezone: 'America/Sao_Paulo' })

  // Backup diário do banco — 2h Brasília
  cron.schedule('0 2 * * *', () => runJob('backup', runBackup), {
    timezone: 'America/Sao_Paulo'
  })

  logger.info('Scheduler iniciado: agenda (8h) | lembretes 24h/2h | pesquisa 3h pós-consulta | limpeza (3h) | backup (2h)')
}
