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
