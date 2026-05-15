import { describe, it, expect, vi } from 'vitest'
import { TRPCError } from '@trpc/server'

vi.mock('./_core/env.ts', () => ({
  env: {
    NODE_ENV:              'test',
    JWT_SECRET:            'test-secret-with-at-least-32-chars-here',
    VITE_APP_ID:           'medscrita',
    PORT:                  3000,
    MEDSCRIBE_URL:         'http://localhost:5173',
    MEDSCRIBE_CLINIC_NAME: 'Clínica Teste',
  },
}))

vi.mock('./db.ts', () => ({ db: {} }))

function buildUserCtx(role: 'admin' | 'doctor') {
  return {
    user: {
      id:                     1,
      email:                  'test@test.com',
      name:                   'Test User',
      role,
      clinicId:               'clinic-1',
      specialty:              'Infectologia',
      crm:                    '12345',
      active:                 1,
      mustChangePassword:     0,
      bulletinEmail:          null,
      receiveMonthlyBulletin: 1,
    },
    req:     {} as never,
    res:     {} as never,
  }
}

function buildNoAuthCtx() {
  return { user: null, req: {} as never, res: {} as never }
}

async function testMiddleware(
  middleware: (opts: { ctx: unknown; next: (opts?: { ctx: unknown }) => Promise<void> }) => Promise<void>,
  ctx: unknown,
) {
  let passed = false
  try {
    await middleware({ ctx, next: async () => { passed = true } })
  } catch (e) {
    if (e instanceof TRPCError) throw e
    throw e
  }
  return passed
}

describe('protectedProcedure', () => {
  it('permite doctor autenticado', async () => {
    const { protectedProcedure } = await import('./_core/trpc.ts')
    const mw = (protectedProcedure as unknown as { _def: { middlewares: Array<(opts: unknown) => Promise<unknown>> } })._def.middlewares[0]!
    const passed = await testMiddleware(mw as never, buildUserCtx('doctor'))
    expect(passed).toBe(true)
  })

  it('permite admin autenticado', async () => {
    const { protectedProcedure } = await import('./_core/trpc.ts')
    const mw = (protectedProcedure as unknown as { _def: { middlewares: Array<(opts: unknown) => Promise<unknown>> } })._def.middlewares[0]!
    const passed = await testMiddleware(mw as never, buildUserCtx('admin'))
    expect(passed).toBe(true)
  })

  it('bloqueia unauthenticated', async () => {
    const { protectedProcedure } = await import('./_core/trpc.ts')
    const mw = (protectedProcedure as unknown as { _def: { middlewares: Array<(opts: unknown) => Promise<unknown>> } })._def.middlewares[0]!
    await expect(testMiddleware(mw as never, buildNoAuthCtx())).rejects.toThrow(TRPCError)
  })
})

describe('adminProcedure', () => {
  it('permite admin', async () => {
    const { adminProcedure } = await import('./_core/trpc.ts')
    const mw = (adminProcedure as unknown as { _def: { middlewares: Array<(opts: unknown) => Promise<unknown>> } })._def.middlewares[0]!
    const passed = await testMiddleware(mw as never, buildUserCtx('admin'))
    expect(passed).toBe(true)
  })

  it('bloqueia doctor', async () => {
    const { adminProcedure } = await import('./_core/trpc.ts')
    const mw = (adminProcedure as unknown as { _def: { middlewares: Array<(opts: unknown) => Promise<unknown>> } })._def.middlewares[0]!
    await expect(testMiddleware(mw as never, buildUserCtx('doctor'))).rejects.toThrow(TRPCError)
  })

  it('bloqueia unauthenticated', async () => {
    const { adminProcedure } = await import('./_core/trpc.ts')
    const mw = (adminProcedure as unknown as { _def: { middlewares: Array<(opts: unknown) => Promise<unknown>> } })._def.middlewares[0]!
    await expect(testMiddleware(mw as never, buildNoAuthCtx())).rejects.toThrow(TRPCError)
  })
})
