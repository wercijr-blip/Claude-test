import { useState } from 'react'
import { useLocation } from 'wouter'
import { trpc } from '../lib/trpc.ts'

export default function ChangePassword() {
  const [, setLocation]        = useLocation()
  const [current, setCurrent]  = useState('')
  const [newPass, setNewPass]  = useState('')
  const [confirm, setConfirm]  = useState('')
  const [error, setError]      = useState('')
  const [success, setSuccess]  = useState(false)

  const utils = trpc.useUtils()

  const changeMutation = trpc.auth.changePassword.useMutation({
    async onSuccess() {
      setSuccess(true)
      await utils.auth.me.invalidate()
      setTimeout(() => setLocation('/dashboard'), 1500)
    },
    onError(err) {
      setError(err.message || 'Erro ao alterar senha')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (newPass.length < 8) {
      setError('A senha deve ter no mínimo 8 caracteres')
      return
    }
    if (newPass !== confirm) {
      setError('As senhas não coincidem')
      return
    }
    changeMutation.mutate({ currentPassword: current, newPassword: newPass })
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-800">Redefina sua senha</h1>
          <p className="text-slate-500 text-sm mt-1">Por segurança, crie uma nova senha antes de continuar</p>
        </div>

        {success ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700 text-center">
            Senha alterada com sucesso! Redirecionando…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Senha atual</label>
              <input
                type="password"
                required
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Senha temporária recebida por email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nova senha</label>
              <input
                type="password"
                required
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Mínimo 8 caracteres"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar nova senha</label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Repita a nova senha"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={changeMutation.isPending}
              className="w-full bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {changeMutation.isPending ? 'Salvando…' : 'Salvar nova senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
