import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { encryptPII, decryptPII } from '../utils/pii.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.DB_PATH || join(__dirname, '../../atos-saude.db')

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
db.pragma('secure_delete = ON')
db.pragma('busy_timeout = 5000')
db.pragma('synchronous = NORMAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    phone TEXT PRIMARY KEY,
    step TEXT DEFAULT 'START',
    flow TEXT,
    especialidade TEXT,
    medico_id TEXT,
    medico_nome TEXT,
    slot_escolhido TEXT,
    slots_json TEXT,
    tipo_atendimento TEXT,
    convenio_informado TEXT,
    nome TEXT,
    nascimento TEXT,
    telefone_contato TEXT,
    tentativas INTEGER DEFAULT 0,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS agendamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT,
    tipo TEXT NOT NULL,
    especialidade TEXT,
    medico_nome TEXT,
    medico_id TEXT,
    slot_datetime TEXT,
    tipo_atendimento TEXT,
    convenio_informado TEXT,
    nome TEXT NOT NULL,
    nascimento TEXT NOT NULL,
    telefone_contato TEXT NOT NULL,
    google_event_id TEXT,
    status TEXT DEFAULT 'PENDENTE',
    exported INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS medication_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT,
    nome TEXT,
    nascimento TEXT,
    telefone_contato TEXT,
    tipo_atendimento TEXT,
    convenio_informado TEXT,
    observacao TEXT,
    status TEXT DEFAULT 'PENDENTE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS authorization_queries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT,
    question TEXT,
    answer TEXT,
    confidence TEXT,
    transferred INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS knowledge_base (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT,
    content TEXT,
    category TEXT,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS reminders_sent (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agendamento_id INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(agendamento_id, tipo)
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin','secretaria','faturamento')),
    active INTEGER DEFAULT 1,
    first_login INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS satisfaction_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT,
    agendamento_id INTEGER,
    medico_nome TEXT,
    especialidade TEXT,
    nota INTEGER,
    comentario TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS encaixe_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    nome TEXT,
    especialidade TEXT,
    medico_id TEXT,
    notificado INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS reschedule_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    agendamento_id INTEGER NOT NULL,
    used INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS messages_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    phone      TEXT    NOT NULL,
    direction  TEXT    NOT NULL CHECK(direction IN ('IN','OUT')),
    text       TEXT,
    flow       TEXT,
    step       TEXT,
    timestamp  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS exam_submissions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    phone       TEXT    NOT NULL,
    nome        TEXT,
    medico_nome TEXT,
    file_path   TEXT,
    media_type  TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`)

try { db.exec('CREATE INDEX IF NOT EXISTS idx_messages_log_phone    ON messages_log(phone)') } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_messages_log_ts       ON messages_log(timestamp)') } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_agendamentos_created  ON agendamentos(created_at)') } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_agendamentos_exported ON agendamentos(exported)') } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_messages_log_covering ON messages_log(phone, id)') } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_flow         ON sessions(flow)') } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_agendamentos_slot     ON agendamentos(slot_datetime) WHERE slot_datetime IS NOT NULL') } catch {}

try { db.exec('ALTER TABLE sessions ADD COLUMN agendamento_id TEXT') } catch {}
try { db.exec('ALTER TABLE sessions ADD COLUMN human_transfer_at DATETIME') } catch {}

// Sessions
export function getSession(phone) {
  return db.prepare('SELECT * FROM sessions WHERE phone = ?').get(phone) || null
}

const SESSION_COLUMNS = new Set([
  'step','flow','especialidade','medico_id','medico_nome','slot_escolhido','slots_json',
  'tipo_atendimento','convenio_informado','nome','nascimento','telefone_contato',
  'tentativas','agendamento_id','human_transfer_at'
])

export function upsertSession(phone, data) {
  const safe = Object.fromEntries(Object.entries(data).filter(([k]) => SESSION_COLUMNS.has(k)))
  const existing = getSession(phone)
  if (existing) {
    if (Object.keys(safe).length === 0) return
    const fields = Object.keys(safe).map(k => `${k} = @${k}`).join(', ')
    db.prepare(`UPDATE sessions SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE phone = @phone`)
      .run({ ...safe, phone })
  } else {
    const allData = { phone, step: 'START', tentativas: 0, ...safe }
    const keys = Object.keys(allData)
    db.prepare(`INSERT INTO sessions (${keys.join(', ')}) VALUES (${keys.map(k => '@' + k).join(', ')})`)
      .run(allData)
  }
}

export function clearSession(phone) {
  db.prepare('DELETE FROM sessions WHERE phone = ?').run(phone)
}

const PII_FIELDS = ['nome', 'nascimento', 'telefone_contato']

function _encryptRow(data) {
  if (!process.env.PII_ENCRYPTION_KEY) return data
  const result = { ...data }
  for (const f of PII_FIELDS) {
    if (f in result && result[f] != null) result[f] = encryptPII(result[f])
  }
  return result
}

function _decryptRow(row) {
  if (!row) return row
  if (!process.env.PII_ENCRYPTION_KEY) return row
  const result = { ...row }
  for (const f of PII_FIELDS) {
    if (f in result) result[f] = decryptPII(result[f])
  }
  return result
}

// Agendamentos
export function getAgendamentoById(id) {
  return _decryptRow(db.prepare('SELECT * FROM agendamentos WHERE id = ?').get(id) || null)
}

export function updateAgendamentoStatus(id, status) {
  db.prepare('UPDATE agendamentos SET status = ? WHERE id = ?').run(status, id)
}

export function insertAgendamento(data) {
  const encrypted = _encryptRow(data)
  const keys = Object.keys(encrypted)
  const stmt = db.prepare(
    `INSERT INTO agendamentos (${keys.join(', ')}) VALUES (${keys.map(k => '@' + k).join(', ')})`
  )
  const result = stmt.run(encrypted)
  return result.lastInsertRowid
}

export function getAgendamentos(filters = {}) {
  let query = 'SELECT * FROM agendamentos WHERE 1=1'
  const params = {}
  if (filters.status) { query += ' AND status = @status'; params.status = filters.status }
  if (filters.tipo) { query += ' AND tipo = @tipo'; params.tipo = filters.tipo }
  if (filters.especialidade) { query += ' AND especialidade = @especialidade'; params.especialidade = filters.especialidade }
  if (filters.data) { query += ' AND DATE(created_at) = @data'; params.data = filters.data }
  query += ' ORDER BY created_at DESC'
  return db.prepare(query).all(params).map(_decryptRow)
}

// Medication requests
export function insertMedicationRequest(data) {
  const encrypted = _encryptRow(data)
  const keys = Object.keys(encrypted)
  const stmt = db.prepare(
    `INSERT INTO medication_requests (${keys.join(', ')}) VALUES (${keys.map(k => '@' + k).join(', ')})`
  )
  const result = stmt.run(encrypted)
  return result.lastInsertRowid
}

export function getMedicationRequests() {
  return db.prepare('SELECT * FROM medication_requests ORDER BY created_at DESC').all().map(_decryptRow)
}

// Authorization queries
export function insertAuthQuery(data) {
  const keys = Object.keys(data)
  const stmt = db.prepare(
    `INSERT INTO authorization_queries (${keys.join(', ')}) VALUES (${keys.map(k => '@' + k).join(', ')})`
  )
  const result = stmt.run(data)
  return result.lastInsertRowid
}

// Knowledge base
export function getKnowledge() {
  return db.prepare('SELECT * FROM knowledge_base WHERE active = 1').all()
}

export function insertKnowledge(data) {
  const keys = Object.keys(data)
  const stmt = db.prepare(
    `INSERT INTO knowledge_base (${keys.join(', ')}) VALUES (${keys.map(k => '@' + k).join(', ')})`
  )
  const result = stmt.run(data)
  return result.lastInsertRowid
}

export function deactivateKnowledge(id) {
  db.prepare('UPDATE knowledge_base SET active = 0 WHERE id = ?').run(id)
}

export function markExported(ids) {
  if (!ids || ids.length === 0) return
  const placeholders = ids.map(() => '?').join(', ')
  db.prepare(`UPDATE agendamentos SET exported = 1 WHERE id IN (${placeholders})`).run(...ids)
}

export function cleanOldSessions(maxAgeMinutes = 30) {
  db.prepare(`DELETE FROM sessions WHERE updated_at < datetime('now', '-${maxAgeMinutes} minutes')`).run()
}

// Reminders
export function wasReminderSent(agendamentoId, tipo) {
  const row = db.prepare('SELECT id FROM reminders_sent WHERE agendamento_id = ? AND tipo = ?').get(agendamentoId, tipo)
  return !!row
}

export function markReminderSent(agendamentoId, tipo) {
  db.prepare('INSERT OR IGNORE INTO reminders_sent (agendamento_id, tipo) VALUES (?, ?)').run(agendamentoId, tipo)
}

// Consultas com slot_datetime para o scheduler
export function getAgendamentosComSlot({ dateMin, dateMax } = {}) {
  let query = `SELECT * FROM agendamentos WHERE slot_datetime IS NOT NULL AND status != 'CANCELADO'`
  const params = []
  if (dateMin) { query += ' AND slot_datetime >= ?'; params.push(dateMin) }
  if (dateMax) { query += ' AND slot_datetime <= ?'; params.push(dateMax) }
  query += ' ORDER BY slot_datetime ASC'
  return db.prepare(query).all(...params).map(_decryptRow)
}

// Pesquisa de satisfação
export function insertSatisfactionResponse(data) {
  const keys = Object.keys(data)
  const stmt = db.prepare(
    `INSERT INTO satisfaction_responses (${keys.join(', ')}) VALUES (${keys.map(k => '@' + k).join(', ')})`
  )
  const result = stmt.run(data)
  return result.lastInsertRowid
}

export function getSatisfactionResponses() {
  return db.prepare('SELECT * FROM satisfaction_responses ORDER BY created_at DESC').all()
}

// Users
export function getUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(username) || null
}

export function getAllUsers() {
  return db.prepare('SELECT id, username, name, role, active, first_login, created_at FROM users ORDER BY role, name').all()
}

export function insertUser(data) {
  const { username, password_hash, name, role } = data
  const result = db.prepare(
    'INSERT INTO users (username, password_hash, name, role) VALUES (?, ?, ?, ?)'
  ).run(username, password_hash, name, role)
  return result.lastInsertRowid
}

export function updateUserPassword(id, password_hash) {
  db.prepare('UPDATE users SET password_hash = ?, first_login = 0 WHERE id = ?').run(password_hash, id)
}

export function toggleUserActive(id, active) {
  db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active ? 1 : 0, id)
}

const _userCache = new Map()
const USER_CACHE_TTL = 30_000

export function getUserById(id) {
  const hit = _userCache.get(id)
  if (hit && hit.exp > Date.now()) return hit.user
  const user = db.prepare('SELECT id, username, name, role, active FROM users WHERE id = ? AND active = 1').get(id) || null
  if (user) _userCache.set(id, { user, exp: Date.now() + USER_CACHE_TTL })
  else _userCache.delete(id)
  return user
}

export function invalidateUserCache(id) {
  _userCache.delete(id)
}

export function getUserAnyStatus(id) {
  return db.prepare('SELECT id, username, name, role, active FROM users WHERE id = ?').get(id) || null
}

export function userCount() {
  return db.prepare('SELECT COUNT(*) as c FROM users').get()?.c || 0
}

// Encaixe queue
export function getEncaixeQueue() {
  return db.prepare('SELECT * FROM encaixe_queue ORDER BY created_at ASC').all()
}

export function insertEncaixe(data) {
  const { phone, nome, especialidade, medico_id } = data
  const result = db.prepare(
    'INSERT INTO encaixe_queue (phone, nome, especialidade, medico_id) VALUES (?, ?, ?, ?)'
  ).run(phone, nome || null, especialidade || null, medico_id || null)
  return result.lastInsertRowid
}

export function removeEncaixe(id) {
  db.prepare('DELETE FROM encaixe_queue WHERE id = ?').run(id)
}

export function getEncaixeByEspecialidade(especialidade, medicoId) {
  let q = 'SELECT * FROM encaixe_queue WHERE notificado = 0'
  const params = []
  if (especialidade) { q += ' AND (especialidade = ? OR especialidade IS NULL)'; params.push(especialidade) }
  if (medicoId) { q += ' AND (medico_id = ? OR medico_id IS NULL)'; params.push(medicoId) }
  q += ' ORDER BY created_at ASC'
  return db.prepare(q).all(...params)
}

export function markEncaixeNotificado(id) {
  db.prepare('UPDATE encaixe_queue SET notificado = 1 WHERE id = ?').run(id)
}

// Reschedule tokens
try { db.exec('ALTER TABLE reschedule_tokens ADD COLUMN expires_at DATETIME') } catch {}

export function insertRescheduleToken(token, agendamentoId) {
  db.prepare(
    "INSERT INTO reschedule_tokens (token, agendamento_id, expires_at) VALUES (?, ?, datetime('now', '+48 hours'))"
  ).run(token, agendamentoId)
}

export function getRescheduleToken(token) {
  return db.prepare(
    "SELECT * FROM reschedule_tokens WHERE token = ? AND used = 0 AND (expires_at IS NULL OR expires_at > datetime('now'))"
  ).get(token) || null
}

export function markRescheduleTokenUsed(token) {
  db.prepare('UPDATE reschedule_tokens SET used = 1 WHERE token = ?').run(token)
}

// Human wait sessions (transferred to human flow)
export function getHumanWaitingSessions(minMinutes = 10) {
  return db.prepare(
    `SELECT * FROM sessions WHERE flow = 'HUMANO' AND human_transfer_at IS NOT NULL
     AND human_transfer_at <= datetime('now', '-${minMinutes} minutes')`
  ).all()
}

// Messages log
export function insertMessageLog({ phone, direction, text, flow, step }) {
  db.prepare(
    'INSERT INTO messages_log (phone, direction, text, flow, step) VALUES (?, ?, ?, ?, ?)'
  ).run(phone, direction, text || '', flow || null, step || null)
}

export function getConversations(limit = 100) {
  return db.prepare(`
    SELECT
      m.phone,
      m.text       AS last_message,
      m.direction  AS last_direction,
      m.timestamp  AS last_timestamp,
      m.flow       AS last_flow,
      m.step       AS last_step,
      s.flow       AS current_flow,
      s.step       AS current_step,
      s.nome,
      s.human_transfer_at,
      (SELECT COUNT(*) FROM messages_log WHERE phone = m.phone) AS message_count
    FROM messages_log m
    LEFT JOIN sessions s ON s.phone = m.phone
    WHERE m.id = (SELECT MAX(id) FROM messages_log WHERE phone = m.phone)
    ORDER BY m.timestamp DESC
    LIMIT ?
  `).all(limit)
}

export function getConversationByPhone(phone) {
  return db.prepare(
    'SELECT * FROM messages_log WHERE phone = ? ORDER BY timestamp ASC'
  ).all(phone)
}

export function deleteOldMessageLogs(daysOld = 90) {
  db.prepare(
    `DELETE FROM messages_log WHERE timestamp < datetime('now', '-${daysOld} days')`
  ).run()
}

// Exam submissions
export function insertExamSubmission(data) {
  const keys = Object.keys(data)
  const stmt = db.prepare(
    `INSERT INTO exam_submissions (${keys.join(', ')}) VALUES (${keys.map(k => '@' + k).join(', ')})`
  )
  const result = stmt.run(data)
  return result.lastInsertRowid
}

export function getExamSubmissions() {
  return db.prepare('SELECT * FROM exam_submissions ORDER BY created_at DESC').all()
}

export function runTransaction(fn, ...args) {
  return db.transaction(fn)(...args)
}

export default db
