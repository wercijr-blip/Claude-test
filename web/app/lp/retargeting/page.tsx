import type { Metadata } from "next";
import LandingPage from "@web/components/LandingPage";

export const metadata: Metadata = {
  title: "Suas Vagas Ainda Estão Abertas | Facilita PrEP",
  description:
    "Você já conhece a Facilita PrEP. Agende agora sua consulta com infectologista. Receita em até 48h.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://facilitaprep.com.br" },
};

export default function RetargetingLP() {
  return <LandingPage variant="retargeting" />;
}
