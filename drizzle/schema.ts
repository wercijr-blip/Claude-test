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
  double,
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
  // Boletim mensal de evidências
  receiveMonthlyBulletin: boolean('receive_monthly_bulletin').notNull().default(false),
  bulletinEmail: varchar('bulletin_email', { length: 255 }),
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
  tipoTelefone: varchar('tipo_telefone', { length: 20 }),
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

// ── Consultas Início (segunda parte — validação de exame HIV) ──

export const consultasInicio = mysqlTable('consultas_inicio', {
  id: int('id').primaryKey().autoincrement(),
  tokenId: int('token_id').notNull(),
  tipoConsulta: varchar('tipo_consulta', { length: 50 }), // 'primeiro_atendimento' | 'ja_faco_prep'
  temExameRecente: boolean('tem_exame_recente'),
  exameS3Key: varchar('exame_s3_key', { length: 500 }),
  pedidoCompletoS3Key: varchar('pedido_completo_s3_key', { length: 500 }),
  pedidoIstS3Key: varchar('pedido_ist_s3_key', { length: 500 }),
  pedidoHivS3Key: varchar('pedido_hiv_s3_key', { length: 500 }),
  pedidoDensitometriaS3Key: varchar('pedido_densitometria_s3_key', { length: 500 }),
  status: varchar('status', { length: 50 }).notNull().default('aguardando_escolha'),
  resultadoIa: json('resultado_ia'),
  motivoRejeicao: varchar('motivo_rejeicao', { length: 200 }),
  validadoPorId: int('validado_por_id'),
  validadoEm: datetime('validado_em'),
  dataExameValidado: varchar('data_exame_validado', { length: 20 }),
  resultadoHivValidado: varchar('resultado_hiv_validado', { length: 20 }),
  observacoesMedico: text('observacoes_medico'),
  ultimoLembreteAt: datetime('ultimo_lembrete_at'),
  linkExpiresAt: datetime('link_expires_at'),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  tokenIdx: uniqueIndex('idx_consultas_inicio_token').on(t.tokenId),
  statusIdx: index('idx_consultas_inicio_status').on(t.status),
}))

// ── Pré-cadastros (intake flow — antes do link ser gerado) ────

export const precadastros = mysqlTable('precadastros', {
  id: int('id').primaryKey().autoincrement(),
  // PII encriptado
  nomeEncrypted: text('nome_encrypted').notNull(),
  telefoneEncrypted: text('telefone_encrypted').notNull(),
  cpfEncrypted: text('cpf_encrypted').notNull(),
  cpfHash: varchar('cpf_hash', { length: 64 }).notNull(),
  emailEncrypted: text('email_encrypted').notNull(),
  // Tipo de atendimento
  tipo: varchar('tipo', { length: 20 }).notNull(), // 'particular' | 'plano'
  plano: varchar('plano', { length: 100 }),
  carteirinhaS3Key: varchar('carteirinha_s3_key', { length: 500 }),
  documentoS3Key: varchar('documento_s3_key', { length: 500 }),
  // Status do fluxo
  status: varchar('status', { length: 50 }).notNull().default('aguardando'),
  stripeSessionId: varchar('stripe_session_id', { length: 200 }),
  accessTokenId: int('access_token_id'),
  validadoPorId: int('validado_por_id'),
  validadoEm: datetime('validado_em'),
  observacoes: text('observacoes'),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  cpfHashIdx: index('idx_precad_cpf_hash').on(t.cpfHash),
  statusIdx: index('idx_precad_status').on(t.status),
  sessionIdx: index('idx_precad_session').on(t.stripeSessionId),
}))

// ── Pesquisa de satisfação ────────────────────────────────────

