import { LogoWordmark } from "./Logo";

export default function FooterCfm() {
  return (
    <footer className="w-full bg-fp-dark text-slate-300 mt-auto">
      <div className="bg-fp-dark-mid px-4 py-3 text-center">
        <p className="text-sm font-semibold text-white leading-tight">
          Responsável Técnico: Dr. Werciley Saraiva Vieira Júnior
        </p>
        <p className="text-sm text-fp-lilac-soft font-medium">CRM/DF 16381</p>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-6 flex justify-center">
        <LogoWordmark size={36} mode="dark" />
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
        <div className="space-y-1">
          <p className="text-white font-semibold text-sm mb-2">
            Iaso Saúde Hospital Dia
          </p>
          <p>Saraiva e Dornelas Hospital Dia LTDA</p>
          <p>CNPJ: 61.983.778/0001-52</p>
          <p className="mt-2 leading-relaxed text-slate-400">
            SHLS Quadra 716, Conjunto A,
            <br />
            Consultórios 607 e 609, Parte B, S/N — 6º Andar
            <br />
            Asa Sul — Brasília/DF — CEP 70390-700
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-white font-semibold text-sm mb-2">Contato</p>
          {/* WhatsApp — número móvel */}
          <a
            href="https://wa.me/5561994018161?text=Ol%C3%A1%2C%20gostaria%20de%20saber%20mais%20sobre%20a%20PrEP%20pelo%20Facilita%20PrEP"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[#25D366] hover:text-green-400 transition-colors"
          >
            <svg
              className="w-3.5 h-3.5 shrink-0"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            (61) 99401-8161 — WhatsApp
          </a>
          {/* Telefone fixo */}
          <a
            href="tel:+556140427188"
            className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors mt-1"
          >
            <svg
              className="w-3.5 h-3.5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
            (61) 4042-7188 — Fixo
          </a>
          <a
            href="mailto:contato@facilitaprep.com.br"
            className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors mt-1"
          >
            <svg
              className="w-3.5 h-3.5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            contato@facilitaprep.com.br
          </a>
        </div>

        <div className="space-y-1">
          <p className="text-white font-semibold text-sm mb-2">
            Informações regulatórias
          </p>
          <p>Plataforma de telemedicina regulamentada conforme:</p>
          <ul className="text-slate-400 space-y-0.5 mt-1">
            <li>• Resolução CFM nº 2.299/2021</li>
            <li>• Resolução CFM nº 2.314/2022</li>
            <li>• Lei nº 14.510/2022 (Telemedicina)</li>
            <li>• LGPD — Lei nº 13.709/2018</li>
          </ul>
          <p className="text-slate-400 mt-2">
            Documentos assinados digitalmente com
            <br />
            certificado ICP-Brasil conforme ITI/CFM.
          </p>
        </div>
      </div>

      <div className="border-t border-slate-700 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          © {new Date().getFullYear()} Iaso Saúde Hospital Dia — Todos os
          direitos reservados
        </span>
        <div className="flex items-center gap-4 flex-wrap justify-center">
          <a
            href="/privacidade"
            className="text-slate-400 hover:text-white transition-colors"
          >
            Política de Privacidade
          </a>
          <a
            href="/termos"
            className="text-slate-400 hover:text-white transition-colors"
          >
            Termos de Uso
          </a>
          <a
            href="mailto:dpo@facilitaprep.com.br"
            className="text-slate-400 hover:text-white transition-colors"
          >
            DPO / LGPD
          </a>
          <a
            href="/duvidas"
            className="text-slate-400 hover:text-white transition-colors"
          >
            Dúvidas sobre PrEP →
          </a>
        </div>
      </div>
    </footer>
  );
}
