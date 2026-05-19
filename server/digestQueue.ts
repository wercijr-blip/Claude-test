/**
 * clinical-digest queue — BullMQ
 *
 * Tipos de job:
 *   diario  → disparado por evento (encerrarSessao no scriba)
 *   semanal → cron sexta-feira 19h BRT (22h UTC) — Prompt 08
 *   mensal  → cron último dia do mês 20h BRT (23h UTC) — Prompt 09
 */

import { Queue, Worker } from 'bullmq'
import { env } from './_core/env.ts'
import { redis, QUEUE_PREFIX } from './_core/redis.ts'
import { db } from './db.ts'
import {
  clinicalSessions,
  soapNotes,
  conductAlerts,
  clinicalDigests,
  publicationDrafts,
  users,
} from '../drizzle/schema.ts'
import { eq, and, gte, lte, lt, isNotNull, inArray, sql, count } from 'drizzle-orm'
import {
  gerarDigestDiario,
  gerarDigestSemanal,
  gerarDigestMensal,
} from './clinicalIntelligence.ts'
import { publicarDigest } from './obsidian.ts'
import { notificarDigest } from './n8n.ts'
import { logger } from './_core/logger.ts'

// ─── Configuração ─────────────────────────────────────────────────────────────

export const DIGEST_QUEUE_NAME = 'clinical-digest'

// Digests não são urgentes nem patient-facing.
// drainDelay alto reduz comandos Redis (Upstash free tier: 500k/mês).
const DIGEST_WORKER_OPTS = {
  lockDuration: 120_000,
  stalledInterval: 120_000,
  maxStalledCount: 1,
  removeOnComplete: { count: 30 },
  removeOnFail: { count: 20 },
  drainDelay: 120, // 2 min — crons não são time-critical
} as const

export const digestQueue = new Queue(DIGEST_QUEUE_NAME, {
  connection: redis,
  prefix: QUEUE_PREFIX,
})

// ─── Tipos de job ─────────────────────────────────────────────────────────────

type DiarioJobData  = { tipo: 'diario';  medicoId: number; sessionId: number; periodoRef: string }
type SemanalJobData = { tipo: 'semanal'; periodoRef: string }
type MensalJobData  = { tipo: 'mensal';  periodoRef: string }
type DigestJobData  = DiarioJobData | SemanalJobData | MensalJobData

// ─── Enqueue público ──────────────────────────────────────────────────────────

