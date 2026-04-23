import { initTRPC, TRPCError } from '@trpc/server'
import type { Context } from './context.ts'
import type { AuthUser } from '../../shared/types.ts'
import { env } from './env.ts'

const t = initTRPC.context<Context>().create()

export const router = t.router
export const publicProcedure = t.procedure

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Não autorizado' })
  }
  return next({ ctx: { ...ctx, session: ctx.session } })
})

export const staffProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session || ctx.session.type !== 'staff') {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  const role = ctx.session.role
  if (!['secretaria', 'medico', 'admin'].includes(role)) {
    throw new TRPCError({ code: 'FORBIDDEN' })
  }
  return next({ ctx: { ...ctx, session: ctx.session as AuthUser } })
})

export const medicoProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session || ctx.session.type !== 'staff') {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  const role = ctx.session.role
  if (!['medico', 'admin'].includes(role)) {
    throw new TRPCError({ code: 'FORBIDDEN' })
  }
  return next({ ctx: { ...ctx, session: ctx.session as AuthUser } })
})

export const adminProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session || ctx.session.type !== 'staff') {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  if (ctx.session.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN' })
  }
  return next({ ctx: { ...ctx, session: ctx.session as AuthUser } })
})

// Autenticação via API key para chamadas internas do n8n
export const n8nProcedure = t.procedure.use(({ ctx, next }) => {
  const apiKey = ctx.req.headers['x-n8n-api-key']
  if (!apiKey || !env.N8N_MEDSCRIBE_KEY || apiKey !== env.N8N_MEDSCRIBE_KEY) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'API key n8n inválida ou ausente' })
  }
  return next({ ctx })
})
