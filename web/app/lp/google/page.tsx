import type { Metadata } from 'next'
import LandingPage from '@web/components/LandingPage'

export const metadata: Metadata = {
  title: 'Consulta PrEP Online Agora | Infectologista | Facilita PrEP',
  description:
    'Buscando PrEP online? Consulta com infectologista credenciado. Receita digital ICP-Brasil em até 48h. Sem fila, sem deslocamento.',
  robots: { index: false, follow: false },
  alternates: { canonical: 'https://facilitaprep.com.br' },
}

export default function GoogleLP() {
  return <LandingPage variant="google" />
}
