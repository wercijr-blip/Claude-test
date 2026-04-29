import {
  mysqlTable,
  mysqlEnum,
  int,
  varchar,
  text,
  datetime,
  timestamp,
  boolean,
  json,
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core'
import { sql } from 'drizzle-orm'

// ── Usuários (staff: admin, doctor) ──────────────────────────

export const users = mysqlTable('users', {
  id:                     int('id').primaryKey().autoincrement(),
  email:                  varchar('email', { length: 320 }).notNull().unique(),
  passwordHash:           varchar('passwordHash', { length: 255 }),
  name:                   varchar('name', { length: 255 }),
  role:                   mysqlEnum('role', ['admin', 'doctor']).default('doctor').notNull(),
  clinicId:               varchar('clinicId', { length: 21 }),
  specialty:              varchar('specialty', { length: 100 }),
  crm:                    varchar('crm', { length: 30 }),
  active:                 int('active').default(1).notNull(),
  mustChangePassword:     int('mustChangePassword').default(1).notNull(),
  bulletinEmail:          varchar('bulletinEmail', { length: 320 }),
  receiveMonthlyBulletin: int('receiveMonthlyBulletin').default(1).notNull(),
  // Legacy fields kept for backward compatibility
  openId:                 varchar('open_id', { length: 255 }),
  nome:                   varchar('nome', { length: 255 }),
  ativo:                  boolean('ativo').default(true),
  createdAt:              timestamp('createdAt').defaultNow().notNull(),
  updatedAt:              timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  emailIdx:   uniqueIndex('idx_users_email').on(t.email),
  clinicIdx:  index('idx_users_clinic').on(t.clinicId),
  roleIdx:    index('idx_users_role').on(t.role),
}))

// ── Consultas médicas (MedScribe core) ───────────────────────

export const consultations = mysqlTable('consultations', {
  id:            int('id').primaryKey().autoincrement(),
  userId:        int('userId').notNull(),
  patientName:   varchar('patientName', { length: 255 }),
  patientAge:    int('patientAge'),
  chiefComplaint: text('chiefComplaint'),
  audioUrl:      varchar('audioUrl', { length: 1000 }),
  audioDuration: int('audioDuration'),          // segundos
  transcription: text('transcription'),
  soapSubjective: text('soapSubjective'),
  soapObjective:  text('soapObjective'),
  soapAssessment: text('soapAssessment'),
  soapPlan:       text('soapPlan'),
  qualityScore:   int('qualityScore'),
  status:         varchar('status', { length: 50 }).notNull().default('draft'),
  exportedAt:     datetime('exportedAt'),
  createdAt:      timestamp('createdAt').defaultNow().notNull(),
  updatedAt:      timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  userIdx:   index('idx_consultations_user').on(t.userId),
  statusIdx: index('idx_consultations_status').on(t.status),
  createdIdx: index('idx_consultations_created').on(t.createdAt),
}))

// ── Tópicos de conhecimento ───────────────────────────────────

export const knowledgeTopics = mysqlTable('knowledge_topics', {
  id:                int('id').primaryKey().autoincrement(),
  topic:             varchar('topic', { length: 500 }).notNull(),
  pubmedQuery:       text('pubmedQuery'),
  source:            mysqlEnum('source', ['auto', 'manual']).default('auto').notNull(),
  status:            mysqlEnum('status', ['pending', 'sent', 'done']).default('pending').notNull(),
  consultationId:    int('consultationId'),
  clinicId:          varchar('clinicId', { length: 21 }),
  visibility:        mysqlEnum('visibility', ['clinic']).default('clinic').notNull(),
  sharedBy:          int('sharedBy'),
  medicalSpecialty:  varchar('medicalSpecialty', { length: 100 }),
  specialtyCategory: varchar('specialtyCategory', { length: 50 }),
  subtopics:         text('subtopics'),    // JSON serializado
  createdAt:         timestamp('createdAt').defaultNow().notNull(),
  updatedAt:         timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  clinicIdx:    index('idx_kt_clinic').on(t.clinicId),
  statusIdx:    index('idx_kt_status').on(t.status),
  sharedByIdx:  index('idx_kt_shared_by').on(t.sharedBy),
}))

// ── Dados clínicos extraídos automaticamente ─────────────────

