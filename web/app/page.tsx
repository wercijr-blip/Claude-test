import type { Metadata } from 'next'
import IntakePage from '@web/components/IntakePage'

export const metadata: Metadata = {
  title: 'Facilita PrEP — Prevenção do HIV com PrEP',
  description:
    'Plataforma digital para acesso à PrEP. Receita com assinatura ICP-Brasil, 100% online, sigiloso e rápido.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Facilita PrEP — Prevenção do HIV com PrEP',
    description:
      'Acesse a PrEP de forma rápida, sigilosa e 100% digital. Receita com assinatura ICP-Brasil, sem sair de casa.',
    url: '/',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Facilita PrEP — Prevenção do HIV com PrEP',
      },
    ],
  },
}

export default function HomePage() {
  return <IntakePage />
}
