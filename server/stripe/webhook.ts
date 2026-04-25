import type { Request, Response } from 'express'
import { stripe } from './products.ts'
import { env } from '../_core/env.ts'
import { db } from '../db.ts'
import { pagamentos, precadastros } from '../../drizzle/schema.ts'
import { eq } from 'drizzle-orm'
import { decrypt } from '../_core/encryption.ts'
import { gerarEEnviarLinkAcesso } from '../routes/intake.ts'
import { emitirNfse } from '../focusnfe.ts'
import { VALOR_CONSULTA_CENTAVOS } from '../../shared/const.ts'

export async function handleWebhook(req: Request, res: Response): Promise<void> {
  const sig = req.headers['stripe-signature']

  if (!sig || !env.STRIPE_WEBHOOK_SECRET) {
    res.status(400).json({ error: 'Webhook não configurado' })
    return
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    res.status(400).json({ error: `Webhook inválido: ${(err as Error).message}` })
    return
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const precadastroId = parseInt(session.metadata?.precadastroId ?? '0')
    const pacienteId = parseInt(session.metadata?.pacienteId ?? '0')

    if (precadastroId) {
      const [precad] = await db.select().from(precadastros).where(eq(precadastros.id, precadastroId)).limit(1)

      if (precad && precad.status !== 'link_enviado') {
        await gerarEEnviarLinkAcesso(precadastroId).catch(console.error)

        // Emit NFSe only for particular (plano has no payment)
        if (precad.tipo === 'particular') {
          const nomeCliente = decrypt(precad.nomeEncrypted)
          const valorCentavos = session.amount_total ?? VALOR_CONSULTA_CENTAVOS
          await emitirNfse({ precadastroId, nomeCliente, valorCentavos }).catch((err) => {
            console.error('[webhook] Falha ao emitir NFSe para precadastro', precadastroId, err)
          })
        }
      }
    } else if (pacienteId) {
      // Idempotency: skip if payment for this session already recorded
      const existing = await db
        .select({ id: pagamentos.id })
        .from(pagamentos)
        .where(eq(pagamentos.stripeSessionId, session.id))
        .limit(1)

      if (!existing.length) {
        await db.insert(pagamentos).values({
          pacienteId,
          stripePaymentId: session.payment_intent as string,
          stripeSessionId: session.id,
          status: 'pago',
          valorCentavos: session.amount_total ?? 0,
        })
      }
    }
  }

  if (event.type === 'checkout.session.expired') {
    const session = event.data.object
    const precadastroId = parseInt(session.metadata?.precadastroId ?? '0')

    if (precadastroId) {
      await db.update(precadastros)
        .set({ status: 'aguardando_pagamento' })
        .where(eq(precadastros.id, precadastroId))
    } else {
      await db.update(pagamentos)
        .set({ status: 'expirado' })
        .where(eq(pagamentos.stripeSessionId, session.id))
    }
  }

  res.json({ received: true })
}
