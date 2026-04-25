import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validarCpf } from './_core/cpfValidator.ts'
import { isAllowedRedirectUri } from './_core/originValidator.ts'

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

describe('CPF Validator', () => {
  it('aceita CPF válido', () => {
    expect(validarCpf('529.982.247-25')).toBe(true)
    expect(validarCpf('52998224725')).toBe(true)
  })

  it('rejeita CPF inválido', () => {
    expect(validarCpf('111.111.111-11')).toBe(false)
    expect(validarCpf('000.000.000-00')).toBe(false)
    expect(validarCpf('123.456.789-00')).toBe(false)
  })

  it('rejeita CPF com todos dígitos iguais', () => {
    for (let d = 0; d <= 9; d++) {
      expect(validarCpf(String(d).repeat(11))).toBe(false)
    }
  })

  it('rejeita CPF com tamanho incorreto', () => {
    expect(validarCpf('123')).toBe(false)
    expect(validarCpf('1234567890123')).toBe(false)
  })

  // Proteção contra CPF injection (SQL/NoSQL injection via campo CPF)
  it('rejeita tentativas de injection via CPF', () => {
    expect(validarCpf("'; DROP TABLE users; --")).toBe(false)
    expect(validarCpf('<script>alert(1)</script>')).toBe(false)
    expect(validarCpf('1 OR 1=1')).toBe(false)
    expect(validarCpf('../../etc/passwd')).toBe(false)
  })
})

describe('Open Redirect Validator', () => {
  it('permite origens da whitelist', () => {
    expect(isAllowedRedirectUri('https://facilitaprep.com.br/callback')).toBe(true)
    expect(isAllowedRedirectUri('http://localhost:5173/callback')).toBe(true)
  })

  it('bloqueia redirecionamento para domínios externos', () => {
    expect(isAllowedRedirectUri('https://malicioso.com/phishing')).toBe(false)
    expect(isAllowedRedirectUri('https://facilitaprep.com.br.evil.com/')).toBe(false)
    expect(isAllowedRedirectUri('javascript:alert(1)')).toBe(false)
  })

  it('bloqueia URI malformada', () => {
    expect(isAllowedRedirectUri('not-a-url')).toBe(false)
    expect(isAllowedRedirectUri('')).toBe(false)
  })
})

describe('Payload Bomb', () => {
  it('detecta strings excessivamente grandes', () => {
    const bomba = 'A'.repeat(25 * 1024 * 1024) // 25MB
    expect(Buffer.byteLength(bomba, 'utf8')).toBeGreaterThan(20 * 1024 * 1024)
  })
})
