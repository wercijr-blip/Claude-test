/**
 * pubmed-synthesis queue — BullMQ
 *
 * Disparado por evento após processarConsulta (scriba.ts).
 * Pipeline: buscarArtigosPubMed → sintetizarArtigosPubMed (Prompt 03)
 *           → salvar em soap_notes.sintese_evidencias
 *           → re-executar detectarDivergenciaConducta com síntese (best-effort)
 */

import { Queue, Worker } from 'bullmq'
import { env } from './_core/env.ts'
import { redis } from './_core/redis.ts'
import { db } from './db.ts'
import { soapNotes, conductAlerts } from '../drizzle/schema.ts'
import { eq } from 'drizzle-orm'
import { buscarArtigosPubMed, formatarArtigosParaPrompt } from './pubmed.ts'
import { sintetizarArtigosPubMed, detectarDivergenciaConducta } from './clinicalIntelligence.ts'
import { logger } from './_core/logger.ts'

// ─── Configuração ─────────────────────────────────────────────────────────────

export const PUBMED_QUEUE_NAME = 'pubmed-synthesis'

const QUEUE_PREFIX = env.NODE_ENV === 'production' ? '{fp-prod}' : `{fp-${env.NODE_ENV}}`

const WORKER_OPTS = {
  lockDuration: 180_000,  // síntese pode levar até 3 min (PubMed + Claude)
  stalledInterval: 120_000,
  maxStalledCount: 1,
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 30 },
  drainDelay: 30, // 30s — mais responsivo que digest pois alimenta alertas
} as const

export const pubmedQueue = new Queue(PUBMED_QUEUE_NAME, {
  connection: redis,
  prefix: QUEUE_PREFIX,
})

// ─── Tipos de job ─────────────────────────────────────────────────────────────

export interface PubmedJobData {
  soapNoteId: number
  medicoId: number
  pubmedQuery: string
  diagnosticoPrincipal: string
  cid10: string
  soapTexto: string          // para compor soapResumido no Prompt 03
  conductaAtual: string      // extraído do soapTexto (seção Plan/Conduta)
  populacao: string          // extraído do knowledge_metadata
}

// ─── Enqueue público ──────────────────────────────────────────────────────────

/**
 * Enfileira síntese PubMed para uma SOAP note.
 * jobId determinístico evita re-processamento se scriba rodar duas vezes.
 */
export async function enqueueSintesePubMed(params: PubmedJobData): Promise<void> {
  if (!params.pubmedQuery?.trim()) return // sem query não há o que buscar

  await pubmedQueue.add('sintese-pubmed', params, {
    jobId: `pubmed-${params.soapNoteId}`,
    attempts: 2,
    backoff: { type: 'exponential', delay: 60_000 },
  })
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export function startPubmedWorker() {
  const worker = new Worker<PubmedJobData>(
    PUBMED_QUEUE_NAME,
    async (job) => {
      const { soapNoteId, medicoId, pubmedQuery, diagnosticoPrincipal, cid10, soapTexto, conductaAtual, populacao } = job.data

      // 1. Buscar artigos no PubMed
      const artigos = await buscarArtigosPubMed(pubmedQuery, 5)
      const artigosFormatados = formatarArtigosParaPrompt(artigos)
      const artigosJson = JSON.stringify(artigos)

      // 2. Gerar síntese (Prompt 03)
      const soapResumido = soapTexto.slice(0, 1500) // primeiros 1500 chars evitam tokens excessivos

      const sintese = await sintetizarArtigosPubMed({
        soapResumido,
        diagnostico: diagnosticoPrincipal,
        cid10,
        populacao,
        condutaAtual: conductaAtual,
        artigosJson: artigosFormatados,
        n: artigos.length,
      })

      // 3. Salvar síntese na soap_note
      await db
        .update(soapNotes)
        .set({ sinteseEvidencias: sintese.texto })
        .where(eq(soapNotes.id, soapNoteId))

      logger.info('[pubmedQueue] Síntese salva', { soapNoteId, artigos: artigos.length })

      // 4. Re-executar divergência de conduta com síntese (best-effort)
      // Se falhar não bloqueia — alerta sem síntese já foi gerado em processarConsulta
      try {
        const alerta = await detectarDivergenciaConducta({
          diagnostico: diagnosticoPrincipal,
          cid10,
          condutaAtual: conductaAtual,
          sinteseEvidencias: sintese.texto,
        })

        if (alerta.tem_divergencia) {
          await db.insert(conductAlerts).values({
            soapNoteId,
            medicoId,
            diagnostico: diagnosticoPrincipal,
            cid10,
            nivelUrgencia: alerta.nivel_urgencia ?? 'baixo',
            hashAlerta: alerta.hash_alerta ?? null,
            alertaJson: alerta as unknown as Record<string, unknown>,
            mensagemMedico: alerta.mensagem_para_medico ?? null,
          }).onDuplicateKeyUpdate({
            // Se já existe alerta para esta soapNote, atualiza com a versão enriquecida
            set: {
              hashAlerta: alerta.hash_alerta ?? null,
              alertaJson: alerta as unknown as Record<string, unknown>,
              mensagemMedico: alerta.mensagem_para_medico ?? null,
            },
          })

          logger.info('[pubmedQueue] Alerta de conduta enriquecido com síntese', {
            soapNoteId,
            nivel: alerta.nivel_urgencia,
          })
        }
      } catch (alertaErr) {
        logger.warn('[pubmedQueue] Falha ao re-executar divergência (best-effort)', { soapNoteId, err: alertaErr })
      }

      return { soapNoteId, artigosEncontrados: artigos.length }
    },
    { connection: redis, prefix: QUEUE_PREFIX, ...WORKER_OPTS },
  )

  worker.on('failed', (job, err) => {
    logger.error(`[pubmedQueue] Job ${job?.id} falhou`, { soapNoteId: job?.data?.soapNoteId, err: err.message })
  })

  worker.on('completed', (job, result) => {
    logger.info(`[pubmedQueue] Job ${job.id} concluído`, result)
  })

  return worker
}
