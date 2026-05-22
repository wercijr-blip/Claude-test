import type { TRPCClientErrorLike } from '@trpc/client'
import type { AnyRouter } from '@trpc/server'

const CODE_MAP: Record<string, string> = {
  UNAUTHORIZED: 'Você precisa estar autenticado para continuar.',
  FORBIDDEN: 'Você não tem permissão para realizar esta ação.',
  NOT_FOUND: 'O recurso solicitado não foi encontrado.',
  BAD_REQUEST: 'Os dados enviados são inválidos. Verifique e tente novamente.',
  CONFLICT: 'Este registro já existe ou está em conflito com outro.',
  TOO_MANY_REQUESTS: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  INTERNAL_SERVER_ERROR: 'Erro interno. Tente novamente em instantes.',
  TIMEOUT: 'A operação demorou demais. Verifique sua conexão e tente novamente.',
  PRECONDITION_FAILED: 'Pré-condição não atendida. Recarregue a página e tente novamente.',
}

export function traduzirErroTrpc<T extends AnyRouter>(
  error: TRPCClientErrorLike<T> | null | undefined,
): string | null {
  if (!error) return null
  const mapped = CODE_MAP[error.data?.code ?? '']
  return mapped ?? error.message ?? 'Ocorreu um erro inesperado.'
}
