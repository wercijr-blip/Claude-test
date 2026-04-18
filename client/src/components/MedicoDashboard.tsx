import { useState } from 'react'
import { trpc } from '../lib/trpc.ts'
import { PACIENTE_STATUS } from '@shared/const.ts'

export default function MedicoDashboard() {
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const { data: pendentes, refetch } = trpc.medico.listarPendentes.useQuery()
  const { data: paciente } = trpc.medico.verPaciente.useQuery(
    { pacienteId: selectedId! },
    { enabled: !!selectedId },
  )

  const aprovar = trpc.medico.aprovar.useMutation({ onSuccess: () => { setSelectedId(null); refetch() } })
  const rejeitar = trpc.medico.rejeitar.useMutation({ onSuccess: () => { setSelectedId(null); refetch() } })

  const [obs, setObs] = useState('')
  const [motivoRejeicao, setMotivoRejeicao] = useState('')

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <h1 className="text-xl font-bold text-blue-700">Dashboard Médico — Facilita PrEP</h1>
      </header>

      <div className="flex h-[calc(100vh-65px)]">
        {/* Lista */}
        <aside className="w-80 border-r border-slate-200 bg-white overflow-y-auto">
          <div className="p-4 border-b border-slate-100">
            <p className="text-sm font-medium text-slate-700">
              {pendentes?.length ?? 0} paciente(s) pendente(s)
            </p>
          </div>
          {pendentes?.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={`w-full text-left p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors ${selectedId === p.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`}
            >
              <p className="font-medium text-slate-800 text-sm">{p.nome}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {new Date(p.createdAt).toLocaleDateString('pt-BR')} · {p.tipoAtendimento}
              </p>
              <StatusBadge status={p.status} />
            </button>
          ))}
        </aside>

        {/* Detalhe */}
        <main className="flex-1 overflow-y-auto p-6">
          {!selectedId && (
            <div className="flex items-center justify-center h-full text-slate-400">
              Selecione um paciente para revisar
            </div>
          )}

          {paciente && (
            <div className="max-w-2xl space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-4">{paciente.nome}</h2>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <Item label="CPF" value={paciente.cpf} />
                  <Item label="Data de nascimento" value={paciente.dataNascimento} />
                  <Item label="Sexo" value={paciente.sexo} />
                  <Item label="E-mail" value={paciente.email} />
                  <Item label="Telefone" value={paciente.telefone} />
                  <Item label="Cidade/UF" value={`${paciente.cidade ?? ''}/${paciente.estado ?? ''}`} />
                  <Item label="Tipo de atendimento" value={paciente.tipoAtendimento} />
                  <Item label="Status" value={paciente.status} />
                </dl>
              </div>

              {Boolean(paciente.condutaJson) && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                  <h3 className="font-medium text-slate-700 mb-3">Conduta clínica</h3>
                  <pre className="text-xs text-slate-600 whitespace-pre-wrap bg-slate-50 rounded-lg p-3">
                    {JSON.stringify(paciente.condutaJson, null, 2)}
                  </pre>
                </div>
              )}

              {/* Exames */}
              {(paciente.exames?.length ?? 0) > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                  <h3 className="font-medium text-slate-700 mb-3">Exames enviados</h3>
                  <div className="space-y-2">
                    {paciente.exames?.map((e) => (
                      <div key={e.id} className="flex items-center justify-between text-sm border border-slate-100 rounded-lg p-3">
                        <span>{e.nomeArquivo}</span>
                        <a href={`/api/exame/${e.id}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs">
                          Ver
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ações */}
              {paciente.status !== PACIENTE_STATUS.APROVADO && paciente.status !== PACIENTE_STATUS.REJEITADO && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                  <h3 className="font-medium text-slate-700">Decisão médica</h3>

                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Observações (aprovação)</label>
                    <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Orientações ao paciente…" />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Motivo (rejeição)</label>
                    <textarea value={motivoRejeicao} onChange={(e) => setMotivoRejeicao(e.target.value)} rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Motivo detalhado da rejeição…" />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => aprovar.mutate({ pacienteId: paciente.id, observacoes: obs })}
                      disabled={aprovar.isPending}
                      className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition-colors"
                    >
                      ✓ Aprovar
                    </button>
                    <button
                      onClick={() => rejeitar.mutate({ pacienteId: paciente.id, motivo: motivoRejeicao })}
                      disabled={rejeitar.isPending || motivoRejeicao.length < 10}
                      className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition-colors"
                    >
                      ✗ Rejeitar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function Item({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="text-slate-700">{value ?? '—'}</dd>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    rascunho: 'bg-slate-100 text-slate-500',
    pendente: 'bg-yellow-100 text-yellow-700',
    em_revisao: 'bg-blue-100 text-blue-700',
    aprovado: 'bg-green-100 text-green-700',
    rejeitado: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium ${colors[status] ?? 'bg-slate-100 text-slate-500'}`}>
      {status}
    </span>
  )
}
