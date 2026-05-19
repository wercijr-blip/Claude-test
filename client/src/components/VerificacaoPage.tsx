import { useParams } from 'wouter'
import { trpc } from '../lib/trpc.ts'
import { LogoWordmark } from './Logo.tsx'
import { fmt } from '../lib/format.ts'

export default function VerificacaoPage() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug ?? ''
  const { data, isLoading, error } = trpc.verificacao.consultar.useQuery({ slug })

  return (
    <div className="min-h-screen bg-warm-bg flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-8 max-w-lg w-full">
        <div className="flex justify-center mb-4">
          <LogoWordmark size={40} mode="light" />
        </div>

        <h1 className="text-xl font-semibold text-center text-slate-800 mb-1">
          Verificação de documento
        </h1>
        <p className="text-xs text-slate-500 text-center mb-6">Código: <code className="bg-slate-100 px-1 rounded">{slug}</code></p>

        {isLoading && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-slate-500 text-sm">Verificando…</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
            Erro ao consultar a verificação. Tente novamente em alguns instantes.
          </div>
        )}

        {data && !data.encontrado && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-yellow-800">⚠ Documento não encontrado</p>
            <p className="text-xs text-yellow-700 mt-1 leading-relaxed">
              Este código de verificação não corresponde a nenhum documento emitido pelo Facilita PrEP.
              Se você acredita que é um erro, entre em contato com a clínica.
            </p>
          </div>
        )}

        {data?.encontrado && (
          <>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <p className="text-sm font-semibold text-green-800">✓ Documento autêntico</p>
              <p className="text-xs text-green-700 mt-1 leading-relaxed">
                Este documento foi emitido pelo <strong>Facilita PrEP</strong> e assinado digitalmente em padrão{' '}
                <strong>ICP-Brasil PAdES</strong> (Medida Provisória 2.200-2/2001 · CFM 2.299/2021).
              </p>
            </div>

            <dl className="space-y-3 text-sm">
              <Linha label="Tipo do documento" valor={data.tipo} />
              <Linha
                label="Médico responsável"
                valor={`${data.medicoNome} · ${data.medicoCrm}`}
              />
              {data.dataEmissao && (
                <Linha
                  label="Data de emissão"
                  valor={fmt.datetime(data.dataEmissao)}
                />
              )}
              {data.certificadoSerial && (
                <Linha
                  label="Serial do certificado"
                  valor={<code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{data.certificadoSerial}</code>}
                />
              )}
            </dl>

            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-blue-800 mb-2">🔍 Verificação completa do PDF</p>
              <p className="text-xs text-blue-700 leading-relaxed mb-3">
                Para validar a integridade criptográfica completa do PDF (assinatura ICP-Brasil válida e
                conteúdo não-alterado), faça download do arquivo e suba no validador oficial do ITI:
              </p>
              <a
                href={data.validadorIti}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
              >
                Abrir verificador.iti.gov.br
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>

            <p className="text-[10px] text-slate-400 text-center mt-6 leading-relaxed">
              Por privacidade (LGPD), informações pessoais do paciente não são exibidas publicamente.
              Apenas o paciente e a equipe autorizada têm acesso ao conteúdo do documento.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function Linha({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div className="flex justify-between items-baseline gap-3 border-b border-slate-100 pb-2">
      <dt className="text-xs text-slate-500 shrink-0">{label}</dt>
      <dd className="text-right text-slate-800 font-medium">{valor}</dd>
    </div>
  )
}
