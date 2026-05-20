import 'dotenv/config'
// Definir timezone antes de qualquer operação de data — cron jobs precisam de Brasília, não UTC
process.env.TZ = 'America/Sao_Paulo'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { randomUUID } from 'crypto'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mkdirSync, existsSync } from 'fs'

import db from './src/services/db.js'
import { logger } from './src/utils/logger.js'
import { runMigrations } from './src/services/migrations.js'
import { seedKnowledgeBase } from './src/services/knowledge.js'
import { seedDefaultUsers } from './src/services/seed-users.js'
import { initScheduler } from './src/services/scheduler.js'
import {
  getRescheduleToken, markRescheduleTokenUsed,
  getAgendamentoById, updateAgendamentoStatus
} from './src/services/db.js'
import { deleteEvent } from './src/services/calendar.js'
import { sendText } from './src/services/whatsapp.js'
import { msg } from './src/utils/messages.js'
import { notificarEncaixe } from './src/services/scheduler.js'
import webhookRouter from './src/webhook/index.js'
import apiRouter from './src/panel/routes/index.js'
import authRouter from './src/panel/routes/auth.js'
import { openApiSpec } from './src/docs/openapi.js'

// ─── Tratamento de erros não capturados ──────────────────────────────────────
process.on('uncaughtException', (err) => {
  logger.error({ err: err.message, stack: err.stack }, 'Exceção não capturada — encerrando processo')
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  logger.error({ reason: String(reason) }, 'Promise rejeitada sem tratamento')
})

// ─── Validação de variáveis de ambiente obrigatórias ────────────────────────
const REQUIRED_ENV = ['EVOLUTION_URL', 'EVOLUTION_API_KEY', 'ANTHROPIC_API_KEY']
const missing = REQUIRED_ENV.filter(k => !process.env[k])
if (missing.length > 0) {
  logger.warn(`Variáveis de ambiente não configuradas: ${missing.join(', ')}. Algumas funcionalidades estarão inativas.`)
}
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET é obrigatório em produção. Configure a variável de ambiente.')
  } else {
    logger.warn('JWT_SECRET não definido — usando chave padrão INSEGURA. Configure JWT_SECRET em produção!')
  }
}
if (process.env.NODE_ENV === 'production' && !process.env.PII_ENCRYPTION_KEY) {
  throw new Error('PII_ENCRYPTION_KEY é obrigatória em produção para proteger dados pessoais (LGPD). Gere com: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"')
}
if (process.env.NODE_ENV === 'production' && !process.env.EVOLUTION_WEBHOOK_SECRET) {
  throw new Error('EVOLUTION_WEBHOOK_SECRET é obrigatório em produção. Configure o mesmo valor na Evolution API e aqui para autenticar webhooks.')
}
if (process.env.NODE_ENV === 'production' && !process.env.BASE_URL) {
  logger.warn('BASE_URL não configurada — links de remarcação usarão localhost')
}

const __dirname = dirname(fileURLToPath(import.meta.url))

// DATA_DIR aponta para volume persistente (Railway) ou raiz do projeto em dev
const DATA_DIR = process.env.DATA_DIR || __dirname
const uploadsDir = join(DATA_DIR, 'uploads')
if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true })

runMigrations()
logger.info('Banco de dados inicializado e migrations aplicadas')

await seedKnowledgeBase()
seedDefaultUsers()
initScheduler()

const app = express()

app.set('trust proxy', 1)

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-eval'", 'cdn.tailwindcss.com', 'cdn.jsdelivr.net'],
      styleSrc: ["'self'", "'unsafe-inline'", 'cdn.tailwindcss.com', 'cdn.jsdelivr.net'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'data:', 'cdn.jsdelivr.net'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    }
  }
}))

if (process.env.NODE_ENV === 'production' && !process.env.PANEL_ORIGIN) {
  throw new Error('PANEL_ORIGIN é obrigatório em produção. Configure a variável de ambiente.')
}
app.use(cors({
  origin: process.env.PANEL_ORIGIN || `http://localhost:${process.env.PORT || 3000}`,
  credentials: true
}))

if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.protocol !== 'https') {
      return res.redirect(301, 'https://' + req.headers.host + req.url)
    }
    next()
  })
}

app.use(express.json({ limit: '1mb' }))

// Request ID para rastreamento em logs — correlaciona request ↔ log entry
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || randomUUID()
  res.setHeader('x-request-id', req.id)
  logger.info({ reqId: req.id, method: req.method, url: req.url }, 'Request recebido')
  next()
})

// Rate limiting global na API (evita abuso)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em instantes.' }
})
app.use('/api', apiLimiter)

