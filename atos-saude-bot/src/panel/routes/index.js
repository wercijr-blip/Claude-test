import { Router } from 'express'
import multer from 'multer'
import { mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { getAgendamentos, deactivateKnowledge, getKnowledge } from '../../services/db.js'
import db from '../../services/db.js'
import { generateExcel } from '../../services/export.js'
import { ingestDocument } from '../../services/knowledge.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const UPLOADS_DIR = join(__dirname, '../../../uploads')
if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true })

const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.txt']
    const ext = '.' + file.originalname.split('.').pop().toLowerCase()
    cb(null, allowed.includes(ext))
  }
})

const apiRouter = Router()

// GET /api/agendamentos
apiRouter.get('/agendamentos', (req, res) => {
  const { status, tipo, especialidade, data } = req.query
  const filters = {}
  if (status) filters.status = status
  if (tipo) filters.tipo = tipo
  if (especialidade) filters.especialidade = especialidade
  if (data) filters.data = data
  const rows = getAgendamentos(filters)
  res.json({ total: rows.length, data: rows })
})

// GET /api/stats
apiRouter.get('/stats', (req, res) => {
  const today = new Date().toISOString().split('T')[0]
  const rows = getAgendamentos({ data: today })
  const allPending = db.prepare('SELECT COUNT(*) as c FROM agendamentos WHERE exported = 0').get()
  res.json({
    hoje: rows.length,
    consultas: rows.filter(r => r.tipo === 'CONSULTA').length,
    infusoes: rows.filter(r => r.tipo === 'INFUSAO').length,
    medicacoes: rows.filter(r => r.tipo === 'MEDICACAO').length,
    particulares: rows.filter(r => r.tipo_atendimento === 'PARTICULAR').length,
    pendentes: allPending?.c || 0
  })
})

// GET /api/medication-requests
apiRouter.get('/medication-requests', (req, res) => {
  const rows = db.prepare('SELECT * FROM medication_requests ORDER BY created_at DESC').all()
  res.json({ total: rows.length, data: rows })
})

// POST /api/export
apiRouter.post('/export', async (req, res) => {
  try {
    const exportAll = req.query.all === 'true'
    const filePath = await generateExcel(exportAll)
    res.download(filePath)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/knowledge
apiRouter.get('/knowledge', (req, res) => {
  const docs = getKnowledge()
  const authStats = db.prepare(`
    SELECT
      COUNT(CASE WHEN DATE(created_at) = DATE('now') THEN 1 END) as hoje,
      COUNT(CASE WHEN confidence = 'HIGH' THEN 1 END) as high,
      COUNT(*) as total
    FROM authorization_queries
  `).get()
  res.json({
    documents: docs,
    stats: {
      perguntasHoje: authStats?.hoje || 0,
      taxaResolucao: authStats?.total > 0
        ? Math.round((authStats.high / authStats.total) * 100)
        : 0
    }
  })
})

// POST /api/knowledge/upload
apiRouter.post('/knowledge/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Arquivo inválido ou não enviado.' })
  try {
    const originalName = req.file.originalname
    const ext = '.' + originalName.split('.').pop().toLowerCase()
    const destPath = join(UPLOADS_DIR, req.file.filename + ext)
    const { renameSync } = await import('fs')
    renameSync(req.file.path, destPath)
    const result = await ingestDocument(destPath)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/knowledge/:id
apiRouter.delete('/knowledge/:id', (req, res) => {
  deactivateKnowledge(Number(req.params.id))
  res.json({ ok: true })
})

export default apiRouter
