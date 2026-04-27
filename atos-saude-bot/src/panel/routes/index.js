import { Router } from 'express'
import multer from 'multer'
import axios from 'axios'
import { mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  getAgendamentos, getAgendamentoById, updateAgendamentoStatus, deactivateKnowledge,
  getKnowledge, getSatisfactionResponses, insertAgendamento,
  getEncaixeQueue, insertEncaixe, removeEncaixe,
  getHumanWaitingSessions, clearSession,
  getConversations, getConversationByPhone
} from '../../services/db.js'
import db from '../../services/db.js'
import { generateExcel } from '../../services/export.js'
import { ingestDocument } from '../../services/knowledge.js'
import { deleteEvent, createBlockEvent, createEvent, getDoctorSlots, createDoctorCalendar } from '../../services/calendar.js'
import { sendText } from '../../services/whatsapp.js'
import { msg, invalidateCache } from '../../utils/messages.js'
import { fmtHora, fmtData, notificarEncaixe } from '../../services/scheduler.js'
import { requireAuth } from '../../services/auth.js'
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

// Todas as rotas da API exigem autenticação
apiRouter.use(requireAuth())

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

// POST /api/agendamentos/:id/cancelar  (admin + secretaria)
// requireAuth já aplicado globalmente; verificamos role aqui
apiRouter.use('/agendamentos/:id/cancelar', (req, res, next) => {
  if (req.method === 'POST' && !['admin','secretaria'].includes(req.user?.role))
    return res.status(403).json({ error: 'Sem permissão.' })
  next()
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

// GET /api/slots?doctorId=X&date=YYYY-MM-DD  (horários disponíveis para marcação manual)
apiRouter.get('/slots', async (req, res) => {
  const { doctorId, date } = req.query
  if (!doctorId || !date) return res.status(400).json({ error: 'doctorId e date são obrigatórios.' })
  try {
    const slots = await getDoctorSlots(doctorId, 30, 50)
    const filtered = slots.filter(s => {
      const d = new Date(s.datetime)
      const slotDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return slotDate === date
    })
    res.json(filtered.map(s => ({
      iso: new Date(s.datetime).toISOString(),
      hora: fmtHora(s.datetime),
      doctorId: s.doctorId,
      doctorNome: s.doctorNome,
      especialidade: s.especialidade
    })))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/agendamentos/manual  (marcação manual pela secretária)
apiRouter.post('/agendamentos/manual', async (req, res) => {
  const { doctorId, slotISO, nome, nascimento, telefone, tipoAtendimento, convenio, phone } = req.body
  if (!doctorId || !slotISO || !nome || !nascimento || !telefone) {
    return res.status(400).json({ error: 'Campos obrigatórios: doctorId, slotISO, nome, nascimento, telefone.' })
  }
  if (!['CONVENIO', 'PARTICULAR'].includes(tipoAtendimento)) {
    return res.status(400).json({ error: 'tipoAtendimento deve ser CONVENIO ou PARTICULAR.' })
  }
  if (tipoAtendimento === 'CONVENIO' && !convenio?.trim()) {
    return res.status(400).json({ error: 'Informe o nome do convênio.' })
  }
  if (isNaN(Date.parse(slotISO))) {
    return res.status(400).json({ error: 'slotISO inválido.' })
  }

  const doctorsConfig = JSON.parse(readFileSync(
    new URL('../../config/doctors.json', import.meta.url), 'utf-8'
  ))
  const doctor = doctorsConfig.doctors.find(d => d.id === doctorId)
  if (!doctor) return res.status(404).json({ error: 'Médico não encontrado.' })

  // Cria evento no Google Calendar
  const patientData = { nome, nascimento, telefone_contato: telefone, convenio_informado: convenio, especialidade: doctor.especialidade }
  const googleEventId = await createEvent(doctorId, new Date(slotISO), patientData)

  // Salva no banco
  const agId = insertAgendamento({
    phone: phone || null,
    tipo: 'CONSULTA',
    especialidade: doctor.especialidade,
    medico_nome: doctor.nome,
    medico_id: doctorId,
    slot_datetime: new Date(slotISO).toISOString(),
    tipo_atendimento: tipoAtendimento || 'CONVENIO',
    convenio_informado: convenio || null,
    nome,
    nascimento,
    telefone_contato: telefone,
    google_event_id: googleEventId,
    status: 'CONFIRMADO'
  })

  // Envia confirmação ao paciente (se tiver WhatsApp)
  if (phone) {
    const { diaSemana, data } = fmtData(slotISO)
    const hora = fmtHora(slotISO)
    await sendText(phone, msg('confirmacao_marcacao_manual', {
      nome, medico: doctor.nome, especialidade: doctor.especialidade, diaSemana, data, hora
    }))
  }

  res.json({ ok: true, agId, googleEventId })
})

// GET /api/messages  (leitura das mensagens configuráveis)
apiRouter.get('/messages', (req, res) => {
  try {
    const m = JSON.parse(readFileSync(
      new URL('../../config/messages.json', import.meta.url), 'utf-8'
    ))
    res.json(m)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/messages  (admin only)
apiRouter.put('/messages', requireAuth(['admin']), async (req, res) => {
  try {
    const { writeFileSync } = await import('fs')
    const filePath = new URL('../../config/messages.json', import.meta.url)
    writeFileSync(filePath, JSON.stringify(req.body, null, 2), 'utf-8')
    invalidateCache()
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/doctors/all  (admin — inclui inativos + workingHours)
apiRouter.get('/doctors/all', requireAuth(['admin']), (req, res) => {
  try {
    const config = JSON.parse(readFileSync(new URL('../../config/doctors.json', import.meta.url), 'utf-8'))
    res.json(config)
  } catch { res.json({ doctors: [], workingHours: {} }) }
})

// POST /api/doctors  (admin — criar médico + cria Google Calendar automaticamente)
apiRouter.post('/doctors', requireAuth(['admin']), async (req, res) => {
  try {
    const { writeFileSync } = await import('fs')
    const filePath = new URL('../../config/doctors.json', import.meta.url)
    const config = JSON.parse(readFileSync(filePath, 'utf-8'))
    const { nome, crm, especialidade, whatsapp, email, calendarId, slotDurationMinutes } = req.body
    if (!nome || !especialidade) return res.status(400).json({ error: 'nome e especialidade são obrigatórios.' })

    // Cria Google Calendar automaticamente via Service Account
    let resolvedCalendarId = calendarId || null
    let calendarCriado = false
    if (!resolvedCalendarId || resolvedCalendarId === 'PREENCHER') {
      resolvedCalendarId = await createDoctorCalendar(nome, especialidade, email || null)
      calendarCriado = !!resolvedCalendarId
    }

    const doctor = {
      id: 'dr_' + Date.now(),
      nome, crm: crm || '', especialidade,
      email: email || '',
      calendarId: resolvedCalendarId || 'PREENCHER',
      whatsapp: whatsapp || '',
      slotDurationMinutes: Number(slotDurationMinutes) || 30,
      schedule: null,
      active: true
    }
    config.doctors.push(doctor)
    writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8')
    res.json({ ok: true, doctor, calendarCriado, calendarId: resolvedCalendarId })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// PUT /api/doctors/:id  (admin — atualizar médico ou agenda)
apiRouter.put('/doctors/:id', requireAuth(['admin']), async (req, res) => {
  try {
    const { writeFileSync } = await import('fs')
    const filePath = new URL('../../config/doctors.json', import.meta.url)
    const config = JSON.parse(readFileSync(filePath, 'utf-8'))
    const idx = config.doctors.findIndex(d => d.id === req.params.id)
    if (idx === -1) return res.status(404).json({ error: 'Médico não encontrado.' })
    const allowed = ['nome','crm','especialidade','whatsapp','calendarId','slotDurationMinutes','schedule','active']
    for (const key of allowed) {
      if (req.body[key] !== undefined) config.doctors[idx][key] = req.body[key]
    }
    writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8')
    res.json({ ok: true, doctor: config.doctors[idx] })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// PUT /api/config/working-hours  (admin — horário padrão da clínica)
apiRouter.put('/config/working-hours', requireAuth(['admin']), async (req, res) => {
  try {
    const { writeFileSync } = await import('fs')
    const filePath = new URL('../../config/doctors.json', import.meta.url)
    const config = JSON.parse(readFileSync(filePath, 'utf-8'))
    config.workingHours = req.body
    writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8')
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /api/doctors  (ativos — para formulários de marcação)
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

// POST /api/export  (admin + faturamento)
apiRouter.post('/export', requireAuth(['admin','faturamento']), async (req, res) => {
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

// ─── Fila de Encaixe ────────────────────────────────────────────────────────

// GET /api/encaixe
apiRouter.get('/encaixe', (req, res) => {
  res.json(getEncaixeQueue())
})

// POST /api/encaixe  (inscrever paciente na fila)
apiRouter.post('/encaixe', (req, res) => {
  const { phone, nome, especialidade, medico_id } = req.body
  if (!phone) return res.status(400).json({ error: 'phone é obrigatório.' })
  const id = insertEncaixe({ phone, nome, especialidade, medico_id })
  res.json({ ok: true, id })
})

// DELETE /api/encaixe/:id
apiRouter.delete('/encaixe/:id', (req, res) => {
  removeEncaixe(Number(req.params.id))
  res.json({ ok: true })
})

// ─── Atendimento humano aguardando ─────────────────────────────────────────

// GET /api/human-waiting
apiRouter.get('/human-waiting', (req, res) => {
  const sessions = getHumanWaitingSessions(10)
  res.json({ total: sessions.length, data: sessions })
})

// ─── Cancelamento com notificação de encaixe ──────────────────────────────
apiRouter.post('/agendamentos/:id/cancelar-encaixe', async (req, res) => {
  const ag = getAgendamentoById(Number(req.params.id))
  if (!ag) return res.status(404).json({ error: 'Agendamento não encontrado.' })
  if (ag.status !== 'CANCELADO') return res.status(400).json({ error: 'Agendamento não está cancelado.' })
  await notificarEncaixe(ag).catch(() => {})
  res.json({ ok: true })
})

// POST /api/sessions/:phone/encerrar  (secretaria/admin marca atendimento humano como assumido)
apiRouter.post('/sessions/:phone/encerrar', (req, res) => {
  if (!['admin','secretaria'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'Sem permissão.' })
  }
  clearSession(req.params.phone)
  res.json({ ok: true })
})

// ─── Monitor de Conversas ──────────────────────────────────────────────────

// GET /api/conversations  (lista todas as conversas com última mensagem)
apiRouter.get('/conversations', requireAuth(['admin','secretaria']), (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500)
  const rows = getConversations(limit)
  res.json({ total: rows.length, data: rows })
})

// GET /api/conversations/:phone  (histórico completo de um número)
apiRouter.get('/conversations/:phone', requireAuth(['admin','secretaria']), (req, res) => {
  const messages = getConversationByPhone(req.params.phone)
  res.json({ phone: req.params.phone, total: messages.length, data: messages })
})

// ─── WhatsApp / Evolution API ──────────────────────────────────────────────

function evolutionHeaders() {
  return { apikey: process.env.EVOLUTION_API_KEY }
}
const EVO_URL = () => process.env.EVOLUTION_URL
const EVO_INSTANCE = () => process.env.INSTANCE_NAME || 'atos-saude'

// GET /api/whatsapp/status
apiRouter.get('/whatsapp/status', requireAuth(['admin']), async (req, res) => {
  try {
    const r = await axios.get(
      `${EVO_URL()}/instance/connectionState/${EVO_INSTANCE()}`,
      { headers: evolutionHeaders() }
    )
    res.json(r.data)
  } catch (err) {
    res.status(502).json({ error: err.response?.data?.message || err.message })
  }
})

// GET /api/whatsapp/qr
apiRouter.get('/whatsapp/qr', requireAuth(['admin']), async (req, res) => {
  try {
    const r = await axios.get(
      `${EVO_URL()}/instance/connect/${EVO_INSTANCE()}`,
      { headers: evolutionHeaders() }
    )
    res.json(r.data)
  } catch (err) {
    res.status(502).json({ error: err.response?.data?.message || err.message })
  }
})

// POST /api/whatsapp/logout
apiRouter.post('/whatsapp/logout', requireAuth(['admin']), async (req, res) => {
  try {
    const r = await axios.delete(
      `${EVO_URL()}/instance/logout/${EVO_INSTANCE()}`,
      { headers: evolutionHeaders() }
    )
    res.json(r.data)
  } catch (err) {
    res.status(502).json({ error: err.response?.data?.message || err.message })
  }
})

// POST /api/whatsapp/restart
apiRouter.post('/whatsapp/restart', requireAuth(['admin']), async (req, res) => {
  try {
    const r = await axios.put(
      `${EVO_URL()}/instance/restart/${EVO_INSTANCE()}`,
      {},
      { headers: evolutionHeaders() }
    )
    res.json(r.data)
  } catch (err) {
    res.status(502).json({ error: err.response?.data?.message || err.message })
  }
})

export default apiRouter
