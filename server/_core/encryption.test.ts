import { describe, it, expect, vi } from 'vitest'

vi.mock('./env.ts', () => ({
  env: {
    ENCRYPTION_KEY: '0000000000000000000000000000000000000000000000000000000000000000',
    CPF_HASH_SALT: 'test-salt-for-cpf-hashing-minimum-32-chars',
    NODE_ENV: 'test',
  },
}))

import { encrypt, decrypt, hashCpf, safeDecrypt } from './encryption.ts'

describe('encrypt / decrypt', () => {
  it('roundtrip preserva o plaintext original', () => {
    const original = 'João da Silva'
    expect(decrypt(encrypt(original))).toBe(original)
  })

  it('gera ciphertext diferente a cada chamada (IV aleatório)', () => {
    const plain = 'dado sensível'
    expect(encrypt(plain)).not.toBe(encrypt(plain))
  })

  it('lança erro ao descriptografar dado corrompido', () => {
    expect(() => decrypt('dado-corrompido-base64==')).toThrow()
  })

  it('strings vazias são aceitas', () => {
    expect(decrypt(encrypt(''))).toBe('')
  })

  it('preserva caracteres especiais e unicode', () => {
    const original = 'Ângela — 123 @ #'
    expect(decrypt(encrypt(original))).toBe(original)
  })
})

describe('safeDecrypt', () => {
  it('descriptografa valor válido', () => {
    const encrypted = encrypt('João da Silva')
    expect(safeDecrypt(encrypted)).toBe('João da Silva')
  })

  it('retorna fallback padrão para string nula', () => {
    expect(safeDecrypt(null)).toBe('—')
  })

  it('retorna fallback padrão para undefined', () => {
    expect(safeDecrypt(undefined)).toBe('—')
  })

  it('retorna fallback padrão para string vazia', () => {
    expect(safeDecrypt('')).toBe('—')
  })

  it('retorna fallback customizado ao falhar', () => {
    expect(safeDecrypt('dado-invalido', 'N/A')).toBe('N/A')
  })

  it('retorna fallback ao tentar descriptografar dado corrompido', () => {
    expect(safeDecrypt('corrompido-base64==')).toBe('—')
  })
})

describe('hashCpf', () => {
  it('produz hash de 64 caracteres hex', () => {
    expect(hashCpf('12345678909')).toHaveLength(64)
    expect(hashCpf('12345678909')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('é determinístico: mesmo CPF gera mesmo hash', () => {
    expect(hashCpf('12345678909')).toBe(hashCpf('12345678909'))
  })

  it('normaliza formatação antes de hashear', () => {
    expect(hashCpf('123.456.789-09')).toBe(hashCpf('12345678909'))
  })

  it('CPFs diferentes geram hashes diferentes', () => {
    expect(hashCpf('12345678909')).not.toBe(hashCpf('98765432100'))
  })
})
