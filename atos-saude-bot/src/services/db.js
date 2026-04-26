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
`)

// Sessions
export function getSession(phone) {
  return db.prepare('SELECT * FROM sessions WHERE phone = ?').get(phone) || null
}

export function upsertSession(phone, data) {
  const existing = getSession(phone)
  if (existing) {
    const fields = Object.keys(data).map(k => `${k} = @${k}`).join(', ')
    db.prepare(`UPDATE sessions SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE phone = @phone`)
      .run({ ...data, phone })
  } else {
    const allData = { phone, step: 'START', tentativas: 0, ...data }
    const keys = Object.keys(allData)
    db.prepare(`INSERT INTO sessions (${keys.join(', ')}) VALUES (${keys.map(k => '@' + k).join(', ')})`)
      .run(allData)
  }
}

export function clearSession(phone) {
  db.prepare('DELETE FROM sessions WHERE phone = ?').run(phone)
}

// Agendamentos
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

export default db
