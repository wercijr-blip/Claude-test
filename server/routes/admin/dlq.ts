import { z } from 'zod'
import { adminProcedure } from '../../_core/trpc.ts'
import { TRPCError } from '@trpc/server'
import { db } from '../../db.ts'
import { dlqJobs } from '../../../drizzle/schema.ts'
import { eq, desc } from 'drizzle-orm'

export const dlqProcedures = {
  listarDlq: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(20) }))
    .query(async ({ input }) => {
      return db
        .select()
        .from(dlqJobs)
        .orderBy(desc(dlqJobs.createdAt))
        .limit(input.limit)
    }),

  reprocessarDlqJob: adminProcedure
    .input(z.object({ jobId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const [job] = await db
        .select()
        .from(dlqJobs)
        .where(eq(dlqJobs.id, input.jobId))
        .limit(1)
      if (!job) throw new TRPCError({ code: 'NOT_FOUND', message: 'Job não encontrado na DLQ' })

      if (job.reprocessingAt && Date.now() - job.reprocessingAt.getTime() < 5 * 60 * 1000) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Job já está sendo reprocessado' })
      }

      await db.update(dlqJobs).set({ reprocessingAt: new Date() }).where(eq(dlqJobs.id, input.jobId))

      if (job.queue === 'exam-analysis') {
        const { enqueueAnalisarExame } = await import('../../examQueue.ts')
        // ECF.02 — pass actorId so the SBIS session records the requesting physician
        await enqueueAnalisarExame((job.data as { exameId: number }).exameId, undefined, true, ctx.session.id)
      } else if (job.queue === 'pdf-generation') {
        const { enqueueGerarPdf } = await import('../../pdfQueue.ts')
        await enqueueGerarPdf((job.data as { pacienteId: number }).pacienteId)
      }

      await db.delete(dlqJobs).where(eq(dlqJobs.id, input.jobId))

      return { ok: true, queue: job.queue, jobId: job.jobId }
    }),
}
