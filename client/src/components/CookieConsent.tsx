import { useEffect, useState } from 'react'

const STORAGE_KEY = 'fp_lgpd_consent'
const GTM_ID = import.meta.env.VITE_GTM_ID as string | undefined
const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined

type Consent = 'true' | 'false' | null

function loadGtm(id: string) {
  if (document.getElementById('gtm-script')) return
  const s = document.createElement('script')
  s.id = 'gtm-script'
  s.async = true
  s.src = `https://www.googletagmanager.com/gtm.js?id=${id}`
  document.head.appendChild(s)

  const noscript = document.createElement('noscript')
  noscript.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${id}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`
  document.body.insertBefore(noscript, document.body.firstChild)

  // @ts-expect-error gtm dataLayer
  window.dataLayer = window.dataLayer ?? []
  // @ts-expect-error gtm dataLayer
  window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' })
}

function loadMetaPixel(id: string) {
  if (document.getElementById('meta-pixel-script')) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const f = window as any
  f.fbq = f.fbq ?? function (...args: unknown[]) { f.fbq.callMethod ? f.fbq.callMethod(...args) : f.fbq.queue.push(args) }
  if (!f._fbq) f._fbq = f.fbq
  f.fbq.push = f.fbq
  f.fbq.loaded = true
  f.fbq.version = '2.0'
  f.fbq.queue = []

  const s = document.createElement('script')
  s.id = 'meta-pixel-script'
  s.async = true
  s.src = 'https://connect.facebook.net/en_US/fbevents.js'
  document.head.appendChild(s)

  f.fbq('init', id)
  f.fbq('track', 'PageView')
}

export function trackLead() {
  // @ts-expect-error fbq
  if (typeof window.fbq === 'function') window.fbq('track', 'Lead')
  // @ts-expect-error dataLayer
  if (Array.isArray(window.dataLayer)) window.dataLayer.push({ event: 'generate_lead' })
}

export function trackCompleteRegistration() {
  // @ts-expect-error fbq
  if (typeof window.fbq === 'function') window.fbq('track', 'CompleteRegistration')
  // @ts-expect-error dataLayer
  if (Array.isArray(window.dataLayer)) window.dataLayer.push({ event: 'sign_up' })
}

export default function CookieConsent() {
  const [consent, setConsent] = useState<Consent>(() => localStorage.getItem(STORAGE_KEY) as Consent)

  useEffect(() => {
    if (consent === 'true') {
      if (GTM_ID) loadGtm(GTM_ID)
      if (META_PIXEL_ID) loadMetaPixel(META_PIXEL_ID)
    }
  }, [consent])

  function accept() {
    localStorage.setItem(STORAGE_KEY, 'true')
    setConsent('true')
  }

  function decline() {
    localStorage.setItem(STORAGE_KEY, 'false')
    setConsent('false')
  }

  if (consent !== null) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 pointer-events-none">
      <div className="max-w-2xl mx-auto bg-fp-dark border border-slate-700 rounded-2xl shadow-2xl p-5 pointer-events-auto">
        <p className="text-white text-sm leading-relaxed mb-4">
          Usamos cookies e tecnologias similares para melhorar sua experiência e, com seu consentimento,
          para fins de análise e marketing conforme nossa política de privacidade (LGPD).
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={accept}
            className="flex-1 bg-fp-accent text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-fp-dark-mid transition-colors"
          >
            Aceitar cookies
          </button>
          <button
            onClick={decline}
            className="flex-1 bg-white/10 border border-white/20 text-white/70 py-2.5 rounded-xl text-sm hover:bg-white/20 transition-colors"
          >
            Apenas essenciais
          </button>
        </div>
      </div>
    </div>
  )
}
