import 'dotenv/config'
import express from 'express'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'
import { mkdirSync, existsSync } from 'fs'

import db from './src/services/db.js'
import { logger } from './src/utils/logger.js'
import { seedKnowledgeBase } from './src/services/knowledge.js'
import { initScheduler } from './src/services/scheduler.js'
import webhookRouter from './src/webhook/index.js'
import apiRouter from './src/panel/routes/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Ensure uploads dir exists
const uploadsDir = join(__dirname, 'uploads')
if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true })

logger.info('Banco de dados inicializado')

await seedKnowledgeBase()
initScheduler()

const app = express()
app.use(express.json())

// Webhook
app.use('/webhook', webhookRouter)
logger.info('Webhook ativo em /webhook')

// API
app.use('/api', apiRouter)

// Panel
app.get('/painel', (req, res) => {
  res.sendFile(join(__dirname, 'src/panel/index.html'))
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  logger.info(`Painel disponível em http://localhost:${PORT}/painel`)
})
