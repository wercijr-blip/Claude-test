import { z } from 'zod'
import { router, adminProcedure } from '../_core/trpc.ts'
import { listDoctorsByClinic } from '../db.ts'

export const bulletinRouter = router({
  getDoctors: adminProcedure.query(async ({ ctx }) => {
    if (!ctx.user.clinicId) return []
    return listDoctorsByClinic(ctx.user.clinicId)
  }),

  getHistory: adminProcedure.query(async () => {
    return []
  }),

  logSend: adminProcedure
    .input(z.object({
      month:        z.string(),
      doctorCount:  z.number(),
      articleCount: z.number(),
    }))
    .mutation(async () => {
      return { success: true }
    }),

  resend: adminProcedure
    .input(z.object({ month: z.string() }))
    .mutation(async () => {
      return { success: true }
    }),
})
