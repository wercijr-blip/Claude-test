import { z } from 'zod'
import { TRPCError } from '@trpc/server'
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

function requireClinicId(clinicId: string | null): string {
  if (!clinicId) throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin sem clinicId associada' })
  return clinicId
}

export const adminStatsRouter = router({
  overview: adminProcedure.query(async ({ ctx }) =>
    adminGetOverviewStats(requireClinicId(ctx.user.clinicId))),

  timeline: adminProcedure
    .input(z.object({ days: z.number().min(7).max(365).default(30) }))
    .query(async ({ ctx, input }) =>
      adminGetConsultationsByPeriod(requireClinicId(ctx.user.clinicId), input.days)),

  byDoctor: adminProcedure.query(async ({ ctx }) =>
    adminGetDoctorRanking(requireClinicId(ctx.user.clinicId))),

  byPathology: adminProcedure
    .input(z.object({ limit: z.number().min(5).max(20).default(10) }))
    .query(async ({ ctx, input }) =>
      adminGetTopDiagnoses(requireClinicId(ctx.user.clinicId), input.limit)),

  platform: adminProcedure.query(async ({ ctx }) =>
    adminGetPlatformMetrics(requireClinicId(ctx.user.clinicId))),

  clinicalIndicators: adminProcedure.query(async ({ ctx }) =>
    adminGetClinicalIndicators(requireClinicId(ctx.user.clinicId))),

  doctorProfile: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ ctx, input }) =>
      adminGetDoctorProfile(requireClinicId(ctx.user.clinicId), input.userId)),
})
