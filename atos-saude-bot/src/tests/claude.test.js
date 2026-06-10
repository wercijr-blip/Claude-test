import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted garante que as variáveis existam quando vi.mock é avaliado (hoisting)
const mockCreate = vi.hoisted(() => vi.fn())

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(() => ({ messages: { create: mockCreate } }))
}))

vi.mock('../services/knowledge.js', () => ({
  searchKnowledge: vi.fn()
}))

vi.mock('../services/db.js', () => ({
  insertAuthQuery: vi.fn().mockResolvedValue(undefined)
}))

// Elimina os delays reais de retry nos testes — comportamento de erro é o que importa
vi.mock('../utils/retry.js', () => ({
  withRetry: vi.fn(async (fn) => fn())
}))

const { answerAuthorizationQuestion } = await import('../services/claude.js')
const { searchKnowledge } = await import('../services/knowledge.js')
const { insertAuthQuery } = await import('../services/db.js')

describe('answerAuthorizationQuestion', () => {
  beforeEach(() => {
    mockCreate.mockReset()
    vi.mocked(searchKnowledge).mockReset()
    vi.mocked(insertAuthQuery).mockReset()
    vi.mocked(insertAuthQuery).mockResolvedValue(undefined)
  })

  it('retorna LOW confidence e não chama API quando não há contexto na base', async () => {
    vi.mocked(searchKnowledge).mockReturnValue('')

    const result = await answerAuthorizationQuestion('5561999999999', 'Cobre ortopedia?')

    expect(result.confidence).toBe('LOW')
    expect(result.answer).toBeNull()
    expect(mockCreate).not.toHaveBeenCalled()
    expect(insertAuthQuery).toHaveBeenCalledWith(
      expect.objectContaining({ confidence: 'LOW', answer: null })
    )
  })

  it('retorna HIGH confidence quando API responde com texto válido', async () => {
    vi.mocked(searchKnowledge).mockReturnValue('Plano X cobre consultas de ortopedia com encaminhamento.')
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Sim, cobre. Apresente o cartão e encaminhamento.' }]
    })

    const result = await answerAuthorizationQuestion('5561999999999', 'Cobre ortopedia?')

    expect(result.confidence).toBe('HIGH')
    expect(result.answer).toBe('Sim, cobre. Apresente o cartão e encaminhamento.')
    expect(insertAuthQuery).toHaveBeenCalledWith(
      expect.objectContaining({ confidence: 'HIGH' })
    )
  })

  it('retorna LOW confidence quando API responde NAO_SEI', async () => {
    vi.mocked(searchKnowledge).mockReturnValue('Algum conteúdo disponível na base.')
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'NAO_SEI' }]
    })

    const result = await answerAuthorizationQuestion('5561999999999', 'Pergunta sem resposta?')

    expect(result.confidence).toBe('LOW')
    expect(result.answer).toBeNull()
  })

  it('retorna LOW confidence quando a API Claude lança erro (timeout etc)', async () => {
    vi.mocked(searchKnowledge).mockReturnValue('Contexto com conteúdo válido disponível.')
    mockCreate.mockRejectedValue(new Error('Request timeout'))

    const result = await answerAuthorizationQuestion('5561999999999', 'Pergunta qualquer?')

    expect(result.confidence).toBe('LOW')
    expect(result.answer).toBeNull()
    expect(insertAuthQuery).toHaveBeenCalledWith(
      expect.objectContaining({ confidence: 'LOW', answer: null })
    )
  })

  it('sempre registra a consulta no banco — mesmo sem contexto', async () => {
    vi.mocked(searchKnowledge).mockReturnValue('')

    await answerAuthorizationQuestion('5561999999999', 'Qualquer pergunta')

    expect(insertAuthQuery).toHaveBeenCalledTimes(1)
    expect(insertAuthQuery).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '5561999999999', question: 'Qualquer pergunta' })
    )
  })

  it('passa a pergunta do usuário como mensagem para a API', async () => {
    const pergunta = 'Precisa de guia para ressonância?'
    vi.mocked(searchKnowledge).mockReturnValue('Documento com cobertura de exames de imagem.')
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'Sim, precisa de guia médico.' }] })

    await answerAuthorizationQuestion('5561999999999', pergunta)

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'user', content: pergunta })
        ])
      })
    )
  })
})
