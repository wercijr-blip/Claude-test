import { describe, it, expect, vi } from 'vitest'
import { TRPCError } from '@trpc/server'

vi.mock('./_core/env.ts', () => ({
  env: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-with-at-least-32-chars-here',
    ENCRYPTION_KEY: 'a'.repeat(64),
    CPF_HASH_SALT: 'test-salt-with-at-least-32-chars-here',
    OAUTH_SERVER_URL: 'https://oauth.example.com',
    OWNER_OPEN_ID: 'owner-id',
    VITE_APP_ID: 'facilita-prep',
    AWS_ACCESS_KEY_ID: 'key',
    AWS_SECRET_ACCESS_KEY: 'secret',
    AWS_REGION: 'sa-east-1',
    AWS_S3_BUCKET: 'bucket',
    REDIS_URL: 'redis://localhost:6379',
    FOCUSNFE_ENVIRONMENT: 'homologacao',
    BUILT_IN_FORGE_API_URL: 'https://api.anthropic.com',
    PORT: 3000,
  },
}))

vi.mock('./db.ts', () => ({ db: {} }))

function buildStaffCtx(role: string) {
  return {
    session: { type: 'staff' as const, id: 1, openId: 'test', nome: 'Test', email: null, role: role as 'secretaria' | 'medico' | 'admin' },
    req: {} as never,
  }
}

function buildPatientCtx() {
  return {
    session: { type: 'patient' as const, tokenId: 1, pacienteId: null },
    req: {} as never,
  }
}

function buildNoAuthCtx() {
  return { session: null, req: {} as never }
}

async function testMiddleware(middleware: (opts: { ctx: unknown; next: (opts?: { ctx: unknown }) => Promise<void> }) => Promise<void>, ctx: unknown) {
  let passed = false
  try {
    await middleware({ ctx, next: async () => { passed = true } })
  } catch (e) {
    if (e instanceof TRPCError) throw e
    throw e
  }
  return passed
}

describe('staffProcedure', () => {
  it('permite secretaria', async () => {
    const { staffProcedure } = await import('./_core/trpc.ts')
    const mw = (staffProcedure as unknown as { _def: { middlewares: Array<(opts: unknown) => Promise<unknown>> } })._def.middlewares[0]!
    const passed = await testMiddleware(mw as never, buildStaffCtx('secretaria'))
    expect(passed).toBe(true)
  })

  it('bloqueia paciente', async () => {
    const { staffProcedure } = await import('./_core/trpc.ts')
    const mw = (staffProcedure as unknown as { _def: { middlewares: Array<(opts: unknown) => Promise<unknown>> } })._def.middlewares[0]!
    await expect(testMiddleware(mw as never, buildPatientCtx())).rejects.toThrow(TRPCError)
  })

  it('bloqueia unauthenticated', async () => {
    const { staffProcedure } = await import('./_core/trpc.ts')
    const mw = (staffProcedure as unknown as { _def: { middlewares: Array<(opts: unknown) => Promise<unknown>> } })._def.middlewares[0]!
    await expect(testMiddleware(mw as never, buildNoAuthCtx())).rejects.toThrow(TRPCError)
  })
})

describe('medicoProcedure', () => {
  it('permite médico', async () => {
    const { medicoProcedure } = await import('./_core/trpc.ts')
    const mw = (medicoProcedure as unknown as { _def: { middlewares: Array<(opts: unknown) => Promise<unknown>> } })._def.middlewares[0]!
    const passed = await testMiddleware(mw as never, buildStaffCtx('medico'))
    expect(passed).toBe(true)
  })

  it('bloqueia secretaria', async () => {
    const { medicoProcedure } = await import('./_core/trpc.ts')
    const mw = (medicoProcedure as unknown as { _def: { middlewares: Array<(opts: unknown) => Promise<unknown>> } })._def.middlewares[0]!
    await expect(testMiddleware(mw as never, buildStaffCtx('secretaria'))).rejects.toThrow(TRPCError)
  })
})

describe('adminProcedure', () => {
  it('permite admin', async () => {
    const { adminProcedure } = await import('./_core/trpc.ts')
    const mw = (adminProcedure as unknown as { _def: { middlewares: Array<(opts: unknown) => Promise<unknown>> } })._def.middlewares[0]!
    const passed = await testMiddleware(mw as never, buildStaffCtx('admin'))
    expect(passed).toBe(true)
  })

  it('bloqueia médico', async () => {
    const { adminProcedure } = await import('./_core/trpc.ts')
    const mw = (adminProcedure as unknown as { _def: { middlewares: Array<(opts: unknown) => Promise<unknown>> } })._def.middlewares[0]!
    await expect(testMiddleware(mw as never, buildStaffCtx('medico'))).rejects.toThrow(TRPCError)
  })
})
