/**
 * Normalizes a stored phone number to E.164 format.
 * Handles legacy BR numbers (10-11 digits without +55) stored before the E.164 migration.
 * Safe to call on values already in E.164 — returns them unchanged.
 */
export function normalizarTelefoneParaE164(telefone: string | null | undefined): string | null {
  if (!telefone) return null
  if (/^\+\d{8,15}$/.test(telefone)) return telefone
  const digits = telefone.replace(/\D/g, '')
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`
  return telefone
}
