import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure, adminProcedure } from '../_core/trpc.ts'
import {
  createKnowledgeTopic,
  listKnowledgeTopicsForClinic,
  updateKnowledgeTopicStatus,
  deleteKnowledgeTopic,
} from '../db.ts'

export const knowledgeTopicRouter = router({
  list: protectedProcedure
    .input(z.object({
      status:            z.enum(['pending', 'sent', 'done']).optional(),
      userId:            z.number().optional(),
      medicalSpecialty:  z.string().optional(),
      specialtyCategory: z.string().optional(),
      dateFrom:          z.string().optional(),
      dateTo:            z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const clinicId = ctx.user.clinicId
      if (!clinicId) return []
      return listKnowledgeTopicsForClinic(clinicId, input ?? {})
    }),

  addManual: adminProcedure
    .input(z.object({
      topic:             z.string().min(3),
      pubmedQuery:       z.string().optional(),
      medicalSpecialty:  z.string().optional(),
      specialtyCategory: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.clinicId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Admin sem clinicId' })
      }
      const id = await createKnowledgeTopic({
        topic:             input.topic,
        pubmedQuery:       input.pubmedQuery ?? null,
        source:            'manual',
        status:            'pending',
        clinicId:          ctx.user.clinicId,
        visibility:        'clinic',
        sharedBy:          ctx.user.id,
        medicalSpecialty:  input.medicalSpecialty ?? null,
        specialtyCategory: input.specialtyCategory ?? null,
      })
      return { id }
    }),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.number(), status: z.enum(['pending', 'sent', 'done']) }))
    .mutation(async ({ input }) => {
      await updateKnowledgeTopicStatus(input.id, input.status)
      return { success: true }
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteKnowledgeTopic(input.id)
      return { success: true }
    }),
})
