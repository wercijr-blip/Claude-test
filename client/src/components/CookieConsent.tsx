import { useState, useEffect } from 'react'
import { initGTM, initGA4, updateConsentMode } from '../lib/analytics.ts'

export const STORAGE_KEY = 'cookies_accepted'
const GA4_ID = import.meta.env.VITE_GA4_ID as string | undefined
const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined

type Consent = 'all' | 'essential' | null

/** Call this from anywhere (e.g. footer link) to re-open the consent banner. */
export function revogarConsentimento() {
  localStorage.removeItem(STORAGE_KEY)
  updateConsentMode('default')
  window.dispatchEvent(new CustomEvent('cookie-consent-reset'))
}

function loadMetaPixel(id: string) {
  if (document.getElementById('meta-pixel-script')) return
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
  const [visible, setVisible] = useState(consent === null)
  const [fading, setFading] = useState(false)

  // Set default denied state on mount (Google Consent Mode v2)
  useEffect(() => {
    updateConsentMode(consent ?? 'default')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-open banner when revogarConsentimento() is called from anywhere
  useEffect(() => {
    function onReset() {
      setConsent(null)
      setFading(false)
      setVisible(true)
    }
    window.addEventListener('cookie-consent-reset', onReset)
    return () => window.removeEventListener('cookie-consent-reset', onReset)
  }, [])

  useEffect(() => {
    updateConsentMode(consent ?? 'default')
    if (consent !== 'all') return
    initGTM()
    if (GA4_ID) initGA4(GA4_ID)
    if (META_PIXEL_ID) loadMetaPixel(META_PIXEL_ID)
  }, [consent])

  function dismiss(value: Consent) {
    if (!value) return
    localStorage.setItem(STORAGE_KEY, value)
    window.dataLayer = window.dataLayer ?? []
    window.dataLayer.push({ event: 'cookies_accepted', consent: value })
    setConsent(value)
    setFading(true)
    setTimeout(() => setVisible(false), 300)
  }

  if (!visible) return null

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-5 transition-opacity duration-300 ${fading ? 'opacity-0' : 'opacity-100'}`}
    >
      <div className="max-w-2xl mx-auto bg-fp-dark border border-white/10 rounded-2xl shadow-2xl p-5">
        <p className="text-white/80 text-sm leading-relaxed mb-4">
          Usamos cookies para melhorar sua experiência e entender o engajamento. Ao continuar, você
          concorda com nossa{' '}
          <a href="/privacidade" className="underline text-fp-lilac-soft hover:text-white transition-colors">
            Política de Privacidade
          </a>{' '}
          (LGPD — Lei 13.709/2018).
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => dismiss('all')}
            className="flex-1 bg-fp-accent text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-fp-dark-mid transition-colors"
          >
            Aceitar todos
          </button>
          <button
            onClick={() => dismiss('essential')}
            className="flex-1 bg-transparent border border-white/30 text-white/70 py-2.5 rounded-xl text-sm hover:bg-white/10 transition-colors"
          >
            Apenas essenciais
          </button>
        </div>
      </div>
    </div>
  )
}
