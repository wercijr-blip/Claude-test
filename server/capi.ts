/**
 * Meta Conversions API (CAPI) — server-side event tracking.
 *
 * Sends events independently of browser cookies and ad blockers.
 * Pair with browser pixel events using the same event_id for deduplication.
 *
 * Docs: https://developers.facebook.com/docs/marketing-api/conversions-api
 */

import { createHash } from 'crypto'
import { env } from './_core/env.ts'
import { logger } from './_core/logger.ts'

const GRAPH_API_VERSION = 'v20.0'

function sha256(value: string): string {
  return createHash('sha256').update(value.toLowerCase().trim()).digest('hex')
}

function cleanPhone(phone: string): string {
  // Remove non-digits, keep leading 55 (Brazil country code) if already present
  const digits = phone.replace(/\D/g, '')
  return digits.startsWith('55') ? digits : `55${digits}`
}

export interface CapiUserData {
  email?: string
  phone?: string
  firstName?: string
  lastName?: string
  clientIp?: string
  clientUserAgent?: string
}

export interface CapiEventOpts {
  eventName: 'Lead' | 'Purchase' | 'InitiateCheckout' | 'CompleteRegistration' | 'PageView'
  eventId: string
  eventSourceUrl?: string
  userData: CapiUserData
  value?: number
  currency?: string
}

/**
 * Send a single event to the Meta Conversions API.
 * No-ops silently when META_PIXEL_ID / META_CAPI_TOKEN are not set (dev / staging).
 */
export async function sendCapiEvent(opts: CapiEventOpts): Promise<void> {
  if (!env.META_PIXEL_ID || !env.META_CAPI_TOKEN) {
    if (env.NODE_ENV === 'production') {
      logger.warn('[capi] META_PIXEL_ID ou META_CAPI_TOKEN não configurados — CAPI desabilitado em produção')
    } else {
      logger.debug('[capi] META_PIXEL_ID ou META_CAPI_TOKEN não configurados — evento ignorado')
    }
    return
  }

  const userData: Record<string, unknown> = {}
  if (opts.userData.email)     userData.em = [sha256(opts.userData.email)]
  if (opts.userData.phone)     userData.ph = [sha256(cleanPhone(opts.userData.phone))]
  if (opts.userData.firstName) userData.fn = [sha256(opts.userData.firstName)]
  if (opts.userData.lastName)  userData.ln = [sha256(opts.userData.lastName)]
  if (opts.userData.clientIp)  userData.client_ip_address = opts.userData.clientIp
  if (opts.userData.clientUserAgent) userData.client_user_agent = opts.userData.clientUserAgent

  const customData: Record<string, unknown> = {}
  if (opts.value !== undefined) customData.value = opts.value
  if (opts.currency)            customData.currency = opts.currency

  const payload = {
    data: [{
      event_name: opts.eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: opts.eventId,
      event_source_url: opts.eventSourceUrl ?? env.APP_URL,
      action_source: 'website',
      user_data: userData,
      ...(Object.keys(customData).length > 0 && { custom_data: customData }),
    }],
    access_token: env.META_CAPI_TOKEN,
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5_000)
  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${env.META_PIXEL_ID}/events`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      },
    )
    clearTimeout(timeoutId)
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      logger.warn('[capi] Evento rejeitado pelo servidor Meta', { status: res.status, body })
    } else {
      logger.debug('[capi] Evento enviado', { event: opts.eventName, eventId: opts.eventId })
    }
  } catch (err) {
    clearTimeout(timeoutId)
    // Network errors and timeouts must not crash the request handler
    logger.warn('[capi] Falha ao enviar evento CAPI', { error: String(err) })
  }
}

/** Convenience: fire Lead event after precadastro submission. */
export async function sendCapiLead(opts: {
  eventId: string
  email?: string
  phone?: string
  firstName?: string
  lastName?: string
  clientIp: string
  clientUserAgent: string
}): Promise<void> {
  return sendCapiEvent({
    eventName: 'Lead',
    eventId: opts.eventId,
    userData: {
      email: opts.email,
      phone: opts.phone,
      firstName: opts.firstName,
      lastName: opts.lastName,
      clientIp: opts.clientIp,
      clientUserAgent: opts.clientUserAgent,
    },
  })
}

/** Convenience: fire Purchase event after Asaas webhook confirms payment. */
export async function sendCapiPurchase(opts: {
  eventId: string
  email?: string
  phone?: string
  firstName?: string
  value: number
}): Promise<void> {
  return sendCapiEvent({
    eventName: 'Purchase',
    eventId: opts.eventId,
    userData: {
      email: opts.email,
      phone: opts.phone,
      firstName: opts.firstName,
      // No clientIp/UA — server-side webhook origin
      clientIp: '0.0.0.0',
    },
    value: opts.value,
    currency: 'BRL',
  })
}
