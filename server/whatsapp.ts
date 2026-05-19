import { env } from './_core/env.ts'

function formatarTelefoneWA(telefone: string): string {
  const digits = telefone.replace(/\D/g, '')
  // E.164 com código de país não-BR (não começa com 55): usa direto
  if (digits.length >= 10 && !digits.startsWith('55')) return digits
  // Já tem +55 com DDD+número (12-13 dígitos): usa direto
  if (digits.startsWith('55') && digits.length >= 12) return digits
  // BR legado sem +55 (10-11 dígitos): prepende 55
  return `55${digits}`
}

export async function enviarWhatsApp(telefone: string, mensagem: string): Promise<boolean> {
  if (!env.ZAPI_INSTANCE_ID || !env.ZAPI_TOKEN) return false

  try {
    const numero = formatarTelefoneWA(telefone)
    const res = await fetch(
      `https://api.z-api.io/instances/${env.ZAPI_INSTANCE_ID}/token/${env.ZAPI_TOKEN}/send-text`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Client-Token': (env.ZAPI_CLIENT_TOKEN ?? env.ZAPI_TOKEN) as string },
        body: JSON.stringify({ phone: numero, message: mensagem }),
      },
    )
    return res.ok
  } catch {
    return false
  }
}
