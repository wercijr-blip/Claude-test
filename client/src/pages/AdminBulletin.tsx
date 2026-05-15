import { useState, useEffect } from 'react'
import { useLocation } from 'wouter'
import { trpc } from '../lib/trpc.ts'
import DashboardLayout from '../components/DashboardLayout.tsx'

export default function AdminBulletin() {
  const [, setLocation] = useLocation()
  const meQuery = trpc.auth.me.useQuery()
  const me      = meQuery.data
  const isAdmin = me?.role === 'admin'

  const doctorsQuery = trpc.admin.bulletin.getDoctors.useQuery(undefined, { enabled: isAdmin })
  const historyQuery = trpc.admin.bulletin.getHistory.useQuery(undefined, { enabled: isAdmin })
  const doctors      = doctorsQuery.data ?? []
  const history      = historyQuery.data ?? []
  const utils        = trpc.useUtils()

  const updateBulletin = trpc.user.updateBulletinPreference.useMutation({
    onSuccess: () => utils.admin.bulletin.getDoctors.invalidate(),
  })
  const updateEmail = trpc.user.setBulletinEmail.useMutation({
    onSuccess: () => utils.admin.bulletin.getDoctors.invalidate(),
  })
  const resend = trpc.admin.bulletin.resend.useMutation({
    onSuccess: () => utils.admin.bulletin.getHistory.invalidate(),
  })

  const [inlineEmails, setInlineEmails] = useState<Record<number, string>>({})

  useEffect(() => {
    if (me && !isAdmin) setLocation('/dashboard')
  }, [me, isAdmin, setLocation])

  if (meQuery.isLoading) return <div className="min-h-screen flex items-center justify-center"><p className="text-slate-400">Carregando…</p></div>
  if (!me || !isAdmin) return null

  return (
    <DashboardLayout>
      <div className="p-6 space-y-8">
        <h1 className="text-2xl font-bold text-slate-800">Gestão de Boletins</h1>

        {/* Seção 1 — Status dos médicos */}
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-700">Status por Médico</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-slate-400">
                <th className="px-6 py-3 font-medium">Nome</th>
                <th className="px-6 py-3 font-medium">Especialidade</th>
                <th className="px-6 py-3 font-medium">Boletim</th>
                <th className="px-6 py-3 font-medium">Email boletim</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {doctors.map((d: {
                id: number; name: string | null; specialty: string | null;
                receiveMonthlyBulletin: number; bulletinEmail: string | null;
              }) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 font-medium text-slate-800">{d.name ?? '—'}</td>
                  <td className="px-6 py-3 text-slate-500">{d.specialty ?? '—'}</td>
                  <td className="px-6 py-3">
                    <button
                      onClick={() => updateBulletin.mutate({ id: d.id, receive: !d.receiveMonthlyBulletin })}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                        d.receiveMonthlyBulletin
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {d.receiveMonthlyBulletin ? '✅ ativo' : '❌ inativo'}
                    </button>
                  </td>
                  <td className="px-6 py-3">
                    {d.bulletinEmail ? (
                      <span className="text-slate-600 text-sm">{d.bulletinEmail}</span>
                    ) : (
                      <div className="flex gap-2 items-center">
                        <span className="text-amber-500 text-xs">⚠️ sem email</span>
                        <input
                          type="email"
                          placeholder="email@medico.com"
                          value={inlineEmails[d.id] ?? ''}
                          onChange={(e) => setInlineEmails((prev) => ({ ...prev, [d.id]: e.target.value }))}
                          className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-44"
                        />
                        <button
                          onClick={() => {
                            const email = inlineEmails[d.id]
                            if (email) updateEmail.mutate({ id: d.id, bulletinEmail: email })
                          }}
                          className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                        >
                          Salvar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!doctors.length && (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400">Nenhum médico cadastrado</td></tr>
              )}
            </tbody>
          </table>
        </section>

        {/* Seção 2 — Histórico de envios */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-700 mb-4">Histórico de Envios</h2>
          {history.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="pb-2 font-medium">Mês</th>
                  <th className="pb-2 font-medium">Médicos</th>
                  <th className="pb-2 font-medium">Artigos</th>
                  <th className="pb-2 font-medium">Enviado em</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2">{h.month}</td>
                    <td className="py-2">{h.doctorCount}</td>
                    <td className="py-2">{h.articleCount}</td>
                    <td className="py-2 text-slate-500">
                      {new Date(h.createdAt).toLocaleDateString('pt-BR')}
                      {h.resentAt && (
                        <span className="ml-2 text-xs text-blue-500">
                          (reenviado {new Date(h.resentAt).toLocaleDateString('pt-BR')})
                        </span>
                      )}
                    </td>
                    <td className="py-2">
                      <button
                        onClick={() => resend.mutate({ id: h.id })}
                        disabled={resend.isPending}
                        className="text-xs text-blue-600 hover:underline disabled:opacity-40"
                      >
                        Reenviar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-slate-400 text-sm text-center py-6">Nenhum boletim enviado ainda</p>
          )}
        </section>

        {/* Seção 3 — Emails pendentes */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-700 mb-4">Emails Pendentes</h2>
          {doctors.filter((d: { bulletinEmail: string | null }) => !d.bulletinEmail).length === 0 ? (
            <p className="text-green-600 text-sm">Todos os médicos têm email de boletim configurado.</p>
          ) : (
            <div className="space-y-3">
              {doctors
                .filter((d: { bulletinEmail: string | null }) => !d.bulletinEmail)
                .map((d: { id: number; name: string | null }) => (
                  <div key={d.id} className="flex items-center gap-3">
                    <span className="text-sm text-slate-700 w-40">{d.name ?? '—'}</span>
                    <input
                      type="email"
                      placeholder="email@medico.com"
                      value={inlineEmails[d.id] ?? ''}
                      onChange={(e) => setInlineEmails((prev) => ({ ...prev, [d.id]: e.target.value }))}
                      className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
                    />
                    <button
                      onClick={() => {
                        const email = inlineEmails[d.id]
                        if (email) updateEmail.mutate({ id: d.id, bulletinEmail: email })
                      }}
                      className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700"
                    >
                      Salvar
                    </button>
                  </div>
                ))}
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  )
}
