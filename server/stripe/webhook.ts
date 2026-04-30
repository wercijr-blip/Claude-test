import type { Request, Response } from 'express'
import { stripe } from './products.ts'
import { env } from '../_core/env.ts'
import { db } from '../db.ts'
import { pagamentos, precadastros, stripeEvents } from '../../drizzle/schema.ts'
import { eq } from 'drizzle-orm'
import { decrypt } from '../_core/encryption.ts'
import { gerarEEnviarLinkAcesso } from '../routes/intake.ts'
import { emitirNfse } from '../focusnfe.ts'
import { VALOR_CONSULTA_CENTAVOS } from '../../shared/const.ts'

// ---------------------------------------------------------------------------
// Structured logger — every line is prefixed with [webhook] + ISO timestamp
// ---------------------------------------------------------------------------
function log(level: 'INFO' | 'WARN' | 'ERROR', message: string, context?: unknown): void {
  const ts = new Date().toISOString()
  const prefix = `[webhook] ${ts} ${level}`
  if (context !== undefined) {
    console.log(`${prefix} ${message}`, context)
  } else {
    console.log(`${prefix} ${message}`)
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export async function handleWebhook(req: Request, res: Response): Promise<void> {
  const sig = req.headers['stripe-signature']

  // ------------------------------------------------------------------
  // 1. Pre-flight: signature header + secret must be present
  // ------------------------------------------------------------------
 if (!sig) {
    log('ERROR', 'Missing stripe-signature header — returning 400')
    res.status(400).json({ error: 'stripe-signature header ausente' })
    return
  }

  if (!env.STRIPE_WEBHOOK_SECRET) {
    log('ERROR', 'STRIPE_WEBHOOK_SECRET not configured — returning 400')
    res.status(400).json({ error: 'Webhook não configurado (secret ausente)' })
    return
  }

  // ------------------------------------------------------------------
  // 2. Signature validation
  // ------------------------------------------------------------------
  let event: ReturnType<typeof stripe.webhooks.constructEvent>
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, env.STRIPE_WEBHOOK_SECRET)
    log('INFO', `Signature validated successfully — event.id=${event.id}`)
  } catch (err) {
    log('ERROR', `Signature validation failed: ${(err as Error).message}`)
    res.status(400).json({ error: `Webhook inválido: ${(err as Error).message}` })
    return
  }

  // ------------------------------------------------------------------
  // 3. Idempotency check — skip already-processed events
  // ------------------------------------------------------------------
  log('INFO', `Webhook received: ${event.type}`, { eventId: event.id })

  const [alreadyProcessed] = await db
    .select({ eventId: stripeEvents.eventId })
    .from(stripeEvents)
    .where(eq(stripeEvents.eventId, event.id))
    .limit(1)

  if (alreadyProcessed) {
    log('INFO', `Event already processed — returning 200 (idempotent): ${event.id}`)
    res.json({ received: true })
    return
  }

  // ------------------------------------------------------------------
  // 4. Event type dispatch
  // ------------------------------------------------------------------
  try {
    if (event.type === 'checkout.session.completed') {
      await handleSessionCompleted(event.data.object)
    } else if (event.type === 'checkout.session.expired') {
      await handleSessionExpired(event.data.object)
    } else {
      log('INFO', `Unhandled event type — ignoring: ${event.type}`)
    }

    // Record event as processed only after successful handling
    await db.insert(stripeEvents).values({ eventId: event.id, type: event.type }).onDuplicateKeyUpdate({
      set: { type: event.type },
    })
  } catch (err) {
    const error = err as Error
    log('ERROR', `Unhandled exception processing event ${event.id}: ${error.message}`, {
      eventType: event.type,
      stack: error.stack,
    })
    res.status(500).json({ error: 'Erro interno ao processar webhook' })
    return
  }

  // ------------------------------------------------------------------
  // 5. Acknowledge receipt to Stripe
  // ------------------------------------------------------------------
  log('INFO', `Webhook processed successfully — responding 200`, { eventId: event.id })
  res.json({ received: true })
}

