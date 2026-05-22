'use client'

import { useState, useEffect } from 'react'
import Script from 'next/script'
import { configCrossDomainLinker } from '@web/lib/analytics'

const CONSENT_KEY = 'fp_lgpd_consent'

interface Props {
  gtmId?: string
  metaPixelId?: string
  googleAdsId?: string
  tiktokPixelId?: string
  clarityId?: string
  ga4Id?: string
}

export default function CookieConsent({ gtmId, metaPixelId, googleAdsId, tiktokPixelId, clarityId, ga4Id }: Props) {
  const [consent, setConsent] = useState<boolean | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY)
    setConsent(stored === 'true' ? true : stored === 'false' ? false : null)
  }, [])

  function accept() {
    localStorage.setItem(CONSENT_KEY, 'true')
    setConsent(true)
    if (typeof window !== 'undefined') {
      window.dataLayer = window.dataLayer ?? []
      window.dataLayer.push({ event: 'cookies_accepted', method: 'all' })
      // Google Consent Mode v2 — update signals after user acceptance
      if (typeof window.gtag === 'function') {
        window.gtag('consent', 'update', {
          ad_storage: 'granted',
          analytics_storage: 'granted',
          ad_user_data: 'granted',
          ad_personalization: 'granted',
        })
      }
      if (ga4Id) configCrossDomainLinker(ga4Id)
    }
  }

  function decline() {
    localStorage.setItem(CONSENT_KEY, 'false')
    setConsent(false)
    if (typeof window !== 'undefined') {
      window.dataLayer = window.dataLayer ?? []
      window.dataLayer.push({ event: 'cookies_declined' })
      if (typeof window.gtag === 'function') {
        window.gtag('consent', 'update', {
          ad_storage: 'denied',
          analytics_storage: 'denied',
          ad_user_data: 'denied',
          ad_personalization: 'denied',
        })
      }
    }
  }

  const hasPixels = gtmId || metaPixelId || googleAdsId || tiktokPixelId || clarityId
  if (!hasPixels) return null

  return (
    <>
      {/* Pixels — only after explicit consent */}
      {consent === true && (
        <>
          {gtmId && (
            <Script
              id="gtm-head"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`,
              }}
            />
          )}
          {metaPixelId && (
            <Script
              id="meta-pixel"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${metaPixelId}');fbq('track','PageView');`,
              }}
            />
          )}
          {googleAdsId && (
            <>
              <Script
                id="google-ads-src"
                strategy="afterInteractive"
                src={`https://www.googletagmanager.com/gtag/js?id=${googleAdsId}`}
              />
              <Script
                id="google-ads-init"
                strategy="afterInteractive"
                dangerouslySetInnerHTML={{
                  __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${googleAdsId}');`,
                }}
              />
            </>
          )}
          {tiktokPixelId && (
            <Script
              id="tiktok-pixel"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=i+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};ttq.load('${tiktokPixelId}');ttq.page()}(window,document,'ttq');`,
              }}
            />
          )}
          {clarityId && (
            <Script
              id="microsoft-clarity"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","${clarityId}");`,
              }}
            />
          )}
        </>
      )}

      {/* Banner — only shown when no decision has been made */}
      {consent === null && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white border-t border-slate-200 shadow-lg">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <p className="text-sm text-slate-600 flex-1">
              Usamos cookies analíticos para melhorar sua experiência. Seus dados são tratados conforme a{' '}
              <a href="/privacidade" className="underline hover:text-fp-accent">
                Política de Privacidade
              </a>{' '}
              (LGPD — Lei 13.709/2018).
            </p>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={decline}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Recusar
              </button>
              <button
                onClick={accept}
                className="px-4 py-2 text-sm font-medium text-white bg-fp-accent rounded-lg hover:opacity-90 transition-opacity"
              >
                Aceitar cookies
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
