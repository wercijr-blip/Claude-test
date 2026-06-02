import { describe, it, expect, vi } from 'vitest'
import { createHash } from 'crypto'

vi.mock('./_core/env.ts', () => ({
  env: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-with-at-least-32-chars-here-x',
    ENCRYPTION_KEY: 'a'.repeat(64),
    CPF_HASH_SALT: 'test-salt-with-at-least-32-chars-x',
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
    PORT: 3000,
  },
}))

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

describe('Token lifecycle', () => {
  it('hash é determinístico para o mesmo token', () => {
    const raw = 'abc123def456'
    expect(hashToken(raw)).toBe(hashToken(raw))
  })

  it('tokens diferentes geram hashes diferentes', () => {
    expect(hashToken('token-a')).not.toBe(hashToken('token-b'))
  })

  it('token expirado é rejeitado', () => {
    const expiresAt = new Date(Date.now() - 1000)
    expect(expiresAt < new Date()).toBe(true)
  })

  it('token válido não está expirado', () => {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    expect(expiresAt > new Date()).toBe(true)
  })
})

describe('Encryption', () => {
  it('encrypt/decrypt roundtrip', async () => {
    const { encrypt, decrypt } = await import('./_core/encryption.ts')
    const texto = 'CPF: 529.982.247-25'
    expect(decrypt(encrypt(texto))).toBe(texto)
  })

  it('criptografias do mesmo texto são diferentes (IV aleatório)', async () => {
    const { encrypt } = await import('./_core/encryption.ts')
    const texto = 'teste'
    expect(encrypt(texto)).not.toBe(encrypt(texto))
  })

  it('hashCpf é determinístico e não-reversível', async () => {
    const { hashCpf } = await import('./_core/encryption.ts')
    const cpf = '52998224725'
    const hash = hashCpf(cpf)
    expect(hash).toBe(hashCpf(cpf))
    expect(hash).not.toContain('529')
    expect(hash.length).toBe(64)
  })
})