export const satisfacaoPesquisas = mysqlTable('satisfacao_pesquisas', {
  id: int('id').primaryKey().autoincrement(),
  pacienteId: int('paciente_id').notNull(),
  achouFacil: boolean('achou_facil'),
  conseguiuMedicacao: boolean('conseguiu_medicacao'),
  indicaria: boolean('indicaria'),
  comentario: text('comentario'),
  respondidoEm: datetime('respondido_em').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  pacienteIdx: uniqueIndex('idx_satisfacao_paciente').on(t.pacienteId),
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

// ═══════════════════════════════════════════════════════════════
// PIPELINE DE CONHECIMENTO CLÍNICO
// ═══════════════════════════════════════════════════════════════

// ── Artigos PubMed (deduplicados por PMID) ────────────────────

export const pubmedArticles = mysqlTable('pubmed_articles', {
  id: int('id').primaryKey().autoincrement(),
  pmid: varchar('pmid', { length: 20 }).notNull(),
  doi: varchar('doi', { length: 255 }),
  title: text('title').notNull(),
  journal: varchar('journal', { length: 255 }),
  year: int('year'),
  abstract: text('abstract'),
  zoteroItemKey: varchar('zotero_item_key', { length: 50 }),
  pdfAvailable: boolean('pdf_available').notNull().default(false),
  pdfUrl: varchar('pdf_url', { length: 500 }),
  totalNotesGenerated: int('total_notes_generated').notNull().default(0),
  firstSeenAt: datetime('first_seen_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  lastCitedAt: datetime('last_cited_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  pmidIdx: uniqueIndex('idx_pubmed_pmid').on(t.pmid),
  doiIdx: uniqueIndex('idx_pubmed_doi').on(t.doi),
  citedIdx: index('idx_pubmed_cited').on(t.totalNotesGenerated),
}))

// ── Vínculos artigo ↔ tópico de conhecimento ─────────────────

export const articleTopicLinks = mysqlTable('article_topic_links', {
  id: int('id').primaryKey().autoincrement(),
  articleId: int('article_id').notNull(),
  knowledgeTopicId: int('knowledge_topic_id').notNull(),
  consultationId: int('consultation_id'),
  doctorId: int('doctor_id'),
  clinicId: int('clinic_id').notNull(),
  notePathObsidian: varchar('note_path_obsidian', { length: 500 }),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  articleIdx: index('idx_atl_article').on(t.articleId),
  topicIdx: index('idx_atl_topic').on(t.knowledgeTopicId),
  clinicIdx: index('idx_atl_clinic').on(t.clinicId),
  doctorIdx: index('idx_atl_doctor').on(t.doctorId),
}))

// ── Clusters de artigos (meta-análises automáticas) ───────────

export const articleClusters = mysqlTable('article_clusters', {
  id: int('id').primaryKey().autoincrement(),
  clinicId: int('clinic_id').notNull(),
  referenceMonth: varchar('reference_month', { length: 7 }).notNull(),
  clusterTopic: varchar('cluster_topic', { length: 255 }).notNull(),
  medicalSpecialty: varchar('medical_specialty', { length: 100 }),
  articlePmids: json('article_pmids').notNull(),
  totalArticles: int('total_articles').notNull().default(0),
  totalNotesGenerated: int('total_notes_generated').notNull().default(0),
  metaAnalysisText: text('meta_analysis_text'),
  evidenceLevel: varchar('evidence_level', { length: 1 }),
  consensus: varchar('consensus', { length: 20 }),
  clinicalRecommendation: text('clinical_recommendation'),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  clinicMonthIdx: index('idx_clusters_clinic_month').on(t.clinicId, t.referenceMonth),
  specialtyIdx: index('idx_clusters_specialty').on(t.medicalSpecialty),
  evidenceIdx: index('idx_clusters_evidence').on(t.evidenceLevel),
}))

// ── Relatórios mensais de evidências ─────────────────────────

export const monthlyEvidenceReports = mysqlTable('monthly_evidence_reports', {
  id: int('id').primaryKey().autoincrement(),
  clinicId: int('clinic_id').notNull(),
  referenceMonth: varchar('reference_month', { length: 7 }).notNull(),
  specialtyCategory: varchar('specialty_category', { length: 100 }),
  medicalSpecialty: varchar('medical_specialty', { length: 100 }).notNull(),
  topic: varchar('topic', { length: 255 }),
  totalArticlesFound: int('total_articles_found').notNull().default(0),
  totalArticlesWithPdf: int('total_articles_with_pdf').notNull().default(0),
  totalTopicsProcessed: int('total_topics_processed').notNull().default(0),
  avgArticlesPerTopic: double('avg_articles_per_topic'),
  evidenceStrength: varchar('evidence_strength', { length: 20 }),
  topJournals: json('top_journals'),
  summaryClaude: text('summary_claude'),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  clinicMonthIdx: index('idx_mer_clinic_month').on(t.clinicId, t.referenceMonth),
  specialtyIdx: index('idx_mer_specialty').on(t.medicalSpecialty),
  strengthIdx: index('idx_mer_strength').on(t.evidenceStrength),
}))

// ── Log de envios de boletins ─────────────────────────────────

export const bulletinSendLogs = mysqlTable('bulletin_send_logs', {
  id: int('id').primaryKey().autoincrement(),
  doctorId: int('doctor_id').notNull(),
  referenceMonth: varchar('reference_month', { length: 7 }).notNull(),
  articlesCount: int('articles_count').notNull().default(0),
  metaAnalysesCount: int('meta_analyses_count').notNull().default(0),
  sentAt: datetime('sent_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  emailUsed: varchar('email_used', { length: 255 }),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  doctorMonthIdx: index('idx_bsl_doctor_month').on(t.doctorId, t.referenceMonth),
}))

// ── Notificações internas do admin ────────────────────────────

export const adminNotifications = mysqlTable('admin_notifications', {
  id: int('id').primaryKey().autoincrement(),
  type: varchar('type', { length: 100 }).notNull(),
  message: text('message').notNull(),
  month: varchar('month', { length: 7 }),
  read: boolean('read').notNull().default(false),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  typeIdx: index('idx_notif_type').on(t.type),
  readIdx: index('idx_notif_read').on(t.read),
  createdIdx: index('idx_notif_created').on(t.createdAt),
}))
