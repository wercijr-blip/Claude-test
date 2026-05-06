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

const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN ?? 'https://www.facilitaprep.com.br'

export const metadata: Metadata = {
  metadataBase: new URL(DOMAIN),
  title: {
    template: '%s | Facilita PrEP',
    default: 'Consulta PrEP Online | Médico Infectologista | Facilita PrEP',
  },
  description:
    'Consulta online com infectologista para PrEP. Receita digital ICP-Brasil em até 48h. Sigiloso, sem deslocamento, atendimento em todo o Brasil. CRM-DF 16381.',
  themeColor: '#6b46c1',
  appleWebApp: { title: 'Facilita PrEP' },
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
    title: 'Facilita PrEP — Consulta médica online para PrEP com receita digital',
    description:
      'Acesso rápido, sigiloso e 100% digital à PrEP. Cadastro, formulário clínico e receita assinada com ICP-Brasil — tudo sem sair de casa.',
    images: [
      {
        url: `${DOMAIN}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'Facilita PrEP — Sua saúde em boas mãos',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Facilita PrEP — Acesso digital à PrEP',
    description: 'Cadastro, consulta e receita digital à PrEP, sem sair de casa.',
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
        {/* GTM script — afterInteractive para não bloquear LCP */}
        {GTM_ID && (
          <Script
            id="gtm-script"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`,
            }}
          />
        )}
        {/* Meta Pixel — afterInteractive para não bloquear LCP */}
        {META_PIXEL_ID && (
          <Script
            id="meta-pixel"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META_PIXEL_ID}');fbq('track','PageView');`,
            }}
          />
        )}
      </body>
    </html>
  )
}
