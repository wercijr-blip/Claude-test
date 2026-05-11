import { Resend } from 'resend'
import { env } from './_core/env.ts'
import { logger } from './_core/logger.ts'

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null

function assertResend(): NonNullable<typeof resend> {
  if (!resend) {
    if (env.NODE_ENV === 'production') {
      throw new Error('RESEND_API_KEY não configurado em produção — e-mail bloqueado')
    }
    logger.warn('[email] RESEND_API_KEY não configurado — e-mail ignorado em desenvolvimento')
    throw new Error('__dev_skip__')
  }
  return resend
}

async function send(opts: {
  to: string | string[]
  subject: string
  html: string
  attachments?: { filename: string; content: Buffer }[]
}): Promise<void> {
  let client: NonNullable<typeof resend>
  try {
    client = assertResend()
  } catch (e) {
    if ((e as Error).message === '__dev_skip__') return
    throw e
  }
  const { error } = await client.emails.send({
    from: env.EMAIL_FROM,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    attachments: opts.attachments?.map(a => ({ filename: a.filename, content: a.content })),
  })
  if (error) throw new Error(`Resend: ${error.message}`)
}

async function sendMultiple(opts: {
  to: string[]
  subject: string
  html: string
}): Promise<void> {
  let client: NonNullable<typeof resend>
  try {
    client = assertResend()
  } catch (e) {
    if ((e as Error).message === '__dev_skip__') return
    throw e
  }
  const { error } = await client.emails.send({
    from: env.EMAIL_FROM,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  })
  if (error) throw new Error(`Resend: ${error.message}`)
}