// ---------------------------------------------------------------------------
// checkout.session.completed
// ---------------------------------------------------------------------------
async function handleSessionCompleted(
  session: ReturnType<typeof stripe.webhooks.constructEvent>['data']['object'],
): Promise<void> {
  const rawPrecadastroId = (session as { metadata?: Record<string, string> }).metadata?.precadastroId ?? '0'
  const rawPacienteId   = (session as { metadata?: Record<string, string> }).metadata?.pacienteId   ?? '0'
  const precadastroId   = parseInt(rawPrecadastroId, 10)
  const pacienteId      = parseInt(rawPacienteId, 10)
  const sessionId       = (session as { id: string }).id
  const amountTotal     = (session as { amount_total?: number | null }).amount_total
  const paymentIntent   = (session as { payment_intent?: string | null }).payment_intent

  log('INFO', `Parsing metadata: precadastroId=${precadastroId}, pacienteId=${pacienteId}`, {
    sessionId,
    amountTotal,
    rawPrecadastroId,
    rawPacienteId,
  })

  // ---- Path A: intake pre-registration flow (precadastroId) ----
  if (precadastroId) {
    log('INFO', `Fetching precadastro from DB: id=${precadastroId}`)

    const [precad] = await db
      .select()
      .from(precadastros)
      .where(eq(precadastros.id, precadastroId))
      .limit(1)

    if (!precad) {
      log('ERROR', `Precadastro not found in DB: id=${precadastroId}`)
      throw new Error(`Precadastro ${precadastroId} não encontrado`)
    }

    log('INFO', `Precadastro found: status=${precad.status}, tipo=${precad.tipo}`, {
      precadastroId,
      status: precad.status,
      tipo: precad.tipo,
    })

    if (precad.status === 'link_enviado') {
      log('WARN', `Precadastro ${precadastroId} already has status=link_enviado — skipping (idempotent)`)
      return
    }

    // Generate access token and send email + WhatsApp
    log('INFO', `Generating access token and sending email: precadastroId=${precadastroId}`)
    try {
      await gerarEEnviarLinkAcesso(precadastroId)
      log('INFO', `Email and WhatsApp sent successfully: precadastroId=${precadastroId}`)
    } catch (err) {
      const error = err as Error
      log('ERROR', `gerarEEnviarLinkAcesso failed for precadastroId=${precadastroId}: ${error.message}`, {
        stack: error.stack,
      })
      throw err
    }

    // Emit NFSe only for particular (plano has no payment)
    if (precad.tipo === 'particular') {
      log('INFO', `Emitting NFSe for precadastroId=${precadastroId}`)
      let nomeCliente: string
      try {
        nomeCliente = decrypt(precad.nomeEncrypted)
      } catch (err) {
        log('ERROR', `Failed to decrypt nomeEncrypted for precadastroId=${precadastroId}: ${(err as Error).message}`)
        throw err
      }

      const valorCentavos = amountTotal ?? VALOR_CONSULTA_CENTAVOS
      log('INFO', `NFSe params: nomeCliente=${nomeCliente}, valorCentavos=${valorCentavos}`)

      try {
        await emitirNfse({ precadastroId, nomeCliente, valorCentavos })
        log('INFO', `NFSe queued successfully: precadastroId=${precadastroId}`)
      } catch (err) {
        const error = err as Error
        log('ERROR', `emitirNfse failed for precadastroId=${precadastroId}: ${error.message}`, {
          stack: error.stack,
        })
        // NFSe failure is non-fatal — log and continue so the patient still gets access
        log('WARN', `NFSe emission failed but continuing — patient access already granted`)
      }
    } else {
      log('INFO', `Skipping NFSe for tipo=${precad.tipo} (only emitted for particular)`)
    }

    return
  }

  // ---- Path B: returning patient payment flow (pacienteId) ----
  if (pacienteId) {
    log('INFO', `Checking idempotency for pacienteId=${pacienteId}, sessionId=${sessionId}`)

    const existing = await db
      .select({ id: pagamentos.id })
      .from(pagamentos)
      .where(eq(pagamentos.stripeSessionId, sessionId))
      .limit(1)

    if (existing.length) {
      log('WARN', `Payment already recorded for sessionId=${sessionId} (pagamento.id=${existing[0]?.id}) — skipping`)
      return
    }

    log('INFO', `Inserting pagamento record: pacienteId=${pacienteId}, valorCentavos=${amountTotal ?? 0}`)
    try {
      await db.insert(pagamentos).values({
        pacienteId,
        stripePaymentId: paymentIntent as string,
        stripeSessionId: sessionId,
        status: 'pago',
        valorCentavos: amountTotal ?? 0,
      })
      log('INFO', `Pagamento record inserted successfully: pacienteId=${pacienteId}, sessionId=${sessionId}`)
    } catch (err) {
      const error = err as Error
      // Duplicate entry por race condition de webhook: não é erro — apenas idempotência
      if ((error as NodeJS.ErrnoException).code === 'ER_DUP_ENTRY') {
        log('WARN', `Duplicate pagamento for sessionId=${sessionId} — concurrent webhook, ignoring`)
        return
      }
      log('ERROR', `DB insert into pagamentos failed: ${error.message}`, {
        pacienteId,
        sessionId,
        stack: error.stack,
      })
      throw err
    }

    return
  }

  // ---- Neither precadastroId nor pacienteId ----
  log('WARN', `checkout.session.completed received with no precadastroId or pacienteId in metadata`, {
    sessionId,
    metadata: (session as { metadata?: unknown }).metadata,
  })
}

// ---------------------------------------------------------------------------
// checkout.session.expired
// ---------------------------------------------------------------------------
async function handleSessionExpired(
  session: ReturnType<typeof stripe.webhooks.constructEvent>['data']['object'],
): Promise<void> {
  const rawPrecadastroId = (session as { metadata?: Record<string, string> }).metadata?.precadastroId ?? '0'
  const precadastroId    = parseInt(rawPrecadastroId, 10)
  const sessionId        = (session as { id: string }).id

  log('INFO', `Handling session expired: sessionId=${sessionId}, precadastroId=${precadastroId}`)

  if (precadastroId) {
    log('INFO', `Resetting precadastro status to aguardando_pagamento: id=${precadastroId}`)
    try {
      await db.update(precadastros)
        .set({ status: 'aguardando_pagamento' })
        .where(eq(precadastros.id, precadastroId))
      log('INFO', `Precadastro status reset successfully: id=${precadastroId}`)
    } catch (err) {
      const error = err as Error
      log('ERROR', `DB update precadastros failed for id=${precadastroId}: ${error.message}`, {
        stack: error.stack,
      })
      throw err
    }
  } else {
    log('INFO', `Marking pagamento as expirado for sessionId=${sessionId}`)
    try {
      await db.update(pagamentos)
        .set({ status: 'expirado' })
        .where(eq(pagamentos.stripeSessionId, sessionId))
      log('INFO', `Pagamento marked as expirado: sessionId=${sessionId}`)
    } catch (err) {
      const error = err as Error
      log('ERROR', `DB update pagamentos failed for sessionId=${sessionId}: ${error.message}`, {
        stack: error.stack,
      })
      throw err
    }
  }
}
