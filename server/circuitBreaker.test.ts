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

vi.mock('./_core/logger.ts', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { withCircuitBreaker, getCircuitStatus } from './_core/circuitBreaker.ts'

describe('withCircuitBreaker — circuito fechado', () => {
  it('executa a função e retorna o resultado', async () => {
    const result = await withCircuitBreaker('cb-ok', async () => 42)
    expect(result).toBe(42)
  })

  it('propaga exceção quando a função lança', async () => {
    await expect(
      withCircuitBreaker('cb-fail-once', async () => { throw new Error('boom') }),
    ).rejects.toThrow('boom')
  })

  it('status inicial: fechado com zero falhas', () => {
    const status = getCircuitStatus('cb-virgin')
    expect(status.open).toBe(false)
    expect(status.failures).toBe(0)
  })
})

describe('withCircuitBreaker — abertura por falhas consecutivas', () => {
  it('abre o circuito após atingir o threshold', async () => {
    const name = `cb-open-${Math.random()}`
    const opts = { threshold: 3, resetMs: 60_000 }
    const fail = () => withCircuitBreaker(name, async () => { throw new Error('fail') }, opts).catch(() => {})
    await fail()
    await fail()
    await fail()
    expect(getCircuitStatus(name).open).toBe(true)
  })

  it('circuito aberto lança erro sem chamar fn', async () => {
    const name = `cb-short-${Math.random()}`
    const opts = { threshold: 2, resetMs: 60_000 }
    const fn = vi.fn().mockRejectedValue(new Error('fail'))
    await withCircuitBreaker(name, fn, opts).catch(() => {})
    await withCircuitBreaker(name, fn, opts).catch(() => {})
    fn.mockClear()
    await expect(withCircuitBreaker(name, fn, opts)).rejects.toThrow('aberto')
    expect(fn).not.toHaveBeenCalled()
  })
})

describe('withCircuitBreaker — recovery', () => {
  it('conta falhas acumuladas corretamente', async () => {
    const name = `cb-count-${Math.random()}`
    const opts = { threshold: 5, resetMs: 60_000 }
    for (let i = 0; i < 3; i++) {
      await withCircuitBreaker(name, async () => { throw new Error('fail') }, opts).catch(() => {})
    }
    expect(getCircuitStatus(name).failures).toBe(3)
    expect(getCircuitStatus(name).open).toBe(false)
  })

  it('sucesso após falhas reseta o contador', async () => {
    const name = `cb-reset-${Math.random()}`
    const opts = { threshold: 5, resetMs: 60_000 }
    await withCircuitBreaker(name, async () => { throw new Error('fail') }, opts).catch(() => {})
    await withCircuitBreaker(name, async () => 'ok', opts)
    expect(getCircuitStatus(name).failures).toBe(0)
  })
})
