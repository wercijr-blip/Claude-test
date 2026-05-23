import { Queue, Worker } from 'bullmq'
import { logger } from './_core/logger.ts'
import { db } from './db.ts'
import { exames, pacientes } from '../drizzle/schema.ts'
import { eq } from 'drizzle-orm'
import { analisarExame } from './examAnalysis.ts'
import { EXAM_RULES } from '../shared/security-constants.ts'
import type { ResultadoIa } from '../shared/types.ts'
import { connection, QUEUE_PREFIX, persistDlq, EXAM_WORKER_OPTS } from './workers/queues.ts'

export const EXAM_QUEUE_NAME = 'exam-analysis'

export const examQueue = new Queue(EXAM_QUEUE_NAME, { connection, prefix: QUEUE_PREFIX })

export function startExamWorker() {
  const worker = new Worker(
    EXAM_QUEUE_NAME,
    async (job) => {
      const { exameId, requestId, actorId } = job.data as { exameId: number; requestId?: string; actorId?: number }
      const logCtx = { exameId, requestId, actorId }

      // 1. Run AI analysis (updates exames.resultadoIa with status: 'pendente')
      let resultado: ResultadoIa
      try {
        resultado = await analisarExame(exameId)
      } catch (err) {
        logger.error(`[examQueue] Falha na análise do exame ${exameId}`, { ...logCtx, error: (err as Error).message })
        throw err // Let BullMQ retry
      }

      // 2. Fetch the exam to get pacienteId
      const [exame] = await db.select().from(exames).where(eq(exames.id, exameId)).limit(1)
      if (!exame) {
        logger.error(`[examQueue] Exame ${exameId} não encontrado após análise`, logCtx)
        return
      }

      const { pacienteId } = exame

      // 3. Auto-approval logic
      if (resultado.resultado === 'nao_reagente' && resultado.confianca >= EXAM_RULES.AUTO_APPROVE_MIN_CONFIDENCE) {
        // High-confidence negative result → auto-approve
        const novoResultado: ResultadoIa = { ...resultado, status: 'aprovado_automaticamente' }

        await db.transaction(async (tx) => {
          await tx.update(exames)
            .set({ resultadoIa: novoResultado })
            .where(eq(exames.id, exameId))
          await tx.update(pacientes)
            .set({ status: 'aprovado' })
            .where(eq(pacientes.id, pacienteId))
        })

        logger.info(`[examQueue] Exame ${exameId} aprovado automaticamente`, { ...logCtx, confianca: resultado.confianca, pacienteId })
      } else if (resultado.resultado === 'reagente' || resultado.confianca < EXAM_RULES.LOW_CONFIDENCE_THRESHOLD) {
        // Reactive result or low confidence → flag for medico review
        const novoResultado: ResultadoIa = { ...resultado, status: 'rejeitado_ia' }

        await db.update(exames)
          .set({ resultadoIa: novoResultado })
          .where(eq(exames.id, exameId))

        logger.warn(`[examQueue] Exame ${exameId} rejeitado pela IA`, { ...logCtx, resultado: resultado.resultado, confianca: resultado.confianca })
        logger.info(`[examQueue] Notificação pendente: exame ${exameId} aguarda revisão médica`, { ...logCtx, motivo: 'resultado_reagente' })
      } else {
        // Inconclusive or unidentified → flag for medico review
        const novoResultado: ResultadoIa = { ...resultado, status: 'pendente_revisao' }

        await db.update(exames)
          .set({ resultadoIa: novoResultado })
          .where(eq(exames.id, exameId))

        logger.warn(`[examQueue] Exame ${exameId} inconclusivo`, { ...logCtx, resultado: resultado.resultado, confianca: resultado.confianca })
        logger.info(`[examQueue] Notificação pendente: exame ${exameId} aguarda revisão médica`, { ...logCtx, motivo: 'resultado_inconclusivo' })
      }

      return { exameId, requestId, resultado: resultado.resultado, status: resultado.status }
    },
    { ...EXAM_WORKER_OPTS, connection, concurrency: 3, prefix: QUEUE_PREFIX },
  )

  worker.on('failed', (job, err) => {
    logger.error(`[examQueue] Job ${job?.id} falhou (${job?.attemptsMade} tentativas)`, { error: err.message })
    if ((job?.attemptsMade ?? 0) >= (job?.opts?.attempts ?? 3)) {
      void persistDlq(EXAM_QUEUE_NAME, job, err)
    }
  })

  return worker
}

// actorId — ECF.02: profissional solicitante vinculado à sessão SBIS
export async function enqueueAnalisarExame(exameId: number, requestId?: string, forceRequeue = false, actorId?: number) {
  if (forceRequeue) {
    const existing = await examQueue.getJob(`exam-${exameId}`)
    if (existing) {
      const state = await existing.getState()
      if (state === 'active') {
        // Job is currently processing — adding with the same jobId would throw.
        // Return the in-flight job so callers don't crash.
        return existing
      }
      await examQueue.remove(`exam-${exameId}`)
    }
  }
  return examQueue.add('analisar', { exameId, requestId, actorId }, {
    jobId: `exam-${exameId}`,
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  })
}
