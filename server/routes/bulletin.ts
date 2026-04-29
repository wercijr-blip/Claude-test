import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, adminProcedure } from '../_core/trpc.ts'
import {
  listDoctorsByClinic,
  getBulletinHistory,
  logBulletinSend,
  markBulletinResent,
  getBulletinById,
} from '../db.ts'

export const bulletinRouter = router({
  getDoctors: adminProcedure.query(async ({ ctx }) => {
    if (!ctx.user.clinicId) return []
    return listDoctorsByClinic(ctx.user.clinicId)
  }),

  getHistory: adminProcedure.query(async ({ ctx }) => {
    if (!ctx.user.clinicId) return []
    return getBulletinHistory(ctx.user.clinicId)
  }),

  logSend: adminProcedure
    .input(z.object({
      month:        z.string().regex(/^\d{4}-\d{2}$/, 'Formato: AAAA-MM'),
      doctorCount:  z.number().int().min(0),
      articleCount: z.number().int().min(0),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.clinicId) throw new TRPCError({ code: 'FORBIDDEN' })
      const id = await logBulletinSend({
        clinicId:     ctx.user.clinicId,
        month:        input.month,
        doctorCount:  input.doctorCount,
        articleCount: input.articleCount,
        sentBy:       ctx.user.id,
      })
      return { id }
    }),

  resend: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.clinicId) throw new TRPCError({ code: 'FORBIDDEN' })
      const record = await getBulletinById(input.id, ctx.user.clinicId)
      if (!record) throw new TRPCError({ code: 'NOT_FOUND' })
      await markBulletinResent(input.id)
      return { success: true }
    }),
})
