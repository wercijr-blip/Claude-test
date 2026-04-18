import { trpc } from '../lib/trpc.ts'

export default function AuditDashboard() {
  const { data: eventos } = trpc.admin.listarEventos.useQuery({ limit: 100 })
  const { data: usuarios } = trpc.admin.listarUsuarios.useQuery()

  const alterarRole = trpc.admin.alterarRole.useMutation()
  const toggleAtivo = trpc.admin.toggleAtivo.useMutation()

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <h1 className="text-xl font-bold text-blue-700">Painel Admin — Facilita PrEP</h1>
      </header>

      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Equipe */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-4">Gerenciar Equipe</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                  <th className="pb-2 pr-4">Nome</th>
                  <th className="pb-2 pr-4">E-mail</th>
                  <th className="pb-2 pr-4">Role</th>
                  <th className="pb-2">Ativo</th>
                </tr>
              </thead>
              <tbody>
                {usuarios?.map((u) => (
                  <tr key={u.id} className="border-b border-slate-50">
                    <td className="py-3 pr-4 text-slate-700">{u.nome ?? '—'}</td>
                    <td className="py-3 pr-4 text-slate-500">{u.email ?? '—'}</td>
                    <td className="py-3 pr-4">
                      <select
                        value={u.role}
                        onChange={(e) => alterarRole.mutate({ userId: u.id, role: e.target.value as 'secretaria' | 'medico' | 'admin' })}
                        className="border border-slate-200 rounded px-2 py-1 text-xs"
                      >
                        <option value="secretaria">Secretaria</option>
                        <option value="medico">Médico</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="py-3">
                      <button
                        onClick={() => toggleAtivo.mutate({ userId: u.id, ativo: !u.ativo })}
                        className={`text-xs px-2 py-1 rounded-full font-medium ${u.ativo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}
                      >
                        {u.ativo ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Log de segurança */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-4">Log de Segurança</h2>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {eventos?.map((e) => (
              <div key={e.id} className="flex items-start gap-3 text-xs py-2 border-b border-slate-50">
                <span className="text-slate-400 whitespace-nowrap">
                  {new Date(e.createdAt).toLocaleString('pt-BR')}
                </span>
                <span className={`font-medium ${e.tipoEvento.includes('fail') || e.tipoEvento.includes('invalid') || e.tipoEvento.includes('block') ? 'text-red-600' : 'text-slate-700'}`}>
                  {e.tipoEvento}
                </span>
                <span className="text-slate-400">{e.ipAddress}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
