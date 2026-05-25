import type { TRPCClientErrorLike } from "@trpc/client";
import type { AnyRouter } from "@trpc/server";

const CODE_MAP: Record<string, string> = {
  UNAUTHORIZED: "Você precisa estar autenticado para continuar.",
  FORBIDDEN: "Você não tem permissão para realizar esta ação.",
  NOT_FOUND: "O recurso solicitado não foi encontrado.",
  BAD_REQUEST: "Os dados enviados são inválidos. Verifique e tente novamente.",
  CONFLICT: "Este registro já existe ou está em conflito com outro.",
  TOO_MANY_REQUESTS:
    "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  INTERNAL_SERVER_ERROR: "Erro interno. Tente novamente em instantes.",
  TIMEOUT:
    "A operação demorou demais. Verifique sua conexão e tente novamente.",
  PRECONDITION_FAILED:
    "Pré-condição não atendida. Recarregue a página e tente novamente.",
};

const MESSAGE_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /Limite por minuto/i,
    message:
      "Muitas análises em andamento. Aguarde 1 minuto e tente novamente.",
  },
  {
    pattern: /Limite diário/i,
    message: "Limite diário de análises atingido. Tente novamente amanhã.",
  },
  {
    pattern: /Dados insuficientes para análise/i,
    message:
      "O exame enviado não tem qualidade suficiente para análise automática.",
  },
  {
    pattern: /padrão adversarial/i,
    message: "O arquivo enviado contém conteúdo não permitido.",
  },
];

export function traduzirErroTrpc<T extends AnyRouter>(
  error: TRPCClientErrorLike<T> | null | undefined,
): string | null {
  if (!error) return null;

  // Check specific message patterns first (more precise than code)
  for (const { pattern, message } of MESSAGE_PATTERNS) {
    if (pattern.test(error.message ?? "")) return message;
  }

  const mapped = CODE_MAP[error.data?.code ?? ""];
  return mapped ?? error.message ?? "Ocorreu um erro inesperado.";
}
