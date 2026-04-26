import 'dotenv/config'
import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mkdirSync, existsSync } from 'fs'

import db from './src/services/db.js'
import { logger } from './src/utils/logger.js'
import { seedKnowledgeBase } from './src/services/knowledge.js'
import { seedDefaultUsers } from './src/services/seed-users.js'
import { initScheduler } from './src/services/scheduler.js'
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
app.use(express.json())

// Webhook WhatsApp
app.use('/webhook', webhookRouter)
logger.info('Webhook ativo em /webhook')

// Auth (sem middleware de autenticação)
app.use('/auth', authRouter)

// API (protegida — requireAuth aplicado dentro do router)
app.use('/api', apiRouter)

// Painel web
app.get('/painel', (req, res) => {
  res.sendFile(join(__dirname, 'src/panel/index.html'))
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  logger.info(`Painel disponível em http://localhost:${PORT}/painel`)
})
