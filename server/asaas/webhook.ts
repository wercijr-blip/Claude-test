import { timingSafeEqual } from "crypto";
import type { Request, Response } from "express";
import { env } from "../_core/env.ts";
import { db } from "../db.ts";
import {
  pagamentos,
  precadastros,
  webhookEvents,
} from "../../drizzle/schema.ts";
import { eq } from "drizzle-orm";
import { gerarEEnviarLinkAcesso } from "../routes/intake.ts";
import { emitirNfseAsaas } from "./client.ts";
import { logger } from "../_core/logger.ts";
import { Sentry } from "../_core/instrument.ts";
import { decrypt } from "../_core/encryption.ts";
import { sendCapiPurchase } from "../capi.ts";

interface AsaasWebhookPayment {
  id: string;
  status: string;
  value: number;
  billingType: string;
  externalReference?: string | null;
}

interface AsaasWebhookEvent {
  event: string;
  payment: AsaasWebhookPayment;
}

function log(
  level: "INFO" | "WARN" | "ERROR",
  message: string,
  context?: unknown,
): void {
  const msg = `[asaas-webhook] ${message}`;
  if (level === "ERROR") logger.error(msg, context);
  else if (level === "WARN") logger.warn(msg, context);
  else logger.info(msg, context);
}

export async function handleAsaasWebhook(
  req: Request,
  res: Response,
): Promise<void> {
  // Asaas sends the token in 'asaas-access-token'; fall back to 'access_token' for older versions
  const asaasHeader = req.headers["asaas-access-token"] as string | undefined;
  const legacyHeader = req.headers["access_token"] as string | undefined;
  const token = asaasHeader ?? legacyHeader;
  const headerUsado = asaasHeader
    ? "asaas-access-token"
    : legacyHeader
      ? "access_token"
      : "NENHUM";
  log("INFO", "Webhook Asaas recebido", { headerUsado });
  if (!env.ASAAS_WEBHOOK_TOKEN) {
    if (env.NODE_ENV === "production") {
      log(
        "ERROR",
        "ASAAS_WEBHOOK_TOKEN não configurado — rejeitando webhook em produção",
      );
      res.status(503).json({ error: "Webhook não configurado" });
      return;
    }
    log(
      "WARN",
      "ASAAS_WEBHOOK_TOKEN ausente — pulando verificação (não-produção)",
    );
  } else {
    const expected = Buffer.from(env.ASAAS_WEBHOOK_TOKEN);
    const provided = Buffer.from(token ?? "");
    // Pad both to same length so timingSafeEqual doesn't leak token length via timing
    const maxLen = Math.max(expected.length, provided.length);
    const paddedExpected = Buffer.concat([
      expected,
      Buffer.alloc(maxLen - expected.length),
    ]);
    const paddedProvided = Buffer.concat([
      provided,
      Buffer.alloc(maxLen - provided.length),
    ]);
    const valid = timingSafeEqual(paddedExpected, paddedProvided);
    if (!valid) {
      log("ERROR", "Invalid ASAAS_WEBHOOK_TOKEN — returning 401");
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  const body = req.body as AsaasWebhookEvent;
  const paymentId = body.payment?.id;
  const eventType = body.event;

  if (!paymentId || !eventType) {
    log("WARN", "Malformed webhook payload — returning 400", { body });
    res.status(400).json({ error: "Payload inválido" });
    return;
  }

  const eventId = `asaas-${eventType}-${paymentId}`;
  log("INFO", `Webhook received: ${eventType}`, { eventId });

  try {
    await db.insert(webhookEvents).values({ eventId, type: eventType });
  } catch (claimErr) {
    if ((claimErr as NodeJS.ErrnoException).code === "ER_DUP_ENTRY") {
      log(
        "INFO",
        `Event already processed — returning 200 (idempotent): ${eventId}`,
      );
      res.json({ received: true });
      return;
    }
    throw claimErr;
  }

  try {
    if (eventType === "PAYMENT_RECEIVED" || eventType === "PAYMENT_CONFIRMED") {
      await handlePaymentConfirmed(body.payment);
    } else {
      log("INFO", `Unhandled event type — ignoring: ${eventType}`);
    }
  } catch (err) {
    const error = err as Error;
    log("ERROR", `Exception processing event ${eventId}: ${error.message}`, {
      eventType,
      stack: error.stack,
    });
    Sentry.captureException(err, {
      tags: { route: "asaas-webhook", stage: "processing" },
      extra: { eventType, eventId },
    });
    // Remove idempotency claim so Asaas can retry
    await db
      .delete(webhookEvents)
      .where(eq(webhookEvents.eventId, eventId))
      .catch(() => {});
    res.status(500).json({ error: "Erro interno ao processar webhook" });
    return;
  }

  log("INFO", `Webhook processed successfully`, { eventId });
  res.json({ received: true });
}

async function handlePaymentConfirmed(
  payment: AsaasWebhookPayment,
): Promise<void> {
  const { id: paymentId, externalReference, value, billingType } = payment;

  log(
    "INFO",
    `Payment confirmed: paymentId=${paymentId}, externalReference=${externalReference ?? "null"}`,
  );

  // Path A: intake precadastro (externalReference = 'precad-{id}')
  const precadMatch = (externalReference ?? "").match(/^precad-(\d+)$/);
  if (precadMatch) {
    const precadastroId = parseInt(precadMatch[1]!, 10);

    const [precad] = await db
      .select()
      .from(precadastros)
      .where(eq(precadastros.id, precadastroId))
      .limit(1);

    if (!precad) {
      log("ERROR", `Precadastro not found: id=${precadastroId}`);
      throw new Error(`Precadastro ${precadastroId} não encontrado`);
    }

    if (precad.status === "link_enviado") {
      log(
        "WARN",
        `Precadastro ${precadastroId} already link_enviado — skipping (idempotent)`,
      );
      return;
    }

    const valorCentavos = Math.round(value * 100);
    const formaPagamento =
      billingType === "PIX"
        ? "PIX"
        : billingType === "BOLETO"
          ? "Boleto"
          : "Cartão de crédito";

    await gerarEEnviarLinkAcesso(precadastroId, undefined, {
      valorCentavos,
      formaPagamento,
      dataHora: new Date(),
      idTransacao: paymentId,
    });

    log("INFO", `Link sent for precadastroId=${precadastroId}`);

    // CAPI Purchase event — fire-and-forget, non-fatal
    const [capiFirst] = decrypt(precad.nomeEncrypted).trim().split(" ");
    sendCapiPurchase({
      eventId: `pay-${paymentId}`,
      email: decrypt(precad.emailEncrypted),
      phone: decrypt(precad.telefoneEncrypted),
      firstName: capiFirst,
      value,
    }).catch(() => {});

    // NFS-e via Asaas native endpoint (fire-and-forget — non-fatal).
    // Sem retry automático: reemitir após timeout pode duplicar a nota.
    // Na falha, alerta o admin por e-mail para emissão manual no painel Asaas.
    if (precad.tipo === "particular") {
      emitirNfseAsaas(paymentId).catch(async (err: unknown) => {
        log(
          "ERROR",
          `NFS-e emission failed — manual action required: ${(err as Error).message}`,
        );
        Sentry.captureException(err, {
          tags: { route: "asaas-webhook", stage: "nfse" },
          extra: { paymentId, precadastroId },
        });
        const { enviarAlertaNfse } = await import("../email.ts");
        await enviarAlertaNfse(paymentId, (err as Error).message);
      });
    }

    return;
  }

  // Path B: returning patient payment (externalReference = 'pac-{id}')
  const pacMatch = (externalReference ?? "").match(/^pac-(\d+)$/);
  if (pacMatch) {
    const pacienteId = parseInt(pacMatch[1]!, 10);

    const existing = await db
      .select({ id: pagamentos.id })
      .from(pagamentos)
      .where(eq(pagamentos.asaasPaymentId, paymentId))
      .limit(1);

    if (existing.length) {
      log(
        "WARN",
        `Pagamento already recorded for paymentId=${paymentId} — skipping`,
      );
      return;
    }

    const valorCentavos = Math.round(value * 100);
    await db.insert(pagamentos).values({
      pacienteId,
      provider: "asaas",
      asaasPaymentId: paymentId,
      status: "pago",
      valorCentavos,
    });

    log(
      "INFO",
      `Pagamento inserted: pacienteId=${pacienteId}, paymentId=${paymentId}`,
    );
    return;
  }

  log(
    "WARN",
    `Payment confirmed with unrecognized externalReference: ${externalReference ?? "null"}`,
    { paymentId },
  );
}