// Health check com validação de DB + Evolution API (timeout 2s)
app.get('/health', async (req, res) => {
  let dbOk = false
  try { db.prepare('SELECT 1').get(); dbOk = true } catch {}

  let whatsapp = 'unchecked'
  const evoUrl = process.env.EVOLUTION_URL
  const evoInstance = process.env.INSTANCE_NAME || 'atos-saude'
  if (evoUrl) {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 2000)
      const r = await fetch(
        `${evoUrl}/instance/connectionState/${evoInstance}`,
        { headers: { apikey: process.env.EVOLUTION_API_KEY || '' }, signal: ctrl.signal }
      )
      clearTimeout(t)
      whatsapp = r.ok ? 'ok' : 'error'
    } catch { whatsapp = 'error' }
  }

  const status = dbOk ? 200 : 503
  res.status(status).json({
    ok: dbOk,
    uptime: process.uptime(),
    db: dbOk ? 'ok' : 'error',
    whatsapp,
    ts: new Date().toISOString()
  })
})

// Webhook WhatsApp
app.use('/webhook', webhookRouter)
logger.info('Webhook ativo em /webhook')

// Auth — montado em /api/auth (antes de /api para match mais específico)
app.use('/api/auth', authRouter)

// API (protegida — requireAuth aplicado dentro do router)
app.use('/api', apiRouter)

// Painel web
app.get('/painel', (req, res) => {
  res.sendFile(join(__dirname, 'src/panel/index.html'))
})

// Documentação OpenAPI — Swagger UI
app.get('/docs/spec.json', (req, res) => {
  res.json(openApiSpec)
})
app.get('/docs', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Atos Saúde Bot — API Docs</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
<div id="swagger-ui"></div>
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>
  SwaggerUIBundle({
    url: '/docs/spec.json',
    dom_id: '#swagger-ui',
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
    layout: 'BaseLayout',
    deepLinking: true,
    persistAuthorization: true,
    tryItOutEnabled: true
  })
</script>
</body>
</html>`)
})

// Link de remarcação — GET /remarcar/:token
app.get('/remarcar/:token', async (req, res) => {
  const record = getRescheduleToken(req.params.token)
  if (!record) {
    return res.send(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Link inválido</title></head>
      <body style="font-family:sans-serif;text-align:center;padding:60px">
        <h2>⚠️ Link expirado ou já utilizado</h2>
        <p>Este link de remarcação não é mais válido.</p>
        <p>Entre em contato: <strong>(61) 4042-7188</strong></p>
      </body></html>`)
  }

  const ag = getAgendamentoById(record.agendamento_id)
  if (!ag || ag.status === 'CANCELADO') {
    markRescheduleTokenUsed(req.params.token)
    return res.send(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Consulta cancelada</title></head>
      <body style="font-family:sans-serif;text-align:center;padding:60px">
        <h2>✅ Consulta já foi cancelada</h2>
        <p>Entre em contato para remarcar: <strong>(61) 4042-7188</strong></p>
      </body></html>`)
  }

  // Cancela a consulta, libera o slot e notifica o paciente para remarcar pelo bot
  markRescheduleTokenUsed(req.params.token)
  updateAgendamentoStatus(ag.id, 'CANCELADO')
  if (ag.google_event_id && ag.medico_id) {
    await deleteEvent(ag.medico_id, ag.google_event_id).catch(() => {})
  }
  if (ag.phone) {
    await sendText(ag.phone, msg('remarcar_slot_cancelado', { nome: ag.nome })).catch(() => {})
  }
  // Notifica fila de encaixe sobre o slot liberado
  await notificarEncaixe(ag).catch(() => {})

  res.send(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Remarcação</title></head>
    <body style="font-family:sans-serif;text-align:center;padding:60px;color:#1E3A5F">
      <h2>🔄 Consulta cancelada com sucesso!</h2>
      <p>Sua consulta foi cancelada. Para remarcar, envie uma mensagem no WhatsApp:</p>
      <a href="https://wa.me/556140427188?text=oi"
         style="display:inline-block;margin-top:20px;padding:14px 28px;background:#25D366;color:white;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px">
        💬 Remarcar pelo WhatsApp
      </a>
      <p style="margin-top:30px;color:#888;font-size:14px">Atos Saúde Integrada | (61) 4042-7188</p>
    </body></html>`)
})

// Central error handler — prevents internal details from leaking to clients
app.use((err, req, res, _next) => {
  logger.error({ reqId: req.id, err: err.message, stack: err.stack }, 'Erro não tratado na requisição')
  const status = err.status || err.statusCode || 500
  res.status(status).json({ error: status < 500 ? err.message : 'Erro interno do servidor' })
})

const PORT = process.env.PORT || 3000
const server = app.listen(PORT, () => {
  logger.info(`Painel disponível em http://localhost:${PORT}/painel`)
})

function shutdown(signal) {
  logger.info(`${signal} recebido — encerrando servidor`)
  server.close(() => {
    db.close()
    process.exit(0)
  })
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))
