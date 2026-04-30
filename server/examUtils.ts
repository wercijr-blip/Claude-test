type ExameStatusFiltro = 'todos' | 'pendente' | 'validado' | 'rejeitado' | 'liberado'

export function filtrarExamePorStatus(
  resultadoIa: { status?: string } | null,
  statusFiltro: ExameStatusFiltro,
): boolean {
  if (statusFiltro === 'todos') return true
  const iaStatus = resultadoIa?.status ?? 'pendente'
  if (statusFiltro === 'pendente') return !resultadoIa || iaStatus === 'pendente'
  if (statusFiltro === 'validado') return iaStatus === 'aprovado' || iaStatus === 'validado'
  if (statusFiltro === 'rejeitado') return iaStatus === 'rejeitado' || iaStatus === 'rejeitado_ia'
  if (statusFiltro === 'liberado') return iaStatus === 'liberado_manualmente'
  return true
}

export function isExameRejeitadoIa(resultadoIa: { status?: string } | null): boolean {
  return resultadoIa?.status === 'rejeitado_ia' || resultadoIa?.status === 'rejeitado'
}
