import type { Metadata } from 'next'
import { Cormorant_Garamond, DM_Sans } from 'next/font/google'
import Script from 'next/script'
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
    default: 'Consulta PrEP Online | Médico Infectologista | Facilita PrEP',
  },
  description:
    'Consulta online com infectologista para PrEP. Receita digital ICP-Brasil em até 48h. Sigiloso, sem deslocamento, atendimento em todo o Brasil. CRM-DF 16381.',
  keywords: [
    'PrEP online',
    'consulta PrEP',
    'profilaxia HIV online',
    'médico infectologista online',
    'PrEP particular',
    'receita PrEP digital',
    'PrEP teleconsulta',
  ],
  authors: [{ name: 'Dr. Werciley Saraiva Vieira Junior', url: DOMAIN }],
  creator: 'Facilita PrEP',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: DOMAIN,
  },
  openGraph: {
    siteName: 'Facilita PrEP',
    locale: 'pt_BR',
    type: 'website',
    url: DOMAIN,
    title: 'Facilita PrEP — Consulta com Infectologista Online',
    description:
      'Sua proteção contra o HIV, sem fila e sem burocracia. Receita digital em até 48h.',
    images: [
      {
        url: `${DOMAIN}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'Facilita PrEP — Teleconsulta com Infectologista',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Facilita PrEP — Consulta PrEP Online',
    description: 'Receita digital de PrEP em até 48h com infectologista credenciado.',
    images: [`${DOMAIN}/og-image.png`],
  },
}

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID
const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID
const TIKTOK_PIXEL_ID = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID

const SCHEMA_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'MedicalBusiness',
      '@id': `${DOMAIN}/#organization`,
      name: 'Facilita PrEP',
      url: DOMAIN,
      logo: `${DOMAIN}/favicon.svg`,
      description: 'Plataforma de teleconsulta médica especializada em PrEP (Profilaxia Pré-Exposição ao HIV), com receita digital ICP-Brasil e acompanhamento médico online.',
      telephone: '+55-61-4042-7188',
      email: 'contato@atossaudeintegrada.com.br',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'SHLS Quadra 716, Conjunto A, Consultórios 607 e 609, Parte B, S/N — 6º Andar',
        addressLocality: 'Brasília',
        addressRegion: 'DF',
        postalCode: '70390-700',
        addressCountry: 'BR',
      },
      medicalSpecialty: 'InfectiousDisease',
      areaServed: { '@type': 'Country', name: 'Brasil' },
      availableService: {
        '@type': 'MedicalTherapy',
        name: 'Profilaxia Pré-Exposição ao HIV (PrEP)',
        relevantSpecialty: 'InfectiousDisease',
      },
      employee: {
        '@type': 'Physician',
        '@id': `${DOMAIN}/#physician`,
        name: 'Dr. Werciley Saraiva Vieira Junior',
        medicalSpecialty: 'InfectiousDisease',
        hasCredential: [
          { '@type': 'EducationalOccupationalCredential', credentialCategory: 'CRM-DF 16381' },
          { '@type': 'EducationalOccupationalCredential', credentialCategory: 'RQE 14486' },
        ],
      },
    },
    {
      '@type': 'WebSite',
      '@id': `${DOMAIN}/#website`,
      url: DOMAIN,
      name: 'Facilita PrEP',
      publisher: { '@id': `${DOMAIN}/#organization` },
    },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${cormorant.variable} ${dmSans.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA_LD) }}
        />
        {GTM_ID && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
        )}
      </head>
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
