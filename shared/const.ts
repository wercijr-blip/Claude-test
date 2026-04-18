export const FORM_STEPS = [
  { step: 1, titulo: 'Dados Pessoais', rota: 'paciente' },
  { step: 2, titulo: 'Dados Demográficos', rota: 'demografico' },
  { step: 3, titulo: 'Contato', rota: 'contato' },
  { step: 4, titulo: 'Conduta', rota: 'conduta' },
  { step: 5, titulo: 'Prescrição', rota: 'prescricao' },
  { step: 6, titulo: 'Serviço', rota: 'servico' },
  { step: 7, titulo: 'Autorizados', rota: 'autorizados' },
  { step: 8, titulo: 'TCLE', rota: 'tcle' },
] as const

export const TOTAL_FORM_STEPS = 8

export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Não autorizado. Faça login para continuar.',
  FORBIDDEN: 'Acesso negado. Você não tem permissão para esta ação.',
  TOKEN_INVALID: 'Link inválido ou expirado.',
  TOKEN_USED: 'Este link já foi utilizado.',
  TOKEN_REVOKED: 'Este link foi revogado.',
  CPF_INVALID: 'CPF inválido.',
  NOT_FOUND: 'Registro não encontrado.',
  INTERNAL_ERROR: 'Erro interno. Tente novamente.',
  UPLOAD_SIZE: 'Arquivo muito grande. Máximo 10MB.',
  UPLOAD_TYPE: 'Tipo de arquivo não permitido.',
  RATE_LIMIT: 'Muitas tentativas. Aguarde e tente novamente.',
} as const

export const ROLES = {
  USER: 'user',
  SECRETARIA: 'secretaria',
  MEDICO: 'medico',
  ADMIN: 'admin',
} as const

export const PACIENTE_STATUS = {
  RASCUNHO: 'rascunho',
  PENDENTE: 'pendente',
  EM_REVISAO: 'em_revisao',
  APROVADO: 'aprovado',
  REJEITADO: 'rejeitado',
} as const

export const COR_RACA_OPTIONS = [
  { value: 'branca', label: 'Branca' },
  { value: 'preta', label: 'Preta' },
  { value: 'parda', label: 'Parda' },
  { value: 'amarela', label: 'Amarela' },
  { value: 'indigena', label: 'Indígena' },
  { value: 'nao_informado', label: 'Prefiro não informar' },
] as const

export const ESCOLARIDADE_OPTIONS = [
  { value: 'sem_escolaridade', label: 'Sem escolaridade' },
  { value: 'fundamental_incompleto', label: 'Fundamental incompleto' },
  { value: 'fundamental_completo', label: 'Fundamental completo' },
  { value: 'medio_incompleto', label: 'Médio incompleto' },
  { value: 'medio_completo', label: 'Médio completo' },
  { value: 'superior_incompleto', label: 'Superior incompleto' },
  { value: 'superior_completo', label: 'Superior completo' },
  { value: 'pos_graduacao', label: 'Pós-graduação' },
] as const

export const ESTADOS_BR = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO',
  'MA','MT','MS','MG','PA','PB','PR','PE','PI',
  'RJ','RN','RS','RO','RR','SC','SP','SE','TO',
] as const

export const PLANOS_VALIDOS = [
  'Amil',
  'Bradesco Saúde',
  'Cassi',
  'Golden Cross',
  'Hapvida',
  'NotreDame Intermédica',
  'Omint',
  'Porto Seguro Saúde',
  'Prevent Senior',
  'SulAmérica',
  'Unimed',
  'Outro',
] as const

export const HORARIO_ATENDIMENTO = {
  ABERTURA_HORA: 8,
  FECHAMENTO_HORA: 18,
} as const

export const PRECADASTRO_STATUS = {
  AGUARDANDO_VALIDACAO: 'aguardando_validacao',
  AGUARDANDO_PAGAMENTO: 'aguardando_pagamento',
  LINK_ENVIADO: 'link_enviado',
  REJEITADO: 'rejeitado',
} as const

export const VALOR_CONSULTA_CENTAVOS = 25000 // R$ 250,00

export const TIPO_CONSULTA = {
  PRIMEIRO_ATENDIMENTO: 'primeiro_atendimento',
  JA_FACO_PREP: 'ja_faco_prep',
} as const

export const STATUS_EXAME = {
  AGUARDANDO_ESCOLHA: 'aguardando_escolha',
  AGUARDANDO_UPLOAD: 'aguardando_upload',
  EM_VALIDACAO_IA: 'em_validacao_ia',
  EM_VALIDACAO_MEDICA: 'em_validacao_medica',
  APROVADO: 'aprovado',
  REJEITADO: 'rejeitado',
} as const

export const MOTIVO_REJEICAO_EXAME = {
  ILEGIVEL: 'ilegivel',
  DATA_INVALIDA: 'data_invalida',
  NOME_DIVERGENTE: 'nome_divergente',
  RESULTADO_POSITIVO: 'resultado_positivo',
} as const

export const EXAMES_PRIMEIRO_ATENDIMENTO = [
  'Anti-HIV 1/2 com Ag p24 (4ª geração)',
  'VDRL quantitativo (Sífilis)',
  'HBsAg (Hepatite B — antígeno de superfície)',
  'Anti-HBc total (Hepatite B — anticorpo total)',
  'Anti-HCV (Hepatite C)',
  'Creatinina sérica + TFG estimada',
  'Hemograma completo',
  'EAS — Urinálise',
] as const

export const EXAMES_FOLLOWUP_PREP = [
  'Anti-HIV 1/2 com Ag p24 (4ª geração)',
  'Creatinina sérica + TFG estimada',
  'Hemograma completo',
  'EAS — Urinálise',
] as const

export const EXAMES_HIV_ISOLADO = [
  'Anti-HIV 1/2 com Ag p24 (4ª geração)',
] as const

export const DIAS_VALIDADE_EXAME = 7
export const DIAS_VALIDADE_LINK_UPLOAD = 7
