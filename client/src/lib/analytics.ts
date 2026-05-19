/**
 * Analytics (Vite SPA — client/)
 *
 * GTM loads immediately via client/index.html.
 * This module provides typed helpers for dataLayer events and
 * wires a global [data-event] click listener.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DataLayerEvent {
  event: string
  [key: string]: unknown
}

declare global {
  interface Window {
    dataLayer: DataLayerEvent[]
    fbq?: (action: string, event: string, params?: Record<string, unknown>) => void
    gtag?: (...args: unknown[]) => void
    __cis_click_listener_attached__?: boolean
  }
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function push(event: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer ?? []
  window.dataLayer.push({ event, ...params })
}

// ─── Initialisation ──────────────────────────────────────────────────────────

/** Inject GA4 gtag.js independently of GTM — idempotent. */
export function initGA4(id: string): void {
  if (typeof window === 'undefined' || !id) return
  if (document.getElementById('ga4-script')) return
  const s = document.createElement('script')
  s.id = 'ga4-script'; s.async = true
  s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`
  document.head.appendChild(s)
  window.dataLayer = window.dataLayer ?? []
  window.gtag = function (...args) { window.dataLayer.push(args as unknown as DataLayerEvent) }
  window.gtag('js', new Date())
  window.gtag('config', id)
}

/**
 * Attach a single global click listener for elements with [data-event].
 * Idempotent — safe to call multiple times.
 */
export function initClickListener(): void {
  if (typeof window === 'undefined') return
  if (window.__cis_click_listener_attached__) return
  window.__cis_click_listener_attached__ = true
  document.addEventListener('click', (e) => {
    const el = (e.target as Element).closest('[data-event]')
    if (!el) return
    const name = el.getAttribute('data-event') ?? ''
    const label = el.getAttribute('data-event-label') ?? el.textContent?.trim().slice(0, 60)
    push(name, { event_label: label ?? undefined })
  })
}

// ─── Generic ─────────────────────────────────────────────────────────────────

/** Push any event to GTM dataLayer. */
export function trackEvent(eventName: string, params?: Record<string, unknown>): void {
  push(eventName, params)
}

/** Track SPA route change — call from useTrackPageView. */
export function trackPageView(path: string, title?: string): void {
  push('page_view', { page_path: path, page_title: title ?? document.title })
  if (typeof window.fbq === 'function') window.fbq('track', 'PageView')
}

/** CTA click. */
export function trackCtaClick(local: string): void {
  push('cta_click', { cta_local: local, page_path: typeof window !== 'undefined' ? window.location.pathname : '' })
}

/** WhatsApp button click. */
export function trackWhatsApp(local: string): void {
  push('whatsapp_click', { local })
  if (typeof window.fbq === 'function') window.fbq('track', 'Contact')
}

/** Form submission tracking. */
export function trackFormSubmit(formName: string): void {
  push('form_submit', { form_name: formName })
}
