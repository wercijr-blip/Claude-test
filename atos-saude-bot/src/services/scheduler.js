import cron from 'node-cron'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { sendText } from './whatsapp.js'
import { upsertSession, getAgendamentosComSlot, wasReminderSent, markReminderSent } from './db.js'
import { logger } from '../utils/logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function getDoctorsConfig() {
  return JSON.parse(readFileSync(join(__dirname, '../config/doctors.json'), 'utf-8'))
}

// ─── Helpers de formatação ────────────────────────────────────────────────────

function fmtHora(datetimeStr) {
  const d = new Date(datetimeStr)
  return `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`
}

function fmtData(datetimeStr) {
  const d = new Date(datetimeStr)
  const dia = String(d.getDate()).padStart(2, '0')
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const ano = d.getFullYear()
  const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
  return { data: `${dia}/${mes}/${ano}`, diaSemana: dias[d.getDay()] }
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
    const { getAgendamentosComSlot: getSlots } = await import('./db.js')
    const appointments = getAgendamentosComSlot({
      dateMin: amanha.toISOString(),
      dateMax: amanhaFim.toISOString()
    }).filter(a => a.medico_id === doctor.id)

    if (appointments.length === 0) {
      await sendText(doctor.whatsapp,
        `📅 *Agenda de amanhã — ${diaSemana}, ${data}*\n\n` +
        `Nenhuma consulta agendada. ✅\n\n` +
        `*Atos Saúde Integrada* 🏥`
      )
      logger.info({ doctorId: doctor.id }, 'Agenda enviada ao médico — dia livre')
      continue
    }

    const linhas = appointments.map((a, i) => {
      return `${i + 1}. *${fmtHora(a.slot_datetime)}* — ${a.nome}`
    }).join('\n')

    await sendText(doctor.whatsapp,
      `📅 *Agenda de amanhã — ${diaSemana}, ${data}*\n\n` +
      `${linhas}\n\n` +
      `Total: *${appointments.length} consulta(s)*\n\n` +
      `*Atos Saúde Integrada* 🏥`
    )
    logger.info({ doctorId: doctor.id, total: appointments.length }, 'Agenda enviada ao médico')
  }
}

// ─── 2. LEMBRETES AO PACIENTE — 24h e 2h antes ───────────────────────────────

async function verificarLembretes() {
  const now = Date.now()

  // Janelas de detecção: ±10 minutos em torno do momento alvo
  const JANELA = 10 * 60 * 1000

  const min24h = new Date(now + 24 * 60 * 60 * 1000 - JANELA)
  const max24h = new Date(now + 24 * 60 * 60 * 1000 + JANELA)
  const min2h  = new Date(now +  2 * 60 * 60 * 1000 - JANELA)
  const max2h  = new Date(now +  2 * 60 * 60 * 1000 + JANELA)

  // Busca todos os agendamentos futuros com horário definido
  const candidatos = getAgendamentosComSlot({
    dateMin: new Date(now).toISOString(),
    dateMax: new Date(now + 25 * 60 * 60 * 1000).toISOString()
  })

  for (const ag of candidatos) {
    if (!ag.phone) continue
    const slotMs = new Date(ag.slot_datetime).getTime()
    const { diaSemana, data } = fmtData(ag.slot_datetime)
    const hora = fmtHora(ag.slot_datetime)

    // Lembrete 24 horas antes
    if (slotMs >= min24h.getTime() && slotMs <= max24h.getTime()) {
      if (!wasReminderSent(ag.id, 'PATIENT_24H')) {
        await sendText(ag.phone,
          `👋 Olá, *${ag.nome}*!\n\n` +
          `Lembrando que você tem consulta *amanhã*:\n\n` +
          `🩺 ${ag.especialidade || 'Consulta médica'}\n` +
          `👨‍⚕️ ${ag.medico_nome || 'Médico da Atos Saúde'}\n` +
          `📅 *${diaSemana}, ${data}* às *${hora}*\n` +
          `📍 Setor Hospitalar Sul 716, Conj. A — Asa Sul\n\n` +
          `Lembre-se de trazer:\n` +
          `📋 Pedido médico (se houver)\n` +
          `💳 Carteirinha do convênio (se tiver)\n` +
          `🪪 Documento com foto e CPF\n\n` +
          `Em caso de cancelamento, avise com antecedência. 🙏\n` +
          `*Atos Saúde Integrada* | (61) 4042-7188 🏥`
        )
        markReminderSent(ag.id, 'PATIENT_24H')
        logger.info({ agId: ag.id, phone: ag.phone }, 'Lembrete 24h enviado ao paciente')
      }
    }

    // Lembrete 2 horas antes
    if (slotMs >= min2h.getTime() && slotMs <= max2h.getTime()) {
      if (!wasReminderSent(ag.id, 'PATIENT_2H')) {
        await sendText(ag.phone,
          `⏰ Olá, *${ag.nome}*!\n\n` +
          `Sua consulta é *daqui a 2 horas*!\n\n` +
          `👨‍⚕️ ${ag.medico_nome || 'Médico da Atos Saúde'}\n` +
          `🕐 Hoje às *${hora}*\n` +
          `📍 Setor Hospitalar Sul 716, Conj. A — Asa Sul, Brasília-DF\n\n` +
          `Chegue com 10 minutos de antecedência. 😊\n` +
          `*Atos Saúde Integrada* 🏥`
        )
        markReminderSent(ag.id, 'PATIENT_2H')
        logger.info({ agId: ag.id, phone: ag.phone }, 'Lembrete 2h enviado ao paciente')
      }
    }
  }
}

