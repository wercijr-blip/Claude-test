import { env } from './env.ts'

export async function sendWelcomeEmail(to: string, name: string, clinicName: string, tempPassword: string): Promise<void> {
  if (!env.SENDGRID_API_KEY) {
    console.warn('[EMAIL] SENDGRID_API_KEY não configurado — email de boas-vindas não enviado')
    return
  }

  const body = `Dr(a). ${name},\n\nVocê foi cadastrado no MedScrita.\nLogin: ${to}\nSenha temporária: ${tempPassword}\nAcesse: ${env.MEDSCRIBE_URL}/login\n\nNo primeiro acesso você será solicitado a redefinir sua senha.\n\nAtenciosamente,\nAdministração — ${clinicName}`

  const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: env.BULLETIN_FROM_EMAIL, name: env.BULLETIN_FROM_NAME },
      subject: `Bem-vindo ao MedScrita — ${clinicName}`,
      content: [{ type: 'text/plain', value: body }],
    }),
    signal: AbortSignal.timeout(10000),
  })

  if (!resp.ok) {
    const txt = await resp.text().catch(() => '')
    console.error(`[EMAIL] Falha ao enviar email de boas-vindas para ${to}: ${resp.status} ${txt}`)
  }
}

export async function sendBulletinEmail(opts: {
  to: string
  name: string
  subject: string
  html: string
}): Promise<void> {
  if (!env.SENDGRID_API_KEY) {
    console.warn('[EMAIL] SENDGRID_API_KEY não configurado — boletim não enviado')
    return
  }

  const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: opts.to, name: opts.name }] }],
      from: { email: env.BULLETIN_FROM_EMAIL, name: env.BULLETIN_FROM_NAME },
      subject: opts.subject,
      content: [{ type: 'text/html', value: opts.html }],
    }),
    signal: AbortSignal.timeout(10000),
  })

  if (!resp.ok) {
    const txt = await resp.text().catch(() => '')
    console.error(`[EMAIL] Falha ao enviar boletim para ${opts.to}: ${resp.status} ${txt}`)
  }
}
