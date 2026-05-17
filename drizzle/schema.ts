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

// ── Usuários (staff: secretaria, médico, admin) ──────────────

export const users = mysqlTable('users', {
  id: int('id').primaryKey().autoincrement(),
  openId: varchar('open_id', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  nome: varchar('nome', { length: 255 }),
  role: varchar('role', { length: 50 }).notNull().default('user'),
  ativo: boolean('ativo').notNull().default(true),
  // TOTP 2FA — obrigatório para admin e medico
  totpSecretEncrypted: text('totp_secret_encrypted'),
  totpEnabled: boolean('totp_enabled').notNull().default(false),
  totpBackupCodes: json('totp_backup_codes'),  // string[] (hashed, each single-use)
  // Soft delete — LGPD audit trail; never hard-delete staff records
  deletedAt: datetime('deleted_at'),
  deletedBy: int('deleted_by'),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`).$onUpdateFn(() => new Date()),
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
  createdById: int('created_by_id').notNull().references(() => users.id),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  tokenHashIdx: uniqueIndex('idx_access_tokens_hash').on(t.tokenHash),
  createdByIdx: index('idx_access_tokens_created_by').on(t.createdById),
}))

// ── Pacientes (registro completo do formulário multi-etapas) ──

export const pacientes = mysqlTable('pacientes', {
  id: int('id').primaryKey().autoincrement(),
  tokenId: int('token_id').notNull().references(() => accessTokens.id),

  // Step 1 — Dados Pessoais (PII encriptado)
  cpfEncrypted: text('cpf_encrypted').notNull(),
  cpfHash: varchar('cpf_hash', { length: 64 }).notNull(),
  nomeEncrypted: text('nome_encrypted').notNull(),
  dataNascimentoEncrypted: text('data_nascimento_encrypted'),
  nomeMaeEncrypted: text('nome_mae_encrypted'),
  cns: varchar('cns', { length: 20 }),
  sexo: varchar('sexo', { length: 20 }),
  nomeSocial: varchar('nome_social', { length: 255 }),

  // Step 2 — Demográfico
  corRaca: varchar('cor_raca', { length: 50 }),
  escolaridade: varchar('escolaridade', { length: 100 }),
  situacaoConjugal: varchar('situacao_conjugal', { length: 50 }),
  rendaFamiliar: varchar('renda_familiar', { length: 50 }),
  ocupacao: varchar('ocupacao', { length: 100 }),
  identidadeGenero: varchar('identidade_genero', { length: 50 }),
  orientacaoSexual: varchar('orientacao_sexual', { length: 50 }),
  ufNascimento: varchar('uf_nascimento', { length: 2 }),
  municipioNascimento: varchar('municipio_nascimento', { length: 100 }),
  situacaoRua: boolean('situacao_rua'),
  privadoLiberdade: boolean('privado_liberdade'),

  // Step 3 — Contato (PII encriptado)
  emailEncrypted: text('email_encrypted'),
  tipoTelefone: varchar('tipo_telefone', { length: 20 }),
  telefoneEncrypted: text('telefone_encrypted'),
  permiteContato: boolean('permite_contato'),
  tipoContato: varchar('tipo_contato', { length: 20 }),
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
  prepModalidade: varchar('prep_modalidade', { length: 30 }),  // 'PrEP diária' | 'PrEP sob demanda'

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
  medicoId: int('medico_id').references(() => users.id),
  observacoesMedico: text('observacoes_medico'),
  retentionUntil: datetime('retention_until'),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`).$onUpdateFn(() => new Date()),
}, (t) => ({
  cpfHashIdx: index('idx_pacientes_cpf_hash').on(t.cpfHash),
  statusIdx: index('idx_pacientes_status').on(t.status),
  tokenIdx: uniqueIndex('idx_pacientes_token').on(t.tokenId),
  medicoIdx: index('idx_pacientes_medico').on(t.medicoId),
}))

// ── Exames (arquivos enviados pelo paciente) ──────────────────

