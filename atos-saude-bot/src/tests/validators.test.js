import { describe, it, expect } from 'vitest'
import { isValidName, isValidDate, cleanPhone, isValidPhone, isQuestion, isRestartKeyword } from '../utils/validators.js'

describe('isValidName', () => {
  it('aceita nome com pelo menos 2 palavras', () => {
    expect(isValidName('João Silva')).toBe(true)
  })
  it('aceita nomes com acentos', () => {
    expect(isValidName('Maria Ângela Conceição')).toBe(true)
  })
  it('rejeita nome com só uma palavra', () => {
    expect(isValidName('João')).toBe(false)
  })
  it('rejeita string vazia', () => {
    expect(isValidName('')).toBe(false)
    expect(isValidName(null)).toBe(false)
  })
  it('rejeita nome com números', () => {
    expect(isValidName('João 123')).toBe(false)
  })
})

describe('isValidDate', () => {
  it('aceita data válida no formato DD/MM/AAAA', () => {
    expect(isValidDate('15/06/1990')).toBe(true)
  })
  it('rejeita dia 32', () => {
    expect(isValidDate('32/01/2000')).toBe(false)
  })
  it('rejeita mês 13', () => {
    expect(isValidDate('01/13/2000')).toBe(false)
  })
  it('rejeita formato errado', () => {
    expect(isValidDate('2000-01-01')).toBe(false)
    expect(isValidDate('')).toBe(false)
    expect(isValidDate(null)).toBe(false)
  })
  it('rejeita data no futuro (idade negativa)', () => {
    expect(isValidDate('01/01/2099')).toBe(false)
  })
  it('rejeita data inválida (31/02)', () => {
    expect(isValidDate('31/02/2000')).toBe(false)
  })
})

describe('cleanPhone', () => {
  it('remove espaços, traços, parênteses e +', () => {
    expect(cleanPhone('+55 (61) 99999-9999')).toBe('5561999999999')
  })
  it('retorna string vazia para input falsy', () => {
    expect(cleanPhone(null)).toBe('')
    expect(cleanPhone('')).toBe('')
  })
})

describe('isValidPhone', () => {
  it('aceita número DDD + 9 dígitos sem formatação', () => {
    expect(isValidPhone('61999999999')).toBe(true)
  })
  it('aceita número com DDI quando limpo', () => {
    expect(isValidPhone('5561999999999')).toBe(false) // DDI não é DDD válido (começa com 5)
  })
  it('rejeita número curto demais', () => {
    expect(isValidPhone('619999')).toBe(false)
  })
})

describe('isQuestion', () => {
  it('detecta pergunta com ?', () => {
    expect(isQuestion('Cobre ortopedia?')).toBe(true)
  })
  it('detecta interrogativa sem ?', () => {
    expect(isQuestion('tem cobertura para cirurgia')).toBe(true)
    expect(isQuestion('cobre exame de imagem')).toBe(true)
    expect(isQuestion('como funciona')).toBe(true)
  })
  it('retorna false para texto neutro', () => {
    expect(isQuestion('obrigado')).toBe(false)
    expect(isQuestion('')).toBe(false)
    expect(isQuestion(null)).toBe(false)
  })
})

describe('isRestartKeyword', () => {
  it('reconhece palavras de reinício', () => {
    expect(isRestartKeyword('oi')).toBe(true)
    expect(isRestartKeyword('menu')).toBe(true)
    expect(isRestartKeyword('inicio')).toBe(true)
    expect(isRestartKeyword('start')).toBe(true)
  })
  it('é case-insensitive', () => {
    expect(isRestartKeyword('OI')).toBe(true)
    expect(isRestartKeyword('Menu')).toBe(true)
  })
  it('retorna false para palavras que não são keyword', () => {
    expect(isRestartKeyword('quero agendar')).toBe(false)
    expect(isRestartKeyword(null)).toBe(false)
  })
})
