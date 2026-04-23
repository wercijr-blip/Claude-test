import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure, protectedProcedure } from '../_core/trpc.ts'
import {
  hashPassword,
  verifyPassword,
  signToken,
  COOKIE_NAME,
  getSessionCookieOptions,
} from '../_core/auth.ts'
import { getUserByEmail, getUserById, updateUser } from '../db.ts'

export const authRouter = router({
  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await getUserByEmail(input.email)
      if (!user || !user.active) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Credenciais inválidas' })
      }

      const ok = await verifyPassword(input.password, user.passwordHash ?? '')
      if (!ok) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Credenciais inválidas' })
      }

      const token = await signToken({ userId: user.id, role: user.role })
      ctx.res.cookie(COOKIE_NAME, token, getSessionCookieOptions(ctx.req))

      return {
        mustChangePassword: !!user.mustChangePassword,
        role:               user.role,
      }
    }),

  logout: publicProcedure.mutation(({ ctx }) => {
    ctx.res.clearCookie(COOKIE_NAME, { path: '/' })
    return { success: true }
  }),

  me: publicProcedure.query(({ ctx }) => ctx.user ?? null),

  changePassword: protectedProcedure
    .input(z.object({
      currentPassword: z.string(),
      newPassword:     z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await getUserById(ctx.user.id)
      if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário não encontrado' })

      const ok = await verifyPassword(input.currentPassword, user.passwordHash ?? '')
      if (!ok) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Senha atual incorreta' })
      }

      const hash = await hashPassword(input.newPassword)
      await updateUser(user.id, { passwordHash: hash, mustChangePassword: 0 })

      return { success: true }
    }),
})
