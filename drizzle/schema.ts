import {
  mysqlTable,
  int,
  varchar,
  text,
  datetime,
  boolean,
  json,
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core'
import { sql } from 'drizzle-orm'

// ── Usuários (staff: secretaria, médico, admin) ──────────────

export const users = mysqlTable('users', {
  id: int('id').primaryKey().autoincrement(),
  openId: varchar('open_id', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  nome: varchar('nome', { length: 255 }),
  role: varchar('role', { length: 50 }).notNull().default('user'),
  ativo: boolean('ativo').notNull().default(true),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  openIdIdx: uniqueIndex('idx_users_open_id').on(t.openId),
  roleIdx: index('idx_users_role').on(t.role),
}))

// ── Tokens de acesso (gerados pela secretaria para pacientes) ──

export const accessTokens = mysqlTable('access_tokens', {
  id: int('id').primaryKey().autoincrement(),
  tokenHash: varchar('token_hash', { length: 64 }).notNull(),
  patientEmail: varchar('patient_email', { length: 255 }),
  tipo: varchar('tipo', { length: 20 }).notNull().default('privado'),
  convenio: varchar('convenio', { length: 100 }),
  usedAt: datetime('used_at'),
  expiresAt: datetime('expires_at').notNull(),
  revokedAt: datetime('revoked_at'),
  createdById: int('created_by_id').notNull(),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  tokenHashIdx: uniqueIndex('idx_access_tokens_hash').on(t.tokenHash),
  createdByIdx: index('idx_access_tokens_created_by').on(t.createdById),
}))

// ── Pacientes (registro completo do formulário multi-etapas) ──

export const pacientes = mysqlTable('pacientes', {
  id: int('id').primaryKey().autoincrement(),
  tokenId: int('token_id').notNull(),

  // Step 1 — Dados Pessoais (PII encriptado)
  cpfEncrypted: text('cpf_encrypted').notNull(),
  cpfHash: varchar('cpf_hash', { length: 64 }).notNull(),
  nomeEncrypted: text('nome_encrypted').notNull(),
  dataNascimentoEncrypted: text('data_nascimento_encrypted'),
  sexo: varchar('sexo', { length: 20 }),
  nomeSocial: varchar('nome_social', { length: 255 }),

  // Step 2 — Demográfico
  corRaca: varchar('cor_raca', { length: 50 }),
  escolaridade: varchar('escolaridade', { length: 100 }),
  situacaoConjugal: varchar('situacao_conjugal', { length: 50 }),
  rendaFamiliar: varchar('renda_familiar', { length: 50 }),
  ocupacao: varchar('ocupacao', { length: 100 }),

  // Step 3 — Contato (PII encriptado)
  emailEncrypted: text('email_encrypted'),
  telefoneEncrypted: text('telefone_encrypted'),
  cep: varchar('cep', { length: 10 }),
  logradouro: varchar('logradouro', { length: 255 }),
  numero: varchar('numero', { length: 20 }),
  complemento: varchar('complemento', { length: 100 }),
  bairro: varchar('bairro', { length: 100 }),
  cidade: varchar('cidade', { length: 100 }),
  estado: varchar('estado', { length: 2 }),

  // Step 4 — Conduta (dados clínicos como JSON)
  condutaJson: json('conduta_json'),

  // Step 5 — Prescrição
  prescricaoJson: json('prescricao_json'),

  // Step 6 — Serviço
  tipoAtendimento: varchar('tipo_atendimento', { length: 50 }),
  convenio: varchar('convenio', { length: 100 }),
  numeroConvenio: varchar('numero_convenio', { length: 100 }),
  valorCentavos: int('valor_centavos'),

  // Step 7 — Autorizados
  autorizadosJson: json('autorizados_json'),

  // Metadata
  status: varchar('status', { length: 50 }).notNull().default('rascunho'),
  currentStep: int('current_step').notNull().default(1),
  medicoId: int('medico_id'),
  observacoesMedico: text('observacoes_medico'),
  retentionUntil: datetime('retention_until'),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  cpfHashIdx: index('idx_pacientes_cpf_hash').on(t.cpfHash),
  statusIdx: index('idx_pacientes_status').on(t.status),
  tokenIdx: index('idx_pacientes_token').on(t.tokenId),
  medicoIdx: index('idx_pacientes_medico').on(t.medicoId),
}))

