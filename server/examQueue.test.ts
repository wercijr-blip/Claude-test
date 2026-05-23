import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── BullMQ mock — must be declared before any import that uses bullmq ──────
const mockRemove = vi.fn().mockResolvedValue(undefined)
const mockAdd = vi.fn().mockResolvedValue({ id: 'exam-1' })
const mockGetJob = vi.fn()
const mockWorkerOn = vi.fn()

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    remove: mockRemove,
    add: mockAdd,
    getJob: mockGetJob,
  })),
  Worker: vi.fn().mockImplementation(() => ({ on: mockWorkerOn })),
}))

vi.mock('./workers/queues.ts', () => ({
  connection: {},
  QUEUE_PREFIX: '{fp-test}',
  persistDlq: vi.fn(),
  EXAM_WORKER_OPTS: {
    lockDuration: 60_000,
    stalledInterval: 60_000,
    maxStalledCount: 1,
    removeOnComplete: { count: 10 },
    removeOnFail: { count: 50 },
    drainDelay: 30,
  },
}))

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
  },
}))

vi.mock('./db.ts', () => ({ db: {} }))
vi.mock('./examAnalysis.ts', () => ({ analisarExame: vi.fn() }))
vi.mock('./_core/logger.ts', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

describe('enqueueAnalisarExame', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('enfileira com jobId deduplicado', async () => {
    const { enqueueAnalisarExame } = await import('./examQueue.ts')
    await enqueueAnalisarExame(42)
    expect(mockAdd).toHaveBeenCalledWith(
      'analisar',
      expect.objectContaining({ exameId: 42 }),
      expect.objectContaining({ jobId: 'exam-42' }),
    )
  })

  it('forceRequeue=false → não verifica nem remove job existente', async () => {
    const { enqueueAnalisarExame } = await import('./examQueue.ts')
    await enqueueAnalisarExame(1, undefined, false)
    expect(mockGetJob).not.toHaveBeenCalled()
    expect(mockRemove).not.toHaveBeenCalled()
  })

  it('forceRequeue=true, nenhum job existente → não remove, apenas adiciona', async () => {
    mockGetJob.mockResolvedValueOnce(null)
    const { enqueueAnalisarExame } = await import('./examQueue.ts')
    await enqueueAnalisarExame(1, undefined, true)
    expect(mockRemove).not.toHaveBeenCalled()
    expect(mockAdd).toHaveBeenCalled()
  })

  it('forceRequeue=true, job em estado waiting → remove e re-adiciona', async () => {
    mockGetJob.mockResolvedValueOnce({ getState: vi.fn().mockResolvedValue('waiting') })
    const { enqueueAnalisarExame } = await import('./examQueue.ts')
    await enqueueAnalisarExame(5, undefined, true)
    expect(mockRemove).toHaveBeenCalledWith('exam-5')
    expect(mockAdd).toHaveBeenCalled()
  })

  it('forceRequeue=true, job ATIVO → não remove nem re-adiciona (evita erro BullMQ de jobId duplicado)', async () => {
    const fakeActiveJob = { getState: vi.fn().mockResolvedValue('active') }
    mockGetJob.mockResolvedValueOnce(fakeActiveJob)
    const { enqueueAnalisarExame } = await import('./examQueue.ts')
    const result = await enqueueAnalisarExame(7, undefined, true)
    expect(mockRemove).not.toHaveBeenCalled()
    expect(mockAdd).not.toHaveBeenCalled()
    expect(result).toBe(fakeActiveJob) // retorna o job em andamento
  })

  it('forceRequeue=true, job em estado delayed → remove e re-adiciona', async () => {
    mockGetJob.mockResolvedValueOnce({ getState: vi.fn().mockResolvedValue('delayed') })
    const { enqueueAnalisarExame } = await import('./examQueue.ts')
    await enqueueAnalisarExame(9, undefined, true)
    expect(mockRemove).toHaveBeenCalledWith('exam-9')
    expect(mockAdd).toHaveBeenCalled()
  })
})
