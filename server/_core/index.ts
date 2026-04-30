import express from 'express'
import cookieParser from 'cookie-parser'
import { createExpressMiddleware } from '@trpc/server/adapters/express'
import path from 'path'
import { fileURLToPath } from 'url'
import { env } from './env.ts'
import { applySecurityMiddleware } from './security.ts'
import { appRouter } from '../routers.ts'
import { createContext } from './context.ts'
import { authLimiter, tokenValidateLimiter, uploadLimiter } from './rateLimiters.ts'
import { db } from '../db.ts'

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

// Healthcheck com verificação do banco
app.get('/api/health', async (_req, res) => {
  try {
    await db.execute('SELECT 1')
    res.json({ status: 'ok', ts: new Date().toISOString() })
  } catch {
    res.status(503).json({ status: 'error', ts: new Date().toISOString() })
  }
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

const server = app.listen(env.PORT, async () => {
  console.log(`🚀 Facilita PrEP rodando na porta ${env.PORT} [${env.NODE_ENV}]`)

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
    console.log('[server] Workers BullMQ iniciados em-processo.')
  } else {
    console.log('[server] WORKERS_ENABLED=false — aguardando worker service separado.')
  }
})

// Graceful shutdown — Railway sends SIGTERM before stopping the container.
// Stop accepting new connections, wait for in-flight requests, then exit.
async function shutdown(signal: string) {
  console.log(`[server] ${signal} recebido — encerrando graciosamente...`)
  server.close(async () => {
    const { redis } = await import('./redis.ts')
    await redis.quit().catch(() => undefined)
    console.log('[server] Conexões encerradas. Saindo.')
    process.exit(0)
  })

  // Force exit if graceful shutdown hangs beyond 15s
  setTimeout(() => {
    console.error('[server] Graceful shutdown excedeu 15s — forçando saída')
    process.exit(1)
  }, 15_000)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

export default app
