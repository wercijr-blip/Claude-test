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

applySecurityMiddleware(app)
app.use(cookieParser())
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

// Stripe webhook (raw body necessário para validação de assinatura)
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const { handleWebhook } = await import('../stripe/webhook.ts')
    await handleWebhook(req, res)
  },
)

// Servir frontend em produção
if (env.NODE_ENV === 'production') {
  const clientDist = path.resolve(__dirname, '../../dist/client')
  app.use(express.static(clientDist))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

app.listen(env.PORT, async () => {
  console.log(`🚀 Facilita PrEP rodando na porta ${env.PORT} [${env.NODE_ENV}]`)
  // Iniciar workers de fila em background
  const { startPdfWorker, startLembreteWorker, startPesquisaWorker, agendarLembreteDiario } = await import('../pdfQueue.ts')
  startPdfWorker()
  startLembreteWorker()
  startPesquisaWorker()
  await agendarLembreteDiario()
})

export default app
