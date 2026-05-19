import {
  mysqlTable,
  int,
  varchar,
  text,
  longtext,
  datetime,
  boolean,
  json,
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core'
import { sql } from 'drizzle-orm'

// ── Users (staff: médico, admin) ──────────────────────────────

export const users = mysqlTable('users', {
  id: int('id').primaryKey().autoincrement(),
  openId: varchar('open_id', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  nome: varchar('nome', { length: 255 }),
  role: varchar('role', { length: 50 }).notNull().default('user'),
  ativo: boolean('ativo').notNull().default(true),
  deletedAt: datetime('deleted_at'),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  openIdIdx: uniqueIndex('idx_users_open_id').on(t.openId),
  roleIdx: index('idx_users_role').on(t.role),
}))

// ── Clinical Intelligence System ──────────────────────────────

export const clinicalSessions = mysqlTable('clinical_sessions', {
  id: int('id').primaryKey().autoincrement(),
  medicoId: int('medico_id').notNull().references(() => users.id),
  abertaEm: datetime('aberta_em').notNull().default(sql`CURRENT_TIMESTAMP`),
  encerradaEm: datetime('encerrada_em'),
  totalConsultas: int('total_consultas').notNull().default(0),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  medicoIdx: index('idx_csessions_medico').on(t.medicoId),
  abertaIdx: index('idx_csessions_aberta').on(t.abertaEm),
}))

export const soapNotes = mysqlTable('soap_notes', {
  id: int('id').primaryKey().autoincrement(),
  sessionId: int('session_id').notNull().references(() => clinicalSessions.id),
  medicoId: int('medico_id').notNull().references(() => users.id),
  pacienteNomeEncrypted: text('paciente_nome_encrypted').notNull(),
  template: varchar('template', { length: 50 }).notNull().default('infectologia_geral'),
  soapTexto: text('soap_texto').notNull(),
  knowledgeMetadata: json('knowledge_metadata'),
  diagnosticoPrincipal: varchar('diagnostico_principal', { length: 255 }),
  cid10: varchar('cid10', { length: 10 }),
  certeza: varchar('certeza', { length: 20 }),
  pubmedQuery: text('pubmed_query'),
  sinteseEvidencias: text('sintese_evidencias'),
  evidenceMetadata: json('evidence_metadata'),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  sessionIdx: index('idx_soap_session').on(t.sessionId),
  medicoIdx: index('idx_soap_medico').on(t.medicoId),
  cid10Idx: index('idx_soap_cid10').on(t.cid10),
  createdAtIdx: index('idx_soap_created').on(t.createdAt),
}))

export const conductAlerts = mysqlTable('conduct_alerts', {
  id: int('id').primaryKey().autoincrement(),
  soapNoteId: int('soap_note_id').notNull().references(() => soapNotes.id),
  medicoId: int('medico_id').notNull().references(() => users.id),
  diagnostico: varchar('diagnostico', { length: 255 }),
  cid10: varchar('cid10', { length: 10 }),
  nivelUrgencia: varchar('nivel_urgencia', { length: 10 }).notNull(),
  hashAlerta: varchar('hash_alerta', { length: 128 }),
  alertaJson: json('alerta_json').notNull(),
  mensagemMedico: text('mensagem_medico'),
  vistoPorId: int('visto_por_id').references(() => users.id),
  vistoEm: datetime('visto_em'),
  supressaoAte: datetime('supressao_ate'),
  feedbackMedico: varchar('feedback_medico', { length: 20 }),
  feedbackMotivo: text('feedback_motivo'),
  feedbackEm: datetime('feedback_em'),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  soapIdx: index('idx_calerts_soap').on(t.soapNoteId),
  medicoIdx: index('idx_calerts_medico').on(t.medicoId),
  urgenciaIdx: index('idx_calerts_urgencia').on(t.nivelUrgencia),
  vistoIdx: index('idx_calerts_visto').on(t.vistoEm),
  hashIdx: index('idx_calerts_hash').on(t.hashAlerta),
  feedbackIdx: index('idx_calerts_feedback').on(t.feedbackMedico),
}))

export const publicationDrafts = mysqlTable('publication_drafts', {
  id: int('id').primaryKey().autoincrement(),
  medicoId: int('medico_id').notNull().references(() => users.id),
  tipo: varchar('tipo', { length: 20 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('rascunho'),
  titulo: text('titulo'),
  diagnostico: varchar('diagnostico', { length: 255 }),
  cid10: varchar('cid10', { length: 10 }),
  nCasos: int('n_casos').default(0),
  soapNoteIds: json('soap_note_ids'),
  tema: varchar('tema', { length: 255 }),
  nArtigos: int('n_artigos').default(0),
  jornal: varchar('jornal', { length: 255 }),
  doi: varchar('doi', { length: 255 }),
  dataSubmissao: datetime('data_submissao'),
  dataPublicacao: datetime('data_publicacao'),
  textoGerado: longtext('texto_gerado'),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  atualizadoEm: datetime('atualizado_em').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  medicoIdx:  index('idx_pdrafts_medico').on(t.medicoId),
  statusIdx:  index('idx_pdrafts_status').on(t.status),
  cid10Idx:   index('idx_pdrafts_cid10').on(t.cid10),
  unicoCid10: uniqueIndex('idx_pdrafts_uniq_cid10').on(t.medicoId, t.tipo, t.cid10, t.status),
}))

export const clinicalDigests = mysqlTable('clinical_digests', {
  id: int('id').primaryKey().autoincrement(),
  medicoId: int('medico_id').notNull().references(() => users.id),
  tipo: varchar('tipo', { length: 10 }).notNull(),
  periodoRef: varchar('periodo_ref', { length: 20 }).notNull(),
  texto: text('texto').notNull(),
  totalConsultas: int('total_consultas').notNull().default(0),
  totalAlertas: int('total_alertas').notNull().default(0),
  geradoEm: datetime('gerado_em').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  medicoIdx: index('idx_cdigests_medico').on(t.medicoId),
  tipoIdx: index('idx_cdigests_tipo').on(t.tipo),
  periodoIdx: uniqueIndex('idx_cdigests_periodo').on(t.medicoId, t.tipo, t.periodoRef),
}))