export const exames = mysqlTable('exames', {
  id: int('id').primaryKey().autoincrement(),
  pacienteId: int('paciente_id').notNull().references(() => pacientes.id),
  s3Key: varchar('s3_key', { length: 500 }).notNull(),
  nomeArquivo: varchar('nome_arquivo', { length: 255 }).notNull(),
  tipoExame: varchar('tipo_exame', { length: 100 }),
  mimeType: varchar('mime_type', { length: 100 }),
  tamanhoBytes: int('tamanho_bytes'),
  // resultadoIa JSON shape (see shared/types.ts ResultadoIa):
  //   tipoExame: TipoExame
  //   resultado: 'reagente' | 'nao_reagente' | 'inconclusivo' | 'nao_identificado'
  //   confianca: number (0–1)
  //   observacoes?: string
  //   processadoEm: ISO timestamp (set by analisarExame)
  //   status: 'pendente' | 'aprovado_automaticamente' | 'rejeitado_ia' | 'pendente_revisao'
  //           (set by examQueue worker after auto-approval logic)
  resultadoIa: json('resultado_ia'),
  revisadoPorId: int('revisado_por_id').references(() => users.id),
  revisadoEm: datetime('revisado_em'),
  liberadoPorMedicoId: int('liberado_por_medico_id').references(() => users.id),
  liberadoEm: datetime('liberado_em'),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  pacienteIdx: index('idx_exames_paciente').on(t.pacienteId),
}))

// ── Assinaturas TCLE ──────────────────────────────────────────

export const tcleAssinaturas = mysqlTable('tcle_assinaturas', {
  id: int('id').primaryKey().autoincrement(),
  pacienteId: int('paciente_id').notNull().references(() => pacientes.id),
  // Nullable a partir do aceite eletrônico via checkbox.
  // Pode estar preenchido em registros antigos (quando havia SignaturePad).
  assinaturaDataUrl: text('assinatura_data_url'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  signedAt: datetime('signed_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  pacienteIdx: uniqueIndex('idx_tcle_paciente').on(t.pacienteId),
}))

// ── PDFs gerados ──────────────────────────────────────────────

export const pdfs = mysqlTable('pdfs', {
  id: int('id').primaryKey().autoincrement(),
  pacienteId: int('paciente_id').notNull().references(() => pacientes.id),
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
  userId: int('user_id').references(() => users.id),
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
  pacienteId: int('paciente_id').references(() => pacientes.id),
  precadastroId: int('precadastro_id').references(() => precadastros.id),
  numeroNfse: varchar('numero_nfse', { length: 50 }),
  status: varchar('status', { length: 50 }).notNull().default('pendente'),
  valorCentavos: int('valor_centavos').notNull(),
  focusnfeRef: varchar('focusnfe_ref', { length: 100 }),
  erroDescricao: text('erro_descricao'),
  emitidoEm: datetime('emitido_em'),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  pacienteIdx: index('idx_nfse_paciente').on(t.pacienteId),
  precadastroIdx: index('idx_nfse_precadastro').on(t.precadastroId),
}))

// ── Consultas Início (segunda parte — validação de exame HIV) ──

