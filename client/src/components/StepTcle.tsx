import { useState } from 'react'
import { trpc } from '../lib/trpc.ts'
import SignaturePad from './SignaturePad.tsx'
import ExameUpload from './ExameUpload.tsx'

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
  const [assinatura, setAssinatura] = useState<string | null>(null)
  const [lido, setLido] = useState(false)
  const [error, setError] = useState('')

  const salvarTcle = trpc.paciente.finalizar.useMutation({ onSuccess: () => onNext() })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!lido) { setError('Confirme que leu e compreendeu o TCLE.'); return }
    if (!assinatura) { setError('A assinatura é obrigatória.'); return }
    if (!pacienteId) return

    // Salvar assinatura via fetch direto (fora do tRPC para enviar o dataUrl)
    fetch('/api/tcle/assinar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('fp_token')}` },
      body: JSON.stringify({ pacienteId, assinaturaDataUrl: assinatura }),
    })
      .then((r) => { if (!r.ok) throw new Error('Erro ao salvar assinatura') })
      .then(() => salvarTcle.mutate({ pacienteId }))
      .catch((err: Error) => setError(err.message))
  }

  if (!pacienteId) return null

  return (
    <div className="space-y-6">
      {/* Upload de exames */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Upload de Exames</h2>
        <p className="text-sm text-slate-500 mb-4">Envie os resultados dos exames solicitados (HIV, Hepatite B/C, Sífilis, Creatinina).</p>
        <ExameUpload pacienteId={pacienteId} />
      </div>

      {/* TCLE */}
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
              Li e compreendi o Termo de Consentimento Livre e Esclarecido acima e concordo com seus termos.
            </span>
          </label>

          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Assinatura digital</p>
            <SignaturePad onChange={setAssinatura} />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex justify-between pt-2">
            <button type="button" onClick={onBack} className={btnSecondary}>← Anterior</button>
            <button type="submit" disabled={salvarTcle.isPending || !lido || !assinatura} className={btnPrimary}>
              {salvarTcle.isPending ? 'Enviando…' : 'Finalizar e enviar ✓'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const btnPrimary = 'bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium py-2 px-6 rounded-lg transition-colors'
const btnSecondary = 'text-slate-600 hover:text-slate-800 font-medium py-2 px-4 rounded-lg transition-colors'
