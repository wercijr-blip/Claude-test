import { useState } from 'react'
import { useLocation } from 'wouter'
import { trpc } from '../lib/trpc.ts'

export default function PesquisaSatisfacao() {
  const path = useLocation()[0]
  const parts = path.split('/')
  const pacienteId = parseInt(parts[parts.length - 2] ?? '')
  const token = parts[parts.length - 1] ?? ''

  const [achouFacil, setAchouFacil] = useState<boolean | null>(null)
  const [conseguiuMedicacao, setConseguiuMedicacao] = useState<boolean | null>(null)
  const [indicaria, setIndicaria] = useState<boolean | null>(null)
  const [comentario, setComentario] = useState('')
  const [enviado, setEnviado] = useState(false)

  const statusQuery = trpc.pesquisa.status.useQuery(
    { pacienteId, token },
    { enabled: !isNaN(pacienteId) && token.length > 0, retry: false },
  )

  const submeter = trpc.pesquisa.submeter.useMutation({
    onSuccess: () => setEnviado(true),
  })

  if (isNaN(pacienteId) || !token) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-sm">
          <p className="text-red-500 font-medium">Link de pesquisa inválido.</p>
        </div>
      </div>
    )
  }

  if (enviado || statusQuery.data?.respondido) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Obrigado pelo feedback!</h2>
          <p className="text-slate-500 text-sm">
            Sua resposta foi registrada. Isso nos ajuda a melhorar o atendimento.
          </p>
        </div>
      </div>
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (achouFacil === null || conseguiuMedicacao === null || indicaria === null) return
    submeter.mutate({ pacienteId, token, achouFacil, conseguiuMedicacao, indicaria, comentario: comentario || undefined })
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-blue-700 mb-1">Facilita PrEP</h1>
          <h2 className="text-lg font-semibold text-slate-800">Pesquisa de satisfação</h2>
          <p className="text-slate-500 text-sm mt-1">Sua experiência nos ajuda a melhorar.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <p className="text-sm font-medium text-slate-700 mb-3">Achou o processo de atendimento fácil?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAchouFacil(true)}
                className={`py-3 rounded-xl border-2 text-sm font-medium transition-all ${achouFacil === true ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
              >
                Sim, foi fácil
              </button>
              <button
                type="button"
                onClick={() => setAchouFacil(false)}
                className={`py-3 rounded-xl border-2 text-sm font-medium transition-all ${achouFacil === false ? 'border-red-400 bg-red-50 text-red-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
              >
                Tive dificuldades
              </button>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 mb-3">Já conseguiu pegar a medicação PrEP?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setConseguiuMedicacao(true)}
                className={`py-3 rounded-xl border-2 text-sm font-medium transition-all ${conseguiuMedicacao === true ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
              >
                Sim, já consegui
              </button>
              <button
                type="button"
                onClick={() => setConseguiuMedicacao(false)}
                className={`py-3 rounded-xl border-2 text-sm font-medium transition-all ${conseguiuMedicacao === false ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
              >
                Ainda não
              </button>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 mb-3">Você indicaria o Facilita PrEP para alguém?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIndicaria(true)}
                className={`py-3 rounded-xl border-2 text-sm font-medium transition-all ${indicaria === true ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
              >
                Sim, indicaria
              </button>
              <button
                type="button"
                onClick={() => setIndicaria(false)}
                className={`py-3 rounded-xl border-2 text-sm font-medium transition-all ${indicaria === false ? 'border-red-400 bg-red-50 text-red-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
              >
                Não indicaria
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Comentários (opcional)
            </label>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Conte como foi sua experiência…"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {submeter.error && (
            <p className="text-red-500 text-sm">{submeter.error.message}</p>
          )}

          <button
            type="submit"
            disabled={achouFacil === null || conseguiuMedicacao === null || indicaria === null || submeter.isPending}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50 hover:bg-blue-700 transition-colors"
          >
            {submeter.isPending ? 'Enviando…' : 'Enviar resposta'}
          </button>
        </form>
      </div>
    </div>
  )
}
