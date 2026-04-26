import { LogoWordmark } from './Logo'

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
          <p className="text-white font-semibold text-sm mb-2">Iaso Saúde Hospital Dia</p>
          <p>Saraiva e Dornelas Hospital Dia LTDA</p>
          <p>CNPJ: 61.983.778/0001-52</p>
          <p className="mt-2 leading-relaxed text-slate-400">
            SHLS Quadra 716, Conjunto A,<br />
            Consultórios 607 e 609, Parte B, S/N — 6º Andar<br />
            Asa Sul — Brasília/DF — CEP 70390-700
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-white font-semibold text-sm mb-2">Contato</p>
          <a
            href="tel:+556140427188"
            className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            (61) 4042-7188
          </a>
          <a
            href="mailto:contato@atossaudeintegrada.com.br"
            className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors mt-1"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            contato@atossaudeintegrada.com.br
          </a>
        </div>

        <div className="space-y-1">
          <p className="text-white font-semibold text-sm mb-2">Informações regulatórias</p>
          <p>Plataforma de telemedicina regulamentada conforme:</p>
          <ul className="text-slate-400 space-y-0.5 mt-1">
            <li>• Resolução CFM nº 2.299/2021</li>
            <li>• Resolução CFM nº 2.314/2022</li>
            <li>• Lei nº 14.510/2022 (Telemedicina)</li>
            <li>• LGPD — Lei nº 13.709/2018</li>
          </ul>
          <p className="text-slate-400 mt-2">
            Documentos assinados digitalmente com<br />
            certificado ICP-Brasil conforme ITI/CFM.
          </p>
        </div>
      </div>

      <div className="border-t border-slate-700 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
        <span>© {new Date().getFullYear()} Iaso Saúde Hospital Dia — Todos os direitos reservados</span>
        <a href="/duvidas" className="text-slate-400 hover:text-white transition-colors">
          Dúvidas sobre PrEP →
        </a>
      </div>
    </footer>
  )
}
