import { initTRPC, TRPCError } from '@trpc/server'
import type { Context, MedscribeUser } from './context.ts'

const t = initTRPC.context<Context>().create()

export const router           = t.router
export const publicProcedure  = t.procedure

// Requer usuário autenticado (admin ou doctor)
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Não autorizado' })
  }
  return next({ ctx: { ...ctx, user: ctx.user } })
})

// Requer role admin
export const adminProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Não autorizado' })
  }
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Área restrita ao administrador' })
  }
  return next({ ctx: { ...ctx, user: ctx.user as MedscribeUser & { role: 'admin' } } })
})

// Legacy aliases — mantidos para compatibilidade com rotas existentes
export const staffProcedure  = protectedProcedure
export const medicoProcedure = protectedProcedure
