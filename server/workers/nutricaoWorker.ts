/**
 * Lead Nurturing Worker — drip de 5 mensagens para leads não convertidos.
 *
 * Público-alvo: precadastros com status 'aguardando' (pagamento ainda não realizado)
 * criados entre 24h e 14 dias atrás.
 *
 * Sequência:
 *   Dia 1  → FAQ sobre PrEP + dúvidas frequentes
 *   Dia 2  → Autoridade médica (CFM, ICP-Brasil, segurança)
 *   Dia 3  → Depoimento de paciente (prova social)
 *   Dia 7  → Urgência — vagas limitadas esta semana
 *   Dia 14 → Última tentativa + link direto
 */

import { Worker } from "bullmq";
import { Resend } from "resend";
import { db } from "../db.ts";
import { precadastros } from "../../drizzle/schema.ts";
import { and, eq, gt, lt } from "drizzle-orm";
import { decrypt } from "../_core/encryption.ts";
import { env } from "../_core/env.ts";
import { logger } from "../_core/logger.ts";
import { redis } from "../_core/redis.ts";
import {
  NUTRICAO_QUEUE_NAME,
  QUEUE_PREFIX,
  connection,
  NUTRICAO_WORKER_OPTS,
  nutricaoQueue,
  persistDlq,
} from "./queues.ts";
import * as Sentry from "@sentry/node";

// ─── Email templates ──────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function templateDia1(
  nome: string,
  appUrl: string,
): { subject: string; html: string } {
  return {
    subject: `${nome}, tire suas dúvidas sobre PrEP`,
    html: `
      <p>Olá, ${nome}!</p>
      <p>Vimos que você iniciou seu cadastro no Facilita PrEP. Queremos ajudar com as perguntas mais comuns:</p>
      <ul>
        <li><strong>PrEP é seguro?</strong> Sim. É aprovado pela ANVISA e recomendado pelo Ministério da Saúde.</li>
        <li><strong>Preciso de consulta presencial?</strong> Não. A consulta é 100% online, com receita digital válida em todo o Brasil.</li>
        <li><strong>Quanto tempo leva?</strong> A receita é emitida em até 24h após o envio dos exames.</li>
      </ul>
      <p><a href="${appUrl}">Clique aqui para continuar seu cadastro</a></p>
      <p>Qualquer dúvida, responda este e-mail.<br><em>Equipe Facilita PrEP</em></p>
    `,
  };
}

function templateDia2(
  nome: string,
  appUrl: string,
): { subject: string; html: string } {
  return {
    subject: `${nome}, por que escolher o Facilita PrEP`,
    html: `
      <p>Olá, ${nome}!</p>
      <p>O Facilita PrEP é gerenciado pelo Dr. Werciley Saraiva Vieira Júnior, infectologista com CRM-DF 16381.</p>
      <ul>
        <li>Receita com assinatura digital ICP-Brasil — válida em qualquer farmácia do Brasil</li>
        <li>100% regulamentado pelo CFM (Resolução 2.299/2021)</li>
        <li>Sigilo total: seus dados são protegidos por criptografia médica</li>
        <li>Atendimento em até 24h, sem filas, sem deslocamento</li>
      </ul>
      <p><a href="${appUrl}">Continuar meu cadastro agora</a></p>
      <p><em>Equipe Facilita PrEP</em></p>
    `,
  };
}

function templateDia3(
  nome: string,
  appUrl: string,
): { subject: string; html: string } {
  return {
    subject: `O que pacientes dizem sobre o Facilita PrEP`,
    html: `
      <p>Olá, ${nome}!</p>
      <p>Veja o que quem já usou o Facilita PrEP diz:</p>
      <blockquote style="border-left:3px solid #6b46c1;padding-left:12px;color:#555">
        "Fiz tudo pelo celular, recebi a receita em menos de 24h. Processo simples, médico atencioso e sigiloso."
        <br><strong>— Paciente do Facilita PrEP</strong>
      </blockquote>
      <p>Você também pode ter acesso à PrEP de forma rápida e segura.</p>
      <p><a href="${appUrl}">Finalizar meu cadastro</a></p>
      <p><em>Equipe Facilita PrEP</em></p>
    `,
  };
}

function templateDia7(
  nome: string,
  appUrl: string,
): { subject: string; html: string } {
  return {
    subject: `${nome}, vagas limitadas esta semana`,
    html: `
      <p>Olá, ${nome}!</p>
      <p>Nossa agenda tem vagas limitadas para atendimento esta semana.</p>
      <p>Para garantir seu atendimento em até 24h, complete seu cadastro agora:</p>
      <p><a href="${appUrl}" style="background:#6b46c1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">Garantir minha vaga →</a></p>
      <p style="color:#888;font-size:12px">Consulta: R$150 · Receita digital ICP-Brasil · 100% online</p>
      <p><em>Equipe Facilita PrEP</em></p>
    `,
  };
}

