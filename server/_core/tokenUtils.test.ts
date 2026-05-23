import { describe, it, expect } from 'vitest'
import { hashToken, generateToken } from './tokenUtils.ts'

describe('hashToken', () => {
  it('produz hash sha256 de 64 caracteres hex', () => {
    const h = hashToken('meu-token-secreto')
    expect(h).toHaveLength(64)
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })

  it('é determinístico para o mesmo input', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'))
  })

  it('inputs diferentes geram hashes diferentes', () => {
    expect(hashToken('token-a')).not.toBe(hashToken('token-b'))
  })
})

describe('generateToken', () => {
  it('gera string hex de 64 caracteres (32 bytes)', () => {
    const tok = generateToken()
    expect(tok).toHaveLength(64)
    expect(tok).toMatch(/^[0-9a-f]{64}$/)
  })

  it('cada chamada gera token único', () => {
    expect(generateToken()).not.toBe(generateToken())
  })
})
