import { useState } from 'react'
import { trpc } from '../lib/trpc.ts'
import { LogoWordmark } from './Logo.tsx'

function maskCpf(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

export default function ReenviarAcesso() {
  const [cpf, setCpf] = useState('')
  const [enviado, setEnviado] = useState(false)
  const mutation = trpc.intake.solicitarReenvioLink.useMutation({
    onSuccess: () => setEnviado(true),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const digits = cpf.replace(/\D/g, '')
    if (digits.length !== 11) return
    mutation.mutate({ cpf: digits })
  }

  return (
    <div className="min-h-screen bg-warm-bg py-10 px-4">
      <div className="max-w-md mx-auto">
        <div className="flex justify-center mb-8">
          <LogoWordmark size={40} mode="light" />
        </div>
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
          {enviado ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">Solicitação recebida</h2>
              <p className="text-slate-500 text-sm leading-relaxed">
                Se o CPF informado estiver cadastrado com atendimento ativo, enviaremos um novo link por e-mail e WhatsApp em instantes.
              </p>
              <a href="/inicio" className="inline-block mt-6 text-brand text-sm font-medium hover:underline">
                Já tenho o link → acessar
              </a>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-brand-light rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-slate-800">Reenviar link de acesso</h2>
                <p className="text-slate-400 text-sm mt-1">
                  Informe seu CPF e reenviaremos o link para o e-mail e WhatsApp cadastrados.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="cpf-reenvio" className="block text-sm font-medium text-slate-700 mb-1">
                    CPF
                  </label>
                  <input
                    id="cpf-reenvio"
                    type="text"
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => setCpf(maskCpf(e.target.value))}
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                    maxLength={14}
                    required
                  />
                </div>

                {mutation.error && (
                  <p className="text-red-600 text-sm">Ocorreu um erro. Tente novamente.</p>
                )}

                <button
                  type="submit"
                  disabled={mutation.isPending || cpf.replace(/\D/g, '').length !== 11}
                  className="w-full bg-brand hover:bg-brand-dark disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  {mutation.isPending ? 'Enviando…' : 'Reenviar meu link'}
                </button>
              </form>

              <p className="text-center text-slate-400 text-xs mt-6">
                Dúvidas?{' '}
                <a href="mailto:contato@facilitaprep.com.br" className="text-brand hover:underline">
                  contato@facilitaprep.com.br
                </a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
