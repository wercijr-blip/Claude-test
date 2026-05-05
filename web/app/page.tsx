import type { Metadata } from 'next'
import LandingPage from '@web/components/LandingPage'

export const metadata: Metadata = {
  title: 'Consulta PrEP Online | Médico Infectologista | Facilita PrEP',
  description:
    'Consulta online com infectologista para PrEP. Receita digital ICP-Brasil em até 48h. Sigiloso, sem deslocamento, atendimento em todo o Brasil. CRM-DF 16381.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Facilita PrEP — Consulta com Infectologista Online',
    description:
      'Sua proteção contra o HIV, sem fila e sem burocracia. Receita digital em até 48h.',
    url: '/',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Facilita PrEP — Teleconsulta com Infectologista',
      },
    ],
  },
}

export default function HomePage() {
  return <LandingPage />
}
