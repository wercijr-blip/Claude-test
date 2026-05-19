import { z } from 'zod'
import { adminProcedure } from '../../_core/trpc.ts'
import { TRPCError } from '@trpc/server'
import { db } from '../../db.ts'
import { users } from '../../../drizzle/schema.ts'
import { eq, count, isNull, and } from 'drizzle-orm'
import type { Role } from '../../../shared/types.ts'
import { logAudit } from '../../_core/audit.ts'
import { okEmpty } from '../../_core/response.ts'

export const userProcedures = {
  listarUsuarios: adminProcedure.query(async () => {
    return db.select().from(users).where(isNull(users.deletedAt)).orderBy(users.createdAt)
  }),

  cadastrarUsuario: adminProcedure
    .input(z.object({
      email: z.string().email(),
      nome: z.string().min(2),
      role: z.enum(['secretaria', 'medico', 'admin']),
    }))
    .mutation(async ({ input }) => {
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1)

      if (existing.length > 0) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Já existe um usuário com esse e-mail.' })
      }

      await db.insert(users).values({
        openId: `pending:${input.email}`,
        email: input.email,
        nome: input.nome,
        role: input.role as Role,
        ativo: true,
      })

      return okEmpty()
    }),

  alterarRole: adminProcedure
    .input(z.object({ userId: z.number(), role: z.enum(['secretaria', 'medico', 'admin']) }))
    .mutation(async ({ input }) => {
      const [user] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1)
      if (!user) throw new TRPCError({ code: 'NOT_FOUND' })

      await db
        .update(users)
        .set({ role: input.role as Role, updatedAt: new Date() })
        .where(eq(users.id, input.userId))

      return okEmpty()
    }),

  toggleAtivo: adminProcedure
    .input(z.object({ userId: z.number(), ativo: z.boolean() }))
    .mutation(async ({ input }) => {
      await db
        .update(users)
        .set({ ativo: input.ativo, updatedAt: new Date() })
        .where(eq(users.id, input.userId))
      return okEmpty()
    }),

  deletarStaff: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (input.userId === ctx.session.id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Você não pode deletar sua própria conta.' })
      }

      const [target] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1)
      if (!target) throw new TRPCError({ code: 'NOT_FOUND' })
      if (target.deletedAt) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Usuário já foi deletado.' })

      if (target.role === 'admin') {
        const [{ activeTotal }] = await db
          .select({ activeTotal: count() })
          .from(users)
          .where(and(eq(users.role, 'admin'), isNull(users.deletedAt)))
        if (activeTotal <= 1) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Não é possível deletar o último administrador ativo.' })
        }
      }

      await db
        .update(users)
        .set({ deletedAt: new Date(), deletedBy: ctx.session.id, ativo: false, updatedAt: new Date() })
        .where(eq(users.id, input.userId))

      await logAudit({
        actorId: ctx.session.id,
        actorRole: ctx.session.role,
        action: 'admin.user_delete',
        resourceType: 'user',
        resourceId: input.userId,
        detalhes: { targetEmail: target.email, targetRole: target.role },
      })

      return okEmpty()
    }),

  reativarStaff: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const [target] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1)
      if (!target) throw new TRPCError({ code: 'NOT_FOUND' })
      if (!target.deletedAt) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Usuário não está deletado.' })

      await db
        .update(users)
        .set({ deletedAt: null, deletedBy: null, ativo: true, updatedAt: new Date() })
        .where(eq(users.id, input.userId))

      await logAudit({
        actorId: ctx.session.id,
        actorRole: ctx.session.role,
        action: 'admin.user_restore',
        resourceType: 'user',
        resourceId: input.userId,
        detalhes: { targetEmail: target.email, targetRole: target.role },
      })

      return okEmpty()
    }),
}
