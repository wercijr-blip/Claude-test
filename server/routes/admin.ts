import { z } from 'zod'
import { router, adminProcedure } from '../_core/trpc.ts'
import { TRPCError } from '@trpc/server'
import { db } from '../db.ts'
import { users, securityEvents } from '../../drizzle/schema.ts'
import { eq, desc } from 'drizzle-orm'
import type { Role } from '../../shared/types.ts'

export const adminRouter = router({
  // Listar equipe
  listarUsuarios: adminProcedure.query(async () => {
    return db.select().from(users).orderBy(users.createdAt)
  }),

  // Alterar role de usuário
  alterarRole: adminProcedure
    .input(z.object({ userId: z.number(), role: z.enum(['secretaria', 'medico', 'admin']) }))
    .mutation(async ({ input }) => {
      const [user] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1)
      if (!user) throw new TRPCError({ code: 'NOT_FOUND' })

      await db
        .update(users)
        .set({ role: input.role as Role, updatedAt: new Date() })
        .where(eq(users.id, input.userId))

      return { ok: true }
    }),

  // Ativar/desativar usuário
  toggleAtivo: adminProcedure
    .input(z.object({ userId: z.number(), ativo: z.boolean() }))
    .mutation(async ({ input }) => {
      await db
        .update(users)
        .set({ ativo: input.ativo, updatedAt: new Date() })
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
