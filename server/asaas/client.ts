import { env } from '../_core/env.ts'
import { VALOR_CONSULTA_CENTAVOS } from '../../shared/const.ts'

const BASE_URL = env.ASAAS_ENV === 'production'
  ? 'https://api.asaas.com/api/v3'
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
  const existing = await request<AsaasCustomerList>('GET', `/customers?cpfCnpj=${cpfDigits}`)
  if (existing.data.length > 0) return existing.data[0]!.id

  const created = await request<AsaasCustomer>('POST', '/customers', {
    name: nome,
    cpfCnpj: cpfDigits,
    email,
  })
  return created.id
}

export async function criarCobrancaIntake(
  precadastroId: number,
  nome: string,
  cpf: string,
  email: string,
  valorCentavos: number = VALOR_CONSULTA_CENTAVOS,
): Promise<{ paymentId: string; pixQrCode: string; pixCopiaECola: string }> {
  const customerId = await encontrarOuCriarCliente(nome, cpf, email)

  const hoje = new Date()
  const dueDate = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`

  const payment = await request<AsaasPayment>('POST', '/payments', {
    customer: customerId,
    billingType: 'PIX',
    value: valorCentavos / 100,
    dueDate,
    description: 'Consulta PrEP — Facilita PrEP',
    externalReference: `precad-${precadastroId}`,
  })

  const qr = await request<AsaasPixQrCode>('GET', `/payments/${payment.id}/pixQrCode`)

  return {
    paymentId: payment.id,
    pixQrCode: qr.encodedImage,
    pixCopiaECola: qr.payload,
  }
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
