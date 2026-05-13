import { env } from '../_core/env.ts'
import { logger } from '../_core/logger.ts'

const BASE_URL = env.ASAAS_ENV === 'production'
  ? 'https://api.asaas.com/v3'
  : 'https://sandbox.asaas.com/api/v3'

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'access_token': env.ASAAS_API_KEY ?? '',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Asaas ${method} ${path} → ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

export type AsaasStatus =
  | 'PENDING'
  | 'RECEIVED'
  | 'CONFIRMED'
  | 'OVERDUE'
  | 'REFUNDED'
  | 'DELETED'
  | 'RESTORED'
  | 'CHARGEBACK_REQUESTED'
  | 'CHARGEBACK_DISPUTE'
  | 'AWAITING_CHARGEBACK_REVERSAL'
  | 'DUNNING_REQUESTED'
  | 'DUNNING_RECEIVED'
  | 'AWAITING_RISK_ANALYSIS'

export interface AsaasPayment {
  id: string
  status: AsaasStatus
  value: number
  billingType: string
  externalReference: string | null
  invoiceUrl: string | null
  bankSlipUrl: string | null
}

export interface AsaasPixQrCode {
  encodedImage: string  // base64 PNG
  payload: string       // copia-e-cola string
  expirationDate: string
}

interface AsaasCustomer {
  id: string
}

interface AsaasCustomerList {
  data: AsaasCustomer[]
}

async function encontrarOuCriarCliente(nome: string, cpf: string, email: string): Promise<string> {
  const cpfDigits = cpf.replace(/\D/g, '')

  // Asaas may return 404 (instead of 200 + empty list) when no customer exists for the CPF.
  // Treat 404 as "not found → create new" rather than a fatal error.
  let existingId: string | null = null
  try {
    const existing = await request<AsaasCustomerList>('GET', `/customers?cpfCnpj=${cpfDigits}&limit=1`)
    if (existing.data.length > 0) existingId = existing.data[0]!.id
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (!msg.includes('→ 404')) throw err  // real error (5xx, 401, network) — propagate
    logger.info('[asaas] customer não encontrado (404), criando novo', { cpfPrefix: cpfDigits.slice(0, 3) })
  }

  if (existingId) {
    logger.info('[asaas] customer existente reutilizado', { customerId: existingId })
    return existingId
  }

  const created = await request<AsaasCustomer>('POST', '/customers', {
    name: nome,
    cpfCnpj: cpfDigits,
    email,
  })
  logger.info('[asaas] customer criado', { customerId: created.id })
  return created.id
}

export async function criarCobrancaIntake(
  precadastroId: number,
  nome: string,
  cpf: string,
  email: string,
  metodo: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' = 'PIX',
  valorCentavos: number = Math.round(env.CONSULTA_VALOR * 100),
): Promise<
  | { tipo: 'pix'; paymentId: string; pixQrCode: string; pixCopiaECola: string }
  | { tipo: 'cartao'; paymentId: string; invoiceUrl: string }
> {
  const customerId = await encontrarOuCriarCliente(nome, cpf, email)

  const hoje = new Date()
  const dueDate = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`

  const payment = await request<AsaasPayment>('POST', '/payments', {
    customer: customerId,
    billingType: metodo,
    value: valorCentavos / 100,
    dueDate,
    description: `Consulta PrEP — Facilita PrEP (R$ ${(valorCentavos / 100).toFixed(2).replace('.', ',')})`,
    externalReference: `precad-${precadastroId}`,
    ...(metodo !== 'PIX' && {
      callback: {
        successUrl: `${env.APP_URL}/sucesso`,
        autoRedirect: true,
      },
    }),
  })

  if (metodo !== 'PIX') {
    if (!payment.invoiceUrl) throw new Error(`Asaas não retornou invoiceUrl para billingType=${metodo}`)
    return { tipo: 'cartao', paymentId: payment.id, invoiceUrl: payment.invoiceUrl }
  }

  const qr = await request<AsaasPixQrCode>('GET', `/payments/${payment.id}/pixQrCode`)
  return { tipo: 'pix', paymentId: payment.id, pixQrCode: qr.encodedImage, pixCopiaECola: qr.payload }
}

export async function obterPagamento(paymentId: string): Promise<AsaasPayment> {
  return request<AsaasPayment>('GET', `/payments/${paymentId}`)
}

export async function emitirNfseAsaas(paymentId: string): Promise<void> {
  await request('POST', '/invoices', {
    payment: paymentId,
    serviceDescription: 'Consulta médica — PrEP',
    observations: 'Facilita PrEP',
  })
}