function baseTemplate(titulo: string, corpo: string): string {
  const dominio = env.APP_URL.replace('https://', '').replace('http://', '')
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
        Facilita PrEP · ${dominio}<br>
        Este e-mail é confidencial e destina-se exclusivamente ao destinatário.
      </p>
    </div>
  </div>
</body>
</html>`
}

export async function enviarLinkAcesso(para: string, link: string, expiresAt: Date): Promise<void> {
  const dataExpiracao = expiresAt.toLocaleDateString('pt-BR')
  await send({
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
  await send({
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
  await send({
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
  await send({
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

export async function enviarDocumentosAssinados(
  para: string,
  nomePaciente: string,
  anexos: { filename: string; buffer: Buffer }[],
): Promise<void> {
  await send({
    to: para,
    subject: 'Seus documentos PrEP estão prontos — Facilita PrEP',
    html: baseTemplate(
      'Documentos prontos',
      `<p style="color:#334155;font-size:15px;">Olá, <strong>${nomePaciente}</strong>!</p>
      <p style="color:#334155;font-size:15px;">Seus documentos PrEP foram gerados e assinados digitalmente. Você os encontra em anexo neste e-mail.</p>
      <p style="color:#64748b;font-size:13px;">Estes documentos possuem assinatura digital ICP-Brasil com validade legal conforme CFM 2.299/2021.</p>
      <p style="color:#64748b;font-size:13px;">Guarde estes arquivos para seu controle.</p>`,
    ),
    attachments: anexos.map(a => ({ filename: a.filename, content: a.buffer })),
  })
}

// TEMPLATE-4 — Receita PrEP pronta com assinatura ICP-Brasil
export async function enviarPrescricaoPronta(
  para: string,
  nomePaciente: string,
  anexos: { filename: string; buffer: Buffer }[],
): Promise<void> {
  const validadeDate = new Date()
  validadeDate.setMonth(validadeDate.getMonth() + 4)
  const dataValidade = validadeDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  await send({
    to: para,
    subject: 'Sua receita PrEP está pronta — Facilita PrEP',
    html: baseTemplate(
      'Receita PrEP pronta',
      `<p style="color:#334155;font-size:15px;">Olá, <strong>${nomePaciente}</strong>!</p>
      <p style="color:#334155;font-size:15px;">Sua receita de PrEP foi emitida e assinada digitalmente pelo médico responsável. Todos os documentos estão em anexo neste e-mail.</p>
      <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:16px;border-radius:4px;margin:20px 0;">
        <p style="color:#15803d;margin:0 0 8px;font-size:14px;font-weight:600;">Receita emitida com sucesso</p>
        <p style="color:#166534;margin:0;font-size:13px;">Validade: até <strong>${dataValidade}</strong> (4 meses)</p>
      </div>
      <p style="color:#334155;font-size:14px;font-weight:600;">Próximos passos:</p>
      <ol style="color:#334155;font-size:13px;line-height:1.8;padding-left:20px;margin:8px 0 16px;">
        <li>Apresente a receita em uma farmácia ou drogaria de sua preferência</li>
        <li>Ou retire gratuitamente em uma UDM (Unidade Dispensadora de Medicamentos) do SUS</li>
        <li>Tome 1 comprimido de Tenofovir/Emtricitabina por dia, no mesmo horário</li>
      </ol>
      <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:12px 16px;border-radius:4px;margin:16px 0;">
        <p style="color:#1e40af;margin:0;font-size:12px;">
          Documentos assinados digitalmente com certificado ICP-Brasil conforme CFM 2.299/2021.
          Têm validade jurídica e são aceitos em todo o território nacional.
        </p>
      </div>
      <p style="color:#64748b;font-size:12px;">Guarde estes arquivos para seu controle. Em caso de dúvidas, entre em contato:<br>
      📱 WhatsApp: <a href="https://wa.me/5561994018161" style="color:#1d4ed8;">(61) 99401-8161</a> &nbsp;|&nbsp;
      📞 Fixo: (61) 4042-7188 &nbsp;|&nbsp;
      ✉️ <a href="mailto:contato@facilitaprep.com.br" style="color:#1d4ed8;">contato@facilitaprep.com.br</a></p>`,
    ),
    attachments: anexos.map(a => ({ filename: a.filename, content: a.buffer })),
  })
}

export async function enviarPesquisaSatisfacao(
  para: string,
  nomePaciente: string,
  link: string,
): Promise<void> {
  await send({
    to: para,
    subject: 'Como foi sua experiência com a PrEP? — Facilita PrEP',
    html: baseTemplate(
      'Pesquisa de satisfação',
      `<p style="color:#334155;font-size:15px;">Olá, <strong>${nomePaciente}</strong>!</p>
      <p style="color:#334155;font-size:15px;">Gostaríamos de saber como foi sua experiência com o atendimento PrEP. A pesquisa leva menos de 1 minuto.</p>
      <a href="${link}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;">
        Responder pesquisa
      </a>
      <p style="color:#64748b;font-size:13px;">Se você não quiser responder, apenas ignore este e-mail.</p>`,
    ),
  })
}

export async function enviarNotificacaoNovoPlano(
  emails: string[],
  nomePaciente: string,
  plano: string,
  dashboardUrl: string,
): Promise<void> {
  if (!emails.length) return
  await send({
    to: emails,
    subject: `Novo paciente aguardando validação — ${plano}`,
    html: baseTemplate(
      'Novo paciente para validação',
      `<p style="color:#334155;font-size:15px;">Um novo paciente se cadastrou via <strong>plano de saúde</strong> e aguarda validação dos documentos.</p>
      <table style="border-collapse:collapse;width:100%;margin:16px 0;">
        <tr><td style="padding:8px 0;color:#64748b;font-size:13px;width:140px;">Paciente:</td><td style="padding:8px 0;color:#1e293b;font-size:13px;font-weight:600;">${nomePaciente}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;font-size:13px;">Plano:</td><td style="padding:8px 0;color:#1e293b;font-size:13px;">${plano}</td></tr>
      </table>
      <a href="${dashboardUrl}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:8px 0;">
        Ir para o painel de secretaria
      </a>
      <p style="color:#64748b;font-size:12px;margin-top:16px;">Acesse a aba "Planos de Saúde" para visualizar os documentos e aprovar ou rejeitar o cadastro.</p>`,
    ),
  })
}

export async function enviarConfirmacaoPlano(para: string, nomePaciente: string): Promise<void> {
  await send({
    to: para,
    subject: 'Cadastro recebido — aguardando validação — Facilita PrEP',
    html: baseTemplate(
      'Cadastro recebido',
      `<p style="color:#334155;font-size:15px;">Olá, <strong>${nomePaciente}</strong>!</p>
      <p style="color:#334155;font-size:15px;">Recebemos seus documentos com sucesso. Nossa equipe irá verificar suas informações e entrará em contato.</p>
      <div style="background:#fefce8;border-left:4px solid #eab308;padding:12px 16px;border-radius:4px;margin:16px 0;">
        <p style="color:#713f12;margin:0;font-size:13px;"><strong>Prazo de retorno:</strong> Em horário comercial (seg.–sex. 08h–18h), até 2 horas. Fora desse horário, até 12 horas.</p>
      </div>
      <p style="color:#64748b;font-size:13px;">Você receberá um novo e-mail com o link de acesso assim que seus documentos forem validados.</p>`,
    ),
  })
}

export async function enviarResultadoRejeitado(para: string, nomePaciente: string, motivo: string): Promise<void> {
  await send({
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

// ── Sprint 3: Templates de exame ────────────────────────────────────────────

// TEMPLATE-1 — Aprovação automática por IA
export async function enviarExameAprovadoIa(para: string, nome: string, link: string): Promise<void> {
  await send({
    to: para,
    subject: 'Exame aprovado — Facilita PrEP',
    html: baseTemplate(
      'Exame aprovado',
      `<p style="color:#334155;font-size:15px;">Olá, <strong>${nome}</strong>!</p>
      <p style="color:#334155;font-size:15px;">Seu exame foi <strong style="color:#16a34a;">aprovado</strong>! Clique no botão abaixo para continuar com o formulário clínico:</p>
      <a href="${link}" style="display:inline-block;background:#16a34a;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:20px 0;font-size:16px;">
        Continuar para o formulário clínico
      </a>
      <p style="color:#64748b;font-size:13px;">Link de uso único — válido por 7 dias.</p>`,
    ),
  })
}

// TEMPLATE-2 — Exame encaminhado para análise humana
export async function enviarAnaliseHumanaExame(para: string, nome: string): Promise<void> {
  await send({
    to: para,
    subject: 'Seu exame está em análise — Facilita PrEP',
    html: baseTemplate(
      'Exame em análise',
      `<p style="color:#334155;font-size:15px;">Olá, <strong>${nome}</strong>!</p>
      <p style="color:#334155;font-size:15px;">Seu exame não pôde ser validado automaticamente e será avaliado por um profissional de saúde.</p>
      <div style="background:#fefce8;border-left:4px solid #eab308;padding:12px 16px;border-radius:4px;margin:16px 0;">
        <p style="color:#713f12;margin:0 0 8px;font-size:13px;font-weight:600;">Prazo de resposta:</p>
        <p style="color:#713f12;margin:0;font-size:13px;">Em horário comercial (seg.–sex., 08h–18h): até 2 horas</p>
        <p style="color:#713f12;margin:4px 0 0;font-size:13px;">Fora do horário comercial: até 12 horas</p>
      </div>
      <p style="color:#64748b;font-size:13px;">Você receberá um novo e-mail assim que a avaliação for concluída.</p>`,
    ),
  })
}

// TEMPLATE-3 — Exame rejeitado por data inválida
export async function enviarExameRejeitadoData(
  para: string,
  nome: string,
  tentativaAtual: number,
  appUrl: string,
): Promise<void> {
  await send({
    to: para,
    subject: 'Exame rejeitado — necessário enviar novo exame',
    html: baseTemplate(
      'Exame rejeitado — data inválida',
      `<p style="color:#334155;font-size:15px;">Olá, <strong>${nome}</strong>!</p>
      <p style="color:#334155;font-size:15px;">Seu exame foi recebido, mas não pode ser aceito porque foi realizado há mais de 7 dias.</p>
      <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:12px 16px;border-radius:4px;margin:16px 0;">
        <p style="color:#dc2626;margin:0;font-size:13px;"><strong>Motivo:</strong> Para garantir a segurança do tratamento PrEP, o exame de HIV deve ter sido realizado há no máximo 7 dias.</p>
      </div>
      <p style="color:#334155;font-size:15px;">Por favor, faça um novo exame e envie pelo nosso portal:</p>
      <a href="${appUrl}/inicio" style="display:inline-block;background:#1d4ed8;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:20px 0;font-size:16px;">
        Enviar novo exame
      </a>
      <p style="color:#64748b;font-size:13px;">Tentativa ${tentativaAtual}/2.</p>`,
    ),
  })
}

// ── Sprint 4: Notificações de ação médica ───────────────────────────────────

// Exame rejeitado / encaminhado / consulta recomendada pelo médico
export async function enviarExameRejeitadoMedico(
  para: string,
  nome: string,
  observacoes: string,
): Promise<void> {
  await send({
    to: para,
    subject: 'Atualização sobre seu exame — Facilita PrEP',
    html: baseTemplate(
      'Avaliação do exame concluída',
      `<p style="color:#334155;font-size:15px;">Olá, <strong>${nome}</strong>!</p>
      <p style="color:#334155;font-size:15px;">Após análise do seu exame pelo médico, não foi possível dar seguimento ao processo PrEP no momento.</p>
      <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:12px 16px;border-radius:4px;margin:16px 0;">
        <p style="color:#dc2626;margin:0;font-size:13px;"><strong>Orientação do médico:</strong> ${observacoes}</p>
      </div>
      <p style="color:#64748b;font-size:13px;">Para mais informações, entre em contato com a clínica:</p>
      <p style="color:#64748b;font-size:13px;">
        📱 WhatsApp: <a href="https://wa.me/5561994018161" style="color:#1d4ed8;font-weight:600;">(61) 99401-8161</a><br>
        📞 Fixo: <span style="font-weight:600;">(61) 4042-7188</span><br>
        ✉️ <a href="mailto:contato@facilitaprep.com.br" style="color:#1d4ed8;">contato@facilitaprep.com.br</a>
      </p>`,
    ),
  })
}

// Médico solicita envio de novo exame (reenvio ou confirmação)
export async function enviarSolicitacaoReenvio(
  para: string,
  nome: string,
  motivo: string,
  appUrl: string,
): Promise<void> {
  await send({
    to: para,
    subject: 'Novo envio de exame necessário — Facilita PrEP',
    html: baseTemplate(
      'Envio de novo exame',
      `<p style="color:#334155;font-size:15px;">Olá, <strong>${nome}</strong>!</p>
      <p style="color:#334155;font-size:15px;">Nosso médico avaliou seu exame e solicita o envio de um novo documento:</p>
      <div style="background:#fefce8;border-left:4px solid #eab308;padding:12px 16px;border-radius:4px;margin:16px 0;">
        <p style="color:#713f12;margin:0;font-size:13px;"><strong>Solicitação:</strong> ${motivo}</p>
      </div>
      <a href="${appUrl}/inicio" style="display:inline-block;background:#1d4ed8;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:20px 0;font-size:16px;">
        Enviar novo exame
      </a>
      <p style="color:#64748b;font-size:13px;">Acesse a plataforma e faça o upload do novo documento.</p>`,
    ),
  })
}

export async function enviarNotificacaoMedicoPendente(
  emails: string[],
  urgente: boolean,
  nomePaciente: string,
  motivo: string,
  dashboardUrl: string,
): Promise<void> {
  if (!emails.length) return
  const subject = urgente
    ? `URGENTE: Exame HIV reagente — ${nomePaciente} — Facilita PrEP`
    : `Exame aguardando revisão — ${nomePaciente} — Facilita PrEP`

  const corBorda = urgente ? '#ef4444' : '#eab308'
  const corFundo = urgente ? '#fef2f2' : '#fefce8'
  const corTexto = urgente ? '#dc2626' : '#713f12'
  const alerta = urgente
    ? '<strong>ATENÇÃO URGENTE:</strong> Resultado HIV possivelmente reagente. Requer avaliação imediata.'
    : `Motivo: <strong>${motivo}</strong>`

  await send({
    to: emails,
    subject,
    html: baseTemplate(
      urgente ? 'Exame URGENTE para revisão' : 'Exame pendente de revisão',
      `<p style="color:#334155;font-size:15px;">Um exame de HIV necessita de revisão médica.</p>
      <table style="border-collapse:collapse;width:100%;margin:16px 0;">
        <tr><td style="padding:8px 0;color:#64748b;font-size:13px;width:120px;">Paciente:</td><td style="padding:8px 0;color:#1e293b;font-size:13px;font-weight:600;">${nomePaciente}</td></tr>
      </table>
      <div style="background:${corFundo};border-left:4px solid ${corBorda};padding:12px 16px;border-radius:4px;margin:16px 0;">
        <p style="color:${corTexto};margin:0;font-size:13px;">${alerta}</p>
      </div>
      <a href="${dashboardUrl}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:8px 0;">
        Revisar no painel médico
      </a>`,
    ),
  })
}
