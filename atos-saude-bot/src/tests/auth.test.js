import { describe, it, expect } from 'vitest'
import { hashPassword, checkPassword, generateToken, verifyToken } from '../services/auth.js'

describe('hashPassword / checkPassword', () => {
  it('verifica senha correta', () => {
    const hash = hashPassword('senha-forte-123')
    expect(checkPassword('senha-forte-123', hash)).toBe(true)
  })

  it('rejeita senha errada', () => {
    const hash = hashPassword('senha-forte-123')
    expect(checkPassword('outra-senha', hash)).toBe(false)
  })

  it('hashes distintos para mesma senha (bcrypt salt)', () => {
    const h1 = hashPassword('abc123')
    const h2 = hashPassword('abc123')
    expect(h1).not.toBe(h2)
    expect(checkPassword('abc123', h1)).toBe(true)
    expect(checkPassword('abc123', h2)).toBe(true)
  })
})

describe('generateToken / verifyToken', () => {
  const user = { id: 1, username: 'admin', role: 'admin', name: 'Administrador' }

  it('gera token verificável com payload correto', () => {
    const token = generateToken(user)
    const payload = verifyToken(token)
    expect(payload).toBeTruthy()
    expect(payload.id).toBe(1)
    expect(payload.username).toBe('admin')
    expect(payload.role).toBe('admin')
  })

  it('retorna null para token inválido', () => {
    expect(verifyToken('token-invalido')).toBeNull()
  })

  it('retorna null para token adulterado', () => {
    const token = generateToken(user)
    const adulterado = token.slice(0, -5) + 'XXXXX'
    expect(verifyToken(adulterado)).toBeNull()
  })

  it('retorna null para string vazia', () => {
    expect(verifyToken('')).toBeNull()
  })

  it('token contém role correta', () => {
    const secretaria = { id: 2, username: 'sec', role: 'secretaria', name: 'Sec' }
    const token = generateToken(secretaria)
    expect(verifyToken(token).role).toBe('secretaria')
  })
})
