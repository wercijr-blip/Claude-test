import { describe, it, expect, beforeEach } from 'vitest'

// Banco em memória para testes
process.env.DB_PATH = ':memory:'
process.env.PII_ENCRYPTION_KEY = '' // desabilita PII para simplificar asserts

const {
  insertAgendamento, getAgendamentos, getAgendamentoById,
  insertSatisfactionResponse, getSatisfactionResponses,
  insertAuthQuery, insertMessageLog, getConversationByPhone,
  deletePatientData, getPatientData,
  revokeToken, isTokenRevoked, cleanupExpiredTokens,
  upsertSession, getSession, clearSession
} = await import('../services/db.js')

const { runMigrations } = await import('../services/migrations.js')

// Garante migrações antes dos testes
runMigrations()

function makeAg(phone = '5561900000001') {
  return insertAgendamento({
    phone, tipo: 'CONSULTA', especialidade: 'Ortopedia',
    medico_nome: 'Dr. Teste', medico_id: 'doc1',
    nome: 'Paciente Teste', nascimento: '1990-01-01',
    telefone_contato: phone
  })
}

describe('getAgendamentos — paginação', () => {
  it('retorna array simples sem paginação', () => {
    const result = getAgendamentos({})
    expect(Array.isArray(result)).toBe(true)
  })

  it('retorna objeto paginado com limit', () => {
    makeAg('5561900000100')
    makeAg('5561900000101')
    const result = getAgendamentos({ limit: 1, offset: 0 })
    expect(result).toHaveProperty('rows')
    expect(result).toHaveProperty('total')
    expect(result.rows.length).toBe(1)
    expect(result.limit).toBe(1)
    expect(result.offset).toBe(0)
  })

  it('offset avança a página', () => {
    makeAg('5561900000200')
    makeAg('5561900000201')
    const p1 = getAgendamentos({ limit: 1, offset: 0 })
    const p2 = getAgendamentos({ limit: 1, offset: 1 })
    expect(p1.rows[0].id).not.toBe(p2.rows[0].id)
  })
})

describe('deletePatientData — LGPD art. 18 III', () => {
  it('remove mensagens, sessão e satisfação do paciente', () => {
    const phone = '5561888000001'
    upsertSession(phone, { step: 'START', flow: 'CONSULTA' })
    insertMessageLog({ phone, direction: 'IN', text: 'olá', flow: 'CONSULTA', step: 'START' })
    insertSatisfactionResponse({ phone, nota: 5, agendamento_id: 1 })

    deletePatientData(phone)

    expect(getSession(phone)).toBeNull()
    expect(getConversationByPhone(phone)).toHaveLength(0)
  })

  it('anonimiza agendamentos em vez de deletar', () => {
    const phone = '5561888000002'
    const id = makeAg(phone)

    deletePatientData(phone)

    const ag = getAgendamentoById(id)
    expect(ag).not.toBeNull()
    expect(ag.nome).toBe('[REMOVIDO]')
    expect(ag.phone).toBeNull()
  })
})

describe('getPatientData — LGPD art. 18 I', () => {
  it('retorna todas as tabelas para o telefone', () => {
    const phone = '5561777000001'
    makeAg(phone)
    insertMessageLog({ phone, direction: 'IN', text: 'teste', flow: 'CONSULTA', step: 'START' })
    insertAuthQuery({ phone, question: 'Cobre?', answer: 'Sim', confidence: 'HIGH' })

    const data = getPatientData(phone)

    expect(data).toHaveProperty('agendamentos')
    expect(data).toHaveProperty('messages_log')
    expect(data).toHaveProperty('satisfaction_responses')
    expect(data).toHaveProperty('authorization_queries')
    expect(data).toHaveProperty('exam_submissions')
    expect(data.agendamentos.length).toBeGreaterThan(0)
    expect(data.messages_log.length).toBeGreaterThan(0)
    expect(data.authorization_queries.length).toBeGreaterThan(0)
  })

  it('retorna arrays vazios para telefone inexistente', () => {
    const data = getPatientData('5500000000000')
    expect(data.agendamentos).toHaveLength(0)
    expect(data.messages_log).toHaveLength(0)
  })
})

describe('revokeToken / isTokenRevoked', () => {
  it('token recém-revogado é detectado como revogado', () => {
    const jti = 'test-jti-abc123'
    const futureISO = new Date(Date.now() + 60_000).toISOString().replace('T', ' ').slice(0, 19)
    revokeToken(jti, futureISO)
    expect(isTokenRevoked(jti)).toBe(true)
  })

  it('token não revogado não aparece como revogado', () => {
    expect(isTokenRevoked('jti-nunca-visto')).toBe(false)
  })

  it('cleanupExpiredTokens remove tokens expirados', () => {
    const jti = 'test-jti-expired'
    const pastISO = new Date(Date.now() - 60_000).toISOString().replace('T', ' ').slice(0, 19)
    revokeToken(jti, pastISO)

    cleanupExpiredTokens()

    // Após limpeza o token expirado não retorna como revogado (expirado)
    expect(isTokenRevoked(jti)).toBe(false)
  })
})

describe('upsertSession / clearSession', () => {
  it('cria sessão nova e recupera', () => {
    const phone = '5561666000001'
    upsertSession(phone, { step: 'NOME', flow: 'CONSULTA' })
    const s = getSession(phone)
    expect(s).not.toBeNull()
    expect(s.step).toBe('NOME')
    expect(s.flow).toBe('CONSULTA')
  })

  it('atualiza sessão existente', () => {
    const phone = '5561666000002'
    upsertSession(phone, { step: 'NOME', flow: 'CONSULTA' })
    upsertSession(phone, { step: 'NASCIMENTO' })
    const s = getSession(phone)
    expect(s.step).toBe('NASCIMENTO')
    expect(s.flow).toBe('CONSULTA')
  })

  it('clearSession remove a sessão', () => {
    const phone = '5561666000003'
    upsertSession(phone, { step: 'START', flow: 'AUTORIZACAO' })
    clearSession(phone)
    expect(getSession(phone)).toBeNull()
  })
})
