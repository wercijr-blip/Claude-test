import { sql } from 'drizzle-orm'
import { db } from '../db.ts'
import { logger } from './logger.ts'

// Creates CIS tables using IF NOT EXISTS — safe to run on every boot.
// Tables listed in FK dependency order (users first, then tables referencing users).
const DDL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    open_id VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    nome VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'medico',
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    deleted_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_users_open_id (open_id),
    INDEX idx_users_role (role),
    INDEX idx_users_ativo (ativo)
  )`,

  `CREATE TABLE IF NOT EXISTS clinical_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    medico_id INT NOT NULL,
    periodo_ref VARCHAR(20) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'aberta',
    iniciada_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    encerrada_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sessions_medico (medico_id),
    INDEX idx_sessions_periodo (periodo_ref),
    INDEX idx_sessions_status (status),
    CONSTRAINT fk_sessions_medico FOREIGN KEY (medico_id) REFERENCES users(id)
  )`,

  `CREATE TABLE IF NOT EXISTS soap_notes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    session_id INT NOT NULL,
    medico_id INT NOT NULL,
    paciente_nome_encrypted TEXT,
    template VARCHAR(100),
    transcricao TEXT,
    soap_texto TEXT,
    knowledge_metadata JSON,
    diagnostico_principal VARCHAR(255),
    cid10 VARCHAR(20),
    pubmed_query VARCHAR(500),
    sintese_evidencias TEXT,
    evidence_metadata JSON,
    retencao_ate DATETIME NOT NULL,
    deleted_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_soap_session (session_id),
    INDEX idx_soap_medico (medico_id),
    INDEX idx_soap_cid10 (cid10),
    INDEX idx_soap_created (created_at),
    CONSTRAINT fk_soap_session FOREIGN KEY (session_id) REFERENCES clinical_sessions(id),
    CONSTRAINT fk_soap_medico FOREIGN KEY (medico_id) REFERENCES users(id)
  )`,

  `CREATE TABLE IF NOT EXISTS conduct_alerts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    soap_note_id INT NOT NULL,
    medico_id INT NOT NULL,
    diagnostico VARCHAR(255),
    cid10 VARCHAR(20),
    nivel_urgencia VARCHAR(20) NOT NULL DEFAULT 'baixo',
    hash_alerta VARCHAR(64),
    alerta_json JSON,
    mensagem_medico TEXT,
    feedback_medico VARCHAR(50),
    feedback_motivo TEXT,
    feedback_em DATETIME,
    supressao_ate DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_alerts_hash (hash_alerta),
    INDEX idx_alerts_soap (soap_note_id),
    INDEX idx_alerts_medico (medico_id),
    INDEX idx_alerts_cid10 (cid10),
    INDEX idx_alerts_supressao (supressao_ate),
    CONSTRAINT fk_alerts_soap FOREIGN KEY (soap_note_id) REFERENCES soap_notes(id),
    CONSTRAINT fk_alerts_medico FOREIGN KEY (medico_id) REFERENCES users(id)
  )`,

  `CREATE TABLE IF NOT EXISTS publication_drafts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    medico_id INT NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'rascunho',
    diagnostico VARCHAR(255),
    cid10 VARCHAR(20),
    n_casos INT,
    soap_note_ids JSON,
    n_artigos INT,
    texto_gerado LONGTEXT,
    obsidian_path VARCHAR(500),
    deleted_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_drafts_medico (medico_id),
    INDEX idx_drafts_cid10 (cid10),
    INDEX idx_drafts_status (status),
    CONSTRAINT fk_drafts_medico FOREIGN KEY (medico_id) REFERENCES users(id)
  )`,

  `CREATE TABLE IF NOT EXISTS clinical_digests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    medico_id INT NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    periodo_ref VARCHAR(20) NOT NULL,
    texto_gerado LONGTEXT,
    batch_id VARCHAR(255),
    obsidian_path VARCHAR(500),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_digests_unique (medico_id, tipo, periodo_ref),
    INDEX idx_digests_medico (medico_id),
    INDEX idx_digests_periodo (periodo_ref),
    CONSTRAINT fk_digests_medico FOREIGN KEY (medico_id) REFERENCES users(id)
  )`,
]

// Column patches for tables that may exist from an older schema version.
const COLUMN_PATCHES: Record<string, Array<{ name: string; ddl: string }>> = {
  users: [
    { name: 'deleted_at', ddl: 'DATETIME' },
  ],
  soap_notes: [
    { name: 'evidence_metadata', ddl: 'JSON' },
    { name: 'deleted_at', ddl: 'DATETIME' },
  ],
  conduct_alerts: [
    { name: 'supressao_ate', ddl: 'DATETIME' },
    { name: 'mensagem_medico', ddl: 'TEXT' },
  ],
  publication_drafts: [
    { name: 'deleted_at', ddl: 'DATETIME' },
    { name: 'obsidian_path', ddl: 'VARCHAR(500)' },
  ],
  clinical_digests: [
    { name: 'batch_id', ddl: 'VARCHAR(255)' },
    { name: 'obsidian_path', ddl: 'VARCHAR(500)' },
  ],
}

async function getExistingColumns(table: string): Promise<Set<string>> {
  const rows = (await db.execute(sql.raw(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}'`,
  ))) as unknown as Array<{ COLUMN_NAME?: string; column_name?: string }> | { rows?: Array<{ COLUMN_NAME?: string; column_name?: string }> }

  const list = Array.isArray(rows) ? rows : (rows.rows ?? [])
  const flat: Array<{ COLUMN_NAME?: string; column_name?: string }> = Array.isArray(list[0])
    ? (list[0] as Array<{ COLUMN_NAME?: string; column_name?: string }>)
    : (list as Array<{ COLUMN_NAME?: string; column_name?: string }>)

  return new Set(flat.map((r) => r.COLUMN_NAME ?? r.column_name ?? '').filter(Boolean))
}

async function patchTableColumns(table: string, columns: Array<{ name: string; ddl: string }>): Promise<void> {
  let existing: Set<string>
  try {
    existing = await getExistingColumns(table)
  } catch (err) {
    logger.error('[ensureSchema] Falha ao listar colunas', { table, error: String(err) })
    return
  }

  for (const col of columns) {
    if (existing.has(col.name)) continue
    try {
      await db.execute(sql.raw(`ALTER TABLE ${table} ADD COLUMN ${col.name} ${col.ddl}`))
      logger.info('[ensureSchema] Coluna adicionada', { table, column: col.name })
    } catch (err) {
      logger.error('[ensureSchema] Falha ao adicionar coluna (continuando)', {
        table, column: col.name, error: String(err),
      })
    }
  }
}

export async function ensureSchema(): Promise<void> {
  logger.info('[ensureSchema] Verificando schema CIS...')
  let ok = 0
  let failed = 0
  for (const stmt of DDL_STATEMENTS) {
    try {
      await db.execute(sql.raw(stmt))
      ok++
    } catch (err) {
      failed++
      logger.error('[ensureSchema] Falha ao executar DDL (continuando)', {
        error: String(err),
        stmt: stmt.slice(0, 100),
      })
    }
  }
  logger.info(`[ensureSchema] DDL concluído: ${ok} ok, ${failed} falhas.`)

  for (const [table, columns] of Object.entries(COLUMN_PATCHES)) {
    await patchTableColumns(table, columns)
  }

  logger.info('[ensureSchema] Schema CIS verificado.')
}
