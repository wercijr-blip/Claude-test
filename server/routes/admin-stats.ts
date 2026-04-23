import { z } from 'zod'
import { router, adminProcedure } from '../_core/trpc.ts'
import {
  adminGetOverviewStats,
  adminGetConsultationsByPeriod,
  adminGetDoctorRanking,
  adminGetTopDiagnoses,
  adminGetPlatformMetrics,
  adminGetClinicalIndicators,
  adminGetDoctorProfile,
} from '../db.ts'

export const adminStatsRouter = router({
  overview: adminProcedure.query(async ({ ctx }) =>
    adminGetOverviewStats(ctx.user.clinicId ?? '')),

  timeline: adminProcedure
    .input(z.object({ days: z.number().min(7).max(365).default(30) }))
    .query(async ({ ctx, input }) =>
      adminGetConsultationsByPeriod(ctx.user.clinicId ?? '', input.days)),

  byDoctor: adminProcedure.query(async ({ ctx }) =>
    adminGetDoctorRanking(ctx.user.clinicId ?? '')),

  byPathology: adminProcedure
    .input(z.object({ limit: z.number().min(5).max(20).default(10) }))
    .query(async ({ ctx, input }) =>
      adminGetTopDiagnoses(ctx.user.clinicId ?? '', input.limit)),

  platform: adminProcedure.query(async ({ ctx }) =>
    adminGetPlatformMetrics(ctx.user.clinicId ?? '')),

  clinicalIndicators: adminProcedure.query(async ({ ctx }) =>
    adminGetClinicalIndicators(ctx.user.clinicId ?? '')),

  doctorProfile: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ ctx, input }) =>
      adminGetDoctorProfile(ctx.user.clinicId ?? '', input.userId)),
})
