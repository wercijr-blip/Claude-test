import type { Metadata } from 'next'
import { Cormorant_Garamond, DM_Sans } from 'next/font/google'
import './globals.css'
import TrpcProvider from '@web/components/TrpcProvider'
import FooterCfm from '@web/components/FooterCfm'
import CookieConsent from '@web/components/CookieConsent'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-display',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
})

const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN ?? 'https://facilitaprep.com.br'

export const metadata: Metadata = {
  metadataBase: new URL(DOMAIN),
  title: {
    template: '%s | Facilita PrEP',
    default: 'Facilita PrEP — Prevenção do HIV com PrEP',
  },
  description:
    'Plataforma digital para acesso à PrEP. Receita com assinatura ICP-Brasil, 100% online, sigiloso e rápido.',
  robots: { index: true, follow: true },
  alternates: {
    canonical: DOMAIN,
  },
  openGraph: {
    siteName: 'Facilita PrEP',
    locale: 'pt_BR',
    type: 'website',
    url: DOMAIN,
    title: 'Facilita PrEP — Prevenção do HIV com PrEP',
    description:
      'Acesse a PrEP de forma rápida, sigilosa e 100% digital. Receita com assinatura ICP-Brasil, sem sair de casa.',
    images: [
      {
        url: `${DOMAIN}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'Facilita PrEP — Prevenção do HIV com PrEP',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Facilita PrEP — Prevenção do HIV com PrEP',
    description:
      'Acesse a PrEP de forma rápida, sigilosa e 100% digital. Receita com assinatura ICP-Brasil, sem sair de casa.',
    images: [`${DOMAIN}/og-image.png`],
  },
}

// ── Read pixel IDs at build/request time (server-safe) ───────────────────────
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID
const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID
const TIKTOK_PIXEL_ID = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${cormorant.variable} ${dmSans.variable}`}>
      <head />
      <body className="min-h-screen flex flex-col">
        <TrpcProvider>
          <div className="flex-1">{children}</div>
          <FooterCfm />
        </TrpcProvider>
        <CookieConsent
          gtmId={GTM_ID}
          metaPixelId={META_PIXEL_ID}
          googleAdsId={GOOGLE_ADS_ID}
          tiktokPixelId={TIKTOK_PIXEL_ID}
        />
      </body>
    </html>
  )
}
