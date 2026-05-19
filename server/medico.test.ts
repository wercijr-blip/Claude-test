import { describe, it, expect, vi } from 'vitest'

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
    ASAAS_ENV: 'sandbox',
    BUILT_IN_FORGE_API_URL: 'https://api.anthropic.com',
    APP_URL: 'https://facilitaprep.com.br',
    PORT: 3000,
  },
}))

vi.mock('./db.ts', () => ({ db: {} }))
vi.mock('./storage.ts', () => ({ getPresignedUrl: vi.fn(), uploadBuffer: vi.fn() }))

import { TRPCError } from '@trpc/server'

type MwOpts = { ctx: unknown; next: () => Promise<void> }
type Mw = (opts: MwOpts) => Promise<void>

async function callMw(mw: Mw, ctx: unknown): Promise<boolean> {
  let passed = false
  await (mw as Mw)({ ctx, next: async () => { passed = true } })
  return passed
}

describe('medicoProcedure — controle de acesso por role', () => {
  it('permite role medico', async () => {
    const { medicoProcedure } = await import('./_core/trpc.ts')
    const mw = (medicoProcedure as unknown as { _def: { middlewares: Array<(opts: unknown) => Promise<unknown>> } })._def.middlewares[0]! as unknown as Mw
    const passed = await callMw(mw, { session: { type: 'staff', id: 1, openId: 'test', nome: 'Dr.', email: null, role: 'medico' }, req: {} as never })
    expect(passed).toBe(true)
  })

  it('permite role admin acessar medicoProcedure', async () => {
    const { medicoProcedure } = await import('./_core/trpc.ts')
    const mw = (medicoProcedure as unknown as { _def: { middlewares: Array<(opts: unknown) => Promise<unknown>> } })._def.middlewares[0]! as unknown as Mw
    const passed = await callMw(mw, { session: { type: 'staff', id: 1, openId: 'test', nome: 'Admin', email: null, role: 'admin' }, req: {} as never })
    expect(passed).toBe(true)
  })

  it('bloqueia secretaria de acessar medicoProcedure', async () => {
    const { medicoProcedure } = await import('./_core/trpc.ts')
    const mw = (medicoProcedure as unknown as { _def: { middlewares: Array<(opts: unknown) => Promise<unknown>> } })._def.middlewares[0]! as unknown as Mw
    await expect(
      callMw(mw, { session: { type: 'staff', id: 1, openId: 'test', nome: 'Sec', email: null, role: 'secretaria' }, req: {} as never })
    ).rejects.toThrow(TRPCError)
  })

  it('bloqueia sessão não autenticada', async () => {
    const { medicoProcedure } = await import('./_core/trpc.ts')
    const mw = (medicoProcedure as unknown as { _def: { middlewares: Array<(opts: unknown) => Promise<unknown>> } })._def.middlewares[0]! as unknown as Mw
    await expect(
      callMw(mw, { session: null, req: {} as never })
    ).rejects.toThrow(TRPCError)
  })
})