export const consultasInicio = mysqlTable('consultas_inicio', {
  id: int('id').primaryKey().autoincrement(),
  tokenId: int('token_id').notNull().references(() => accessTokens.id),
  tipoConsulta: varchar('tipo_consulta', { length: 50 }), // 'primeiro_atendimento' | 'ja_faco_prep'
  temExameRecente: boolean('tem_exame_recente'),
  exameS3Key: varchar('exame_s3_key', { length: 500 }),
  pedidoCompletoS3Key: varchar('pedido_completo_s3_key', { length: 500 }),
  pedidoIstS3Key: varchar('pedido_ist_s3_key', { length: 500 }),
  pedidoHivS3Key: varchar('pedido_hiv_s3_key', { length: 500 }),
  pedidoDensitometriaS3Key: varchar('pedido_densitometria_s3_key', { length: 500 }),
  // status values: aguardando_escolha | aguardando_upload | em_validacao_ia |
  //   rejeitado_data_invalida | pendente_revisao_medica | pendente_revisao_medica_urgente |
  //   aprovado_ia | aprovado | rejeitado | em_validacao_medica | expirado
  status: varchar('status', { length: 50 }).notNull().default('aguardando_escolha'),
  resultadoIa: json('resultado_ia'),
  motivoRejeicao: varchar('motivo_rejeicao', { length: 200 }),
  tentativasReenvio: int('tentativas_reenvio').notNull().default(0),
  validadoPorId: int('validado_por_id').references(() => users.id),
  validadoEm: datetime('validado_em'),
  dataExameValidado: varchar('data_exame_validado', { length: 20 }),
  resultadoHivValidado: varchar('resultado_hiv_validado', { length: 20 }),
  observacoesMedico: text('observacoes_medico'),
  ultimoLembreteAt: datetime('ultimo_lembrete_at'),
  linkExpiresAt: datetime('link_expires_at'),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`).$onUpdateFn(() => new Date()),
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
  accessTokenId: int('access_token_id').references(() => accessTokens.id),
  validadoPorId: int('validado_por_id').references(() => users.id),
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
  pacienteId: int('paciente_id').notNull().references(() => pacientes.id),
  achouFacil: boolean('achou_facil'),
  conseguiuMedicacao: boolean('conseguiu_medicacao'),
  indicaria: boolean('indicaria'),
  comentario: text('comentario'),
  respondidoEm: datetime('respondido_em').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  pacienteIdx: uniqueIndex('idx_satisfacao_paciente').on(t.pacienteId),
}))

// ── Pagamentos ────────────────────────────────────────────────

export const pagamentos = mysqlTable('pagamentos', {
  id: int('id').primaryKey().autoincrement(),
  pacienteId: int('paciente_id').notNull().references(() => pacientes.id),
  provider: varchar('provider', { length: 20 }).notNull().default('asaas'),
  asaasPaymentId: varchar('asaas_payment_id', { length: 100 }),
  // Deprecated — kept for historical rows that went through Stripe
  stripePaymentId: varchar('stripe_payment_id', { length: 100 }),
  stripeSessionId: varchar('stripe_session_id', { length: 100 }),
  status: varchar('status', { length: 50 }).notNull().default('pendente'),
  valorCentavos: int('valor_centavos').notNull(),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  pacienteIdx: index('idx_pagamentos_paciente').on(t.pacienteId),
  asaasIdx: index('idx_pagamentos_asaas').on(t.asaasPaymentId),
  sessionIdx: index('idx_pagamentos_session').on(t.stripeSessionId),
}))

// ── Eventos Stripe (idempotência de webhook) ──────────────────
// Registra event.id processado para evitar reprocessamento em caso de retry.

export const stripeEvents = mysqlTable('stripe_events', {
  eventId: varchar('event_id', { length: 100 }).primaryKey(),
  type: varchar('type', { length: 100 }).notNull(),
  processadoEm: datetime('processado_em').notNull().default(sql`CURRENT_TIMESTAMP`),
})

// ── Audit Log LGPD (Art. 37 — imutável, sem UPDATE/DELETE) ───
// Registra acessos e operações sobre dados pessoais de pacientes.
// Nunca atualizar ou deletar registros — append-only por design.

export const auditLog = mysqlTable('audit_log', {
  id: int('id').primaryKey().autoincrement(),
  // Quem fez a ação (staff userId ou null para ações do próprio paciente)
  actorId: int('actor_id').references(() => users.id),
  actorRole: varchar('actor_role', { length: 50 }),
  // O que foi feito
  action: varchar('action', { length: 100 }).notNull(),
  // Sobre qual recurso (ex: 'paciente', 'exame', 'pdf', 'token')
  resourceType: varchar('resource_type', { length: 50 }).notNull(),
  resourceId: int('resource_id'),
  // Contexto adicional (campos acessados, motivo, etc.)
  detalhes: json('detalhes'),
  // Rastreabilidade de rede
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  actorIdx: index('idx_audit_actor').on(t.actorId),
  actionIdx: index('idx_audit_action').on(t.action),
  resourceIdx: index('idx_audit_resource').on(t.resourceType, t.resourceId),
  createdAtIdx: index('idx_audit_created').on(t.createdAt),
}))

// ── Tokens de Pesquisa de Satisfação ─────────────────────────
// Um token aleatório por paciente, gerado no momento do envio do link.
// Substituição do hash determinístico SHA-256(pacienteId + JWT_SECRET).

export const pesquisaTokens = mysqlTable('pesquisa_tokens', {
  pacienteId: int('paciente_id').primaryKey().references(() => pacientes.id),
  token: varchar('token', { length: 64 }).notNull(),
  criadoEm: datetime('criado_em').notNull().default(sql`CURRENT_TIMESTAMP`),
  expiraEm: datetime('expira_em').notNull(),
}, (t) => ({
  tokenIdx: uniqueIndex('idx_pesquisa_token').on(t.token),
}))

// ── Clinical Intelligence System ──────────────────────────────
// Tabelas para MedScribe, alertas de conduta e digests clínicos.

export const clinicalSessions = mysqlTable('clinical_sessions', {
  id: int('id').primaryKey().autoincrement(),
  medicoId: int('medico_id').notNull().references(() => users.id),
  // Aberta manualmente ou ao iniciar o primeiro SOAP do dia.
  abertaEm: datetime('aberta_em').notNull().default(sql`CURRENT_TIMESTAMP`),
  // Preenchida pelo evento "encerrar sessão" (dispara o digest diário).
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
  // PII — nome do paciente encriptado (LGPD)
  pacienteNomeEncrypted: text('paciente_nome_encrypted').notNull(),
  // Template usado no MedScribe (Prompt 02)
  template: varchar('template', { length: 50 }).notNull().default('infectologia_geral'),
  // Texto completo do SOAP gerado
  soapTexto: text('soap_texto').notNull(),
  // JSON completo do knowledge_metadata (KnowledgeMetadata do Prompt 02)
  knowledgeMetadata: json('knowledge_metadata'),
  // Campos denormalizados do knowledge_metadata para indexação/busca
  diagnosticoPrincipal: varchar('diagnostico_principal', { length: 255 }),
  cid10: varchar('cid10', { length: 10 }),
  certeza: varchar('certeza', { length: 20 }), // confirmado | provavel | suspeito
  pubmedQuery: text('pubmed_query'),
  // Síntese das evidências PubMed gerada pelo Prompt 03 (null até o worker completar)
  sinteseEvidencias: text('sintese_evidencias'),
  // Metadados de qualidade extraídos da síntese: contagem por nível GRADE, lacunas, total de citações
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
  nivelUrgencia: varchar('nivel_urgencia', { length: 10 }).notNull(), // baixo | medio | alto
  // Chave canônica gerada pelo Prompt 06 — usada para deduplicação e supressão
  hashAlerta: varchar('hash_alerta', { length: 128 }),
  // JSON completo retornado pelo Prompt 06 (ResultadoDivergenciaConducta)
  alertaJson: json('alerta_json').notNull(),
  mensagemMedico: text('mensagem_medico'),
  // Controle de leitura — preenchido quando médico marca como visto
  vistoPorId: int('visto_por_id').references(() => users.id),
  vistoEm: datetime('visto_em'),
  // Supressão — preenchido quando médico suprime o tipo de alerta
  supressaoAte: datetime('supressao_ate'),
  // Feedback do médico — alimenta histórico do Prompt 06
  feedbackMedico: varchar('feedback_medico', { length: 20 }),   // concordo | discordo | inaplicavel
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

/**
 * Rascunhos e publicações gerados pelo CIS (Prompts 10 e 11).
 * Rastreia o ciclo completo: rascunho → revisão → submetido → publicado.
 * Alimenta as seções "séries" e "publicações" dos digests semanais e mensais.
 */
export const publicationDrafts = mysqlTable('publication_drafts', {
  id: int('id').primaryKey().autoincrement(),
  medicoId: int('medico_id').notNull().references(() => users.id),
  // 'serie_casos' | 'revisao_literatura'
  tipo: varchar('tipo', { length: 20 }).notNull(),
  // 'rascunho' | 'em_revisao' | 'submetido' | 'aceito' | 'publicado'
  status: varchar('status', { length: 20 }).notNull().default('rascunho'),
  titulo: text('titulo'),
  // Série de casos
  diagnostico: varchar('diagnostico', { length: 255 }),
  cid10: varchar('cid10', { length: 10 }),
  nCasos: int('n_casos').default(0),
  soapNoteIds: json('soap_note_ids'),   // number[] — IDs das notas incluídas
  // Revisão de literatura
  tema: varchar('tema', { length: 255 }),
  nArtigos: int('n_artigos').default(0),
  // Submissão / publicação
  jornal: varchar('jornal', { length: 255 }),
  doi: varchar('doi', { length: 255 }),
  dataSubmissao: datetime('data_submissao'),
  dataPublicacao: datetime('data_publicacao'),
  // Texto gerado pelo Prompt 10 ou 11 (rascunho completo)
  textoGerado: longtext('texto_gerado'),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  atualizadoEm: datetime('atualizado_em').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  medicoIdx:    index('idx_pdrafts_medico').on(t.medicoId),
  statusIdx:    index('idx_pdrafts_status').on(t.status),
  cid10Idx:     index('idx_pdrafts_cid10').on(t.cid10),
  // Impede criação de duplicate rascunho para mesmo diagnóstico enquanto já existe um ativo
  unicoCid10:   uniqueIndex('idx_pdrafts_uniq_cid10').on(t.medicoId, t.tipo, t.cid10, t.status),
}))

export const clinicalDigests = mysqlTable('clinical_digests', {
  id: int('id').primaryKey().autoincrement(),
  medicoId: int('medico_id').notNull().references(() => users.id),
  // diario | semanal | mensal
  tipo: varchar('tipo', { length: 10 }).notNull(),
  // Referência do período: "2026-05-17" (diário), "2026-W20" (semanal), "2026-05" (mensal)
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
