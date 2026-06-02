/**
 * Converte data para DD/MM/AAAA. Aceita ISO (YYYY-MM-DD) ou DD/MM/AAAA.
 *
 * Histórico: a IA de validação de exames extrai datas em formato BR (DD/MM/AAAA)
 * e grava direto em consultas_inicio.data_exame_validado. Uma versão anterior
 * só tratava ISO — fazia split('-') no input "24/04/2026" e produzia
 * "undefined/undefined/24/04/2026", deixando campos em branco nos PDFs SUS.
 */
export function formatarDataBR(input: string): string {
  if (!input) return ''
  // Já em DD/MM/AAAA? normaliza o zero-padding
  const matchBR = input.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (matchBR) {
    const [, dd, mm, yyyy] = matchBR
    return `${dd.padStart(2, '0')}/${mm.padStart(2, '0')}/${yyyy}`
  }
  // ISO YYYY-MM-DD
  const matchISO = input.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (matchISO) {
    const [, yyyy, mm, dd] = matchISO
    return `${dd}/${mm}/${yyyy}`
  }
  return input
}
