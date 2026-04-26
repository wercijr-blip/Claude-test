import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, '../../atos-saude.db')

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

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
`)

// Adiciona coluna agendamento_id à tabela sessions se ainda não existir
try { db.exec('ALTER TABLE sessions ADD COLUMN agendamento_id TEXT') } catch {}

// Sessions
export function getSession(phone) {
  return db.prepare('SELECT * FROM sessions WHERE phone = ?').get(phone) || null
}

const SESSION_COLUMNS = new Set([
  'step','flow','especialidade','medico_id','medico_nome','slot_escolhido','slots_json',
  'tipo_atendimento','convenio_informado','nome','nascimento','telefone_contato',
  'tentativas','agendamento_id'
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

// Agendamentos
export function getAgendamentoById(id) {
  return db.prepare('SELECT * FROM agendamentos WHERE id = ?').get(id) || null
}

export function updateAgendamentoStatus(id, status) {
  db.prepare('UPDATE agendamentos SET status = ? WHERE id = ?').run(status, id)
}

export function insertAgendamento(data) {
  const keys = Object.keys(data)
  const stmt = db.prepare(
    `INSERT INTO agendamentos (${keys.join(', ')}) VALUES (${keys.map(k => '@' + k).join(', ')})`
  )
  const result = stmt.run(data)
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
  return db.prepare(query).all(params)
}

// Medication requests
export function insertMedicationRequest(data) {
  const keys = Object.keys(data)
  const stmt = db.prepare(
    `INSERT INTO medication_requests (${keys.join(', ')}) VALUES (${keys.map(k => '@' + k).join(', ')})`
  )
  const result = stmt.run(data)
  return result.lastInsertRowid
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
  return db.prepare(query).all(...params)
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

export function userCount() {
  return db.prepare('SELECT COUNT(*) as c FROM users').get()?.c || 0
}

export default db