// ── Exames (arquivos enviados pelo paciente) ──────────────────

export const exames = mysqlTable('exames', {
  id: int('id').primaryKey().autoincrement(),
  pacienteId: int('paciente_id').notNull(),
  s3Key: varchar('s3_key', { length: 500 }).notNull(),
  nomeArquivo: varchar('nome_arquivo', { length: 255 }).notNull(),
  tipoExame: varchar('tipo_exame', { length: 100 }),
  mimeType: varchar('mime_type', { length: 100 }),
  tamanhoBytes: int('tamanho_bytes'),
  resultadoIa: json('resultado_ia'),
  revisadoPorId: int('revisado_por_id'),
  revisadoEm: datetime('revisado_em'),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  pacienteIdx: index('idx_exames_paciente').on(t.pacienteId),
}))

// ── Assinaturas TCLE ──────────────────────────────────────────

export const tcleAssinaturas = mysqlTable('tcle_assinaturas', {
  id: int('id').primaryKey().autoincrement(),
  pacienteId: int('paciente_id').notNull(),
  assinaturaDataUrl: text('assinatura_data_url').notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  signedAt: datetime('signed_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  pacienteIdx: uniqueIndex('idx_tcle_paciente').on(t.pacienteId),
}))

// ── PDFs gerados ──────────────────────────────────────────────

export const pdfs = mysqlTable('pdfs', {
  id: int('id').primaryKey().autoincrement(),
  pacienteId: int('paciente_id').notNull(),
  s3Key: varchar('s3_key', { length: 500 }).notNull(),
  tipo: varchar('tipo', { length: 50 }).notNull(),
  certificadoSerial: varchar('certificado_serial', { length: 100 }),
  assinadoEm: datetime('assinado_em'),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  pacienteIdx: index('idx_pdfs_paciente').on(t.pacienteId),
}))

// ── Eventos de segurança (auditoria) ─────────────────────────

export const securityEvents = mysqlTable('security_events', {
  id: int('id').primaryKey().autoincrement(),
  tipoEvento: varchar('tipo_evento', { length: 100 }).notNull(),
  userId: int('user_id'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  detalhes: json('detalhes'),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  tipoIdx: index('idx_sec_tipo').on(t.tipoEvento),
  createdAtIdx: index('idx_sec_created').on(t.createdAt),
  userIdx: index('idx_sec_user').on(t.userId),
}))

// ── NFS-e ─────────────────────────────────────────────────────

export const nfseRegistros = mysqlTable('nfse_registros', {
  id: int('id').primaryKey().autoincrement(),
  pacienteId: int('paciente_id').notNull(),
  numeroNfse: varchar('numero_nfse', { length: 50 }),
  status: varchar('status', { length: 50 }).notNull().default('pendente'),
  valorCentavos: int('valor_centavos').notNull(),
  focusnfeRef: varchar('focusnfe_ref', { length: 100 }),
  erroDescricao: text('erro_descricao'),
  emitidoEm: datetime('emitido_em'),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  pacienteIdx: index('idx_nfse_paciente').on(t.pacienteId),
}))

// ── Pagamentos Stripe ─────────────────────────────────────────

export const pagamentos = mysqlTable('pagamentos', {
  id: int('id').primaryKey().autoincrement(),
  pacienteId: int('paciente_id').notNull(),
  stripePaymentId: varchar('stripe_payment_id', { length: 100 }),
  stripeSessionId: varchar('stripe_session_id', { length: 100 }),
  status: varchar('status', { length: 50 }).notNull().default('pendente'),
  valorCentavos: int('valor_centavos').notNull(),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  pacienteIdx: index('idx_pagamentos_paciente').on(t.pacienteId),
  sessionIdx: index('idx_pagamentos_session').on(t.stripeSessionId),
}))
