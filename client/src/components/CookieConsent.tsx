import { useEffect, useState } from 'react'
import { initGTM, initGA4, trackEvent } from '../lib/analytics.ts'

const STORAGE_KEY = 'fp_lgpd_consent'
const GTM_ID = import.meta.env.VITE_GTM_ID as string | undefined
const GA4_ID = import.meta.env.VITE_GA4_ID as string | undefined
const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined

type Consent = 'true' | 'false' | null

function loadMetaPixel(id: string) {
  if (document.getElementById('meta-pixel-script')) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const f = window as any
  f.fbq = f.fbq ?? function (...args: unknown[]) { f.fbq.callMethod ? f.fbq.callMethod(...args) : f.fbq.queue.push(args) }
  if (!f._fbq) f._fbq = f.fbq
  f.fbq.push = f.fbq; f.fbq.loaded = true; f.fbq.version = '2.0'; f.fbq.queue = []
  const s = document.createElement('script')
  s.id = 'meta-pixel-script'; s.async = true
  s.src = 'https://connect.facebook.net/en_US/fbevents.js'
  document.head.appendChild(s)
  f.fbq('init', id); f.fbq('track', 'PageView')
}

export default function CookieConsent() {
  const [consent, setConsent] = useState<Consent>(() => localStorage.getItem(STORAGE_KEY) as Consent)

  useEffect(() => {
    if (consent !== 'true') return
    if (GTM_ID) initGTM(GTM_ID)
    if (GA4_ID) initGA4(GA4_ID)
    if (META_PIXEL_ID) loadMetaPixel(META_PIXEL_ID)
  }, [consent])

  function accept() {
    localStorage.setItem(STORAGE_KEY, 'true')
    setConsent('true')
    trackEvent('cookies_accepted', { method: 'all' })
  }

  function decline() {
    localStorage.setItem(STORAGE_KEY, 'false')
    setConsent('false')
    trackEvent('cookies_declined')
  }

  if (consent !== null) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 pointer-events-none">
      <div className="max-w-2xl mx-auto bg-fp-dark border border-white/10 rounded-2xl shadow-2xl p-5 pointer-events-auto">
        <p className="text-white/80 text-sm leading-relaxed mb-4">
          Usamos cookies para melhorar sua experiência e medir engajamento. Ao aceitar, você concorda com
          nossa{' '}
          <a href="/privacidade" className="underline text-fp-lilac-soft hover:text-white transition-colors">
            Política de Privacidade
          </a>{' '}
          (LGPD — Lei 13.709/2018).
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={accept}
            className="flex-1 bg-fp-accent text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-fp-dark-mid transition-colors"
          >
            Aceitar todos
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
