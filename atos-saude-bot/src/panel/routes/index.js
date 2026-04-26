import { Router } from 'express'
import multer from 'multer'
import { mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { getAgendamentos, getAgendamentoById, updateAgendamentoStatus, deactivateKnowledge, getKnowledge, getSatisfactionResponses } from '../../services/db.js'
import db from '../../services/db.js'
import { generateExcel } from '../../services/export.js'
import { ingestDocument } from '../../services/knowledge.js'
import { deleteEvent, createBlockEvent } from '../../services/calendar.js'
import { sendText } from '../../services/whatsapp.js'
import { readFileSync } from 'fs'

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

// POST /api/agendamentos/:id/cancelar
apiRouter.post('/agendamentos/:id/cancelar', async (req, res) => {
  const ag = getAgendamentoById(Number(req.params.id))
  if (!ag) return res.status(404).json({ error: 'Agendamento não encontrado.' })
  if (ag.status === 'CANCELADO') return res.json({ ok: true, msg: 'Já estava cancelado.' })

  // 1. Atualiza status no banco
  updateAgendamentoStatus(ag.id, 'CANCELADO')

  // 2. Remove evento do Google Calendar (se existir)
  let gcalRemovido = false
  if (ag.google_event_id && ag.medico_id) {
    gcalRemovido = await deleteEvent(ag.medico_id, ag.google_event_id)
  }

  // 3. Notifica o paciente via WhatsApp (se tiver telefone)
  let pacienteNotificado = false
  if (ag.phone) {
    let dataHora = ''
    if (ag.slot_datetime) {
      const d = new Date(ag.slot_datetime)
      const pad = n => String(n).padStart(2, '0')
      dataHora = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} às ${pad(d.getHours())}h${pad(d.getMinutes())}`
    }
    const msg =
      `⚠️ Olá, *${ag.nome}*!\n\n` +
      `Precisamos informar que sua consulta foi *cancelada*:\n\n` +
      `🩺 ${ag.especialidade || 'Consulta médica'}\n` +
      `👨‍⚕️ ${ag.medico_nome || 'Médico da Atos Saúde'}\n` +
      (dataHora ? `📅 ${dataHora}\n` : '') +
      `\nPor favor, entre em contato para reagendar:\n` +
      `📞 *(61) 4042-7188*\n` +
      `_Pedimos desculpas pelo transtorno._ 🙏\n` +
      `*Atos Saúde Integrada* 🏥`
    pacienteNotificado = await sendText(ag.phone, msg)
  }

  res.json({ ok: true, gcalRemovido, pacienteNotificado })
})

// POST /api/calendar/bloquear
apiRouter.post('/calendar/bloquear', async (req, res) => {
  const { doctorId, startISO, endISO, motivo } = req.body
  if (!doctorId || !startISO || !endISO) {
    return res.status(400).json({ error: 'doctorId, startISO e endISO são obrigatórios.' })
  }

  // Cancela e notifica todos os agendamentos de CONSULTA do médico naquele período
  const afetados = db.prepare(`
    SELECT * FROM agendamentos
    WHERE medico_id = ? AND slot_datetime >= ? AND slot_datetime <= ?
    AND tipo = 'CONSULTA' AND status != 'CANCELADO'
  `).all(doctorId, startISO, endISO)

  const resultados = []
  for (const ag of afetados) {
    updateAgendamentoStatus(ag.id, 'CANCELADO')
    if (ag.google_event_id) await deleteEvent(ag.medico_id, ag.google_event_id)

    if (ag.phone) {
      let dataHora = ''
      if (ag.slot_datetime) {
        const d = new Date(ag.slot_datetime)
        const pad = n => String(n).padStart(2, '0')
        dataHora = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} às ${pad(d.getHours())}h${pad(d.getMinutes())}`
      }
      const msg =
        `⚠️ Olá, *${ag.nome}*!\n\n` +
        `Infelizmente a agenda do *${ag.medico_nome || 'médico'}* ` +
        `precisou ser *cancelada*${motivo ? ` (${motivo})` : ''}.\n\n` +
        (dataHora ? `📅 Sua consulta: *${dataHora}*\n\n` : '') +
        `Por favor, entre em contato para reagendar:\n` +
        `📞 *(61) 4042-7188*\n` +
        `_Pedimos desculpas pelo inconveniente._ 🙏\n` +
        `*Atos Saúde Integrada* 🏥`
      await sendText(ag.phone, msg)
    }
    resultados.push({ id: ag.id, nome: ag.nome })
  }

  // Cria evento de bloqueio no Google Calendar
  const blockEventId = await createBlockEvent(doctorId, startISO, endISO, motivo || 'BLOQUEADO')

  res.json({
    ok: true,
    blockEventId,
    pacientesNotificados: resultados.length,
    detalhes: resultados
  })
})

// GET /api/doctors
apiRouter.get('/doctors', (req, res) => {
  try {
    const config = JSON.parse(readFileSync(
      new URL('../../config/doctors.json', import.meta.url),
      'utf-8'
    ))
    res.json(config.doctors.filter(d => d.active))
  } catch {
    res.json([])
  }
})

// GET /api/satisfaction
apiRouter.get('/satisfaction', (req, res) => {
  const rows = getSatisfactionResponses()
  const stats = db.prepare(`
    SELECT
      ROUND(AVG(nota), 1) as media,
      COUNT(*) as total,
      COUNT(CASE WHEN nota = 5 THEN 1 END) as excelente,
      COUNT(CASE WHEN nota = 4 THEN 1 END) as bom,
      COUNT(CASE WHEN nota = 3 THEN 1 END) as regular,
      COUNT(CASE WHEN nota <= 2 THEN 1 END) as ruim
    FROM satisfaction_responses
  `).get()
  res.json({ data: rows, stats })
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
