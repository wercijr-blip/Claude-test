import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocks para isolar o handler de dependências externas
vi.mock('../services/whatsapp.js', () => ({ sendText: vi.fn().mockResolvedValue(true) }))
vi.mock('../handlers/router.js', () => ({ router: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../utils/sse.js', () => ({ broadcastSSE: vi.fn() }))

const { handleWebhook } = await import('../webhook/handler.js')
const { router } = await import('../handlers/router.js')
const { sendText } = await import('../services/whatsapp.js')

function makeReq(overrides = {}) {
  return {
    headers: {},
    body: {
      event: 'messages.upsert',
      data: {
        messages: [{
          key: { remoteJid: '5561999999999@s.whatsapp.net', fromMe: false },
          message: { conversation: 'oi' },
          pushName: 'Paciente'
        }]
      }
    },
    ...overrides
  }
}

function makeRes() {
  return {
    _status: null,
    sendStatus(code) { this._status = code },
    status(code) { this._status = code; return this }
  }
}

describe('handleWebhook — validação de secret', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    router.mockClear()
  })

  it('processa mensagem sem secret configurado', async () => {
    vi.stubEnv('EVOLUTION_WEBHOOK_SECRET', '')
    const req = makeReq()
    const res = makeRes()
    await handleWebhook(req, res)
    expect(res._status).toBe(200)
  })

  it('rejeita requisição com secret errado', async () => {
    vi.stubEnv('EVOLUTION_WEBHOOK_SECRET', 'secret-correto')
    const req = makeReq({ headers: { apikey: 'secret-errado' } })
    const res = makeRes()
    await handleWebhook(req, res)
    expect(res._status).toBe(401)
    expect(router).not.toHaveBeenCalled()
  })
})

describe('handleWebhook — filtros de mensagem', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.stubEnv('EVOLUTION_WEBHOOK_SECRET', '')
    router.mockClear()
    sendText.mockClear()
  })

  it('ignora mensagens fromMe', async () => {
    const req = makeReq()
    req.body.data.messages[0].key.fromMe = true
    const res = makeRes()
    await handleWebhook(req, res)
    expect(router).not.toHaveBeenCalled()
  })

  it('ignora mensagens de grupo', async () => {
    const req = makeReq()
    req.body.data.messages[0].key.remoteJid = '5561group@g.us'
    const res = makeRes()
    await handleWebhook(req, res)
    expect(router).not.toHaveBeenCalled()
  })

  it('ignora eventos que não são messages.upsert', async () => {
    const req = makeReq()
    req.body.event = 'connection.update'
    const res = makeRes()
    await handleWebhook(req, res)
    expect(router).not.toHaveBeenCalled()
  })

  it('avisa sobre mensagens de mídia fora de fluxo especial', async () => {
    const req = makeReq()
    req.body.data.messages[0].message = { imageMessage: {} }
    const res = makeRes()
    await handleWebhook(req, res)
    expect(sendText).toHaveBeenCalledWith(
      '5561999999999',
      expect.stringContaining('apenas mensagens de texto')
    )
    expect(router).not.toHaveBeenCalled()
  })

  it('roteia mensagem de texto válida', async () => {
    const req = makeReq()
    const res = makeRes()
    await handleWebhook(req, res)
    expect(res._status).toBe(200)
    expect(router).toHaveBeenCalledWith('5561999999999', 'oi', 'Paciente')
  })
})
