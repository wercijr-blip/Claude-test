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
// (necessário para express-rate-limit identificar o IP correto do usuário)
app.set('trust proxy', 1)

// Servir assets estáticos ANTES do middleware de segurança para evitar que o
// CORS rejeite requisições same-origin sem cabeçalho Origin (JS/CSS do browser)
if (env.NODE_ENV === 'production') {
  const clientDist = path.resolve(__dirname, '../../dist/client')
  app.use(express.static(clientDist))
}

applySecurityMiddleware(app)
app.use(cookieParser())

// Stripe webhook MUST be registered before express.json() so it receives the
// raw request body as a Buffer. express.json() consumes the stream and parses
// it into a JS object, which destroys the original bytes that Stripe's HMAC
// signature verification requires.
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const { handleWebhook } = await import('../stripe/webhook.ts')
    await handleWebhook(req, res)
  },
)

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
    onError({ error, path, input }) {
      if (error.code === 'INTERNAL_SERVER_ERROR') {
        console.error(`[tRPC] Internal error on procedure "${path}"`)
        console.error('[tRPC] Input:', JSON.stringify(input))
        console.error('[tRPC] Error:', error.message)
        console.error('[tRPC] Stack:', error.stack)
      } else {
        console.warn(`[tRPC] Error "${error.code}" on procedure "${path}": ${error.message}`)
      }
    },
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

// Global error handler — captura erros não tratados em middlewares e rotas Express
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`[Express] Unhandled error on ${req.method} ${req.path}`)
  console.error('[Express] Error:', err.message)
  console.error('[Express] Stack:', err.stack)
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal Server Error' })
  }
})

app.listen(env.PORT, async () => {
  console.log(`🚀 Facilita PrEP rodando na porta ${env.PORT} [${env.NODE_ENV}]`)
  // Iniciar workers de fila em background
  const { startPdfWorker, startLembreteWorker, startPesquisaWorker, agendarLembreteDiario } = await import('../pdfQueue.ts')
  startPdfWorker()
  startLembreteWorker()
  startPesquisaWorker()
  await agendarLembreteDiario()
  const { startExamWorker } = await import('../examQueue.ts')
  startExamWorker()
})

export default app
