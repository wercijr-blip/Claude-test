import { z } from 'zod'
import { router, adminProcedure } from '../_core/trpc.ts'
import { TRPCError } from '@trpc/server'
import { db } from '../db.ts'
import { users, securityEvents } from '../../drizzle/schema.ts'
import { eq, desc, and } from 'drizzle-orm'

export const adminRouter = router({
  // Listar equipe — apenas da própria clínica
  listarUsuarios: adminProcedure.query(async ({ ctx }) => {
    if (!ctx.user.clinicId) return []
    return db
      .select()
      .from(users)
      .where(eq(users.clinicId, ctx.user.clinicId))
      .orderBy(users.createdAt)
  }),

  // Alterar role de usuário — apenas da própria clínica
  alterarRole: adminProcedure
    .input(z.object({ userId: z.number(), role: z.enum(['admin', 'doctor']) }))
    .mutation(async ({ ctx, input }) => {
      const [user] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, input.userId), eq(users.clinicId, ctx.user.clinicId ?? '')))
        .limit(1)
      if (!user) throw new TRPCError({ code: 'NOT_FOUND' })

      await db
        .update(users)
        .set({ role: input.role, updatedAt: new Date() })
        .where(eq(users.id, input.userId))

      return { ok: true }
    }),

  // Ativar/desativar usuário — usa campo `active` (int), apenas da própria clínica
  toggleAtivo: adminProcedure
    .input(z.object({ userId: z.number(), ativo: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [user] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, input.userId), eq(users.clinicId, ctx.user.clinicId ?? '')))
        .limit(1)
      if (!user) throw new TRPCError({ code: 'NOT_FOUND' })

      await db
        .update(users)
        .set({ active: input.ativo ? 1 : 0, updatedAt: new Date() })
        .where(eq(users.id, input.userId))
      return { ok: true }
    }),

  // Log de eventos de segurança
  listarEventos: adminProcedure
    .input(z.object({ limit: z.number().max(200).default(50) }))
    .query(async ({ input }) => {
      return db
        .select()
        .from(securityEvents)
        .orderBy(desc(securityEvents.createdAt))
        .limit(input.limit)
    }),
})
