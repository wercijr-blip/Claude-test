/**
 * Analytics for Facilita PrEP (Vite SPA — client/)
 *
 * Initialisation flow:
 *   1. CookieConsent calls initGTM() / initGA4() after user accepts.
 *   2. App calls initClickListener() once on mount.
 *   3. useTrackPageView() hook fires trackPageView on every wouter navigation.
 */

type EventParams = Record<string, string | number | boolean | undefined>

declare global {
  interface Window {
    dataLayer: EventParams[]
    fbq?: (action: string, event: string, params?: EventParams) => void
    gtag?: (...args: unknown[]) => void
  }
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function push(event: string, params?: EventParams): void {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer ?? []
  window.dataLayer.push({ event, ...params })
}

// ─── Initialisation ──────────────────────────────────────────────────────────

/** Inject GTM snippet — safe to call multiple times (idempotent). */
export function initGTM(id: string): void {
  if (typeof window === 'undefined' || !id) return
  if (document.getElementById('gtm-script')) return

  window.dataLayer = window.dataLayer ?? []
  window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' })

  const s = document.createElement('script')
  s.id = 'gtm-script'
  s.async = true
  s.src = `https://www.googletagmanager.com/gtm.js?id=${id}`
  document.head.appendChild(s)

  const ns = document.createElement('noscript')
  ns.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${id}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`
  document.body.insertBefore(ns, document.body.firstChild)
}

/** Inject GA4 gtag.js — safe to call multiple times. */
export function initGA4(id: string): void {
  if (typeof window === 'undefined' || !id) return
  if (document.getElementById('ga4-script')) return

  const s = document.createElement('script')
  s.id = 'ga4-script'
  s.async = true
  s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`
  document.head.appendChild(s)

  window.dataLayer = window.dataLayer ?? []
  window.gtag = function (...args) { window.dataLayer.push(args as unknown as EventParams) }
  window.gtag('js', new Date())
  window.gtag('config', id)
}

/**
 * Attach a global click listener for elements with [data-event].
 * Fires once — safe to call multiple times.
 */
export function initClickListener(): void {
  if (typeof window === 'undefined') return
  if (window.__fp_click_listener_attached__) return
  window.__fp_click_listener_attached__ = true

  document.addEventListener('click', (e) => {
    const el = (e.target as Element).closest('[data-event]')
    if (!el) return
    const name = el.getAttribute('data-event') ?? ''
    const label = el.getAttribute('data-event-label') ?? el.textContent?.trim().slice(0, 60)
    push(name, { event_label: label ?? undefined })
  })
}

declare global {
  interface Window { __fp_click_listener_attached__?: boolean }
}

// ─── Generic ─────────────────────────────────────────────────────────────────

/** Push any event to GTM dataLayer. */
export function trackEvent(name: string, params?: EventParams): void {
  push(name, params)
}

/** Track SPA route change (call from useTrackPageView). */
export function trackPageView(path: string): void {
  push('page_view', { page_path: path })
  if (typeof window.fbq === 'function') window.fbq('track', 'PageView')
}

// ─── Conversion events ───────────────────────────────────────────────────────

/** User clicked a CTA and started the payment or intake flow. */
export function trackBeginCheckout(type: 'particular' | 'plano', origin: string): void {
  push('begin_checkout', { intake_type: type, cta_origin: origin, currency: 'BRL', value: type === 'particular' ? 150 : 0 })
  if (typeof window.fbq === 'function') window.fbq('track', 'InitiateCheckout', { content_name: `PrEP_${type}` })
}

/** Stripe payment confirmed — call from /pagamento/sucesso. */
export function trackPurchase(sessionId: string, value = 150): void {
  push('purchase', { transaction_id: sessionId, value, currency: 'BRL', item_name: 'Consulta PrEP' })
  if (typeof window.fbq === 'function') window.fbq('track', 'Purchase', { value, currency: 'BRL' })
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'purchase', { transaction_id: sessionId, value, currency: 'BRL', items: [{ item_name: 'Consulta PrEP', price: value }] })
  }
}

/** User submitted the pre-registration intake form. */
export function trackFormSubmitPrecadastro(tipo: 'particular' | 'plano'): void {
  push('form_submit_precadastro', { intake_type: tipo })
  if (typeof window.fbq === 'function') window.fbq('track', 'Lead', { content_name: `PrEP_precadastro_${tipo}` })
}

/** Patient submitted the full clinical form. */
export function trackFormSubmitClinico(): void {
  push('form_submit_clinico', { event_category: 'intake' })
  if (typeof window.fbq === 'function') window.fbq('track', 'CompleteRegistration')
}

/** CTA click (hero, modal, sticky bar, etc.). */
export function trackCtaClick(local: string): void {
  push('cta_click', { cta_local: local, page_path: typeof window !== 'undefined' ? window.location.pathname : '' })
}

/** WhatsApp button click. */
export function trackWhatsApp(local: string): void {
  push('whatsapp_click', { local })
  if (typeof window.fbq === 'function') window.fbq('track', 'Contact')
}
