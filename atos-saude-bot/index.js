import 'dotenv/config'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mkdirSync, existsSync } from 'fs'

import db from './src/services/db.js'
import { logger } from './src/utils/logger.js'
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

// ─── Validação de variáveis de ambiente obrigatórias ────────────────────────
const REQUIRED_ENV = ['EVOLUTION_URL', 'EVOLUTION_API_KEY', 'ANTHROPIC_API_KEY']
const missing = REQUIRED_ENV.filter(k => !process.env[k])
if (missing.length > 0) {
  logger.warn(`Variáveis de ambiente não configuradas: ${missing.join(', ')}. Algumas funcionalidades estarão inativas.`)
}
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET é obrigatório em produção. Configure a variável de ambiente.')
  }
  logger.warn('JWT_SECRET não definido — usando chave padrão INSEGURA. Configure JWT_SECRET em produção!')
}

const __dirname = dirname(fileURLToPath(import.meta.url))

const uploadsDir = join(__dirname, 'uploads')
if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true })

logger.info('Banco de dados inicializado')

await seedKnowledgeBase()
seedDefaultUsers()
initScheduler()

const app = express()

app.set('trust proxy', 1)

app.use(helmet({
  contentSecurityPolicy: false // painel usa CDN inline — ajustar CSP por fase se necessário
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

// Health check (Railway / load-balancer)
app.get('/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }))

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

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  logger.info(`Painel disponível em http://localhost:${PORT}/painel`)
})
