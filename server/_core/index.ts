import './instrument.ts'
import express from 'express'
import cookieParser from 'cookie-parser'
import { createExpressMiddleware } from '@trpc/server/adapters/express'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'
import { env } from './env.ts'
import { logger } from './logger.ts'
import { redis } from './redis.ts'
import { applySecurityMiddleware } from './security.ts'
import { appRouter } from '../routers.ts'
import { createContext } from './context.ts'
import { authLimiter, tokenValidateLimiter, uploadLimiter, totpLimiter, dataRightsLimiter } from './rateLimiters.ts'
import { db } from '../db.ts'
import { ensureSchema } from './ensureSchema.ts'
import { Sentry } from './instrument.ts'

declare global {
  namespace Express {
    interface Request {
      requestId: string
    }
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()

// Trust Railway's reverse proxy so X-Forwarded-For is recognized
app.set('trust proxy', 1)

applySecurityMiddleware(app)
app.use(cookieParser())

// Request ID — assigns a short UUID per request, logs method/url/status/duration
app.use((req, res, next) => {
  req.requestId = (req.headers['x-request-id'] as string | undefined) ?? randomUUID().slice(0, 8)
  res.setHeader('X-Request-ID', req.requestId)
  const start = Date.now()
  res.on('finish', () => {
    logger.info('http', {
      requestId: req.requestId,
      method: req.method,
      url: req.url,
      status: res.statusCode,
      ms: Date.now() - start,
    })
  })
  next()
})

// Assets estáticos DEPOIS dos middlewares de segurança (Helmet, CORS, rate limit)
if (env.NODE_ENV === 'production') {
  const clientDist = path.resolve(__dirname, '../../dist/client')
  const webOut = path.resolve(__dirname, '../../web/out')
  const clientIndex = path.join(clientDist, 'index.html')

  // Bundle smoke check — exit early with clear diagnostic if the Vite build is missing
  if (!fs.existsSync(clientIndex)) {
    logger.error('[FATAL] dist/client/index.html não existe', {
      cwd: process.cwd(),
      expected: clientIndex,
      cwdContents: fs.readdirSync(process.cwd()).join(', '),
      distContents: fs.existsSync(path.dirname(clientDist))
        ? fs.readdirSync(path.dirname(clientDist)).join(', ')
        : '(dist/ não encontrada)',
    })
    process.exit(1)
  }

  {
    const indexContent = fs.readFileSync(clientIndex, 'utf8')
    const bundleMatch = indexContent.match(/\/assets\/(index-[A-Za-z0-9_-]+\.js)/)
    const assetsDir = path.join(clientDist, 'assets')
    const chunkCount = fs.existsSync(assetsDir)
      ? fs.readdirSync(assetsDir).filter((f: string) => f.endsWith('.js')).length
      : 0
    logger.info('[startup] dist/client OK', {
      bundle: bundleMatch?.[1] ?? 'NÃO ENCONTRADO no index.html',
      chunks: chunkCount,
    })
  }

  // Verifica se o build do Next.js está disponível
  const webOutExists = fs.existsSync(path.join(webOut, 'index.html'))
  if (!webOutExists) {
    logger.warn('[server] web/out/index.html não encontrado — marketing routes vão usar o Vite SPA como fallback')
  }

  // Next.js static assets — _next/static has hashed names, safe to cache immutably
  app.use('/_next/static', express.static(path.join(webOut, '_next', 'static'), {
    maxAge: '1y',
    immutable: true,
  }))
  app.use('/_next', express.static(path.join(webOut, '_next')))

  // Rotas de marketing: Next.js SSG quando disponível, Vite SPA como fallback
  const marketingRoutes = ['/', '/lp/google', '/lp/meta', '/lp/retargeting', '/privacidade', '/termos', '/robots.txt', '/sitemap.xml']
  for (const route of marketingRoutes) {
    if (route === '/robots.txt' || route === '/sitemap.xml') {
      app.get(route, (_req, res) => {
        const webFilePath = path.join(webOut, route)
        const clientFilePath = path.join(clientDist, route.slice(1))
        if (fs.existsSync(webFilePath)) {
          res.sendFile(webFilePath)
        } else if (fs.existsSync(clientFilePath)) {
          res.sendFile(clientFilePath)
        } else {
          res.status(404).end()
        }
      })
    } else {
      const htmlPath = route === '/'
        ? path.join(webOut, 'index.html')
        : path.join(webOut, route, 'index.html')
      app.get(route, (_req, res) => {
        res.set('Cache-Control', 'no-cache, must-revalidate')
        // Fallback para Vite SPA se o build do Next.js não estiver disponível
        const target = fs.existsSync(htmlPath) ? htmlPath : clientIndex
        res.sendFile(target)
      })
    }
  }

  // Vite /assets → hashed bundles (JS, CSS) — content-addressable, safe to cache immutably
  app.use('/assets', express.static(path.join(clientDist, 'assets'), {
    maxAge: '1y',
    immutable: true,
  }))
  // Other Vite statics (favicon, og-image, manifest) — moderate cache for images/fonts
  app.use(express.static(clientDist, {
    setHeaders: (res, filePath) => {
      if (/\.(png|jpg|jpeg|svg|webp|avif|ico|woff2?|ttf)$/.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=86400')
      }
    },
  }))
}

// Body parsers globais
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))

