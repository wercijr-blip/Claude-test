import Stripe from 'stripe'
import { env } from '../_core/env.ts'
import { VALOR_CONSULTA_CENTAVOS } from '../../shared/const.ts'

export const stripe = new Stripe(env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2024-04-10' })

export async function criarCheckout(pacienteId: number, valorCentavos: number, emailCliente?: string) {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card', 'pix'],
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
    success_url: `${env.APP_URL}/pagamento/sucesso?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.APP_URL}/pagamento/cancelado`,
    metadata: { pacienteId: String(pacienteId) },
  })

  return { url: session.url, sessionId: session.id }
}

export async function criarCheckoutIntake(precadastroId: number, emailCliente?: string) {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card', 'pix'],
    mode: 'payment',
    customer_email: emailCliente,
    line_items: [
      {
        price_data: {
          currency: 'brl',
          product_data: { name: 'Consulta PrEP — Facilita PrEP' },
          unit_amount: VALOR_CONSULTA_CENTAVOS,
        },
        quantity: 1,
      },
    ],
    success_url: `${env.APP_URL}/pagamento/sucesso?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.APP_URL}/cadastro?cancelado=true`,
    metadata: { precadastroId: String(precadastroId) },
  })

  return { url: session.url, sessionId: session.id }
}
