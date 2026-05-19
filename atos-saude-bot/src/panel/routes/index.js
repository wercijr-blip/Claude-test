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
  getConversations, getConversationByPhone,
  getExamSubmissions, insertMessageLog, upsertSession,
  getAllUsers, insertUser, updateUserPassword, toggleUserActive
} from '../../services/db.js'
import db from '../../services/db.js'
import { generateExcel } from '../../services/export.js'
import { ingestDocument } from '../../services/knowledge.js'
import { deleteEvent, createBlockEvent, createEvent, getDoctorSlots, createDoctorCalendar } from '../../services/calendar.js'
import { sendText } from '../../services/whatsapp.js'
import { msg, invalidateCache } from '../../utils/messages.js'
import { fmtHora, fmtData, notificarEncaixe } from '../../services/scheduler.js'
import { requireAuth, hashPassword } from '../../services/auth.js'
import { readFileSync, writeFileSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const UPLOADS_DIR = join(__dirname, '../../../uploads')

const DOCTORS_FILE = new URL('../../config/doctors.json', import.meta.url)
function loadDoctorsConfig() {
  try { return JSON.parse(readFileSync(DOCTORS_FILE, 'utf-8')) } catch { return { doctors: [], workingHours: {} } }
}
function saveDoctorsConfig(config) {
  writeFileSync(DOCTORS_FILE, JSON.stringify(config, null, 2), 'utf-8')
}
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
  res.json(readMessages())
})

