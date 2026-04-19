export default function FooterCfm() {
  return (
    <footer className="w-full bg-slate-800 text-slate-300 mt-auto">
      {/* Faixa de destaque do RT */}
      <div className="bg-blue-900 px-4 py-3 text-center">
        <p className="text-sm font-semibold text-white leading-tight">
          Responsável Técnico: Dr. Werciley Saraiva Vieira Júnior
        </p>
        <p className="text-sm text-blue-200 font-medium">CRM/DF 16381</p>
      </div>

      {/* Informações institucionais */}
      <div className="max-w-4xl mx-auto px-4 py-6 grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
        {/* Dados da empresa */}
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

        {/* Compliance CFM */}
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

      {/* Linha inferior */}
      <div className="border-t border-slate-700 px-4 py-3 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Iaso Saúde Hospital Dia — Todos os direitos reservados
      </div>
    </footer>
  )
}
