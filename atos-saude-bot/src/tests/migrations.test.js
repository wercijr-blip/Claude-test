import { describe, it, expect } from 'vitest'

// DB usa :memory: via DB_PATH=':memory:' definido no vitest.config.js
const { default: db } = await import('../services/db.js')
const { runMigrations } = await import('../services/migrations.js')

describe('runMigrations', () => {
  it('cria a tabela schema_migrations se não existir', () => {
    runMigrations()
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'")
      .get()
    expect(row).toBeTruthy()
    expect(row.name).toBe('schema_migrations')
  })

  it('registra todas as migrations definidas', () => {
    runMigrations()
    const rows = db
      .prepare('SELECT version, name FROM schema_migrations ORDER BY version')
      .all()
    expect(rows.length).toBeGreaterThanOrEqual(3)
    expect(rows[0]).toMatchObject({ version: 1, name: 'baseline' })
    expect(rows[1]).toMatchObject({ version: 2, name: 'messages_log_encrypted_text' })
    expect(rows[2]).toMatchObject({ version: 3, name: 'add_audit_log' })
  })

  it('é idempotente — segunda chamada não duplica registros', () => {
    runMigrations()
    runMigrations()
    const { c } = db.prepare('SELECT COUNT(*) as c FROM schema_migrations').get()
    expect(c).toBe(3)
  })

  it('migration v3 cria a tabela audit_log com índices', () => {
    runMigrations()
    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='audit_log'")
      .get()
    expect(table).toBeTruthy()

    const idxOperator = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_audit_log_operator'")
      .get()
    expect(idxOperator).toBeTruthy()
  })

  it('colunas corretas em audit_log', () => {
    runMigrations()
    const cols = db.prepare('PRAGMA table_info(audit_log)').all()
    const colNames = cols.map(c => c.name)
    expect(colNames).toContain('operator_id')
    expect(colNames).toContain('action')
    expect(colNames).toContain('target_type')
    expect(colNames).toContain('target_id')
    expect(colNames).toContain('detail')
    expect(colNames).toContain('created_at')
  })
})
