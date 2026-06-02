import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../services/whatsapp.js', () => ({ sendText: vi.fn().mockResolvedValue(true) }))
vi.mock('../services/db.js', () => ({
  getSession: vi.fn(),
  clearSession: vi.fn(),
  upsertSession: vi.fn(),
  insertMessageLog: vi.fn(),
  getUserById: vi.fn(),
  invalidateUserCache: vi.fn()
}))
vi.mock('../utils/validators.js', () => ({ isRestartKeyword: vi.fn().mockReturnValue(false) }))
vi.mock('../flows/menu-flow.js', () => ({ run: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../flows/consulta-flow.js', () => ({ run: vi.fn().mockResolvedValue(undefined) }))

const { router } = await import('../handlers/router.js')
const { getSession, clearSession, upsertSession } = await import('../services/db.js')
const { sendText } = await import('../services/whatsapp.js')
const { isRestartKeyword } = await import('../utils/validators.js')
const { run: menuRun } = await import('../flows/menu-flow.js')
const { run: consultaRun } = await import('../flows/consulta-flow.js')

beforeEach(() => {
  vi.clearAllMocks()
  isRestartKeyword.mockReturnValue(false)
})

describe('router — sem sessão', () => {
  it('inicia menu quando não há sessão', async () => {
    getSession.mockResolvedValue(null)
    await router('5561999999999', 'oi', 'Paciente')
    expect(clearSession).toHaveBeenCalledWith('5561999999999')
    expect(menuRun).toHaveBeenCalled()
  })

  it('inicia menu quando sessão está em START', async () => {
    getSession.mockResolvedValue({ flow: 'MENU', step: 'START' })
    await router('5561999999999', 'oi', 'Paciente')
    expect(menuRun).toHaveBeenCalled()
  })

  it('reinicia quando isRestartKeyword retorna true', async () => {
    getSession.mockResolvedValue({ flow: 'CONSULTA', step: 'ALGUM_STEP' })
    isRestartKeyword.mockReturnValue(true)
    await router('5561999999999', 'menu', 'Paciente')
    expect(clearSession).toHaveBeenCalled()
    expect(menuRun).toHaveBeenCalled()
  })
})

describe('router — roteamento de fluxos', () => {
  it('roteia flow CONSULTA para consulta-flow', async () => {
    getSession.mockResolvedValue({ flow: 'CONSULTA', step: 'ESCOLHER_MEDICO' })
    await router('5561999999999', '1', '')
    expect(consultaRun).toHaveBeenCalledWith('5561999999999', '1', expect.objectContaining({ flow: 'CONSULTA' }))
  })

  it('transfere imediatamente para HUMANO quando texto é "atendente"', async () => {
    getSession.mockResolvedValue({ flow: 'MENU', step: 'AGUARDANDO' })
    await router('5561999999999', 'atendente', '')
    expect(sendText).toHaveBeenCalledWith('5561999999999', expect.stringContaining('equipe'))
    expect(upsertSession).toHaveBeenCalledWith('5561999999999', expect.objectContaining({ flow: 'HUMANO' }))
  })

  it('ignora silenciosamente mensagens em flow HUMANO', async () => {
    getSession.mockResolvedValue({ flow: 'HUMANO', step: 'AGUARDANDO_HUMANO' })
    await router('5561999999999', 'qualquer coisa', '')
    expect(menuRun).not.toHaveBeenCalled()
    expect(consultaRun).not.toHaveBeenCalled()
    expect(sendText).not.toHaveBeenCalled()
  })
})
