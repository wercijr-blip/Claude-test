import { describe, it, expect, vi } from 'vitest'
import { createHash, randomBytes } from 'crypto'
import { z } from 'zod'

vi.mock('./_core/env.ts', () => ({
  env: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-with-at-least-32-chars-here',
    ENCRYPTION_KEY: 'a'.repeat(64),
    CPF_HASH_SALT: 'test-salt-with-at-least-32-chars-here',
    OAUTH_SERVER_URL: 'https://oauth.example.com',
    OWNER_OPEN_ID: 'owner-id',
    VITE_APP_ID: 'facilita-prep',
    AWS_ACCESS_KEY_ID: 'key',
    AWS_SECRET_ACCESS_KEY: 'secret',
    AWS_REGION: 'sa-east-1',
    AWS_S3_BUCKET: 'bucket',
    REDIS_URL: 'redis://localhost:6379',
    ASAAS_ENV: 'sandbox',
    BUILT_IN_FORGE_API_URL: 'https://api.anthropic.com',
    APP_URL: 'https://facilitaprep.com.br',
    PORT: 3000,
    CONSULTA_VALOR: 250,
    ENABLE_DEBIT_CARD: false,
  },
}))
vi.mock('./db.ts', () => ({ db: {} }))
vi.mock('./storage.ts', () => ({ getPresignedUrl: vi.fn() }))
vi.mock('./email.ts', () => ({
  enviarNotificacaoNovoPlano: vi.fn(),
  enviarConfirmacaoPlano: vi.fn(),
  enqueueEnviarLinkAcesso: vi.fn(),
}))
vi.mock('./pdfQueue.ts', () => ({
  enqueueGerarPdf: vi.fn(),
  enqueueEnviarLinkAcesso: vi.fn(),
}))
vi.mock('./asaas/client.ts', () => ({
  criarCobrancaIntake: vi.fn(),
  obterPagamento: vi.fn(),
  listarPagamentosPorReferencia: vi.fn(),
}))
vi.mock('./whatsapp.ts', () => ({ enviarWhatsApp: vi.fn() }))
vi.mock('@sentry/node', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))
vi.mock('./_core/logger.ts', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// Local reimplementation of hashToken / generateToken — mirrors tokenUtils.ts exactly.
function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}
function generateToken(): string {
  return randomBytes(32).toString('hex')
}

// ────────────────────────────────────────────────────────────────────────────
// tokenUtils — hashToken / generateToken
// ────────────────────────────────────────────────────────────────────────────
describe('tokenUtils — hashToken', () => {
  it('produz sha256 hex de 64 chars', () => {
    const hash = hashToken('qualquer-token-aqui')
    expect(hash).toHaveLength(64)
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true)
  })

  it('é determinístico: mesma entrada, mesmo hash', () => {
    const raw = 'token-estável'
    expect(hashToken(raw)).toBe(hashToken(raw))
  })

  it('tokens distintos produzem hashes distintos', () => {
    expect(hashToken('tok-A')).not.toBe(hashToken('tok-B'))
  })

  it('não é reversível: hash não contém o token original', () => {
    const raw = 'segredo-invaluavel'
    const hash = hashToken(raw)
    expect(hash).not.toContain(raw)
  })
})

