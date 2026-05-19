import type { Metadata } from "next";
import LandingPage from "@web/components/LandingPage";

export const metadata: Metadata = {
  title: "Proteção Preventiva ao HIV Online | Facilita PrEP",
  description:
    "Saúde sexual preventiva com acompanhamento médico especializado. Consulta online, discreta, rápida. Receita digital válida em todo o Brasil.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://facilitaprep.com.br" },
};

export default function MetaLP() {
  return <LandingPage variant="meta" />;
}
