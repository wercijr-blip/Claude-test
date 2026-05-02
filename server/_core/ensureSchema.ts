import { sql } from 'drizzle-orm'
import { db } from '../db.ts'
import { logger } from './logger.ts'

// Creates all tables using IF NOT EXISTS so this is safe to run on every boot.
// Tables are listed in FK dependency order.
const DDL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    open_id VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    nome VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_users_open_id (open_id),
    INDEX idx_users_role (role)
  )`,

  `CREATE TABLE IF NOT EXISTS access_tokens (
    id INT PRIMARY KEY AUTO_INCREMENT,
    token_hash VARCHAR(64) NOT NULL,
    patient_email VARCHAR(255),
    tipo VARCHAR(20) NOT NULL DEFAULT 'privado',
    convenio VARCHAR(100),
    used_at DATETIME,
    expires_at DATETIME NOT NULL,
    revoked_at DATETIME,
    created_by_id INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_access_tokens_hash (token_hash),
    INDEX idx_access_tokens_created_by (created_by_id)
  )`,

  `CREATE TABLE IF NOT EXISTS pacientes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    token_id INT NOT NULL,
    cpf_encrypted TEXT NOT NULL,
    cpf_hash VARCHAR(64) NOT NULL,
    nome_encrypted TEXT NOT NULL,
    data_nascimento_encrypted TEXT,
    nome_mae_encrypted TEXT,
    cns VARCHAR(20),
    sexo VARCHAR(20),
    nome_social VARCHAR(255),
    cor_raca VARCHAR(50),
    escolaridade VARCHAR(100),
    situacao_conjugal VARCHAR(50),
    renda_familiar VARCHAR(50),
    ocupacao VARCHAR(100),
    identidade_genero VARCHAR(50),
    orientacao_sexual VARCHAR(50),
    uf_nascimento VARCHAR(2),
    municipio_nascimento VARCHAR(100),
    situacao_rua TINYINT(1),
    privado_liberdade TINYINT(1),
    email_encrypted TEXT,
    tipo_telefone VARCHAR(20),
    telefone_encrypted TEXT,
    permite_contato TINYINT(1),
    tipo_contato VARCHAR(20),
    cep VARCHAR(10),
    logradouro VARCHAR(255),
    numero VARCHAR(20),
    complemento VARCHAR(100),
    bairro VARCHAR(100),
    cidade VARCHAR(100),
    estado VARCHAR(2),
    conduta_json JSON,
    prescricao_json JSON,
    prep_modalidade VARCHAR(30),
    tipo_atendimento VARCHAR(50),
    convenio VARCHAR(100),
    numero_convenio VARCHAR(100),
    valor_centavos INT,
    autorizados_json JSON,
    status VARCHAR(50) NOT NULL DEFAULT 'rascunho',
    current_step INT NOT NULL DEFAULT 1,
    medico_id INT,
    observacoes_medico TEXT,
    retention_until DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pacientes_cpf_hash (cpf_hash),
    INDEX idx_pacientes_status (status),
    UNIQUE INDEX idx_pacientes_token (token_id),
    INDEX idx_pacientes_medico (medico_id)
  )`,

  `CREATE TABLE IF NOT EXISTS precadastros (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nome_encrypted TEXT NOT NULL,
    telefone_encrypted TEXT NOT NULL,
    cpf_encrypted TEXT NOT NULL,
    cpf_hash VARCHAR(64) NOT NULL,
    email_encrypted TEXT NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    plano VARCHAR(100),
    carteirinha_s3_key VARCHAR(500),
    documento_s3_key VARCHAR(500),
    status VARCHAR(50) NOT NULL DEFAULT 'aguardando',
    stripe_session_id VARCHAR(200),
    access_token_id INT,
    validado_por_id INT,
    validado_em DATETIME,
    observacoes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_precad_cpf_hash (cpf_hash),
    INDEX idx_precad_status (status),
    INDEX idx_precad_session (stripe_session_id)
  )`,

  `CREATE TABLE IF NOT EXISTS exames (
    id INT PRIMARY KEY AUTO_INCREMENT,
    paciente_id INT NOT NULL,
    s3_key VARCHAR(500) NOT NULL,
    nome_arquivo VARCHAR(255) NOT NULL,
    tipo_exame VARCHAR(100),
    mime_type VARCHAR(100),
    tamanho_bytes INT,
    resultado_ia JSON,
    revisado_por_id INT,
    revisado_em DATETIME,
    liberado_por_medico_id INT,
    liberado_em DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_exames_paciente (paciente_id)
  )`,

  `CREATE TABLE IF NOT EXISTS tcle_assinaturas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    paciente_id INT NOT NULL,
    assinatura_data_url TEXT NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    signed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_tcle_paciente (paciente_id)
  )`,

  `CREATE TABLE IF NOT EXISTS pdfs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    paciente_id INT NOT NULL,
    s3_key VARCHAR(500) NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    certificado_serial VARCHAR(100),
    assinado_em DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pdfs_paciente (paciente_id)
  )`,

  `CREATE TABLE IF NOT EXISTS security_events (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tipo_evento VARCHAR(100) NOT NULL,
    user_id INT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    detalhes JSON,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sec_tipo (tipo_evento),
    INDEX idx_sec_created (created_at),
    INDEX idx_sec_user (user_id)
  )`,

  `CREATE TABLE IF NOT EXISTS nfse_registros (
    id INT PRIMARY KEY AUTO_INCREMENT,
    paciente_id INT,
    precadastro_id INT,
    numero_nfse VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'pendente',
    valor_centavos INT NOT NULL,
    focusnfe_ref VARCHAR(100),
    erro_descricao TEXT,
    emitido_em DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_nfse_paciente (paciente_id),
    INDEX idx_nfse_precadastro (precadastro_id)
  )`,

  `CREATE TABLE IF NOT EXISTS consultas_inicio (
    id INT PRIMARY KEY AUTO_INCREMENT,
    token_id INT NOT NULL,
    tipo_consulta VARCHAR(50),
    tem_exame_recente TINYINT(1),
    exame_s3_key VARCHAR(500),
    pedido_completo_s3_key VARCHAR(500),
    pedido_ist_s3_key VARCHAR(500),
    pedido_hiv_s3_key VARCHAR(500),
    pedido_densitometria_s3_key VARCHAR(500),
    status VARCHAR(50) NOT NULL DEFAULT 'aguardando_escolha',
    resultado_ia JSON,
    motivo_rejeicao VARCHAR(200),
    tentativas_reenvio INT NOT NULL DEFAULT 0,
    validado_por_id INT,
    validado_em DATETIME,
    data_exame_validado VARCHAR(20),
    resultado_hiv_validado VARCHAR(20),
    observacoes_medico TEXT,
    ultimo_lembrete_at DATETIME,
    link_expires_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_consultas_inicio_token (token_id),
    INDEX idx_consultas_inicio_status (status)
  )`,

  `CREATE TABLE IF NOT EXISTS satisfacao_pesquisas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    paciente_id INT NOT NULL,
    achou_facil TINYINT(1),
    conseguiu_medicacao TINYINT(1),
    indicaria TINYINT(1),
    comentario TEXT,
    respondido_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_satisfacao_paciente (paciente_id)
  )`,

  `CREATE TABLE IF NOT EXISTS pagamentos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    paciente_id INT NOT NULL,
    stripe_payment_id VARCHAR(100),
    stripe_session_id VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'pendente',
    valor_centavos INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pagamentos_paciente (paciente_id),
    INDEX idx_pagamentos_session (stripe_session_id)
  )`,

  `CREATE TABLE IF NOT EXISTS stripe_events (
    event_id VARCHAR(100) PRIMARY KEY,
    type VARCHAR(100) NOT NULL,
    processado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS pesquisa_tokens (
    paciente_id INT PRIMARY KEY,
    token VARCHAR(64) NOT NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expira_em DATETIME NOT NULL,
    UNIQUE INDEX idx_pesquisa_token (token)
  )`,
]

// Mapa de tabela -> colunas esperadas (DDL para ALTER TABLE ADD COLUMN).
// Usado para adicionar colunas que faltam em tabelas pré-existentes
// criadas com schema antigo.
const COLUMN_PATCHES: Record<string, Array<{ name: string; ddl: string }>> = {
  consultas_inicio: [
    { name: 'tipo_consulta', ddl: 'VARCHAR(50)' },
    { name: 'tem_exame_recente', ddl: 'TINYINT(1)' },
    { name: 'exame_s3_key', ddl: 'VARCHAR(500)' },
    { name: 'pedido_completo_s3_key', ddl: 'VARCHAR(500)' },
    { name: 'pedido_ist_s3_key', ddl: 'VARCHAR(500)' },
    { name: 'pedido_hiv_s3_key', ddl: 'VARCHAR(500)' },
    { name: 'pedido_densitometria_s3_key', ddl: 'VARCHAR(500)' },
    { name: 'status', ddl: "VARCHAR(50) NOT NULL DEFAULT 'aguardando_escolha'" },
    { name: 'resultado_ia', ddl: 'JSON' },
    { name: 'motivo_rejeicao', ddl: 'VARCHAR(200)' },
    { name: 'tentativas_reenvio', ddl: 'INT NOT NULL DEFAULT 0' },
    { name: 'validado_por_id', ddl: 'INT' },
    { name: 'validado_em', ddl: 'DATETIME' },
    { name: 'data_exame_validado', ddl: 'VARCHAR(20)' },
    { name: 'resultado_hiv_validado', ddl: 'VARCHAR(20)' },
    { name: 'observacoes_medico', ddl: 'TEXT' },
    { name: 'ultimo_lembrete_at', ddl: 'DATETIME' },
    { name: 'link_expires_at', ddl: 'DATETIME' },
  ],
  precadastros: [
    { name: 'plano', ddl: 'VARCHAR(100)' },
    { name: 'carteirinha_s3_key', ddl: 'VARCHAR(500)' },
    { name: 'documento_s3_key', ddl: 'VARCHAR(500)' },
    { name: 'stripe_session_id', ddl: 'VARCHAR(200)' },
    { name: 'access_token_id', ddl: 'INT' },
    { name: 'validado_por_id', ddl: 'INT' },
    { name: 'validado_em', ddl: 'DATETIME' },
    { name: 'observacoes', ddl: 'TEXT' },
  ],
  access_tokens: [
    { name: 'patient_email', ddl: 'VARCHAR(255)' },
    { name: 'tipo', ddl: "VARCHAR(20) NOT NULL DEFAULT 'privado'" },
    { name: 'convenio', ddl: 'VARCHAR(100)' },
    { name: 'used_at', ddl: 'DATETIME' },
    { name: 'revoked_at', ddl: 'DATETIME' },
  ],
  pacientes: [
    { name: 'nome_mae_encrypted', ddl: 'TEXT' },
    { name: 'cns', ddl: 'VARCHAR(20)' },
    { name: 'identidade_genero', ddl: 'VARCHAR(50)' },
    { name: 'orientacao_sexual', ddl: 'VARCHAR(50)' },
    { name: 'uf_nascimento', ddl: 'VARCHAR(2)' },
    { name: 'municipio_nascimento', ddl: 'VARCHAR(100)' },
    { name: 'situacao_rua', ddl: 'TINYINT(1)' },
    { name: 'privado_liberdade', ddl: 'TINYINT(1)' },
    { name: 'permite_contato', ddl: 'TINYINT(1)' },
    { name: 'tipo_contato', ddl: 'VARCHAR(20)' },
    { name: 'prep_modalidade', ddl: 'VARCHAR(30)' },
  ],
}

async function getExistingColumns(table: string): Promise<Set<string>> {
  const rows = (await db.execute(sql.raw(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}'`,
  ))) as unknown as Array<{ COLUMN_NAME?: string; column_name?: string }> | { rows?: Array<{ COLUMN_NAME?: string; column_name?: string }> }

  const list = Array.isArray(rows) ? rows : (rows.rows ?? [])
  // mysql2 driver returns rows in [results, fields] tuple — flatten if needed
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
    logger.error('[ensureSchema] Falha ao listar colunas existentes', { table, error: String(err) })
    return
  }

  for (const col of columns) {
    if (existing.has(col.name)) continue
    const stmt = `ALTER TABLE ${table} ADD COLUMN ${col.name} ${col.ddl}`
    try {
      await db.execute(sql.raw(stmt))
      logger.info('[ensureSchema] Coluna adicionada', { table, column: col.name })
    } catch (err) {
      logger.error('[ensureSchema] Falha ao adicionar coluna (continuando)', {
        table,
        column: col.name,
        error: String(err),
      })
    }
  }
}

export async function ensureSchema(): Promise<void> {
  logger.info('[ensureSchema] Verificando schema do banco de dados...')
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

  // Patch de colunas faltantes em tabelas pré-existentes
  for (const [table, columns] of Object.entries(COLUMN_PATCHES)) {
    await patchTableColumns(table, columns)
  }

  logger.info('[ensureSchema] Verificação concluída.')
}
