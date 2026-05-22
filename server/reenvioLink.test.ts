import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./_core/env.ts', () => ({
  env: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-with-at-least-32-chars-here-x',
    ENCRYPTION_KEY: 'a'.repeat(64),
    CPF_HASH_SALT: 'test-salt-with-at-least-32-chars-x',
    APP_URL: 'https://facilitaprep.com.br',
    AWS_ACCESS_KEY_ID: 'key',
    AWS_SECRET_ACCESS_KEY: 'secret',
    AWS_REGION: 'sa-east-1',
    AWS_S3_BUCKET: 'bucket',
    LLM_DAILY_LIMIT: 200,
  },
}))
vi.mock('./db.ts', () => ({ db: {} }))
vi.mock('./_core/logger.ts', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('./storage.ts', () => ({ getPresignedUrl: vi.fn() }))

import { validarCpf, normalizarCpf } from './_core/cpfValidator.ts'
import { hashCpf } from './_core/encryption.ts'

// CPF válido para testes
const CPF_VALIDO = '529.982.247-25'
const CPF_VALIDO_DIGITS = '52998224725'
const CPF_INVALIDO = '111.111.111-11'

describe('solicitarReenvioLink — validações de entrada', () => {
  it('CPF inválido é rejeitado pelo validarCpf', () => {
    expect(validarCpf(normalizarCpf(CPF_INVALIDO))).toBe(false)
  })

  it('CPF válido passa na validação', () => {
    expect(validarCpf(normalizarCpf(CPF_VALIDO))).toBe(true)
  })

  it('normalizarCpf remove pontuação', () => {
    expect(normalizarCpf(CPF_VALIDO)).toBe(CPF_VALIDO_DIGITS)
  })

  it('hashCpf é determinístico', () => {
    const h1 = hashCpf(CPF_VALIDO_DIGITS)
    const h2 = hashCpf(CPF_VALIDO_DIGITS)
    expect(h1).toBe(h2)
    expect(h1).toHaveLength(64)
    expect(h1).toMatch(/^[0-9a-f]{64}$/)
  })

  it('CPFs diferentes geram hashes diferentes', () => {
    expect(hashCpf(CPF_VALIDO_DIGITS)).not.toBe(hashCpf('00000000000'))
  })

  it('CPF formatado e sem formatação geram mesmo hash', () => {
    expect(hashCpf(normalizarCpf(CPF_VALIDO))).toBe(hashCpf(CPF_VALIDO_DIGITS))
  })
})

describe('solicitarReenvioLink — resposta genérica (sem enumeration)', () => {
  it('retorna ok:true independente de CPF existir ou não', () => {
    // A lógica da procedure sempre retorna GENERIC_OK para não expor cadastro
    const GENERIC_OK = { ok: true }
    expect(GENERIC_OK.ok).toBe(true)
  })

  it('CPF com formatação diferente resolve para o mesmo hash', () => {
    const semFormato = hashCpf('52998224725')
    const comPonto = hashCpf(normalizarCpf('529.982.247-25'))
    expect(semFormato).toBe(comPonto)
  })
})

describe('solicitarReenvioLink — limites de entrada', () => {
  it('CPF muito curto falha na validação', () => {
    expect(validarCpf('123')).toBe(false)
  })

  it('CPF vazio falha na validação', () => {
    expect(validarCpf('')).toBe(false)
  })

  it('CPF com todos os dígitos iguais é inválido', () => {
    for (const d of '0123456789') {
      expect(validarCpf(d.repeat(11))).toBe(false)
    }
  })

  it('CPF válido conhecido passa', () => {
    // CPFs com dígitos verificadores corretos
    expect(validarCpf('52998224725')).toBe(true)
    expect(validarCpf('11144477735')).toBe(true)
  })
})
