import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { createExpressMiddleware } from '@trpc/server/adapters/express'
import { appRouter } from '../routers.ts'
import { createContext } from './context.ts'
import { env } from './env.ts'

const app = express()

app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({
  origin:      env.MEDSCRIBE_URL,
  credentials: true,
}))
app.use(express.json({ limit: '50mb' }))
app.use(cookieParser())

app.use(
  '/trpc',
  createExpressMiddleware({
    router:      appRouter,
    createContext: ({ req, res }) => createContext({ req, res }),
  }),
)

// Health check
app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }))

// Servir frontend em produção
if (env.NODE_ENV === 'production') {
  const { default: sirv } = await import('sirv')
  app.use(sirv('dist/client', { single: true }))
}

app.listen(env.PORT, () => {
  console.log(`🚀 MedScrita rodando na porta ${env.PORT} [${env.NODE_ENV}]`)
})