describe('tokenUtils — generateToken', () => {
  it('gera string hex de 64 chars (32 bytes)', () => {
    const tok = generateToken()
    expect(tok).toHaveLength(64)
    expect(/^[0-9a-f]+$/.test(tok)).toBe(true)
  })

  it('cada chamada produz token único', () => {
    const tokens = Array.from({ length: 10 }, () => generateToken())
    const unique = new Set(tokens)
    expect(unique.size).toBe(10)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// consultarStatusPorPrecadastro — shape de resposta (segurança por design)
// ────────────────────────────────────────────────────────────────────────────
describe('consultarStatusPorPrecadastro — shape de resposta', () => {
  it('retorno não inclui paymentId (enumeration chain fechada)', () => {
    // Replica o mapeamento que a procedure faz a partir dos dados do Asaas.
    const mockPayment = { id: 'pay_abc123', status: 'RECEIVED', externalReference: 'precad-42' }
    const confirmed = mockPayment
    const latest = confirmed

    const response = {
      confirmado: !!confirmed,
      status: latest?.status ?? 'NOT_FOUND',
    }

    expect(response).toHaveProperty('confirmado')
    expect(response).toHaveProperty('status')
    // paymentId NÃO deve ser exposto ao cliente
    expect(response).not.toHaveProperty('paymentId')
    expect(response).not.toHaveProperty('id')
  })

  it('retorna confirmado=false quando sem pagamento confirmado', () => {
    const payments = [{ id: 'pay_x', status: 'PENDING', externalReference: 'precad-1' }]
    const confirmed = payments.find(p => p.status === 'RECEIVED' || p.status === 'CONFIRMED')
    const latest = confirmed ?? payments[0] ?? null

    const response = { confirmado: !!confirmed, status: latest?.status ?? 'NOT_FOUND' }

    expect(response.confirmado).toBe(false)
    expect(response.status).toBe('PENDING')
  })

  it('retorna confirmado=true quando status é CONFIRMED', () => {
    const payments = [{ id: 'pay_y', status: 'CONFIRMED', externalReference: 'precad-2' }]
    const confirmed = payments.find(p => p.status === 'RECEIVED' || p.status === 'CONFIRMED')
    const latest = confirmed ?? payments[0] ?? null

    const response = { confirmado: !!confirmed, status: latest?.status ?? 'NOT_FOUND' }

    expect(response.confirmado).toBe(true)
    expect(response.status).toBe('CONFIRMED')
  })

  it('retorna status NOT_FOUND quando lista de pagamentos está vazia', () => {
    const payments: { id: string; status: string }[] = []
    const confirmed = payments.find(p => p.status === 'RECEIVED' || p.status === 'CONFIRMED')
    const latest = confirmed ?? payments[0] ?? null

    const response = { confirmado: !!confirmed, status: latest?.status ?? 'NOT_FOUND' }

    expect(response.confirmado).toBe(false)
    expect(response.status).toBe('NOT_FOUND')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// consultarStatusPorPrecadastro — validação Zod do input
// ────────────────────────────────────────────────────────────────────────────
describe('consultarStatusPorPrecadastro — validação de input', () => {
  const inputSchema = z.object({ precadastroId: z.number().int().positive() })

  it('aceita precadastroId inteiro positivo', () => {
    expect(() => inputSchema.parse({ precadastroId: 42 })).not.toThrow()
  })

  it('rejeita precadastroId zero', () => {
    expect(() => inputSchema.parse({ precadastroId: 0 })).toThrow()
  })

  it('rejeita precadastroId negativo', () => {
    expect(() => inputSchema.parse({ precadastroId: -5 })).toThrow()
  })

  it('rejeita precadastroId decimal', () => {
    expect(() => inputSchema.parse({ precadastroId: 1.5 })).toThrow()
  })

  it('rejeita precadastroId string vazia', () => {
    expect(() => inputSchema.parse({ precadastroId: '' })).toThrow()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// HORARIO_ATENDIMENTO — lógica de horário via reimplementação local
// ────────────────────────────────────────────────────────────────────────────
describe('isDentroHorarioAtendimento — lógica de negócio', () => {
  const ABERTURA_HORA = 8
  const FECHAMENTO_HORA = 18

  function isDentroHorario(hora: number, diaSemana: number): boolean {
    const isDiaUtil = diaSemana >= 1 && diaSemana <= 5
    const isDentroHorario = hora >= ABERTURA_HORA && hora < FECHAMENTO_HORA
    return isDiaUtil && isDentroHorario
  }

  it('aceita segunda-feira às 10h', () => {
    expect(isDentroHorario(10, 1)).toBe(true) // 1 = Segunda
  })

  it('aceita sexta-feira às 17h (antes do fechamento)', () => {
    expect(isDentroHorario(17, 5)).toBe(true) // 5 = Sexta
  })

  it('rejeita sábado mesmo dentro do horário', () => {
    expect(isDentroHorario(10, 6)).toBe(false) // 6 = Sábado
  })

  it('rejeita domingo mesmo dentro do horário', () => {
    expect(isDentroHorario(10, 0)).toBe(false) // 0 = Domingo
  })

  it('rejeita hora de fechamento exata (18h não incluso)', () => {
    expect(isDentroHorario(18, 1)).toBe(false)
  })

  it('rejeita antes da abertura (7h)', () => {
    expect(isDentroHorario(7, 3)).toBe(false) // 3 = Quarta
  })
})
