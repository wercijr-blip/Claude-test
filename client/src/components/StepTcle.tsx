import { useState } from 'react'
import { trpc } from '../lib/trpc.ts'

interface Props {
  pacienteId: number | null
  onNext: () => void
  onBack: () => void
}

const TCLE_TEXT = `
TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO (TCLE)

Eu, paciente identificado neste formulário, declaro que:

1. Fui informado(a) sobre a PrEP (Profilaxia Pré-Exposição ao HIV) e seus benefícios e riscos.
2. Fui orientado(a) quanto à necessidade de acompanhamento regular e realização de exames periódicos.
3. Estou ciente de que a PrEP não protege contra outras infecções sexualmente transmissíveis.
4. Entendo que devo comunicar ao médico qualquer efeito adverso ou alteração de saúde.
5. Autorizo o armazenamento dos meus dados clínicos conforme a LGPD (Lei 13.709/2018), com retenção por 20 anos conforme resolução CFM 2.218/2018.
6. Consinto com o tratamento proposto e me comprometo a seguir as orientações médicas.

Este documento tem validade legal conforme CFM 2.299/2021 e possui assinatura digital ICP-Brasil.
`.trim()

export default function StepTcle({ pacienteId, onNext, onBack }: Props) {
  const [lido, setLido] = useState(false)
  const [error, setError] = useState('')

  const finalizar = trpc.paciente.finalizar.useMutation({ onSuccess: () => onNext() })
  const salvarAceite = trpc.paciente.salvarTcle.useMutation({
    onSuccess: () => { if (pacienteId) finalizar.mutate({ pacienteId }) },
    onError: (err) => setError(err.message),
  })

  const isPending = salvarAceite.isPending || finalizar.isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!lido) { setError('Confirme que leu e compreendeu o TCLE.'); return }
    if (!pacienteId) return
    salvarAceite.mutate({ pacienteId, aceite: true })
  }

  if (!pacienteId) return null

  return (
    <div>
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Termo de Consentimento (TCLE)</h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-slate-50 rounded-xl p-4 max-h-64 overflow-y-auto border border-slate-200">
            <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{TCLE_TEXT}</pre>
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={lido}
              onChange={(e) => setLido(e.target.checked)}
              className="mt-0.5 rounded"
            />
            <span className="text-sm text-slate-700">
              Li, compreendi e <strong>aceito</strong> o Termo de Consentimento Livre e Esclarecido acima.
              Este aceite tem validade legal e será registrado eletronicamente com data, hora e endereço de IP.
            </span>
          </label>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex justify-between pt-2">
            <button type="button" onClick={onBack} className={btnSecondary}>← Anterior</button>
            <button type="submit" disabled={isPending || !lido} className={btnPrimary}>
              {isPending ? 'Enviando…' : 'Aceitar e finalizar ✓'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


const btnPrimary = 'bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium py-2 px-6 rounded-lg transition-colors'
const btnSecondary = 'text-slate-600 hover:text-slate-800 font-medium py-2 px-4 rounded-lg transition-colors'