export const consultationClinicalData = mysqlTable('consultation_clinical_data', {
  id:                           varchar('id', { length: 21 }).primaryKey(),
  consultationId:               int('consultation_id').notNull(),
  doctorId:                     int('doctor_id').notNull(),
  clinicId:                     varchar('clinic_id', { length: 21 }),
  examsRequested:               text('exams_requested'),   // JSON serializado
  treatmentType:                mysqlEnum('treatment_type', ['oral', 'iv', 'both', 'none']),
  medications:                  text('medications'),        // JSON serializado
  hasHospitalizationIndication: int('has_hospitalization_indication'),
  followUpDays:                 int('follow_up_days'),
  createdAt:                    timestamp('createdAt').defaultNow().notNull(),
}, (t) => ({
  consultationIdx: index('idx_ccd_consultation').on(t.consultationId),
  doctorIdx:       index('idx_ccd_doctor').on(t.doctorId),
  clinicIdx:       index('idx_ccd_clinic').on(t.clinicId),
}))

export type ConsultationClinicalData = typeof consultationClinicalData.$inferSelect
export type InsertConsultationClinicalData = typeof consultationClinicalData.$inferInsert

// ── Tokens de acesso (pacientes — legado Facilita PrEP) ───────

export const accessTokens = mysqlTable('access_tokens', {
  id:           int('id').primaryKey().autoincrement(),
  tokenHash:    varchar('token_hash', { length: 64 }).notNull(),
  patientEmail: varchar('patient_email', { length: 255 }),
  tipo:         varchar('tipo', { length: 20 }).notNull().default('privado'),
  convenio:     varchar('convenio', { length: 100 }),
  usedAt:       datetime('used_at'),
  expiresAt:    datetime('expires_at').notNull(),
  revokedAt:    datetime('revoked_at'),
  createdById:  int('created_by_id').notNull(),
  createdAt:    datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  tokenHashIdx: uniqueIndex('idx_access_tokens_hash').on(t.tokenHash),
  createdByIdx: index('idx_access_tokens_created_by').on(t.createdById),
}))

// ── Pacientes (legado Facilita PrEP) ─────────────────────────

export const pacientes = mysqlTable('pacientes', {
  id:       int('id').primaryKey().autoincrement(),
  tokenId:  int('token_id').notNull(),

  cpfEncrypted:            text('cpf_encrypted').notNull(),
  cpfHash:                 varchar('cpf_hash', { length: 64 }).notNull(),
  nomeEncrypted:           text('nome_encrypted').notNull(),
  dataNascimentoEncrypted: text('data_nascimento_encrypted'),
  sexo:                    varchar('sexo', { length: 20 }),
  nomeSocial:              varchar('nome_social', { length: 255 }),

  corRaca:          varchar('cor_raca', { length: 50 }),
  escolaridade:     varchar('escolaridade', { length: 100 }),
  situacaoConjugal: varchar('situacao_conjugal', { length: 50 }),
  rendaFamiliar:    varchar('renda_familiar', { length: 50 }),
  ocupacao:         varchar('ocupacao', { length: 100 }),

  emailEncrypted:    text('email_encrypted'),
  tipoTelefone:      varchar('tipo_telefone', { length: 20 }),
  telefoneEncrypted: text('telefone_encrypted'),
  cep:               varchar('cep', { length: 10 }),
  logradouro:        varchar('logradouro', { length: 255 }),
  numero:            varchar('numero', { length: 20 }),
  complemento:       varchar('complemento', { length: 100 }),
  bairro:            varchar('bairro', { length: 100 }),
  cidade:            varchar('cidade', { length: 100 }),
  estado:            varchar('estado', { length: 2 }),

  condutaJson:   json('conduta_json'),
  prescricaoJson: json('prescricao_json'),

  tipoAtendimento: varchar('tipo_atendimento', { length: 50 }),
  convenio:        varchar('convenio', { length: 100 }),
  numeroConvenio:  varchar('numero_convenio', { length: 100 }),
  valorCentavos:   int('valor_centavos'),

  autorizadosJson: json('autorizados_json'),

  status:             varchar('status', { length: 50 }).notNull().default('rascunho'),
  currentStep:        int('current_step').notNull().default(1),
  medicoId:           int('medico_id'),
  observacoesMedico:  text('observacoes_medico'),
  retentionUntil:     datetime('retention_until'),
  createdAt:          datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt:          datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  cpfHashIdx: index('idx_pacientes_cpf_hash').on(t.cpfHash),
  statusIdx:  index('idx_pacientes_status').on(t.status),
  tokenIdx:   index('idx_pacientes_token').on(t.tokenId),
  medicoIdx:  index('idx_pacientes_medico').on(t.medicoId),
}))