// PUT /api/messages  (admin only)
apiRouter.put('/messages', requireAuth(['admin']), async (req, res) => {
  try {
    await writeMessages(req.body)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/doctors/all  (admin — inclui inativos + workingHours)
apiRouter.get('/doctors/all', requireAuth(['admin']), (req, res) => {
  res.json(loadDoctorsConfig())
})

// POST /api/doctors  (admin — criar médico + cria Google Calendar automaticamente)
apiRouter.post('/doctors', requireAuth(['admin']), async (req, res) => {
  try {
    const config = loadDoctorsConfig()
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
    saveDoctorsConfig(config)
    res.json({ ok: true, doctor, calendarCriado, calendarId: resolvedCalendarId })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// PUT /api/doctors/:id  (admin — atualizar médico ou agenda)
apiRouter.put('/doctors/:id', requireAuth(['admin']), (req, res) => {
  try {
    const config = loadDoctorsConfig()
    const idx = config.doctors.findIndex(d => d.id === req.params.id)
    if (idx === -1) return res.status(404).json({ error: 'Médico não encontrado.' })
    const allowed = ['nome','crm','especialidade','whatsapp','calendarId','slotDurationMinutes','schedule','active']
    for (const key of allowed) {
      if (req.body[key] !== undefined) config.doctors[idx][key] = req.body[key]
    }
    saveDoctorsConfig(config)
    res.json({ ok: true, doctor: config.doctors[idx] })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// PUT /api/config/working-hours  (admin — horário padrão da clínica)
apiRouter.put('/config/working-hours', requireAuth(['admin']), (req, res) => {
  try {
    const config = loadDoctorsConfig()
    config.workingHours = req.body
    saveDoctorsConfig(config)
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /api/doctors  (ativos — para formulários de marcação)
apiRouter.get('/doctors', (req, res) => {
  try {
    res.json(loadDoctorsConfig().doctors.filter(d => d.active))
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

// ─── Exames ───────────────────────────────────────────────────────────────────

// GET /api/exames
apiRouter.get('/exames', requireAuth(['admin','secretaria']), (req, res) => {
  const rows = getExamSubmissions()
  res.json({ total: rows.length, data: rows })
})

// GET /api/exames/:id/download  (serve o arquivo salvo em disco)
apiRouter.get('/exames/:id/download', requireAuth(['admin','secretaria']), (req, res) => {
  const rows = getExamSubmissions()
  const exam = rows.find(e => String(e.id) === String(req.params.id))
  if (!exam || !exam.file_path) return res.status(404).json({ error: 'Arquivo não encontrado' })
  res.download(exam.file_path)
})

// ─── Conversations reply ──────────────────────────────────────────────────────

// POST /api/conversations/:phone/reply
apiRouter.post('/conversations/:phone/reply', requireAuth(['admin','secretaria']), async (req, res) => {
  const { phone } = req.params
  const { text } = req.body
  if (!text || !text.trim()) return res.status(400).json({ error: 'Texto obrigatório' })
  try {
    await sendText(phone, text.trim())
    // Força sessão para HUMANO para silenciar o bot
    upsertSession(phone, { flow: 'HUMANO', step: 'HUMANO', human_transfer_at: new Date().toISOString() })
    insertMessageLog({ phone, direction: 'OUT', text: text.trim(), flow: 'HUMANO', step: 'HUMANO' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── /api/sessions/humanas ────────────────────────────────────────────────────

// GET /api/sessions/humanas — alias de /api/human-waiting
apiRouter.get('/sessions/humanas', requireAuth(['admin','secretaria']), (req, res) => {
  const rows = getHumanWaitingSessions(0)
  res.json({ total: rows.length, data: rows })
})

// POST /api/sessions/:phone/assume — operador assume o atendimento
apiRouter.post('/sessions/:phone/assume', requireAuth(['admin','secretaria']), (req, res) => {
  upsertSession(req.params.phone, {
    flow: 'HUMANO', step: 'HUMANO',
    human_transfer_at: new Date().toISOString()
  })
  res.json({ ok: true })
})

// ─── Aliases PT-BR ────────────────────────────────────────────────────────────

// GET /api/medicacoes — alias de /api/medication-requests
apiRouter.get('/medicacoes', requireAuth(['admin','secretaria','faturamento']), (req, res) => {
  const rows = db.prepare('SELECT * FROM medication_requests ORDER BY created_at DESC').all()
  res.json({ total: rows.length, data: rows })
})

// GET /api/satisfacao — alias de /api/satisfaction
apiRouter.get('/satisfacao', requireAuth(['admin','secretaria','faturamento']), (req, res) => {
  const rows = getSatisfactionResponses()
  res.json({ total: rows.length, data: rows })
})

// GET /api/conhecimento — alias de /api/knowledge (retorna só documentos)
apiRouter.get('/conhecimento', requireAuth(['admin','secretaria']), (req, res) => {
  const docs = getKnowledge()
  res.json({ total: docs.length, data: docs })
})

// POST /api/conhecimento — adicionar texto simples (sem upload de arquivo)
apiRouter.post('/conhecimento', requireAuth(['admin']), async (req, res) => {
  const { filename, category, content } = req.body
  if (!filename || !content) return res.status(400).json({ error: 'filename e content são obrigatórios.' })
  const { insertKnowledge } = await import('../../services/db.js')
  const id = insertKnowledge({ filename, category: category || 'geral', content })
  res.json({ ok: true, id })
})

// DELETE /api/conhecimento/:id — alias de /api/knowledge/:id
apiRouter.delete('/conhecimento/:id', requireAuth(['admin']), (req, res) => {
  deactivateKnowledge(Number(req.params.id))
  res.json({ ok: true })
})

// PATCH /api/agendamentos/:id/status — confirmar ou cancelar
apiRouter.patch('/agendamentos/:id/status', requireAuth(['admin','secretaria']), async (req, res) => {
  const { status } = req.body
  if (!['CONFIRMADO','CANCELADO','PENDENTE'].includes(status)) {
    return res.status(400).json({ error: 'status inválido.' })
  }
  const ag = getAgendamentoById(Number(req.params.id))
  if (!ag) return res.status(404).json({ error: 'Agendamento não encontrado.' })
  updateAgendamentoStatus(Number(req.params.id), status)
  res.json({ ok: true })
})

// GET /api/agendamentos/export — alias de POST /api/export
apiRouter.get('/agendamentos/export', requireAuth(['admin','faturamento']), async (req, res) => {
  try {
    const filePath = await generateExcel(req.query.all === 'true')
    res.download(filePath)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /api/agenda/bloquear — alias de /api/calendar/bloquear
apiRouter.post('/agenda/bloquear', requireAuth(['admin','secretaria']), async (req, res) => {
  const { data, medico_id, obs } = req.body
  if (!data) return res.status(400).json({ error: 'data é obrigatória.' })
  const startISO = new Date(data + 'T00:00:00').toISOString()
  const endISO   = new Date(data + 'T23:59:59').toISOString()
  try {
    if (medico_id) await createBlockEvent(medico_id, startISO, endISO, obs || 'BLOQUEADO')
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── /api/textos (alias CRUD sobre messages.json) ────────────────────────────

const MSG_FILE = new URL('../../config/messages.json', import.meta.url)
function readMessages() {
  try { return JSON.parse(readFileSync(MSG_FILE, 'utf-8')) } catch { return {} }
}
async function writeMessages(data) {
  const { writeFileSync } = await import('fs')
  writeFileSync(MSG_FILE, JSON.stringify(data, null, 2), 'utf-8')
  invalidateCache()
}

// GET /api/textos — lista como array [{id, nome, conteudo}]
apiRouter.get('/textos', requireAuth(['admin']), (req, res) => {
  const m = readMessages()
  const data = Object.entries(m).map(([nome, conteudo]) => ({ id: nome, nome, conteudo }))
  res.json({ data })
})

// POST /api/textos — adicionar/editar uma chave
apiRouter.post('/textos', requireAuth(['admin']), async (req, res) => {
  const { nome, conteudo } = req.body
  if (!nome || !conteudo) return res.status(400).json({ error: 'nome e conteudo são obrigatórios.' })
  const m = readMessages()
  m[nome] = conteudo
  await writeMessages(m)
  res.json({ ok: true, id: nome })
})

// DELETE /api/textos/:id — remover uma chave
apiRouter.delete('/textos/:id', requireAuth(['admin']), async (req, res) => {
  const m = readMessages()
  if (!(req.params.id in m)) return res.status(404).json({ error: 'Texto não encontrado.' })
  delete m[req.params.id]
  await writeMessages(m)
  res.json({ ok: true })
})

// ─── /api/usuarios ────────────────────────────────────────────────────────────

// GET /api/usuarios
apiRouter.get('/usuarios', requireAuth(['admin']), (req, res) => {
  const users = getAllUsers()
  res.json({ data: users })
})

// POST /api/usuarios — criar usuário
apiRouter.post('/usuarios', requireAuth(['admin']), (req, res) => {
  const { username, name, role, password } = req.body
  if (!username || !name || !role || !password) {
    return res.status(400).json({ error: 'username, name, role e password são obrigatórios.' })
  }
  if (!['admin','secretaria','faturamento'].includes(role)) {
    return res.status(400).json({ error: 'role inválido.' })
  }
  if (password.length < 6) return res.status(400).json({ error: 'Senha mínimo 6 caracteres.' })
  try {
    const id = insertUser({ username, password_hash: hashPassword(password), name, role })
    res.json({ ok: true, id })
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Usuário já existe.' })
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/usuarios/:id/toggle — ativar/desativar
apiRouter.patch('/usuarios/:id/toggle', requireAuth(['admin']), (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' })
  toggleUserActive(req.params.id, !user.active)
  res.json({ ok: true, active: !user.active })
})

// PATCH /api/usuarios/:id/reset-senha — redefinir senha
apiRouter.patch('/usuarios/:id/reset-senha', requireAuth(['admin']), (req, res) => {
  const { password } = req.body
  if (!password || password.length < 6) return res.status(400).json({ error: 'Senha mínimo 6 caracteres.' })
  updateUserPassword(req.params.id, hashPassword(password))
  res.json({ ok: true })
})

// ─── /api/medicos (aliases PT-BR de /api/doctors) ────────────────────────────

// GET /api/medicos — lista médicos ativos
apiRouter.get('/medicos', requireAuth(['admin','secretaria']), (req, res) => {
  try {
    const medicos = (loadDoctorsConfig().doctors || []).map(d => ({
      id: d.id, nome: d.nome, especialidade: d.especialidade, especialidades: d.especialidade,
      crm: d.crm || '', calendarId: d.calendarId, active: d.active !== false
    }))
    res.json({ data: medicos })
  } catch { res.json({ data: [] }) }
})

// POST /api/medicos — criar médico
apiRouter.post('/medicos', requireAuth(['admin']), (req, res) => {
  try {
    const config = loadDoctorsConfig()
    const { nome, especialidade, especialidades, crm, email, whatsapp, calendarId, slotDurationMinutes, diasSemana, horarioInicio, horarioFim } = req.body
    if (!nome) return res.status(400).json({ error: 'nome é obrigatório.' })
    const doctor = {
      id: 'dr_' + Date.now(),
      nome, crm: crm || '', especialidade: especialidade || especialidades || '',
      email: email || '', whatsapp: whatsapp || '',
      calendarId: calendarId || '',
      slotDurationMinutes: Math.max(15, Math.min(480, Number(slotDurationMinutes) || 30)),
      diasSemana: diasSemana || [], horarioInicio: horarioInicio || '08:00', horarioFim: horarioFim || '18:00',
      schedule: null, active: true
    }
    config.doctors.push(doctor)
    saveDoctorsConfig(config)
    res.json({ ok: true, data: doctor })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// DELETE /api/medicos/:id — desativar médico
apiRouter.delete('/medicos/:id', requireAuth(['admin']), (req, res) => {
  try {
    const config = loadDoctorsConfig()
    const idx = config.doctors.findIndex(d => d.id === req.params.id)
    if (idx === -1) return res.status(404).json({ error: 'Médico não encontrado.' })
    config.doctors[idx].active = false
    saveDoctorsConfig(config)
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// PATCH /api/medicos/:id/toggle — ativar/desativar médico
apiRouter.patch('/medicos/:id/toggle', requireAuth(['admin']), (req, res) => {
  try {
    const config = loadDoctorsConfig()
    const idx = config.doctors.findIndex(d => d.id === req.params.id)
    if (idx === -1) return res.status(404).json({ error: 'Médico não encontrado.' })
    config.doctors[idx].active = !config.doctors[idx].active
    saveDoctorsConfig(config)
    res.json({ ok: true, active: config.doctors[idx].active })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /api/medicos/:id/slots — horários disponíveis para marcação manual
apiRouter.get('/medicos/:id/slots', async (req, res) => {
  const { date } = req.query
  if (!date) return res.status(400).json({ error: 'date é obrigatório.' })
  try {
    const slots = await getDoctorSlots(req.params.id, 30, 50)
    const filtered = slots.filter(s => {
      const d = new Date(s.datetime)
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` === date
    })
    res.json(filtered.map(s => ({ iso: new Date(s.datetime).toISOString(), hora: fmtHora(s.datetime) })))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// PUT /api/textos — substituir todo o messages.json de uma vez
apiRouter.put('/textos', requireAuth(['admin']), async (req, res) => {
  try {
    await writeMessages(req.body)
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

export default apiRouter
