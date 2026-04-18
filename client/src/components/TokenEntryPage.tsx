import { useState } from 'react'
import { useLocation } from 'wouter'
import { trpc } from '../lib/trpc.ts'
import { useAuth } from '../_core/hooks/useAuth.ts'

export default function TokenEntryPage() {
  const params = new URLSearchParams(window.location.search)
  const tokenFromUrl = useLocation()[0].split('/acesso/')[1] ?? params.get('token') ?? ''

  const [token, setToken] = useState(tokenFromUrl)
  const [error, setError] = useState('')
  const { setToken: saveSession } = useAuth()
  const [, navigate] = useLocation()

  const validar = trpc.token.validar.useMutation({
    onSuccess: (data) => {
      saveSession(data.sessionToken)
      // Redireciona para a segunda parte (validação de exame) antes do formulário clínico
      navigate('/inicio')
    },
    onError: (err) => setError(err.message),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    validar.mutate({ token: token.trim() })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-blue-700 mb-1">Facilita PrEP</h1>
        <p className="text-slate-500 text-sm mb-6">
          Informe o código de acesso enviado para o seu e-mail.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Código de acesso
            </label>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Cole aqui o código recebido por e-mail"
              required
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={validar.isPending}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
          >
            {validar.isPending ? 'Verificando…' : 'Acessar formulário'}
          </button>
        </form>
      </div>
    </div>
  )
}
