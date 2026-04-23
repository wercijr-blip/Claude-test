import { useState } from 'react'
import { trpc } from '../lib/trpc.ts'

export default function Perfil() {
  const meQuery = trpc.auth.me.useQuery()
  const me      = meQuery.data

  const [bulletinEmail, setBulletinEmail] = useState('')
  const [saved, setSaved]                 = useState(false)
  const [error, setError]                 = useState('')

  const updateMutation = trpc.user.updateBulletinEmail.useMutation({
    onSuccess() {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
    onError(err) {
      setError(err.message)
    },
  })

  if (meQuery.isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-slate-400">Carregando…</p></div>
  }

  if (!me) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-slate-500">Não autenticado</p></div>
  }

  const emailBoletim = bulletinEmail !== '' ? bulletinEmail : (me.bulletinEmail ?? '')

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-slate-800 mb-6">Meu Perfil</h1>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-xl">
              {me.name?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-lg">{me.name ?? '—'}</p>
              <p className="text-slate-500 text-sm">{me.role === 'admin' ? 'Administrador' : 'Médico'}</p>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Campos somente leitura */}
          <Field label="Email de login" value={me.email} />
          <Field label="CRM"           value={me.crm ?? '—'} />
          <Field label="Especialidade" value={me.specialty ?? '—'} />

          <hr className="border-slate-100" />

          {/* Email do boletim (editável) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email para boletim mensal
              <span className="ml-1 text-slate-400 text-xs">(opcional)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={emailBoletim}
                onChange={(e) => { setBulletinEmail(e.target.value); setSaved(false) }}
                placeholder="outro@email.com"
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => {
                  setError('')
                  updateMutation.mutate({ bulletinEmail: emailBoletim })
                }}
                disabled={updateMutation.isPending}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {updateMutation.isPending ? '…' : 'Salvar'}
              </button>
            </div>
            {saved  && <p className="text-green-600 text-xs mt-1">Email salvo com sucesso!</p>}
            {error  && <p className="text-red-600  text-xs mt-1">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-slate-800">{value}</p>
    </div>
  )
}
