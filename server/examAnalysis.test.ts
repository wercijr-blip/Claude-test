import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockIncr = vi.fn()
const mockExpire = vi.fn()

vi.mock('./_core/redis.ts', () => ({
  redis: {
    incr: mockIncr,
    expire: mockExpire,
    ping: vi.fn().mockResolvedValue('PONG'),
    quit: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('./_core/env.ts', () => ({
  env: {
    NODE_ENV: 'test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-secret-minimum-32-characters-long-xx',
    LLM_DAILY_LIMIT: 5,
    BUILT_IN_FORGE_API_URL: 'https://api.anthropic.com',
    BUILT_IN_FORGE_API_KEY: 'sk-ant-test',
  },
}))

vi.mock('./db.ts', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}))

vi.mock('./storage.ts', () => ({
  uploadBuffer: vi.fn(),
  getPresignedUrl: vi.fn().mockResolvedValue('https://s3.example.com/exame.jpg'),
}))

vi.mock('./_core/logger.ts', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

describe('checkDailyLimit (via analisarExame)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('allows calls under the daily limit', async () => {
    mockIncr.mockResolvedValueOnce(1)
    mockExpire.mockResolvedValueOnce(1)

    const { analisarExame } = await import('./examAnalysis.ts')

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [
          {
            text: JSON.stringify({
              tipoExame: 'hiv',
              resultado: 'nao_reagente',
              confianca: 0.95,
              observacoes: 'teste',
            }),
          },
        ],
      }),
    }) as unknown as typeof fetch

    const { db } = await import('./db.ts')
    const mockSelect = db.select as ReturnType<typeof vi.fn>
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 1, s3Key: 'exames/test.jpg', status: 'pendente' }]),
        }),
      }),
    })

    await expect(analisarExame(1)).resolves.toBeDefined()
    expect(mockIncr).toHaveBeenCalledWith(expect.stringMatching(/^llm:daily:\d{4}-\d{2}-\d{2}$/))
  })

  it('blocks calls over the daily limit and throws user-friendly error', async () => {
    mockIncr.mockResolvedValueOnce(6)

    const { analisarExame } = await import('./examAnalysis.ts')

    await expect(analisarExame(1)).rejects.toThrow('Limite diário')
    expect(mockIncr).toHaveBeenCalledOnce()
  })

  it('sets 25h TTL on first call of the day (incr returns 1)', async () => {
    mockIncr.mockResolvedValueOnce(1)
    mockExpire.mockResolvedValueOnce(1)

    const { analisarExame } = await import('./examAnalysis.ts')

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [
          {
            text: JSON.stringify({
              tipoExame: 'hiv',
              resultado: 'nao_reagente',
              confianca: 0.9,
            }),
          },
        ],
      }),
    }) as unknown as typeof fetch

    const { db } = await import('./db.ts')
    const mockSelect = db.select as ReturnType<typeof vi.fn>
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 1, s3Key: 'exames/test.jpg', status: 'pendente' }]),
        }),
      }),
    })

    await expect(analisarExame(1)).resolves.toBeDefined()
    expect(mockExpire).toHaveBeenCalledWith(expect.stringMatching(/^llm:daily:/), 90_000)
  })

  it('does not set TTL when count > 1 (key already exists)', async () => {
    mockIncr.mockResolvedValueOnce(3)

    const { analisarExame } = await import('./examAnalysis.ts')

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [
          {
            text: JSON.stringify({
              tipoExame: 'hiv',
              resultado: 'nao_reagente',
              confianca: 0.9,
            }),
          },
        ],
      }),
    }) as unknown as typeof fetch

    const { db } = await import('./db.ts')
    const mockSelect = db.select as ReturnType<typeof vi.fn>
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 1, s3Key: 'exames/test.jpg', status: 'pendente' }]),
        }),
      }),
    })

    await expect(analisarExame(1)).resolves.toBeDefined()
    expect(mockExpire).not.toHaveBeenCalled()
  })

  it('degrades gracefully when Redis is unavailable (non-limit error)', async () => {
    mockIncr.mockRejectedValueOnce(new Error('Connection refused'))

    const { analisarExame } = await import('./examAnalysis.ts')

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [
          {
            text: JSON.stringify({
              tipoExame: 'hiv',
              resultado: 'nao_reagente',
              confianca: 0.9,
            }),
          },
        ],
      }),
    }) as unknown as typeof fetch

    const { db } = await import('./db.ts')
    const mockSelect = db.select as ReturnType<typeof vi.fn>
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 1, s3Key: 'exames/test.jpg', status: 'pendente' }]),
        }),
      }),
    })

    await expect(analisarExame(1)).resolves.toBeDefined()
  })
})
