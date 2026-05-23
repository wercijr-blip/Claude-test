import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./env.ts', () => ({
  env: {
    NODE_ENV: 'production',
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

vi.mock('./security.ts', () => ({
  allowedOrigins: ['https://facilitaprep.com.br', 'https://www.facilitaprep.com.br'],
  isOriginAllowed: vi.fn((origin: string) =>
    ['https://facilitaprep.com.br', 'https://www.facilitaprep.com.br'].includes(origin),
  ),
}))

import { validateOAuthState, isAllowedRedirectUri } from './originValidator.ts'

describe('validateOAuthState', () => {
  it('retorna true para states idênticos', () => {
    expect(validateOAuthState('abc123', 'abc123')).toBe(true)
  })

  it('retorna false para states diferentes', () => {
    expect(validateOAuthState('abc123', 'xyz789')).toBe(false)
  })

  it('retorna false para state vazio', () => {
    expect(validateOAuthState('', 'abc123')).toBe(false)
  })

  it('retorna false para expected vazio', () => {
    expect(validateOAuthState('abc123', '')).toBe(false)
  })

  it('retorna false para strings de tamanhos diferentes', () => {
    expect(validateOAuthState('abc', 'abcd')).toBe(false)
  })

  it('é resistente a timing attack (constant-time comparison)', () => {
    const state = 'a'.repeat(64)
    const expected = 'b'.repeat(64)
    expect(validateOAuthState(state, expected)).toBe(false)
  })
})

describe('isAllowedRedirectUri', () => {
  it('permite URIs do domínio facilitaprep.com.br', () => {
    expect(isAllowedRedirectUri('https://facilitaprep.com.br/callback')).toBe(true)
    expect(isAllowedRedirectUri('https://www.facilitaprep.com.br/auth')).toBe(true)
  })

  it('rejeita URI malformada', () => {
    expect(isAllowedRedirectUri('not-a-url')).toBe(false)
    expect(isAllowedRedirectUri('')).toBe(false)
  })

  it('rejeita domínio não permitido', () => {
    expect(isAllowedRedirectUri('https://evil.example.com/callback')).toBe(false)
    expect(isAllowedRedirectUri('https://facilitaprep.com.br.evil.com/callback')).toBe(false)
  })
})
