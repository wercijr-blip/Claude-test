import { z } from 'zod'
import { randomBytes } from 'crypto'
import { router, adminProcedure, protectedProcedure } from '../_core/trpc.ts'
import { TRPCError } from '@trpc/server'
import { hashPassword } from '../_core/auth.ts'
import { sendWelcomeEmail } from '../_core/email.ts'
import { env } from '../_core/env.ts'
import {
  createUser,
  getUserById,
  listDoctorsByClinic,
  updateUser,
} from '../db.ts'

function generateTempPassword(): string {
  return randomBytes(8).toString('base64url') // 11 chars URL-safe aleatório
}

async function assertSameClinic(targetUserId: number, adminClinicId: string | null) {
  if (!adminClinicId) throw new TRPCError({ code: 'FORBIDDEN' })
  const target = await getUserById(targetUserId)
  if (!target) throw new TRPCError({ code: 'NOT_FOUND' })
  if (target.clinicId !== adminClinicId) throw new TRPCError({ code: 'FORBIDDEN' })
  return target
}

export const userRouter = router({
  create: adminProcedure
    .input(z.object({
      name:      z.string().min(2),
      email:     z.string().email(),
      crm:       z.string().min(1),
      specialty: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const tempPassword = generateTempPassword()
      const hash = await hashPassword(tempPassword)
      const id   = await createUser({
        email:              input.email,
        passwordHash:       hash,
        name:               input.name,
        role:               'doctor',
        clinicId:           ctx.user.clinicId,
        specialty:          input.specialty,
        crm:                input.crm,
        active:             1,
        mustChangePassword: 1,
      })
      await sendWelcomeEmail(input.email, input.name, env.MEDSCRIBE_CLINIC_NAME, tempPassword)
      return { id }
    }),

  list: adminProcedure.query(async ({ ctx }) => {
    if (!ctx.user.clinicId) return []
    return listDoctorsByClinic(ctx.user.clinicId)
  }),

  update: adminProcedure
    .input(z.object({
      id:          z.number(),
      name:        z.string().optional(),
      email:       z.string().email().optional(),
      specialty:   z.string().optional(),
      crm:         z.string().optional(),
      newPassword: z.string().min(8).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertSameClinic(input.id, ctx.user.clinicId)
      const { id, newPassword, ...data } = input
      const updateData: Record<string, unknown> = { ...data }
      if (newPassword) updateData.passwordHash = await hashPassword(newPassword)
      await updateUser(id, updateData)
      return { success: true }
    }),

  deactivate: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertSameClinic(input.id, ctx.user.clinicId)
      await updateUser(input.id, { active: 0 })
      return { success: true }
    }),

  reactivate: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertSameClinic(input.id, ctx.user.clinicId)
      await updateUser(input.id, { active: 1 })
      return { success: true }
    }),

  updateBulletinEmail: protectedProcedure
    .input(z.object({ bulletinEmail: z.string().email().or(z.literal('')) }))
    .mutation(async ({ ctx, input }) => {
      await updateUser(ctx.user.id, { bulletinEmail: input.bulletinEmail || null })
      return { success: true }
    }),

  setBulletinEmail: adminProcedure
    .input(z.object({ id: z.number(), bulletinEmail: z.string().email().or(z.literal('')) }))
    .mutation(async ({ ctx, input }) => {
      await assertSameClinic(input.id, ctx.user.clinicId)
      await updateUser(input.id, { bulletinEmail: input.bulletinEmail || null })
      return { success: true }
    }),

  updateBulletinPreference: adminProcedure
    .input(z.object({ id: z.number(), receive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await assertSameClinic(input.id, ctx.user.clinicId)
      await updateUser(input.id, { receiveMonthlyBulletin: input.receive ? 1 : 0 })
      return { success: true }
    }),
})
