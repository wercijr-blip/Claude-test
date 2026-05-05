/**
 * Analytics helper for Facilita PrEP
 * Sends events to GTM dataLayer and fires platform-specific conversion signals.
 * Safe to import server-side — all functions guard against missing `window`.
 */

type EventParams = Record<string, string | number | boolean | undefined>

declare global {
  interface Window {
    dataLayer: EventParams[]
    fbq?: (action: string, event: string, params?: EventParams) => void
    gtag?: (command: string, target: string, params?: EventParams) => void
    ttq?: {
      track: (event: string, params?: EventParams) => void
    }
  }
}

function pushDataLayer(event: string, params?: EventParams): void {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer ?? []
  window.dataLayer.push({ event, ...params })
}

/** Send a generic event to GTM dataLayer (and, by extension, to any tag listening in GTM). */
export function trackEvent(eventName: string, params?: EventParams): void {
  pushDataLayer(eventName, params)
}

/** Fire a conversion event with optional monetary value. */
export function trackConversion(value?: number, currency = 'BRL'): void {
  pushDataLayer('conversion', {
    event_category: 'ecommerce',
    value,
    currency,
  })

  // Meta Pixel — Purchase / Lead
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('track', value !== undefined ? 'Purchase' : 'Lead', {
      value,
      currency,
    })
  }

  // TikTok Pixel — CompletePayment / SubmitForm
  if (typeof window !== 'undefined' && window.ttq) {
    window.ttq.track(value !== undefined ? 'CompletePayment' : 'SubmitForm', {
      value,
      currency,
    })
  }
}

/** Fire when the user begins interacting with the intake form. */
export function trackFormStart(): void {
  pushDataLayer('form_start', { event_category: 'intake' })

  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('track', 'InitiateCheckout')
  }

  if (typeof window !== 'undefined' && window.ttq) {
    window.ttq.track('InitiateCheckout')
  }
}

/** Fire on successful form submission. */
export function trackFormSubmit(type: 'particular' | 'plano'): void {
  pushDataLayer('form_submit', { event_category: 'intake', intake_type: type })

  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('track', 'Lead', { content_name: type })
  }

  if (typeof window !== 'undefined' && window.ttq) {
    window.ttq.track('SubmitForm', { content_name: type })
  }
}

/** Fire on SPA navigation (e.g. after router pushes a new URL). */
export function trackPageView(url: string): void {
  pushDataLayer('page_view', { page_path: url })

  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('track', 'PageView')
  }
}

/** Fire when user clicks any scheduling / CTA button. */
export function trackAgendarClick(local: string): void {
  pushDataLayer('cta_click', { cta_local: local, page_path: typeof window !== 'undefined' ? window.location.pathname : '' })

  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('track', 'ViewContent', { content_name: 'CTA Agendar', content_category: 'PrEP' })
  }
}

/** Fire when a lead is successfully generated (form submitted). */
export function trackLeadGerado(origem: string): void {
  pushDataLayer('lead_gerado', { origem, currency: 'BRL' })

  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('track', 'Lead', { content_name: 'Consulta PrEP', currency: 'BRL' })
  }

  if (typeof window !== 'undefined' && window.ttq) {
    window.ttq.track('SubmitForm', { content_name: 'Consulta PrEP' })
  }
}

/** Fire when user clicks the WhatsApp button. */
export function trackWhatsApp(local: string): void {
  pushDataLayer('whatsapp_click', { local })

  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('track', 'Contact')
  }
}
