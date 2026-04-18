import Stripe from 'stripe'
import { env } from '../_core/env.ts'

export const stripe = new Stripe(env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2024-04-10' })

export async function criarCheckout(pacienteId: number, valorCentavos: number, emailCliente?: string) {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    customer_email: emailCliente,
    line_items: [
      {
        price_data: {
          currency: 'brl',
          product_data: { name: 'Consulta PrEP — Facilita PrEP' },
          unit_amount: valorCentavos,
        },
        quantity: 1,
      },
    ],
    success_url: `${process.env.APP_URL ?? 'https://facilitaprep.manus.space'}/pagamento/sucesso?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.APP_URL ?? 'https://facilitaprep.manus.space'}/pagamento/cancelado`,
    metadata: { pacienteId: String(pacienteId) },
  })

  return { url: session.url, sessionId: session.id }
}