/** Chamado por scriba.encerrarSessao — disparo por evento. */
export async function enqueueDigestDiario(params: {
  medicoId: number
  sessionId: number
  periodoRef: string // "YYYY-MM-DD"
}) {
  // jobId determinístico evita duplicatas em cliques duplos ou retries
  return digestQueue.add(
    'digest-diario',
    { tipo: 'diario', ...params } satisfies DiarioJobData,
    {
      jobId: `digest-diario-${params.medicoId}-${params.periodoRef}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 30_000 },
    },
  )
}

// ─── Crons ────────────────────────────────────────────────────────────────────

/** Registra os crons semanal e mensal uma única vez ao iniciar o worker. */
export async function agendarDigestCrons() {
  // Sexta-feira 19h BRT = sexta-feira 22h UTC
  await digestQueue.add(
    'digest-semanal',
    { tipo: 'semanal', periodoRef: '' } satisfies SemanalJobData,
    {
      repeat: { pattern: '0 22 * * 5' },
      jobId: 'digest-semanal-cron',
    },
  )

  // Dias 28-31 às 23h UTC (20h BRT) — worker verifica se é o último dia
  await digestQueue.add(
    'digest-mensal',
    { tipo: 'mensal', periodoRef: '' } satisfies MensalJobData,
    {
      repeat: { pattern: '0 23 28-31 * *' },
      jobId: 'digest-mensal-cron',
    },
  )

  logger.info('[digestQueue] Crons semanal e mensal registrados')
}

// ─── Helpers de data ──────────────────────────────────────────────────────────

function isUltimoDiaDoMes(): boolean {
  const amanha = new Date()
  amanha.setDate(amanha.getDate() + 1)
  return amanha.getDate() === 1
}

function inicioDia(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function fimDia(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999))
}

// Semana ISO: segunda a sexta (ou domingo a sábado conforme disparo)
function inicioSemana(d: Date): Date {
  const diff = d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1 // segunda = 0
  const seg = new Date(d)
  seg.setUTCDate(d.getUTCDate() - diff)
  return inicioDia(seg)
}

function inicioMes(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

// ─── Helpers de consulta ──────────────────────────────────────────────────────

async function getMedicoIds(): Promise<number[]> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.role, ['medico', 'admin']))
  return rows.map(r => r.id)
}

async function getSoapResumo(medicoId: number, de: Date, ate: Date) {
  return db
    .select({
      diagnosticoPrincipal: soapNotes.diagnosticoPrincipal,
      cid10: soapNotes.cid10,
      certeza: soapNotes.certeza,
      template: soapNotes.template,
      sinteseEvidencias: soapNotes.sinteseEvidencias,
      createdAt: soapNotes.createdAt,
    })
    .from(soapNotes)
    .where(and(
      eq(soapNotes.medicoId, medicoId),
      gte(soapNotes.createdAt, de),
      lte(soapNotes.createdAt, ate),
    ))
}

async function getSintesesPeriodo(medicoId: number, de: Date, ate: Date): Promise<string> {
  const rows = await db
    .select({ sinteseEvidencias: soapNotes.sinteseEvidencias, diagnosticoPrincipal: soapNotes.diagnosticoPrincipal })
    .from(soapNotes)
    .where(and(
      eq(soapNotes.medicoId, medicoId),
      gte(soapNotes.createdAt, de),
      lte(soapNotes.createdAt, ate),
      isNotNull(soapNotes.sinteseEvidencias),
    ))

  if (!rows.length) return '[]'
  return JSON.stringify(rows.map(r => ({
    diagnostico: r.diagnosticoPrincipal,
    sintese: r.sinteseEvidencias?.slice(0, 1500), // resumo para o digest
  })))
}

async function getAlertasResumo(medicoId: number, de: Date, ate: Date) {
  return db
    .select({
      diagnostico: conductAlerts.diagnostico,
      cid10: conductAlerts.cid10,
      nivelUrgencia: conductAlerts.nivelUrgencia,
      mensagemMedico: conductAlerts.mensagemMedico,
      createdAt: conductAlerts.createdAt,
    })
    .from(conductAlerts)
    .where(and(
      eq(conductAlerts.medicoId, medicoId),
      gte(conductAlerts.createdAt, de),
      lte(conductAlerts.createdAt, ate),
    ))
}

async function salvarDigest(params: {
  medicoId: number
  tipo: string
  periodoRef: string
  texto: string
  totalConsultas: number
  totalAlertas: number
}) {
  // Unique constraint em (medicoId, tipo, periodoRef) — ignora duplicatas
  await db
    .insert(clinicalDigests)
    .values(params)
    .onDuplicateKeyUpdate({ set: { texto: params.texto, geradoEm: new Date() } })
}

// ─── Processadores por tipo ───────────────────────────────────────────────────

async function runDiario(data: DiarioJobData) {
  const hoje = new Date()
  const de = inicioDia(hoje)
  const ate = fimDia(hoje)

  const [consultas, alertas, artigosSintetizadosJson] = await Promise.all([
    getSoapResumo(data.medicoId, de, ate),
    getAlertasResumo(data.medicoId, de, ate),
    getSintesesPeriodo(data.medicoId, de, ate),
  ])

  const { texto } = await gerarDigestDiario({
    data: data.periodoRef,
    totalPacientes: consultas.length,
    consultasJson: JSON.stringify(consultas),
    artigosSintetizadosJson,
    alertasCondutaJson: JSON.stringify(alertas),
    relatoriosGerados: '0',
  })

  await salvarDigest({
    medicoId: data.medicoId,
    tipo: 'diario',
    periodoRef: data.periodoRef,
    texto,
    totalConsultas: consultas.length,
    totalAlertas: alertas.length,
  })

  publicarDigest({ tipo: 'diario', periodoRef: data.periodoRef, texto }).catch(() => null)
  notificarDigest({ tipo: 'diario', periodoRef: data.periodoRef, totalConsultas: consultas.length, totalAlertas: alertas.length, resumoTexto: texto })

  logger.info('[digestQueue] Digest diário gerado', {
    medicoId: data.medicoId,
    periodo: data.periodoRef,
    consultas: consultas.length,
  })
}

async function runSemanal(periodoRef: string) {
  const medicoIds = await getMedicoIds()
  if (!medicoIds.length) return

  const agora = new Date()
  const de = inicioSemana(agora)
  const ate = fimDia(agora)
  const semanaLabel = periodoRef || `${agora.getUTCFullYear()}-W${String(Math.ceil(agora.getUTCDate() / 7)).padStart(2, '0')}`

  for (const medicoId of medicoIds) {
    const [consultas, alertas, artigosSemanaJson, seriesAtivas] = await Promise.all([
      getSoapResumo(medicoId, de, ate),
      getAlertasResumo(medicoId, de, ate),
      getSintesesPeriodo(medicoId, de, ate),
      db.select({
        tipo: publicationDrafts.tipo,
        diagnostico: publicationDrafts.diagnostico,
        tema: publicationDrafts.tema,
        status: publicationDrafts.status,
        nCasos: publicationDrafts.nCasos,
        jornal: publicationDrafts.jornal,
        atualizadoEm: publicationDrafts.atualizadoEm,
      })
      .from(publicationDrafts)
      .where(and(
        eq(publicationDrafts.medicoId, medicoId),
        inArray(publicationDrafts.status, ['rascunho', 'em_revisao', 'submetido', 'aceito']),
      ))
      .limit(10),
    ])

    if (!consultas.length && !alertas.length) continue

    const { texto } = await gerarDigestSemanal({
      semana: semanaLabel,
      totalPacientes: consultas.length,
      diagnosticosJson: JSON.stringify(consultas),
      artigosSemanaJson,
      alertasSemanaJson: JSON.stringify(alertas),
      seriesStatusJson: JSON.stringify(seriesAtivas),
      relatoriosSemana: String(seriesAtivas.length),
    })

    await salvarDigest({
      medicoId,
      tipo: 'semanal',
      periodoRef: semanaLabel,
      texto,
      totalConsultas: consultas.length,
      totalAlertas: alertas.length,
    })

    publicarDigest({ tipo: 'semanal', periodoRef: semanaLabel, texto }).catch(() => null)
    notificarDigest({ tipo: 'semanal', periodoRef: semanaLabel, totalConsultas: consultas.length, totalAlertas: alertas.length, resumoTexto: texto })

    logger.info('[digestQueue] Digest semanal gerado', { medicoId, semana: semanaLabel })
  }
}

async function runMensal(periodoRef: string) {
  const medicoIds = await getMedicoIds()
  if (!medicoIds.length) return

  const agora = new Date()
  const de = inicioMes(agora)
  const ate = fimDia(agora)
  const mesLabel = periodoRef || `${agora.getUTCFullYear()}-${String(agora.getUTCMonth() + 1).padStart(2, '0')}`

  for (const medicoId of medicoIds) {
    const [consultas, alertas, artigosMesJson, seriesGeradas, seriesPublicadas, cronograma] = await Promise.all([
      getSoapResumo(medicoId, de, ate),
      getAlertasResumo(medicoId, de, ate),
      getSintesesPeriodo(medicoId, de, ate),
      // Séries criadas neste mês (qualquer status)
      db.select({
        tipo: publicationDrafts.tipo,
        diagnostico: publicationDrafts.diagnostico,
        tema: publicationDrafts.tema,
        status: publicationDrafts.status,
        nCasos: publicationDrafts.nCasos,
        jornal: publicationDrafts.jornal,
      })
      .from(publicationDrafts)
      .where(and(
        eq(publicationDrafts.medicoId, medicoId),
        gte(publicationDrafts.createdAt, de),
        lte(publicationDrafts.createdAt, ate),
      )),
      // Séries publicadas no total (acumulado)
      db.select({
        tipo: publicationDrafts.tipo,
        diagnostico: publicationDrafts.diagnostico,
        tema: publicationDrafts.tema,
        doi: publicationDrafts.doi,
        jornal: publicationDrafts.jornal,
        dataPublicacao: publicationDrafts.dataPublicacao,
      })
      .from(publicationDrafts)
      .where(and(
        eq(publicationDrafts.medicoId, medicoId),
        eq(publicationDrafts.status, 'publicado'),
      )),
      // Cronograma: rascunhos e submetidos com jornal informado
      db.select({
        tipo: publicationDrafts.tipo,
        diagnostico: publicationDrafts.diagnostico,
        tema: publicationDrafts.tema,
        status: publicationDrafts.status,
        jornal: publicationDrafts.jornal,
        dataSubmissao: publicationDrafts.dataSubmissao,
      })
      .from(publicationDrafts)
      .where(and(
        eq(publicationDrafts.medicoId, medicoId),
        inArray(publicationDrafts.status, ['rascunho', 'em_revisao', 'submetido', 'aceito']),
        isNotNull(publicationDrafts.jornal),
      ))
      .limit(5),
    ])

    const { texto } = await gerarDigestMensal({
      mesAno: mesLabel,
      totalPacientes: consultas.length,
      diagnosticosMesJson: JSON.stringify(consultas),
      artigosMesJson,
      alertasMesJson: JSON.stringify(alertas),
      seriesGeradasJson: JSON.stringify(seriesGeradas),
      seriesPublicadasJson: JSON.stringify(seriesPublicadas),
      totalAcumuladoJson: JSON.stringify({
        consultas: consultas.length,
        alertas: alertas.length,
        seriesGeradas: seriesGeradas.length,
        seriesPublicadas: seriesPublicadas.length,
      }),
      cronogramaPublicacaoJson: JSON.stringify(cronograma),
    })

    await salvarDigest({
      medicoId,
      tipo: 'mensal',
      periodoRef: mesLabel,
      texto,
      totalConsultas: consultas.length,
      totalAlertas: alertas.length,
    })

    publicarDigest({ tipo: 'mensal', periodoRef: mesLabel, texto }).catch(() => null)
    notificarDigest({ tipo: 'mensal', periodoRef: mesLabel, totalConsultas: consultas.length, totalAlertas: alertas.length, resumoTexto: texto })

    logger.info('[digestQueue] Digest mensal gerado', { medicoId, mes: mesLabel })
  }
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export function startDigestWorker() {
  const worker = new Worker<DigestJobData>(
    DIGEST_QUEUE_NAME,
    async (job) => {
      const data = job.data

      if (data.tipo === 'diario') {
        await runDiario(data)
        return { tipo: 'diario', medicoId: data.medicoId }
      }

      if (data.tipo === 'semanal') {
        await runSemanal(data.periodoRef)
        return { tipo: 'semanal' }
      }

      if (data.tipo === 'mensal') {
        // Cron roda dias 28-31 — verifica se é realmente o último dia
        if (!isUltimoDiaDoMes()) {
          logger.info('[digestQueue] Mensal: não é o último dia do mês, pulando')
          return { skipped: true }
        }
        await runMensal(data.periodoRef)
        return { tipo: 'mensal' }
      }
    },
    { connection: redis, prefix: QUEUE_PREFIX, ...DIGEST_WORKER_OPTS },
  )

  worker.on('failed', (job, err) => {
    logger.error(`[digestQueue] Job ${job?.id} falhou`, { message: err.message, tipo: job?.data?.tipo })
  })

  worker.on('completed', (job) => {
    logger.info(`[digestQueue] Job ${job.id} concluído`, { tipo: job.data.tipo })
  })

  return worker
}