// ─── 3. PESQUISA DE SATISFAÇÃO — 3 horas após a consulta ─────────────────────

async function verificarPesquisas() {
  const now = Date.now()
  const JANELA = 10 * 60 * 1000

  // Consultas que terminaram entre 2h50min e 3h10min atrás
  const min3h = new Date(now - 3 * 60 * 60 * 1000 - JANELA)
  const max3h = new Date(now - 3 * 60 * 60 * 1000 + JANELA)

  const candidatos = getAgendamentosComSlot({
    dateMin: min3h.toISOString(),
    dateMax: max3h.toISOString()
  }).filter(a => a.tipo === 'CONSULTA')

  for (const ag of candidatos) {
    if (!ag.phone) continue
    if (wasReminderSent(ag.id, 'PESQUISA_3H')) continue

    // Envia a pesquisa
    await sendText(ag.phone,
      `😊 Olá, *${ag.nome}*!\n\n` +
      `Como foi sua consulta hoje na *Atos Saúde*?\n\n` +
      `Sua avaliação nos ajuda a melhorar cada vez mais! 🙏\n\n` +
      `⭐ Como você avalia o atendimento?\n\n` +
      `1️⃣ Péssimo\n` +
      `2️⃣ Ruim\n` +
      `3️⃣ Regular\n` +
      `4️⃣ Bom\n` +
      `5️⃣ Excelente ⭐`
    )

    // Coloca o paciente no fluxo de pesquisa
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

// ─── Inicialização dos jobs ───────────────────────────────────────────────────

export function initScheduler() {
  // Agenda do médico: todo dia às 8h (fuso de Brasília)
  cron.schedule('0 8 * * *', async () => {
    logger.info('Scheduler: enviando agenda diária aos médicos')
    await enviarAgendaMedicos().catch(e => logger.error({ err: e.message }, 'Erro ao enviar agenda médica'))
  }, { timezone: 'America/Sao_Paulo' })

  // Lembretes ao paciente: a cada 15 minutos
  cron.schedule('*/15 * * * *', async () => {
    await verificarLembretes().catch(e => logger.error({ err: e.message }, 'Erro ao verificar lembretes'))
  })

  // Pesquisa de satisfação: a cada 15 minutos
  cron.schedule('*/15 * * * *', async () => {
    await verificarPesquisas().catch(e => logger.error({ err: e.message }, 'Erro ao verificar pesquisas'))
  })

  logger.info('Scheduler iniciado: agenda médica (8h/dia) | lembretes 24h e 2h | pesquisa 3h pós-consulta')
}