// Asaas webhook (JSON body — no raw body needed; Asaas uses token auth, not HMAC)
app.post('/api/asaas/webhook', async (req, res) => {
  const { handleAsaasWebhook } = await import('../asaas/webhook.ts')
  await handleAsaasWebhook(req, res)
})

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
  '/trpc/twoFactor.verify',
  totpLimiter,
)
app.use(
  '/trpc/me.exportData',
  dataRightsLimiter,
)
app.use(
  '/trpc/me.requestAnonymization',
  dataRightsLimiter,
)
app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext: ({ req }) => createContext({ req }),
    onError: ({ error, path, type, input }) => {
      const PII_KEYS = ['cpf', 'nome', 'email', 'telefone', 'password', 'senha', 'token']
      const sanitize = (v: unknown): unknown => {
        if (v === null || typeof v !== 'object') return v
        return Object.fromEntries(
          Object.entries(v as Record<string, unknown>).map(([k, val]) => [
            k,
            PII_KEYS.some((p) => k.toLowerCase().includes(p)) ? '[redacted]' : sanitize(val),
          ]),
        )
      }
      const safeInput = typeof input === 'object' ? JSON.stringify(sanitize(input)) : '[non-object input]'
      logger.error('[trpc] error', {
        path,
        type,
        code: error.code,
        message: error.message,
        cause: error.cause ? String(error.cause) : undefined,
        stack: error.stack,
        input: safeInput,
      })
    },
  }),
)

// Healthcheck com verificação do banco e Redis
app.get('/api/health', async (_req, res) => {
  const [dbOk, redisOk] = await Promise.all([
    db.execute('SELECT 1').then(() => true).catch(() => false),
    redis.ping().then((r) => r === 'PONG').catch(() => false),
  ])

  const allOk = dbOk && redisOk
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    uptime: Math.floor(process.uptime()),
    version: '1.0.0',
    db: dbOk ? 'ok' : 'error',
    redis: redisOk ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
  })
})

// Version info — confirms deploy reached production and which bundle is being served
app.get('/api/health/version', (_req, res) => {
  let bundle = 'unknown'
  let chunks = 0
  try {
    const distClient = path.resolve(__dirname, '../../dist/client')
    const indexHtml = fs.readFileSync(path.join(distClient, 'index.html'), 'utf8')
    const m = indexHtml.match(/\/assets\/(index-[A-Za-z0-9_-]+\.js)/)
    bundle = m?.[1] ?? 'no-match'
    const assetsDir = path.join(distClient, 'assets')
    chunks = fs.existsSync(assetsDir)
      ? fs.readdirSync(assetsDir).filter((f: string) => f.endsWith('.js')).length
      : 0
  } catch (e) {
    bundle = `error: ${(e as Error).message}`
  }
  res.json({
    commit: (process.env.RAILWAY_GIT_COMMIT_SHA ?? 'dev').slice(0, 7),
    branch: process.env.RAILWAY_GIT_BRANCH ?? 'local',
    bundle,
    chunks,
    builtAt: process.env.BUILD_TIMESTAMP ?? 'unknown',
    nodeVersion: process.version,
    env: process.env.NODE_ENV,
  })
})

