/**
 * Analytics for Facilita PrEP (Vite SPA — client/)
 *
 * GTM loads via consent-gated /gtm-loader.js (LGPD compliant).
 * This module provides typed helpers for: dataLayer events, UTM persistence,
 * scroll depth, time on page, form step tracking, CAPI event_id dedup,
 * Core Web Vitals reporting, and Google Consent Mode v2.
 */

import { onLCP, onFCP, onCLS, onINP, onTTFB } from 'web-vitals'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DataLayerEvent {
  event: string
  [key: string]: unknown
}

declare global {
  interface Window {
    dataLayer: DataLayerEvent[]
    fbq?: (action: string, event: string, params?: Record<string, unknown>) => void
    gtag?: (...args: unknown[]) => void
    __fp_click_listener_attached__?: boolean
    __fp_scroll_attached__?: boolean
    __fp_time_attached__?: boolean
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function push(event: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer ?? []
  window.dataLayer.push({ event, ...params })
}

// ─── UTM Persistence (D01) ────────────────────────────────────────────────────

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const

/** Capture UTMs from the URL and persist in sessionStorage. Call on every page load. */
export function persistUtms(): void {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  const stored: Record<string, string> = {}
  UTM_KEYS.forEach(k => { const v = params.get(k); if (v) stored[k] = v })
  if (Object.keys(stored).length > 0) {
    sessionStorage.setItem('_fp_utms', JSON.stringify(stored))
  }
}

/** Read persisted UTMs to include in conversion events. */
export function getStoredUtms(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(sessionStorage.getItem('_fp_utms') ?? '{}') }
  catch { return {} }
}

// ─── Event ID for CAPI deduplication (D01 / D02) ─────────────────────────────

/** Generate a unique event ID. Must match the event_id sent via CAPI server-side. */
export function generateEventId(): string {
  return `fp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// ─── Initialisation ──────────────────────────────────────────────────────────

/**
 * Google Consent Mode v2 — call on every page load with default 'denied',
 * then call again with 'granted' after user accepts cookies.
 */
export function updateConsentMode(consent: 'all' | 'essential' | 'default'): void {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer ?? []
  const granted = consent === 'all' ? 'granted' : 'denied'
  const update = consent === 'default' ? 'default' : 'update'
  window.dataLayer.push({
    event: `consent_${update}`,
    analytics_storage: granted,
    ad_storage: granted,
    ad_user_data: granted,
    ad_personalization: granted,
  })
  if (typeof window.gtag === 'function') {
    window.gtag('consent', update, {
      analytics_storage: granted,
      ad_storage: granted,
      ad_user_data: granted,
      ad_personalization: granted,
    })
  }
}

/** Report Core Web Vitals (LCP, FCP, CLS, INP, TTFB) to GA4 via dataLayer. */
export function initWebVitals(): void {
  if (typeof window === 'undefined') return
  const report = ({ name, value, id }: { name: string; value: number; id: string }) => {
    const rounded = Math.round(name === 'CLS' ? value * 1000 : value)
    push('web_vital', { metric_name: name, metric_value: rounded, metric_id: id })
    if (typeof window.gtag === 'function') {
      window.gtag('event', name, {
        event_category: 'Web Vitals',
        event_label: id,
        value: rounded,
        non_interaction: true,
      })
    }
  }
  onLCP(report)
  onFCP(report)
  onCLS(report)
  onINP(report)
  onTTFB(report)
}

/** Inject GTM — called by CookieConsent when user accepts all cookies. Idempotent. */
export function initGTM(): void {
  if (typeof window === 'undefined') return
  if (document.getElementById('gtm-script')) return
  window.dataLayer = window.dataLayer ?? []
  window.dataLayer.push({ event: 'gtm.js', 'gtm.start': new Date().getTime() })
  const s = document.createElement('script')
  s.id = 'gtm-script'; s.async = true
  s.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-WCF38JBP'
  document.head.appendChild(s)
}

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

/** Track scroll depth milestones (25 / 50 / 75 / 90%). Fires once per milestone per page. */
export function initScrollDepth(): void {
  if (typeof window === 'undefined') return
  if (window.__fp_scroll_attached__) return
  window.__fp_scroll_attached__ = true
  const marks = [25, 50, 75, 90]
  const fired = new Set<number>()
  window.addEventListener('scroll', () => {
    const scrolled = window.scrollY + window.innerHeight
    const total = document.documentElement.scrollHeight
    if (total <= window.innerHeight) return
    const pct = Math.round((scrolled / total) * 100)
    marks.forEach(m => {
      if (pct >= m && !fired.has(m)) {
        fired.add(m)
        push('scroll_depth', { depth_percent: m, page_path: window.location.pathname })
      }
    })
  }, { passive: true })
}

/** Track time-on-page milestones (30s / 60s / 120s). Call after each SPA navigation. */
export function initTimeOnPage(): void {
  if (typeof window === 'undefined') return
  const path = window.location.pathname
  ;[30, 60, 120].forEach(seconds => {
    setTimeout(() => {
      // Only fire if user is still on the same route
      if (window.location.pathname === path) {
        push('time_on_page', { seconds, page_path: path })
      }
    }, seconds * 1000)
  })
}

// ─── Generic ─────────────────────────────────────────────────────────────────

/** Push any event to GTM dataLayer. */
export function trackEvent(eventName: string, params?: Record<string, unknown>): void {
  push(eventName, params)
}

/** Track SPA route change — call from useTrackPageView. */
export function trackPageView(path: string, title?: string): void {
  push('page_view', {
    page_path: path,
    page_title: title ?? document.title,
    ...getStoredUtms(),
  })
  if (typeof window.fbq === 'function') window.fbq('track', 'PageView')
}

// ─── Form step tracking (D20) ─────────────────────────────────────────────────

/** Fire on each step of the multi-step clinical form. Enables funnel abandonment diagnosis. */
export function trackFormStep(stepName: string, stepNumber: number, totalSteps: number): void {
  push('form_step', {
    step_name: stepName,
    step_number: stepNumber,
    total_steps: totalSteps,
    page_path: typeof window !== 'undefined' ? window.location.pathname : '',
    ...getStoredUtms(),
  })
}

// ─── Conversion events ───────────────────────────────────────────────────────

/** User started the payment/intake flow. */
export function trackBeginCheckout(plan: string, value: number): void {
  const eventId = generateEventId()
  push('begin_checkout', { plan, value, currency: 'BRL', event_id: eventId, ...getStoredUtms() })
  if (typeof window.fbq === 'function') {
    window.fbq('track', 'InitiateCheckout', { content_name: plan, value, currency: 'BRL' })
  }
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'begin_checkout', { value, currency: 'BRL', items: [{ item_name: plan, price: value }] })
  }
}

/**
 * Payment confirmed — call from /pagamento/sucesso.
 * userEmail is hashed client-side for Enhanced Conversions.
 */
export function trackPurchase(orderId: string, value: number, userEmail?: string): void {
  const eventId = generateEventId()
  // Enhanced Conversions: GTM reads this object and sends hashed email to Google Ads.
  if (userEmail) {
    push('enhanced_conversion_data', { enhanced_conversion_data: { email: userEmail } })
  }
  push('purchase', {
    transaction_id: orderId,
    value,
    currency: 'BRL',
    item_name: 'Consulta PrEP',
    event_id: eventId,
    ...getStoredUtms(),
  })
  if (typeof window.fbq === 'function') window.fbq('track', 'Purchase', { value, currency: 'BRL' })
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'purchase', {
      transaction_id: orderId, value, currency: 'BRL',
      items: [{ item_name: 'Consulta PrEP', price: value }],
    })
  }
}

/** Form submission tracking. */
export function trackFormSubmit(formName: string): void {
  const eventId = generateEventId()
  push('form_submit', { form_name: formName, event_id: eventId, ...getStoredUtms() })
  if (typeof window.fbq === 'function') {
    window.fbq('track', formName.includes('clinico') ? 'CompleteRegistration' : 'Lead', { content_name: formName })
  }
}

/** Specific: pre-registration form submitted. */
export function trackFormSubmitPrecadastro(tipo: 'particular' | 'plano'): void {
  trackFormSubmit(`precadastro_${tipo}`)
}

/** Specific: clinical questionnaire submitted. */
export function trackFormSubmitClinico(): void {
  trackFormSubmit('clinico')
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
