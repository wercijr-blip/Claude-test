import type { Metadata } from 'next'
import { Cormorant_Garamond, DM_Sans } from 'next/font/google'
import './globals.css'
import TrpcProvider from '@web/components/TrpcProvider'
import FooterCfm from '@web/components/FooterCfm'

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

const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN ?? 'https://claude-test-production-8672.up.railway.app'

export const metadata: Metadata = {
  metadataBase: new URL(DOMAIN),
  title: {
    template: '%s | Facilita PrEP',
    default: 'Facilita PrEP — Prevenção do HIV com PrEP',
  },
  description: 'Plataforma digital para acesso à PrEP. Receita com assinatura ICP-Brasil, 100% online, sigiloso e rápido.',
  robots: { index: true, follow: true },
  openGraph: {
    siteName: 'Facilita PrEP',
    locale: 'pt_BR',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${cormorant.variable} ${dmSans.variable}`}>
      <body className="min-h-screen flex flex-col">
        <TrpcProvider>
          <div className="flex-1">{children}</div>
          <FooterCfm />
        </TrpcProvider>
      </body>
    </html>
  )
}
