import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGet = vi.fn()
const mockSet = vi.fn()

vi.mock('./_core/redis.ts', () => ({
  redis: { get: mockGet, set: mockSet },
}))

vi.mock('./_core/env.ts', () => ({
  env: {
    STAFF_WHATSAPP_MEDICOS: '+556198432878',
    STAFF_WHATSAPP_SECRETARIAS: '+556140427188',
    APP_URL: 'https://facilitaprep.com.br',
    ZAPI_INSTANCE_ID: 'inst',
    ZAPI_TOKEN: 'tok',
    ZAPI_CLIENT_TOKEN: 'ctok',
  },
}))

const mockEnviarWhatsApp = vi.fn().mockResolvedValue(true)
vi.mock('./whatsapp.ts', () => ({ enviarWhatsApp: mockEnviarWhatsApp }))

vi.mock('./_core/logger.ts', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

describe('notificarStaff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    // Restore full env after any test that overrides it with vi.doMock
    vi.doMock('./_core/env.ts', () => ({
      env: {
        STAFF_WHATSAPP_MEDICOS: '+556198432878',
        STAFF_WHATSAPP_SECRETARIAS: '+556140427188',
        APP_URL: 'https://facilitaprep.com.br',
        ZAPI_INSTANCE_ID: 'inst',
        ZAPI_TOKEN: 'tok',
        ZAPI_CLIENT_TOKEN: 'ctok',
      },
    }))
  })

  it('envia WhatsApp quando Redis permite (chave ausente)', async () => {
    mockGet.mockResolvedValueOnce(null)
    mockSet.mockResolvedValueOnce('OK')
    const { notificarStaff, staffTemplates } = await import('./whatsapp.staff.ts')
    await notificarStaff('medico', 'exame-revisar', staffTemplates.medicoExameParaRevisar)
    expect(mockEnviarWhatsApp).toHaveBeenCalledWith('+556198432878', expect.stringContaining('Facilita PrEP'))
  })

  it('não envia se debounce ativo (chave Redis presente)', async () => {
    mockGet.mockResolvedValueOnce('1')
    const { notificarStaff, staffTemplates } = await import('./whatsapp.staff.ts')
    await notificarStaff('medico', 'exame-revisar', staffTemplates.medicoExameParaRevisar)
    expect(mockEnviarWhatsApp).not.toHaveBeenCalled()
  })

  it('permite envio quando Redis falha (degradação graciosa)', async () => {
    mockGet.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    const { notificarStaff, staffTemplates } = await import('./whatsapp.staff.ts')
    await notificarStaff('secretaria', 'plano-pendente', staffTemplates.secretariaPlanoSaudePendente)
    expect(mockEnviarWhatsApp).toHaveBeenCalledWith('+556140427188', expect.any(String))
  })

  it('não envia se env var STAFF_WHATSAPP_MEDICOS não configurada', async () => {
    vi.doMock('./_core/env.ts', () => ({
      env: { STAFF_WHATSAPP_MEDICOS: undefined, APP_URL: 'https://facilitaprep.com.br' },
    }))
    const { notificarStaff, staffTemplates } = await import('./whatsapp.staff.ts')
    await notificarStaff('medico', 'exame-revisar', staffTemplates.medicoExameParaRevisar)
    expect(mockEnviarWhatsApp).not.toHaveBeenCalled()
  })

  it('template urgente contém "URGENTE"', async () => {
    const { staffTemplates } = await import('./whatsapp.staff.ts')
    expect(staffTemplates.medicoExameUrgente()).toContain('URGENTE')
  })

  it('template secretaria contém URL do painel correto', async () => {
    const { staffTemplates } = await import('./whatsapp.staff.ts')
    expect(staffTemplates.secretariaPlanoSaudePendente()).toContain('/secretaria')
  })

  it('mascaramento de número no log não expõe dígitos do meio', async () => {
    mockGet.mockResolvedValueOnce(null)
    mockSet.mockResolvedValueOnce('OK')
    mockEnviarWhatsApp.mockResolvedValueOnce(false)
    const { notificarStaff, staffTemplates } = await import('./whatsapp.staff.ts')
    const { logger } = await import('./_core/logger.ts')
    await notificarStaff('medico', 'exame-revisar', staffTemplates.medicoExameParaRevisar)
    const calls = (logger.warn as ReturnType<typeof vi.fn>).mock.calls
    expect(calls.length).toBeGreaterThan(0)
    const loggedString = JSON.stringify(calls[0])
    expect(loggedString).not.toContain('32878')
    expect(loggedString).toContain('****')
  })
})
