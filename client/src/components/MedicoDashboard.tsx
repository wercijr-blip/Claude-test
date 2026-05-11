import { useState } from 'react'
import type { ReactNode } from 'react'
import { trpc } from '../lib/trpc.ts'
import { useAuth } from '../_core/hooks/useAuth.ts'
import { PACIENTE_STATUS } from '@shared/const.ts'

type Tab = 'pacientes' | 'exames_inicio' | 'exames_rejeitados'
type Acao = 'aprovar' | 'recusar' | 'solicitar_reenvio' | 'recomendar_consulta' | 'encaminhar_especialista' | 'solicitar_confirmacao'

interface ResultadoIa {
  nomeExame: string | null
  resultadoHiv: string | null
  dataExame: string | null
  confianca: number
}

export default function MedicoDashboard() {
  const { logout } = useAuth()
  const [tab, setTab] = useState<Tab>('pacientes')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const { data: pendentes, refetch } = trpc.medico.listarPendentes.useQuery()
  const { data: paciente } = trpc.medico.verPaciente.useQuery(
    { pacienteId: selectedId! },
    { enabled: !!selectedId },
  )
  const { data: examesRejeitados, refetch: refetchExames } = trpc.medico.listarExamesRejeitadosIa.useQuery()
  const { data: revisoes } = trpc.consulta.medico.listarRevisoes.useQuery()

  const aprovar = trpc.medico.aprovar.useMutation({ onSuccess: () => { setSelectedId(null); refetch() } })
  const rejeitar = trpc.medico.rejeitar.useMutation({ onSuccess: () => { setSelectedId(null); refetch() } })
  const liberarExame = trpc.medico.liberarExameSemValidacao.useMutation({ onSuccess: () => refetchExames() })

  const [obs, setObs] = useState('')
  const [motivoRejeicao, setMotivoRejeicao] = useState('')
  const [obsExame, setObsExame] = useState<Record<number, string>>({})

  const urgentesCount = revisoes?.filter(r => r.urgente).length ?? 0
  const totalRevisoesCount = revisoes?.length ?? 0

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-blue-700">Dashboard Médico — Facilita PrEP</h1>
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              <TabButton active={tab === 'pacientes'} onClick={() => setTab('pacientes')}>
                Pacientes pendentes
                {(pendentes?.length ?? 0) > 0 && (
                  <span className="ml-1.5 bg-yellow-100 text-yellow-700 text-xs px-1.5 py-0.5 rounded-full font-medium">
                    {pendentes?.length}
                  </span>
                )}
              </TabButton>

              <TabButton active={tab === 'exames_inicio'} onClick={() => setTab('exames_inicio')}>
                Exames início (PrEP)
                {urgentesCount > 0 && (
                  <span className="ml-1.5 bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-full font-medium">
                    {urgentesCount}
                  </span>
                )}
                {totalRevisoesCount > urgentesCount && (
                  <span className="ml-1 bg-yellow-100 text-yellow-700 text-xs px-1.5 py-0.5 rounded-full font-medium">
                    {totalRevisoesCount - urgentesCount}
                  </span>
                )}
              </TabButton>

              <TabButton active={tab === 'exames_rejeitados'} onClick={() => setTab('exames_rejeitados')}>
                Exames rejeitados pela IA
                {(examesRejeitados?.length ?? 0) > 0 && (
                  <span className="ml-1.5 bg-red-100 text-red-700 text-xs px-1.5 py-0.5 rounded-full font-medium">
                    {examesRejeitados?.length}
                  </span>
                )}
              </TabButton>
            </div>
            <div className="w-px h-6 bg-slate-200" />
            <button
              data-event="logout"
              onClick={() => { if (confirm('Deseja realmente sair?')) { logout(); window.location.href = '/' } }}
              className="text-sm text-slate-600 hover:text-red-600 font-medium px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5"
              aria-label="Sair"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* Pacientes pendentes */}
      {tab === 'pacientes' && (
        <div className="flex h-[calc(100vh-65px)]">
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
      )}

      {/* Exames início */}
      {tab === 'exames_inicio' && <ExamesInicioTab revisoes={revisoes} />}

      {/* Exames rejeitados pela IA */}
      {tab === 'exames_rejeitados' && (
        <div className="max-w-4xl mx-auto p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            Estes exames foram <strong>rejeitados automaticamente pela IA</strong>. Revise cada um e, se considerar adequado, libere manualmente com uma justificativa.
          </div>

          {!examesRejeitados?.length && (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400">
              Nenhum exame aguardando liberação manual.
            </div>
          )}

          {examesRejeitados?.map((exame) => {
            const ia = exame.resultadoIa as { status?: string; motivo?: string; observacoes?: string } | null
            const jaLiberado = ia?.status === 'liberado_manualmente'
            return (
              <div key={exame.id} className={`bg-white rounded-2xl border p-6 space-y-4 ${jaLiberado ? 'border-green-200 opacity-70' : 'border-slate-200'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-slate-800">{exame.nomeArquivo}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Paciente #{exame.pacienteId} · {exame.tipoExame ?? 'tipo não identificado'} · {new Date(exame.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  {jaLiberado ? (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">Liberado manualmente</span>
                  ) : (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">Rejeitado pela IA</span>
                  )}
                </div>

                {ia?.motivo && (
                  <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
                    <span className="font-medium text-slate-700">Motivo da rejeição: </span>{ia.motivo}
                  </p>
                )}

                {!jaLiberado && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Justificativa para liberação (opcional)</label>
                      <textarea
                        value={obsExame[exame.id] ?? ''}
                        onChange={(e) => setObsExame((prev) => ({ ...prev, [exame.id]: e.target.value }))}
                        rows={2}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                        placeholder="Ex: Exame legível, resultado negativo confirmado visualmente…"
                      />
                    </div>
                    <button
                      onClick={() => liberarExame.mutate({ exameId: exame.id, observacoes: obsExame[exame.id] })}
                      disabled={liberarExame.isPending}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
                    >
                      Liberar manualmente
                    </button>
                  </div>
                )}

                {jaLiberado && exame.liberadoEm && (
                  <p className="text-xs text-green-600">
                    Liberado em {new Date(exame.liberadoEm).toLocaleString('pt-BR')}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ExamesInicioTab({ revisoes }: { revisoes: Array<any> | undefined }) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [acao, setAcao] = useState<Acao | null>(null)
  const [comentario, setComentario] = useState('')
  const [resultadoHivManual, setResultadoHivManual] = useState<'reagente' | 'nao_reagente' | ''>('')
  const [dataExameManual, setDataExameManual] = useState('')

  const validarMut = trpc.consulta.medico.validar.useMutation()

  const selecionada = revisoes?.find(r => r.id === selectedId)
  const ia = selecionada?.resultadoIa as ResultadoIa | null

  const urgentes = revisoes?.filter(r => r.urgente) ?? []
  const normais = revisoes?.filter(r => !r.urgente) ?? []
  const ordenadas = [...urgentes, ...normais]

  const podeSubmeter = !!acao && comentario.trim().length >= 10

  function submeter() {
    if (!acao || !selectedId || !podeSubmeter) return
    validarMut.mutate(
      {
        consultaId: selectedId,
        acao,
        observacoes: comentario.trim(),
        ...(acao === 'aprovar' && resultadoHivManual ? { resultadoHiv: resultadoHivManual as 'reagente' | 'nao_reagente' } : {}),
        ...(acao === 'aprovar' && dataExameManual ? { dataExame: dataExameManual } : {}),
      },
      {
        onSuccess: () => {
          setSelectedId(null)
          setAcao(null)
          setComentario('')
          setResultadoHivManual('')
          setDataExameManual('')
        },
      },
    )
  }

  return (
    <div className="flex h-[calc(100vh-65px)]">
      {/* Sidebar */}
      <aside className="w-80 border-r border-slate-200 bg-white overflow-y-auto">
        <div className="p-4 border-b border-slate-100">
          <p className="text-sm font-medium text-slate-700">{ordenadas.length} exame(s) aguardando revisão</p>
          {urgentes.length > 0 && <p className="text-xs text-red-600 font-semibold mt-1">{urgentes.length} urgente(s) — HIV reagente</p>}
        </div>
        {ordenadas.length === 0 && <div className="p-8 text-center text-slate-400 text-sm">Nenhum exame pendente.</div>}
        {ordenadas.map((r) => (
          <button
            key={r.id}
            onClick={() => {
              setSelectedId(r.id)
              setAcao(null)
              setComentario('')
            }}
            className={`w-full text-left p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors ${selectedId === r.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''} ${r.urgente ? 'bg-red-50 hover:bg-red-100' : ''}`}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="font-medium text-slate-800 text-sm">{r.nomePaciente}</p>
              {r.urgente && <span className="text-xs bg-red-600 text-white px-1.5 py-0.5 rounded font-bold">URGENTE</span>}
            </div>
            <p className="text-xs text-slate-400">
              {r.tipoConsulta === 'ja_faco_prep' ? 'Já faz PrEP' : 'Primeiro atendimento'} · {new Date(r.createdAt).toLocaleDateString('pt-BR')}
            </p>
            {r.motivoRejeicao && <p className="text-xs text-amber-600 mt-0.5 truncate">{r.motivoRejeicao}</p>}
          </button>
        ))}
      </aside>

      {/* Detail */}
      <main className="flex-1 overflow-y-auto p-6">
        {!selecionada && <div className="flex items-center justify-center h-full text-slate-400">Selecione um exame para revisar</div>}

        {selecionada && (
          <div className="max-w-2xl space-y-4">
            {selecionada.urgente && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-red-700">Atenção — Exame URGENTE</p>
                  <p className="text-red-600 text-sm">Resultado HIV possivelmente reagente. Requer avaliação imediata.</p>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-700 mb-3">Dados do paciente</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Item label="Nome" value={selecionada.nomePaciente} />
                <Item label="E-mail" value={selecionada.patientEmail} />
                <Item label="Tipo de consulta" value={selecionada.tipoConsulta === 'ja_faco_prep' ? 'Já faz PrEP' : 'Primeiro atendimento'} />
                <Item label="Tentativas" value={`${selecionada.tentativasReenvio ?? 0}`} />
              </div>
            </div>

            {ia && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-700 mb-3">Análise automática (IA)</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Item label="Nome no exame" value={ia.nomeExame} />
                  <Item label="Resultado HIV" value={ia.resultadoHiv} />
                  <Item label="Data do exame" value={ia.dataExame} />
                  <Item label="Confiança" value={ia.confianca != null ? `${Math.round(ia.confianca * 100)}%` : null} />
                </div>
                {selecionada.motivoRejeicao && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-amber-800 text-sm">
                      <strong>Motivo da revisão:</strong> {selecionada.motivoRejeicao}
                    </p>
                  </div>
                )}
              </div>
            )}

            {selecionada.urlExame && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-700 mb-3">Arquivo enviado</h3>
                <a
                  href={selecionada.urlExame}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Abrir exame (expira em 10 min)
                </a>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
              <h3 className="font-semibold text-slate-700">Decisão médica</h3>

              {!selecionada.urgente ? (
                <div className="grid grid-cols-2 gap-2">
                  <AcaoBtn label="Aprovar exame" acao="aprovar" selected={acao} onSelect={setAcao} color="green" />
                  <AcaoBtn label="Recusar exame" acao="recusar" selected={acao} onSelect={setAcao} color="red" />
                  <AcaoBtn label="Solicitar reenvio" acao="solicitar_reenvio" selected={acao} onSelect={setAcao} color="amber" />
                  <AcaoBtn label="Recomendar consulta" acao="recomendar_consulta" selected={acao} onSelect={setAcao} color="slate" />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  <AcaoBtn label="Encaminhar para atendimento" acao="encaminhar_especialista" selected={acao} onSelect={setAcao} color="red" />
                  <AcaoBtn label="Solicitar confirmação (possível falso +)" acao="solicitar_confirmacao" selected={acao} onSelect={setAcao} color="amber" />
                  <AcaoBtn label="Recusar PrEP" acao="recusar" selected={acao} onSelect={setAcao} color="slate" />
                </div>
              )}

              {acao === 'aprovar' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-green-50 rounded-xl border border-green-200">
                  <div>
                    <label className="block text-xs text-green-700 font-medium mb-1">Resultado HIV (confirmar)</label>
                    <select
                      value={resultadoHivManual}
                      onChange={(e) => setResultadoHivManual(e.target.value as 'reagente' | 'nao_reagente' | '')}
                      className="w-full border border-green-300 bg-white rounded-lg px-2 py-1.5 text-sm"
                    >
                      <option value="">Não alterar</option>
                      <option value="nao_reagente">Não reagente</option>
                      <option value="reagente">Reagente</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-green-700 font-medium mb-1">Data do exame (DD/MM/AAAA)</label>
                    <input type="text" value={dataExameManual} onChange={(e) => setDataExameManual(e.target.value)} placeholder="15/04/2026" className="w-full border border-green-300 rounded-lg px-2 py-1.5 text-sm" />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs text-slate-600 font-medium mb-1">
                  Comentário do médico <span className="text-slate-400">(mínimo 10 caracteres, obrigatório)</span>
                </label>
                <textarea
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  rows={3}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Descreva o resultado da análise, orientações…"
                />
                <p className="text-xs text-slate-400 mt-1">{comentario.length}/10 mínimo</p>
              </div>

              {validarMut.error && <p className="text-red-600 text-sm">{validarMut.error.message}</p>}

              <button
                onClick={submeter}
                disabled={!podeSubmeter || validarMut.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
              >
                {validarMut.isPending ? 'Enviando…' : 'Confirmar decisão →'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function AcaoBtn({
  label,
  acao,
  selected,
  onSelect,
  color,
}: {
  label: string
  acao: Acao
  selected: Acao | null
  onSelect: (a: Acao) => void
  color: 'green' | 'red' | 'amber' | 'slate'
}) {
  const isSelected = selected === acao
  const styles = {
    green: isSelected ? 'bg-green-600 text-white border-green-600' : 'bg-white text-green-700 border-green-300 hover:bg-green-50',
    red: isSelected ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-700 border-red-300 hover:bg-red-50',
    amber: isSelected ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50',
    slate: isSelected ? 'bg-slate-600 text-white border-slate-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100',
  }
  return (
    <button onClick={() => onSelect(acao)} className={`border-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all text-left ${styles[color]}`}>
      {label}
    </button>
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

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
    >
      {children}
    </button>
  )
}
