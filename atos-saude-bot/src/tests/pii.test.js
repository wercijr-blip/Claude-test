import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { encryptPII, decryptPII } from '../utils/pii.js'

const VALID_KEY = '0'.repeat(64)

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('encryptPII — sem chave', () => {
  beforeEach(() => {
    vi.stubEnv('PII_ENCRYPTION_KEY', '')
  })

  it('sem chave — encryptPII retorna valor original', () => {
    expect(encryptPII('João Silva')).toBe('João Silva')
  })

  it('null e undefined passam sem alteração', () => {
    expect(encryptPII(null)).toBeNull()
    expect(encryptPII(undefined)).toBeUndefined()
  })
})

describe('decryptPII — sem chave', () => {
  beforeEach(() => {
    vi.stubEnv('PII_ENCRYPTION_KEY', '')
  })

  it('sem chave — decryptPII retorna valor original', () => {
    expect(decryptPII('qualquer texto')).toBe('qualquer texto')
  })
})

describe('encryptPII / decryptPII — com chave', () => {
  beforeEach(() => {
    vi.stubEnv('PII_ENCRYPTION_KEY', VALID_KEY)
  })

  it('com chave — roundtrip preserva o valor', () => {
    const original = 'João Silva'
    const encrypted = encryptPII(original)
    const decrypted = decryptPII(encrypted)
    expect(decrypted).toBe(original)
  })

  it('com chave — texto cifrado começa com enc:', () => {
    const encrypted = encryptPII('teste')
    expect(String(encrypted).startsWith('enc:')).toBe(true)
  })

  it('com chave — valores diferentes geram ciphertext diferente (IV aleatório)', () => {
    const c1 = encryptPII('mesmo texto')
    const c2 = encryptPII('mesmo texto')
    expect(c1).not.toBe(c2)
  })

  it('decryptPII sem prefixo enc: retorna original', () => {
    const plain = 'texto sem prefixo'
    expect(decryptPII(plain)).toBe(plain)
  })
})