// Metrics — queue depth, memory, circuit breaker state
app.get('/api/metrics', async (_req, res) => {
  const { getCircuitStatus } = await import('./circuitBreaker.ts')
  let pdfWaiting = -1
  let linkWaiting = -1
  try {
    const { pdfQueue, linkAcessoQueue } = await import('../pdfQueue.ts')
    ;[pdfWaiting, linkWaiting] = await Promise.all([
      pdfQueue.getWaitingCount(),
      linkAcessoQueue.getWaitingCount(),
    ])
  } catch { /* workers may not be started */ }

  let staffWhatsappActiveDebounces = -1
  try {
    const keys = await redis.keys('wpp:staff:*')
    staffWhatsappActiveDebounces = keys.length
  } catch { /* Redis may be unavailable */ }

  res.json({
    uptime: Math.floor(process.uptime()),
    memory: { heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) },
    queues: { pdf: pdfWaiting, linkAcesso: linkWaiting },
    circuits: { asaas: getCircuitStatus('asaas') },
    staffWhatsappActiveDebounces,
    timestamp: new Date().toISOString(),
  })
})

// Observability — confirma que Sentry está configurado no servidor
app.get('/api/health/observability', (_req, res) => {
  res.json({
    sentry_server_configured: !!process.env.SENTRY_DSN_SERVER,
    sentry_server_dsn_prefix: process.env.SENTRY_DSN_SERVER?.slice(0, 25) ?? null,
    node_env: process.env.NODE_ENV,
    release: process.env.RAILWAY_GIT_COMMIT_SHA ?? 'unknown',
    timestamp: new Date().toISOString(),
  })
})

// Upload de exames (lazy import para evitar carregar S3 client no boot)
app.post('/api/upload', uploadLimiter, async (req, res) => {
  const { uploadExame } = await import('../storage.ts')
  await uploadExame(req, res)
})

// Catch-all: servir index.html para rotas do SPA em produção.
// Importante: NÃO servir index.html para assets ausentes (.css, .js, etc) —
// um navegador com tab antiga referenciando hash de build velho receberia
// HTML com Content-Type text/html, levando o browser a recusar com erro de
// MIME. Para qualquer arquivo com extensão, retornamos 404.
if (env.NODE_ENV === 'production') {
  const clientDist = path.resolve(__dirname, '../../dist/client')
  app.get('*', (req, res) => {
    if (/\.[a-zA-Z0-9]+$/.test(req.path)) {
      res.status(404).end()
      return
    }
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.sendFile(path.join(clientDist, 'index.html'), (err) => {
      if (err) {
        logger.error('[server] sendFile index.html falhou', { path: req.path, error: String(err) })
        res.status(503).send('Serviço temporariamente indisponível')
      }
    })
  })
}

// Sentry error handler — must come after all routes, before listen
Sentry.setupExpressErrorHandler(app)

await ensureSchema().catch((err) => {
  logger.error('[server] ensureSchema falhou (continuando)', { error: String(err) })
})

// Configura a regra de lifecycle do S3 (exames-inicio/ expira em 30 dias)
const { ensureS3Lifecycle } = await import('../storage.ts')
await ensureS3Lifecycle().catch((err) => {
  logger.error('[server] ensureS3Lifecycle falhou (continuando)', { error: String(err) })
})

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
  // Force-close keep-alive connections after 10s so server.close() callback fires
  setTimeout(() => server.closeAllConnections?.(), 10_000)

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
