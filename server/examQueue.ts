import { Queue, Worker } from 'bullmq'
import { redis } from './_core/redis.ts'
import { logger } from './_core/logger.ts'
import { db } from './db.ts'
import { exames, pacientes } from '../drizzle/schema.ts'
import { eq } from 'drizzle-orm'
import { analisarExame } from './examAnalysis.ts'
import { EXAM_RULES } from '../shared/security-constants.ts'
import type { ResultadoIa } from '../shared/types.ts'

export const EXAM_QUEUE_NAME = 'exam-analysis'

const connection = redis

export const examQueue = new Queue(EXAM_QUEUE_NAME, { connection })

export function startExamWorker() {
  const worker = new Worker(
    EXAM_QUEUE_NAME,
    async (job) => {
      const { exameId } = job.data as { exameId: number }

      // 1. Run AI analysis (updates exames.resultadoIa with status: 'pendente')
      let resultado: ResultadoIa
      try {
        resultado = await analisarExame(exameId)
      } catch (err) {
        logger.error(`[examQueue] Falha na análise do exame ${exameId}`, { error: (err as Error).message })
        throw err // Let BullMQ retry
      }

      // 2. Fetch the exam to get pacienteId
      const [exame] = await db.select().from(exames).where(eq(exames.id, exameId)).limit(1)
      if (!exame) {
        logger.error(`[examQueue] Exame ${exameId} não encontrado após análise`)
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

        logger.info(`[examQueue] Exame ${exameId} aprovado automaticamente`, { confianca: resultado.confianca, pacienteId })
      } else if (resultado.resultado === 'reagente' || resultado.confianca < EXAM_RULES.LOW_CONFIDENCE_THRESHOLD) {
        // Reactive result or low confidence → flag for medico review
        const novoResultado: ResultadoIa = { ...resultado, status: 'rejeitado_ia' }

        await db.update(exames)
          .set({ resultadoIa: novoResultado })
          .where(eq(exames.id, exameId))

        logger.warn(`[examQueue] Exame ${exameId} rejeitado pela IA`, { resultado: resultado.resultado, confianca: resultado.confianca })
        // TODO: send email/WhatsApp notification to medico
      } else {
        // Inconclusive or unidentified → flag for medico review
        const novoResultado: ResultadoIa = { ...resultado, status: 'pendente_revisao' }

        await db.update(exames)
          .set({ resultadoIa: novoResultado })
          .where(eq(exames.id, exameId))

        logger.warn(`[examQueue] Exame ${exameId} inconclusivo`, { resultado: resultado.resultado, confianca: resultado.confianca })
        // TODO: send email/WhatsApp notification to medico
      }

      return { exameId, resultado: resultado.resultado, status: resultado.status }
    },
    { connection, concurrency: 5 },
  )

  worker.on('failed', (job, err) => {
    logger.error(`[examQueue] Job ${job?.id} falhou`, { error: err.message })
  })

  return worker
}

export async function enqueueAnalisarExame(exameId: number) {
  return examQueue.add('analisar', { exameId }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  })
}
