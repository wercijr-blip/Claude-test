import nodemailer from 'nodemailer'
import { env } from './_core/env.ts'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: env.GMAIL_USER,
    pass: env.GMAIL_APP_PASSWORD,
  },
})

function baseTemplate(titulo: string, corpo: string): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${titulo}</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
    <div style="background:#1d4ed8;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:20px;">Facilita PrEP</h1>
    </div>
    <div style="padding:32px;">
      ${corpo}
    </div>
    <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
      <p style="margin:0;font-size:11px;color:#94a3b8;">
        Facilita PrEP · facilitaprep.manus.space<br>
        Este e-mail é confidencial e destina-se exclusivamente ao destinatário.
      </p>
    </div>
  </div>
</body>
</html>`
}

export async function enviarLinkAcesso(para: string, link: string, expiresAt: Date): Promise<void> {
  const dataExpiracao = expiresAt.toLocaleDateString('pt-BR')
  await transporter.sendMail({
    from: `"Facilita PrEP" <${env.GMAIL_USER}>`,
    to: para,
    subject: 'Seu link de acesso ao formulário PrEP',
    html: baseTemplate(
      'Acesso ao formulário PrEP',
      `<p style="color:#334155;font-size:15px;">Você recebeu um link para preencher o formulário PrEP.</p>
      <a href="${link}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;">
        Acessar formulário
      </a>
      <p style="color:#64748b;font-size:13px;">Link válido até <strong>${dataExpiracao}</strong>.</p>
      <p style="color:#64748b;font-size:13px;">Se você não solicitou este acesso, ignore este e-mail.</p>`,
    ),
  })
}

export async function enviarConfirmacaoEnvio(para: string, nomePaciente: string): Promise<void> {
  await transporter.sendMail({
    from: `"Facilita PrEP" <${env.GMAIL_USER}>`,
    to: para,
    subject: 'Formulário recebido — Facilita PrEP',
    html: baseTemplate(
      'Formulário recebido',
      `<p style="color:#334155;font-size:15px;">Olá, <strong>${nomePaciente}</strong>!</p>
      <p style="color:#334155;font-size:15px;">Seu formulário foi recebido com sucesso e está em análise pelo médico responsável.</p>
      <p style="color:#64748b;font-size:13px;">Você receberá um novo e-mail quando houver uma atualização.</p>`,
    ),
  })
}

export async function enviarResultadoAprovado(para: string, nomePaciente: string): Promise<void> {
  await transporter.sendMail({
    from: `"Facilita PrEP" <${env.GMAIL_USER}>`,
    to: para,
    subject: 'Prescrição aprovada — Facilita PrEP',
    html: baseTemplate(
      'Prescrição aprovada',
      `<p style="color:#334155;font-size:15px;">Olá, <strong>${nomePaciente}</strong>!</p>
      <p style="color:#334155;font-size:15px;">Sua prescrição foi aprovada pelo médico. Em breve você receberá o documento assinado digitalmente.</p>`,
    ),
  })
}

export async function enviarLinkAcessoIntake(para: string, nome: string, link: string, expiresAt: Date): Promise<void> {
  const dataExpiracao = expiresAt.toLocaleDateString('pt-BR')
  await transporter.sendMail({
    from: `"Facilita PrEP" <${env.GMAIL_USER}>`,
    to: para,
    subject: 'Seu acesso ao formulário PrEP está pronto — Facilita PrEP',
    html: baseTemplate(
      'Acesso liberado',
      `<p style="color:#334155;font-size:15px;">Olá, <strong>${nome}</strong>!</p>
      <p style="color:#334155;font-size:15px;">Seu cadastro foi confirmado. Clique no botão abaixo para preencher o formulário clínico PrEP:</p>
      <a href="${link}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:20px 0;font-size:16px;">
        Acessar formulário
      </a>
      <p style="color:#64748b;font-size:13px;">Link válido até <strong>${dataExpiracao}</strong>. Use apenas uma vez.</p>
      <p style="color:#64748b;font-size:13px;">Se você não solicitou este acesso, ignore este e-mail.</p>`,
    ),
  })
}

export async function enviarResultadoRejeitado(para: string, nomePaciente: string, motivo: string): Promise<void> {
  await transporter.sendMail({
    from: `"Facilita PrEP" <${env.GMAIL_USER}>`,
    to: para,
    subject: 'Atualização sobre seu pedido — Facilita PrEP',
    html: baseTemplate(
      'Pedido não aprovado',
      `<p style="color:#334155;font-size:15px;">Olá, <strong>${nomePaciente}</strong>!</p>
      <p style="color:#334155;font-size:15px;">Após análise médica, não foi possível aprovar sua solicitação de PrEP neste momento.</p>
      <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:12px 16px;border-radius:4px;margin:16px 0;">
        <p style="color:#dc2626;margin:0;font-size:13px;"><strong>Motivo:</strong> ${motivo}</p>
      </div>
      <p style="color:#64748b;font-size:13px;">Entre em contato com a clínica para mais informações.</p>`,
    ),
  })
}
