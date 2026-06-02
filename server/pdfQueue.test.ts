import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock BullMQ before importing pdfQueue
const mockAdd = vi.fn().mockResolvedValue({ id: 'job-1' })
const mockCount = vi.fn().mockResolvedValue(0)
vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({ add: mockAdd, count: mockCount, getWaitingCount: vi.fn().mockResolvedValue(0) })),
  Worker: vi.fn().mockImplementation(() => ({ on: vi.fn() })),
}))

vi.mock('./_core/env.ts', () => ({
  env: {
    NODE_ENV: 'test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-secret-minimum-32-characters-long-xx',
    WORKERS_ENABLED: false,
  },
}))

vi.mock('./_core/redis.ts', () => ({
  redis: {
    ping: vi.fn().mockResolvedValue('PONG'),
    quit: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('./db.ts', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        catch: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}))

vi.mock('./pdfSigner.ts', () => ({ gerarPrescricaoPdf: vi.fn(), assinarPdf: vi.fn() }))
vi.mock('./pdfOrientacao.ts', () => ({ gerarOrientacaoPdf: vi.fn() }))
vi.mock('./pdfExameRequest.ts', () => ({ gerarPedidosExames: vi.fn() }))
vi.mock('./storage.ts', () => ({ uploadBuffer: vi.fn() }))
vi.mock('./email.ts', () => ({
  enviarLinkAcessoIntake: vi.fn(),
  enviarPrescricaoPronta: vi.fn(),
  enviarPesquisaSatisfacao: vi.fn(),
}))
vi.mock('./whatsapp.ts', () => ({ enviarWhatsApp: vi.fn() }))
vi.mock('./_core/logger.ts', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('./_core/tokenUtils.ts', () => ({ generateToken: vi.fn().mockReturnValue('tok'), hashToken: vi.fn().mockReturnValue('hash') }))
vi.mock('./_core/encryption.ts', () => ({ decrypt: vi.fn().mockReturnValue('decrypted') }))
vi.mock('./sus/preencherCadastro.ts', () => ({ preencherCadastroSUS: vi.fn() }))
vi.mock('./sus/preencherFichaAtendimento.ts', () => ({ preencherFichaAtendimento: vi.fn(), buildConfigClinica: vi.fn(), mapPrepAdesaoLabel: vi.fn() }))

describe('pdfQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('PDF_QUEUE_NAME is a non-empty string', async () => {
    const { PDF_QUEUE_NAME } = await import('./pdfQueue.ts')
    expect(typeof PDF_QUEUE_NAME).toBe('string')
    expect(PDF_QUEUE_NAME.length).toBeGreaterThan(0)
  })

  it('enqueueGerarPdf adds a job with pacienteId', async () => {
    const { enqueueGerarPdf } = await import('./pdfQueue.ts')
    await enqueueGerarPdf(42)
    expect(mockAdd).toHaveBeenCalledWith('gerar', { pacienteId: 42 }, expect.any(Object))
  })

  it('enqueueGerarPdf passes jobId option for dedup', async () => {
    const { enqueueGerarPdf } = await import('./pdfQueue.ts')
    await enqueueGerarPdf(7)
    const [, , opts] = mockAdd.mock.calls[0] as [string, unknown, { jobId?: string }]
    expect(opts).toHaveProperty('jobId')
    expect(opts.jobId).toContain('7')
  })

  it('LEMBRETE_QUEUE_NAME and PESQUISA_QUEUE_NAME are distinct', async () => {
    const { LEMBRETE_QUEUE_NAME, PESQUISA_QUEUE_NAME, PDF_QUEUE_NAME, LINK_ACESSO_QUEUE_NAME } = await import('./pdfQueue.ts')
    const names = new Set([PDF_QUEUE_NAME, LEMBRETE_QUEUE_NAME, PESQUISA_QUEUE_NAME, LINK_ACESSO_QUEUE_NAME])
    expect(names.size).toBe(4)
  })

  it('startPdfWorker returns a Worker instance', async () => {
    const { startPdfWorker } = await import('./pdfQueue.ts')
    const worker = startPdfWorker()
    expect(worker).toBeDefined()
  })
})
