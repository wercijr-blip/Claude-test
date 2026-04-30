import express from 'express'
import cookieParser from 'cookie-parser'
import { createExpressMiddleware } from '@trpc/server/adapters/express'
import path from 'path'
import { fileURLToPath } from 'url'
import { env } from './env.ts'
import { logger } from './logger.ts'
import { redis } from './redis.ts'
import { applySecurityMiddleware } from './security.ts'
import { appRouter } from '../routers.ts'
import { createContext } from './context.ts'
import { authLimiter, tokenValidateLimiter, uploadLimiter } from './rateLimiters.ts'
import { db } from '../db.ts'
import { ensureSchema } from './ensureSchema.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()

// Trust Railway's reverse proxy so X-Forwarded-For is recognized
app.set('trust proxy', 1)

applySecurityMiddleware(app)
app.use(cookieParser())

// Assets estáticos DEPOIS dos middlewares de segurança (Helmet, CORS, rate limit)
if (env.NODE_ENV === 'production') {
  const clientDist = path.resolve(__dirname, '../../dist/client')
  app.use(express.static(clientDist))
}

// ⚠️ Stripe webhook DEVE vir ANTES de express.json() para receber raw body
// (Stripe valida assinatura usando os bytes brutos do payload)
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const { handleWebhook } = await import('../stripe/webhook.ts')
    await handleWebhook(req, res)
  },
)

// Body parsers globais (depois do webhook)
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))

// tRPC — com rate limiters por rota
app.use(
  '/trpc/auth.callback',
  authLimiter,
)
app.use(
  '/trpc/token.validar',
  tokenValidateLimiter,
)
app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext: ({ req }) => createContext({ req }),
  }),
)

// Healthcheck com verificação do banco e Redis
app.get('/api/health', async (_req, res) => {
  const ts = new Date().toISOString()

  const [dbOk, redisOk] = await Promise.all([
    db.execute('SELECT 1').then(() => true).catch(() => false),
    redis.ping().then((r) => r === 'PONG').catch(() => false),
  ])

  const allOk = dbOk && redisOk
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    checks: { db: dbOk ? 'ok' : 'error', redis: redisOk ? 'ok' : 'error' },
    ts,
  })
})

// Upload de exames (lazy import para evitar carregar S3 client no boot)
app.post('/api/upload', uploadLimiter, async (req, res) => {
  const { uploadExame } = await import('../storage.ts')
  await uploadExame(req, res)
})

// Catch-all: servir index.html para rotas do SPA em produção
if (env.NODE_ENV === 'production') {
  const clientDist = path.resolve(__dirname, '../../dist/client')
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

await ensureSchema()

const server = app.listen(env.PORT, async () => {
  logger.info(`Facilita PrEP rodando na porta ${env.PORT}`, { env: env.NODE_ENV })

  // Workers run in-process by default (single-service deploy).
  // Set WORKERS_ENABLED=false when running a dedicated worker service via server/workers.ts.
  if (env.WORKERS_ENABLED !== false) {
    const { startPdfWorker, startLembreteWorker, startPesquisaWorker, startLinkAcessoWorker, agendarLembreteDiario } = await import('../pdfQueue.ts')
    const { startExamWorker } = await import('../examQueue.ts')
    startPdfWorker()
    startLembreteWorker()
    startPesquisaWorker()
    startLinkAcessoWorker()
    startExamWorker()
    await agendarLembreteDiario()
    logger.info('[server] Workers BullMQ iniciados em-processo.')
  } else {
    logger.info('[server] WORKERS_ENABLED=false — aguardando worker service separado.')
  }
})

// Graceful shutdown — Railway sends SIGTERM before stopping the container.
// Stop accepting new connections, wait for in-flight requests, then exit.
async function shutdown(signal: string) {
  logger.info(`[server] ${signal} recebido — encerrando graciosamente...`)
  server.close(async () => {
    const { redis } = await import('./redis.ts')
    await redis.quit().catch(() => undefined)
    logger.info('[server] Conexões encerradas. Saindo.')
    process.exit(0)
  })

  // Force exit if graceful shutdown hangs beyond 15s
  setTimeout(() => {
    logger.error('[server] Graceful shutdown excedeu 15s — forçando saída')
    process.exit(1)
  }, 15_000)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// Catch any unhandled promise rejections or thrown exceptions so they appear
// in Railway logs with full context instead of crashing silently.
process.on('unhandledRejection', (reason) => {
  logger.error('[server] unhandledRejection', { reason: String(reason) })
})
process.on('uncaughtException', (err) => {
  logger.error('[server] uncaughtException', { error: err.message, stack: err.stack })
  // Exit after uncaughtException — process state is undefined, Railway restarts it.
  process.exit(1)
})

export default app