function templateDia14(
  nome: string,
  appUrl: string,
): { subject: string; html: string } {
  return {
    subject: `Última tentativa — seu acesso ao Facilita PrEP`,
    html: `
      <p>Olá, ${nome}!</p>
      <p>Esta é nossa última mensagem sobre seu cadastro no Facilita PrEP.</p>
      <p>Se mudou de ideia ou está com dúvidas, estamos aqui para ajudar — basta responder este e-mail.</p>
      <p>Caso queira continuar:</p>
      <p><a href="${appUrl}">Acessar meu cadastro</a></p>
      <p>Caso não queira mais receber e-mails sobre PrEP, responda com "Cancelar" e removemos você da nossa lista.</p>
      <p><em>Equipe Facilita PrEP</em></p>
    `,
  };
}

function getTemplate(diasDesdeRegistro: number, nome: string, appUrl: string) {
  const safeName = escHtml(nome);
  const safeUrl = appUrl.startsWith("https://")
    ? appUrl
    : "https://facilitaprep.com.br";
  if (diasDesdeRegistro <= 1) return templateDia1(safeName, safeUrl);
  if (diasDesdeRegistro <= 2) return templateDia2(safeName, safeUrl);
  if (diasDesdeRegistro <= 3) return templateDia3(safeName, safeUrl);
  if (diasDesdeRegistro <= 7) return templateDia7(safeName, safeUrl);
  return templateDia14(safeName, safeUrl);
}

function diasEntre(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export async function agendarNutricaoDiaria() {
  await nutricaoQueue.add(
    "nutricao-diaria",
    {},
    {
      repeat: { pattern: "0 10 * * *" },
      jobId: "nutricao-diaria-fixo",
    },
  );
}

async function executarNutricao() {
  const agora = new Date();
  const umDiaAtras = new Date(agora.getTime() - 1 * 24 * 60 * 60 * 1000);
  const quatorzeDiasAtras = new Date(
    agora.getTime() - 14 * 24 * 60 * 60 * 1000,
  );

  // Leads aguardando conversão criados entre 1 e 14 dias atrás
  const leads = await db
    .select({
      id: precadastros.id,
      nomeEncrypted: precadastros.nomeEncrypted,
      emailEncrypted: precadastros.emailEncrypted,
      createdAt: precadastros.createdAt,
    })
    .from(precadastros)
    .where(
      and(
        eq(precadastros.status, "aguardando"),
        lt(precadastros.createdAt, umDiaAtras),
        gt(precadastros.createdAt, quatorzeDiasAtras),
      ),
    )
    .limit(200);

  let enviados = 0;

  for (const lead of leads) {
    try {
      const email = decrypt(lead.emailEncrypted);
      const nome = decrypt(lead.nomeEncrypted).split(" ")[0];
      const dias = diasEntre(lead.createdAt, agora);

      // Usar Redis como dedup — evita reenvio na mesma janela de dia
      const redisKey = `nutricao:${lead.id}:dia${dias}`;
      const jaEnviado = await redis.get(redisKey);
      if (jaEnviado) continue;

      if (!env.RESEND_API_KEY) continue;
      const template = getTemplate(dias, nome, env.APP_URL);
      const resend = new Resend(env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from: env.EMAIL_FROM,
        to: email,
        subject: template.subject,
        html: template.html,
      });
      if (error) {
        logger.warn("[nutricao] Falha ao enviar e-mail", {
          leadId: lead.id,
          error: error.message,
        });
        continue;
      }

      // TTL 25h — garante que o mesmo e-mail não é reenviado amanhã para o mesmo dia
      await redis.set(redisKey, "1", "EX", 25 * 60 * 60);
      enviados++;
    } catch (err) {
      logger.warn("[nutricao] Erro ao processar lead", {
        leadId: lead.id,
        error: String(err),
      });
      Sentry.captureException(err, { tags: { worker: "nutricao" } });
    }
  }

  logger.info("[nutricao] Ciclo concluído", { leads: leads.length, enviados });
  return { leads: leads.length, enviados };
}

export function startNutricaoWorker() {
  const worker = new Worker(
    NUTRICAO_QUEUE_NAME,
    async (job) => {
      if (job.name === "nutricao-diaria") return executarNutricao();
    },
    { connection, ...NUTRICAO_WORKER_OPTS, prefix: QUEUE_PREFIX },
  );

  worker.on("failed", (job, err) => {
    logger.error(`[nutricaoQueue] Job ${job?.id} falhou`, {
      message: err.message,
    });
    if ((job?.attemptsMade ?? 0) >= (job?.opts?.attempts ?? 3)) {
      void persistDlq(NUTRICAO_QUEUE_NAME, job, err);
    }
  });

  return worker;
}
