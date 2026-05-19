import { describe, it, expect, vi } from 'vitest'

vi.mock('../services/db.js', () => ({
  upsertSession: vi.fn(),
  getAgendamentosComSlot: vi.fn().mockReturnValue([]),
  wasReminderSent: vi.fn().mockReturnValue(false),
  markReminderSent: vi.fn(),
  insertRescheduleToken: vi.fn(),
  getEncaixeByEspecialidade: vi.fn().mockReturnValue([]),
  markEncaixeNotificado: vi.fn(),
  deleteOldMessageLogs: vi.fn()
}))

vi.mock('../services/whatsapp.js', () => ({ sendText: vi.fn().mockResolvedValue(true) }))

vi.mock('../utils/messages.js', () => ({ msg: vi.fn((key, vars) => `[${key}]`) }))

import { fmtHora, fmtData } from '../services/scheduler.js'

describe('fmtHora', () => {
  it('formata hora corretamente', () => {
    expect(fmtHora('2025-06-15T10:30:00')).toBe('10h30')
    expect(fmtHora('2025-06-15T09:05:00')).toBe('09h05')
  })
})

describe('fmtData', () => {
  it('retorna data formatada', () => {
    const result = fmtData('2025-06-15T10:00:00')
    expect(result.data).toBe('15/06/2025')
  })
})