// ── Exames ────────────────────────────────────────────────────

export const exames = mysqlTable('exames', {
  id:            int('id').primaryKey().autoincrement(),
  pacienteId:    int('paciente_id').notNull(),
  s3Key:         varchar('s3_key', { length: 500 }).notNull(),
  nomeArquivo:   varchar('nome_arquivo', { length: 255 }).notNull(),
  tipoExame:     varchar('tipo_exame', { length: 100 }),
  mimeType:      varchar('mime_type', { length: 100 }),
  tamanhoBytes:  int('tamanho_bytes'),
  resultadoIa:   json('resultado_ia'),
  revisadoPorId: int('revisado_por_id'),
  revisadoEm:    datetime('revisado_em'),
  createdAt:     datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  pacienteIdx: index('idx_exames_paciente').on(t.pacienteId),
}))

// ── TCLE ──────────────────────────────────────────────────────

export const tcleAssinaturas = mysqlTable('tcle_assinaturas', {
  id:                int('id').primaryKey().autoincrement(),
  pacienteId:        int('paciente_id').notNull(),
  assinaturaDataUrl: text('assinatura_data_url').notNull(),
  ipAddress:         varchar('ip_address', { length: 45 }),
  userAgent:         text('user_agent'),
  signedAt:          datetime('signed_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  pacienteIdx: uniqueIndex('idx_tcle_paciente').on(t.pacienteId),
}))

// ── PDFs ──────────────────────────────────────────────────────

export const pdfs = mysqlTable('pdfs', {
  id:               int('id').primaryKey().autoincrement(),
  pacienteId:       int('paciente_id').notNull(),
  s3Key:            varchar('s3_key', { length: 500 }).notNull(),
  tipo:             varchar('tipo', { length: 50 }).notNull(),
  certificadoSerial: varchar('certificado_serial', { length: 100 }),
  assinadoEm:       datetime('assinado_em'),
  createdAt:        datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  pacienteIdx: index('idx_pdfs_paciente').on(t.pacienteId),
}))

// ── Eventos de segurança ──────────────────────────────────────

export const securityEvents = mysqlTable('security_events', {
  id:         int('id').primaryKey().autoincrement(),
  tipoEvento: varchar('tipo_evento', { length: 100 }).notNull(),
  userId:     int('user_id'),
  ipAddress:  varchar('ip_address', { length: 45 }),
  userAgent:  text('user_agent'),
  detalhes:   json('detalhes'),
  createdAt:  datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  tipoIdx:    index('idx_sec_tipo').on(t.tipoEvento),
  createdIdx: index('idx_sec_created').on(t.createdAt),
  userIdx:    index('idx_sec_user').on(t.userId),
}))

// ── NFS-e ─────────────────────────────────────────────────────

export const nfseRegistros = mysqlTable('nfse_registros', {
  id:             int('id').primaryKey().autoincrement(),
  pacienteId:     int('paciente_id').notNull(),
  numeroNfse:     varchar('numero_nfse', { length: 50 }),
  status:         varchar('status', { length: 50 }).notNull().default('pendente'),
  valorCentavos:  int('valor_centavos').notNull(),
  focusnfeRef:    varchar('focusnfe_ref', { length: 100 }),
  erroDescricao:  text('erro_descricao'),
  emitidoEm:      datetime('emitido_em'),
  createdAt:      datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  pacienteIdx: index('idx_nfse_paciente').on(t.pacienteId),
}))

// ── Consultas Início (legado) ─────────────────────────────────

