import { describe, it, expect, vi } from 'vitest'

vi.mock('./_core/env.ts', () => ({
  env: {
    NODE_ENV: 'test',
    BUILT_IN_FORGE_API_URL: 'https://api.anthropic.com',
    BUILT_IN_FORGE_API_KEY: 'test-key',
    AWS_ACCESS_KEY_ID: 'key',
    AWS_SECRET_ACCESS_KEY: 'secret',
    AWS_REGION: 'sa-east-1',
    AWS_S3_BUCKET: 'bucket',
    LLM_DAILY_LIMIT: 200,
  },
}))
vi.mock('./storage.ts', () => ({ getPresignedUrl: vi.fn() }))
vi.mock('./_core/logger.ts', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('./db.ts', () => ({ db: {} }))

import { calcularSimilaridadeNome, parseDateBR, isDataValida } from './examValidation.ts'

describe('calcularSimilaridadeNome', () => {
  it('nome idêntico retorna 1', () => {
    expect(calcularSimilaridadeNome('João Silva', 'João Silva')).toBe(1)
  })

  it('nome com acento vs. sem acento retorna alta similaridade', () => {
    const sim = calcularSimilaridadeNome('Joao Silva', 'João Silva')
    expect(sim).toBeGreaterThanOrEqual(0.9)
  })

  it('primeiro nome diferente retorna 0', () => {
    expect(calcularSimilaridadeNome('Maria Silva', 'João Silva')).toBe(0)
  })

  it('sobrenome abreviado aceito', () => {
    const sim = calcularSimilaridadeNome('João S', 'João Silva')
    expect(sim).toBeGreaterThan(0)
  })

  it('string vazia retorna 0', () => {
    expect(calcularSimilaridadeNome('', 'João Silva')).toBe(0)
    expect(calcularSimilaridadeNome('João Silva', '')).toBe(0)
  })

  it('ignora stopwords (de, da, do)', () => {
    const sim = calcularSimilaridadeNome('João da Silva', 'João Silva')
    expect(sim).toBeGreaterThan(0)
  })
})

describe('parseDateBR', () => {
  it('parseia DD/MM/AAAA', () => {
    const d = parseDateBR('24/04/2026')
    expect(d).not.toBeNull()
    expect(d!.getUTCFullYear()).toBe(2026)
    expect(d!.getUTCMonth()).toBe(3) // 0-indexed
    expect(d!.getUTCDate()).toBe(24)
  })

  it('parseia data com sufixo de horário', () => {
    const d = parseDateBR('24/04/2026 - 13:16:00')
    expect(d).not.toBeNull()
    expect(d!.getUTCDate()).toBe(24)
  })

  it('retorna null para string inválida', () => {
    expect(parseDateBR('invalid')).toBeNull()
  })

  it('retorna null para string vazia', () => {
    expect(parseDateBR('')).toBeNull()
  })

  it('parseia datas de um dígito DD/M/AAAA', () => {
    const d = parseDateBR('1/1/2026')
    expect(d).not.toBeNull()
    expect(d!.getUTCDate()).toBe(1)
    expect(d!.getUTCMonth()).toBe(0)
  })
})

describe('isDataValida', () => {
  it('retorna false para null', () => {
    expect(isDataValida(null)).toBe(false)
  })

  it('retorna false para data futura', () => {
    const amanha = new Date(Date.now() + 2 * 86_400_000)
    expect(isDataValida(amanha)).toBe(false)
  })

  it('retorna false para data muito antiga (> 7 dias)', () => {
    const velha = new Date(Date.UTC(2020, 0, 1))
    expect(isDataValida(velha)).toBe(false)
  })

  it('retorna true para hoje', () => {
    const hojeSP = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date())
    const [y, m, d] = hojeSP.split('-').map(Number)
    const hojeBR = new Date(Date.UTC(y, m - 1, d))
    expect(isDataValida(hojeBR)).toBe(true)
  })

  it('aceita diasMaximos customizado', () => {
    const velha = new Date(Date.UTC(2020, 0, 1))
    expect(isDataValida(velha, 365 * 100)).toBe(true)
  })
})
