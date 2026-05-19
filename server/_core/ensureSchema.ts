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
    totp_enabled TINYINT(1) NOT NULL DEFAULT 0,
    deleted_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_users_open_id (open_id),
    INDEX idx_users_role (role)
  )`,

  `CREATE TABLE IF NOT EXISTS clinical_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    medico_id INT NOT NULL,
    aberta_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    encerrada_em DATETIME,
    total_consultas INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_csessions_medico (medico_id),
    INDEX idx_csessions_aberta (aberta_em),
    CONSTRAINT fk_sessions_medico FOREIGN KEY (medico_id) REFERENCES users(id)
  )`,

  `CREATE TABLE IF NOT EXISTS soap_notes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    session_id INT NOT NULL,
    medico_id INT NOT NULL,
    paciente_nome_encrypted TEXT NOT NULL,
    template VARCHAR(50) NOT NULL DEFAULT 'infectologia_geral',
    soap_texto TEXT NOT NULL,
    knowledge_metadata JSON,
    diagnostico_principal VARCHAR(255),
    cid10 VARCHAR(10),
    certeza VARCHAR(20),
    pubmed_query TEXT,
    sintese_evidencias TEXT,
    evidence_metadata JSON,
    retencao_ate DATETIME NOT NULL DEFAULT (DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 20 YEAR)),
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
    cid10 VARCHAR(10),
    nivel_urgencia VARCHAR(10) NOT NULL DEFAULT 'baixo',
    hash_alerta VARCHAR(128),
    alerta_json JSON NOT NULL,
    mensagem_medico TEXT,
    visto_por_id INT,
    visto_em DATETIME,
    supressao_ate DATETIME,
    feedback_medico VARCHAR(20),
    feedback_motivo TEXT,
    feedback_em DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_calerts_soap (soap_note_id),
    INDEX idx_calerts_medico (medico_id),
    INDEX idx_calerts_urgencia (nivel_urgencia),
    INDEX idx_calerts_visto (visto_em),
    INDEX idx_calerts_hash (hash_alerta),
    INDEX idx_calerts_feedback (feedback_medico),
    CONSTRAINT fk_alerts_soap FOREIGN KEY (soap_note_id) REFERENCES soap_notes(id),
    CONSTRAINT fk_alerts_medico FOREIGN KEY (medico_id) REFERENCES users(id)
  )`,

  `CREATE TABLE IF NOT EXISTS publication_drafts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    medico_id INT NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'rascunho',
    titulo TEXT,
    diagnostico VARCHAR(255),
    cid10 VARCHAR(10),
    n_casos INT DEFAULT 0,
    soap_note_ids JSON,
    tema VARCHAR(255),
    n_artigos INT DEFAULT 0,
    jornal VARCHAR(255),
    doi VARCHAR(255),
    data_submissao DATETIME,
    data_publicacao DATETIME,
    texto_gerado LONGTEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pdrafts_medico (medico_id),
    INDEX idx_pdrafts_status (status),
    INDEX idx_pdrafts_cid10 (cid10),
    UNIQUE INDEX idx_pdrafts_uniq_cid10 (medico_id, tipo, cid10, status),
    CONSTRAINT fk_drafts_medico FOREIGN KEY (medico_id) REFERENCES users(id)
  )`,

  `CREATE TABLE IF NOT EXISTS clinical_digests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    medico_id INT NOT NULL,
    tipo VARCHAR(10) NOT NULL,
    periodo_ref VARCHAR(20) NOT NULL,
    texto TEXT NOT NULL,
    total_consultas INT NOT NULL DEFAULT 0,
    total_alertas INT NOT NULL DEFAULT 0,
    gerado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    batch_id VARCHAR(255),
    obsidian_path VARCHAR(500),
    UNIQUE INDEX idx_cdigests_periodo (medico_id, tipo, periodo_ref),
    INDEX idx_cdigests_medico (medico_id),
    INDEX idx_cdigests_tipo (tipo),
    CONSTRAINT fk_digests_medico FOREIGN KEY (medico_id) REFERENCES users(id)
  )`,
]

// Column patches for tables that may exist from an older schema version.
// Only additive — never drop or rename columns here.
const COLUMN_PATCHES: Record<string, Array<{ name: string; ddl: string }>> = {
  users: [
    { name: 'deleted_at', ddl: 'DATETIME' },
    { name: 'totp_enabled', ddl: 'TINYINT(1) NOT NULL DEFAULT 0' },
  ],
  clinical_sessions: [
    { name: 'aberta_em', ddl: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP' },
    { name: 'encerrada_em', ddl: 'DATETIME' },
    { name: 'total_consultas', ddl: 'INT NOT NULL DEFAULT 0' },
  ],
  soap_notes: [
    { name: 'evidence_metadata', ddl: 'JSON' },
    { name: 'deleted_at', ddl: 'DATETIME' },
    { name: 'certeza', ddl: 'VARCHAR(20)' },
  ],
  conduct_alerts: [
    { name: 'supressao_ate', ddl: 'DATETIME' },
    { name: 'mensagem_medico', ddl: 'TEXT' },
    { name: 'visto_por_id', ddl: 'INT' },
    { name: 'visto_em', ddl: 'DATETIME' },
  ],
  publication_drafts: [
    { name: 'deleted_at', ddl: 'DATETIME' },
    { name: 'obsidian_path', ddl: 'VARCHAR(500)' },
    { name: 'titulo', ddl: 'TEXT' },
    { name: 'tema', ddl: 'VARCHAR(255)' },
    { name: 'jornal', ddl: 'VARCHAR(255)' },
    { name: 'doi', ddl: 'VARCHAR(255)' },
    { name: 'data_submissao', ddl: 'DATETIME' },
    { name: 'data_publicacao', ddl: 'DATETIME' },
    { name: 'atualizado_em', ddl: "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP" },
  ],
  clinical_digests: [
    { name: 'batch_id', ddl: 'VARCHAR(255)' },
    { name: 'obsidian_path', ddl: 'VARCHAR(500)' },
    { name: 'texto', ddl: "TEXT NOT NULL DEFAULT ''" },
    { name: 'total_consultas', ddl: 'INT NOT NULL DEFAULT 0' },
    { name: 'total_alertas', ddl: 'INT NOT NULL DEFAULT 0' },
    { name: 'gerado_em', ddl: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP' },
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
