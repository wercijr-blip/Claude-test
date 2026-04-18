import { useState } from 'react'
import { trpc } from '../lib/trpc.ts'
import { Copy, Link, Trash2 } from 'lucide-react'

export default function SecretariaDashboard() {
  const [email, setEmail] = useState('')
  const [tipo, setTipo] = useState<'privado' | 'convenio'>('privado')
  const [convenio, setConvenio] = useState('')
  const [novoToken, setNovoToken] = useState<string | null>(null)

  const { data: tokens, refetch } = trpc.token.listar.useQuery()
  const criar = trpc.token.criar.useMutation({
    onSuccess: (data) => { setNovoToken(data.token); refetch() },
  })
  const revogar = trpc.token.revogar.useMutation({ onSuccess: () => refetch() })

  const linkAcesso = novoToken ? `${window.location.origin}/acesso/${novoToken}` : null

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <h1 className="text-xl font-bold text-blue-700">Dashboard Secretaria — Facilita PrEP</h1>
      </header>

      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Gerar novo token */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-4">Gerar link de acesso</h2>

          <div className="space-y-3">
            <div>
              <label className="block text-sm text-slate-600 mb-1">E-mail do paciente (opcional)</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="paciente@email.com" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-1">Tipo</label>
              <div className="flex gap-3">
                {(['privado', 'convenio'] as const).map((t) => (
                  <label key={t} className={`flex items-center gap-2 border rounded-lg px-4 py-2 cursor-pointer text-sm transition-colors ${tipo === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600'}`}>
                    <input type="radio" value={t} checked={tipo === t} onChange={() => setTipo(t)} className="sr-only" />
                    {t === 'privado' ? 'Particular' : 'Convênio'}
                  </label>
                ))}
              </div>
            </div>

            {tipo === 'convenio' && (
              <div>
                <label className="block text-sm text-slate-600 mb-1">Nome do convênio</label>
                <input value={convenio} onChange={(e) => setConvenio(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            )}

            <button
              onClick={() => criar.mutate({ patientEmail: email || undefined, tipo, convenio: convenio || undefined })}
              disabled={criar.isPending}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              {criar.isPending ? 'Gerando…' : 'Gerar link de acesso'}
            </button>
          </div>

          {linkAcesso && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-sm font-medium text-green-800 mb-2">Link gerado com sucesso!</p>
              <div className="flex items-center gap-2 bg-white border border-green-200 rounded-lg px-3 py-2">
                <Link className="w-4 h-4 text-green-600 flex-shrink-0" />
                <p className="text-xs text-slate-700 truncate flex-1">{linkAcesso}</p>
                <button onClick={() => navigator.clipboard.writeText(linkAcesso)} className="flex-shrink-0">
                  <Copy className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                </button>
              </div>
              <p className="text-xs text-green-600 mt-2">Válido por 7 dias. Envie ao paciente por e-mail ou WhatsApp.</p>
            </div>
          )}
        </div>

        {/* Lista de tokens */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-4">Links gerados</h2>

          {!tokens?.length && <p className="text-sm text-slate-400">Nenhum link gerado ainda.</p>}

          <div className="space-y-2">
            {tokens?.map((t) => (
              <div key={t.id} className="flex items-center justify-between border border-slate-100 rounded-xl p-3">
                <div>
                  <p className="text-sm text-slate-700">{t.patientEmail ?? 'Sem e-mail'}</p>
                  <p className="text-xs text-slate-400">
                    {t.tipo} · Expira {new Date(t.expiresAt).toLocaleDateString('pt-BR')}
                    {t.revokedAt && ' · REVOGADO'}
                    {t.usedAt && ' · Usado'}
                  </p>
                </div>
                {!t.revokedAt && (
                  <button onClick={() => revogar.mutate({ tokenId: t.id })} className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