export const consultasInicio = mysqlTable('consultas_inicio', {
  id:                     int('id').primaryKey().autoincrement(),
  tokenId:                int('token_id').notNull(),
  tipoConsulta:           varchar('tipo_consulta', { length: 50 }),
  temExameRecente:        boolean('tem_exame_recente'),
  exameS3Key:             varchar('exame_s3_key', { length: 500 }),
  pedidoCompletoS3Key:    varchar('pedido_completo_s3_key', { length: 500 }),
  pedidoIstS3Key:         varchar('pedido_ist_s3_key', { length: 500 }),
  pedidoHivS3Key:         varchar('pedido_hiv_s3_key', { length: 500 }),
  pedidoDensitometriaS3Key: varchar('pedido_densitometria_s3_key', { length: 500 }),
  status:                 varchar('status', { length: 50 }).notNull().default('aguardando_escolha'),
  resultadoIa:            json('resultado_ia'),
  motivoRejeicao:         varchar('motivo_rejeicao', { length: 200 }),
  validadoPorId:          int('validado_por_id'),
  validadoEm:             datetime('validado_em'),
  dataExameValidado:      varchar('data_exame_validado', { length: 20 }),
  resultadoHivValidado:   varchar('resultado_hiv_validado', { length: 20 }),
  observacoesMedico:      text('observacoes_medico'),
  ultimoLembreteAt:       datetime('ultimo_lembrete_at'),
  linkExpiresAt:          datetime('link_expires_at'),
  createdAt:              datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt:              datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  tokenIdx:  uniqueIndex('idx_consultas_inicio_token').on(t.tokenId),
  statusIdx: index('idx_consultas_inicio_status').on(t.status),
}))

// ── Pré-cadastros ─────────────────────────────────────────────

export const precadastros = mysqlTable('precadastros', {
  id:              int('id').primaryKey().autoincrement(),
  nomeEncrypted:   text('nome_encrypted').notNull(),
  telefoneEncrypted: text('telefone_encrypted').notNull(),
  cpfEncrypted:    text('cpf_encrypted').notNull(),
  cpfHash:         varchar('cpf_hash', { length: 64 }).notNull(),
  emailEncrypted:  text('email_encrypted').notNull(),
  tipo:            varchar('tipo', { length: 20 }).notNull(),
  plano:           varchar('plano', { length: 100 }),
  carteirinhaS3Key: varchar('carteirinha_s3_key', { length: 500 }),
  documentoS3Key:  varchar('documento_s3_key', { length: 500 }),
  status:          varchar('status', { length: 50 }).notNull().default('aguardando'),
  stripeSessionId: varchar('stripe_session_id', { length: 200 }),
  accessTokenId:   int('access_token_id'),
  validadoPorId:   int('validado_por_id'),
  validadoEm:      datetime('validado_em'),
  observacoes:     text('observacoes'),
  createdAt:       datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  cpfHashIdx: index('idx_precad_cpf_hash').on(t.cpfHash),
  statusIdx:  index('idx_precad_status').on(t.status),
  sessionIdx: index('idx_precad_session').on(t.stripeSessionId),
}))

// ── Pesquisa de satisfação ────────────────────────────────────

export const satisfacaoPesquisas = mysqlTable('satisfacao_pesquisas', {
  id:                 int('id').primaryKey().autoincrement(),
  pacienteId:         int('paciente_id').notNull(),
  achouFacil:         boolean('achou_facil'),
  conseguiuMedicacao: boolean('conseguiu_medicacao'),
  indicaria:          boolean('indicaria'),
  comentario:         text('comentario'),
  respondidoEm:       datetime('respondido_em').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  pacienteIdx: uniqueIndex('idx_satisfacao_paciente').on(t.pacienteId),
}))

// ── Histórico de boletins enviados ───────────────────────────

export const bulletinHistory = mysqlTable('bulletin_history', {
  id:           int('id').primaryKey().autoincrement(),
  clinicId:     varchar('clinicId', { length: 21 }).notNull(),
  month:        varchar('month', { length: 7 }).notNull(),  // ex: "2025-04"
  doctorCount:  int('doctorCount').notNull().default(0),
  articleCount: int('articleCount').notNull().default(0),
  sentBy:       int('sentBy').notNull(),
  resentAt:     datetime('resentAt'),
  createdAt:    timestamp('createdAt').defaultNow().notNull(),
}, (t) => ({
  clinicIdx: index('idx_bh_clinic').on(t.clinicId),
  monthIdx:  index('idx_bh_month').on(t.month),
}))

// ── Pagamentos Stripe ─────────────────────────────────────────

export const pagamentos = mysqlTable('pagamentos', {
  id:               int('id').primaryKey().autoincrement(),
  pacienteId:       int('paciente_id').notNull(),
  stripePaymentId:  varchar('stripe_payment_id', { length: 100 }),
  stripeSessionId:  varchar('stripe_session_id', { length: 100 }),
  status:           varchar('status', { length: 50 }).notNull().default('pendente'),
  valorCentavos:    int('valor_centavos').notNull(),
  createdAt:        datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  pacienteIdx: index('idx_pagamentos_paciente').on(t.pacienteId),
  sessionIdx:  index('idx_pagamentos_session').on(t.stripeSessionId),
}))
