import db from './db.js'
import { logger } from '../utils/logger.js'

// Cada migration é aplicada uma única vez e registrada em schema_migrations.
// Para adicionar uma migration: append ao array com a próxima version.
const MIGRATIONS = [
  {
    version: 1,
    name: 'baseline',
    up: () => {
      // Schema inicial já criado pelo db.js — apenas registra o baseline.
      // ALTER TABLE inline já realizados via try/catch no db.js são parte deste baseline.
    }
  },
  {
    version: 2,
    name: 'messages_log_encrypted_text',
    up: () => {
      // Dados existentes não serão re-criptografados automaticamente —
      // limpeza LGPD (90 dias) eliminará registros antigos em texto puro.
      // Novos inserts já usam encryptPII em insertMessageLog.
      logger.info('Migration 2: messages_log.text passará a ser armazenado criptografado nos novos registros')
    }
  },
  {
    version: 3,
    name: 'add_audit_log',
    up: () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS audit_log (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          operator_id INTEGER,
          action      TEXT NOT NULL,
          target_type TEXT,
          target_id   TEXT,
          detail      TEXT,
          created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)
      try {
        db.exec('CREATE INDEX IF NOT EXISTS idx_audit_log_operator ON audit_log(operator_id)')
        db.exec('CREATE INDEX IF NOT EXISTS idx_audit_log_action   ON audit_log(action)')
      } catch {}
    }
  },
  {
    version: 4,
    name: 'revoked_tokens',
    up: () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS revoked_tokens (
          jti        TEXT PRIMARY KEY,
          expires_at DATETIME NOT NULL
        )
      `)
      try {
        db.exec('CREATE INDEX IF NOT EXISTS idx_revoked_tokens_exp ON revoked_tokens(expires_at)')
      } catch {}
    }
  },
  {
    version: 5,
    name: 'performance_indexes',
    up: () => {
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_agendamentos_status    ON agendamentos(status)',
        'CREATE INDEX IF NOT EXISTS idx_agendamentos_phone     ON agendamentos(phone)',
        'CREATE INDEX IF NOT EXISTS idx_agendamentos_medico    ON agendamentos(medico_id)',
        'CREATE INDEX IF NOT EXISTS idx_authq_phone_ts         ON authorization_queries(phone, created_at)',
        'CREATE INDEX IF NOT EXISTS idx_satisfaction_phone_ts  ON satisfaction_responses(phone, created_at)',
      ]
      for (const sql of indexes) {
        try { db.exec(sql) } catch {}
      }
    }
  },
  {
    version: 6,
    name: 'processed_messages_dedup',
    up: () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS processed_messages (
          message_id   TEXT PRIMARY KEY,
          processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)
      try { db.exec('CREATE INDEX IF NOT EXISTS idx_pm_ts ON processed_messages(processed_at)') } catch {}
    }
  },
  {
    version: 7,
    name: 'job_execution_log',
    up: () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS job_log (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          job_name     TEXT    NOT NULL,
          status       TEXT    NOT NULL CHECK(status IN ('SUCCESS','FAILED')),
          duration_ms  INTEGER,
          detail       TEXT,
          executed_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)
      try { db.exec('CREATE INDEX IF NOT EXISTS idx_job_log_name ON job_log(job_name, executed_at)') } catch {}
    }
  }
]

export function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT    NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  for (const migration of MIGRATIONS) {
    const applied = db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(migration.version)
    if (applied) continue

    logger.info({ version: migration.version, name: migration.name }, 'Aplicando migration')
    try {
      migration.up()
      db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(migration.version, migration.name)
      logger.info({ version: migration.version }, 'Migration aplicada com sucesso')
    } catch (err) {
      logger.error({ version: migration.version, name: migration.name, err: err.message }, 'Falha ao aplicar migration')
      throw err
    }
  }
}

export function insertAuditLog({ operatorId, action, targetType, targetId, detail }) {
  try {
    db.prepare(`
      INSERT INTO audit_log (operator_id, action, target_type, target_id, detail)
      VALUES (?, ?, ?, ?, ?)
    `).run(operatorId || null, action, targetType || null, String(targetId || ''), detail || null)
  } catch {
    // Audit log não deve quebrar a operação principal
  }
}
