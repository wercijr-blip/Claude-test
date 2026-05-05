import { useState } from 'react'
import { trpc } from '../lib/trpc.ts'
import { Download } from 'lucide-react'

type Tab = 'equipe' | 'pacientes' | 'auditoria' | 'certificado'

export default function AuditDashboard() {
  const [tab, setTab] = useState<Tab>('equipe')

  // Equipe
  const { data: usuarios, refetch: refetchUsuarios } = trpc.admin.listarUsuarios.useQuery()
  const alterarRole = trpc.admin.alterarRole.useMutation({ onSuccess: () => refetchUsuarios() })
  const toggleAtivo = trpc.admin.toggleAtivo.useMutation({ onSuccess: () => refetchUsuarios() })
  const cadastrarUsuario = trpc.admin.cadastrarUsuario.useMutation({ onSuccess: () => { refetchUsuarios(); setNovoEmail(''); setNovoNome(''); setNovoRole('secretaria') } })

  // Novo usuário
  const [novoEmail, setNovoEmail] = useState('')
  const [novoNome, setNovoNome] = useState('')
  const [novoRole, setNovoRole] = useState<'secretaria' | 'medico' | 'admin'>('secretaria')

  // Pacientes
  const [busca, setBusca] = useState('')
  const { data: pacientesResp } = trpc.admin.listarTodosPacientes.useQuery({ busca: busca || undefined })
  const pacientes = pacientesResp?.data

  // Auditoria
  const { data: eventos } = trpc.admin.listarEventos.useQuery({ limit: 100 })
  const { refetch: fetchCsv } = trpc.admin.exportarAuditoria.useQuery(undefined, { enabled: false })

  function downloadCsv() {
    fetchCsv().then(({ data }) => {
      if (!data?.csv) return
      const blob = new Blob([data.csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-blue-700">Painel Admin — Facilita PrEP</h1>
          <div className="flex gap-2">
            {(['equipe', 'pacientes', 'auditoria', 'certificado'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {t === 'equipe' ? 'Equipe' : t === 'pacientes' ? 'Pacientes' : t === 'auditoria' ? 'Auditoria' : 'Certificado ICP'}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Aba: Equipe ── */}
      {tab === 'equipe' && (
        <div className="max-w-5xl mx-auto p-6 space-y-6">
          {/* Cadastrar novo usuário */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-base font-semibold text-slate-800 mb-4">Cadastrar novo usuário</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Nome completo</label>
                <input
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  placeholder="Dr. João Silva"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">E-mail</label>
                <input
                  value={novoEmail}
                  onChange={(e) => setNovoEmail(e.target.value)}
                  type="email"
                  placeholder="usuario@clinica.com"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Perfil</label>
                <select
                  value={novoRole}
                  onChange={(e) => setNovoRole(e.target.value as 'secretaria' | 'medico' | 'admin')}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="secretaria">Secretaria</option>
                  <option value="medico">Médico</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            {cadastrarUsuario.error && (
              <p className="mt-2 text-xs text-red-600">{cadastrarUsuario.error.message}</p>
            )}
            {cadastrarUsuario.isSuccess && (
              <p className="mt-2 text-xs text-green-600">Usuário cadastrado com sucesso.</p>
            )}
            <button
              onClick={() => cadastrarUsuario.mutate({ email: novoEmail, nome: novoNome, role: novoRole })}
              disabled={cadastrarUsuario.isPending || !novoEmail || !novoNome}
              className="mt-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
            >
              {cadastrarUsuario.isPending ? 'Cadastrando…' : 'Cadastrar usuário'}
            </button>
          </div>

          {/* Gerenciar equipe existente */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-base font-semibold text-slate-800 mb-4">Gerenciar Equipe</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                    <th className="pb-2 pr-4">Nome</th>
                    <th className="pb-2 pr-4">E-mail</th>
                    <th className="pb-2 pr-4">Perfil</th>
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
        </div>
      )}

      {/* ── Aba: Pacientes ── */}
      {tab === 'pacientes' && (
        <div className="max-w-5xl mx-auto p-6 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-800">Todos os Pacientes</h2>
              <span className="text-xs text-slate-400">{pacientesResp?.total ?? 0} registro(s)</span>
            </div>

            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou CPF (hash)…"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4"
            />

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                    <th className="pb-2 pr-4">Nome</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Tipo atendimento</th>
                    <th className="pb-2 pr-4">Convênio</th>
                    <th className="pb-2 pr-4">Etapa</th>
                    <th className="pb-2">Cadastrado em</th>
                  </tr>
                </thead>
                <tbody>
                  {!pacientes?.length && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">Nenhum paciente encontrado.</td>
                    </tr>
                  )}
                  {pacientes?.map((p) => (
                    <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-3 pr-4 text-slate-700 font-medium">{p.nome}</td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="py-3 pr-4 text-slate-500">{p.tipoAtendimento ?? '—'}</td>
                      <td className="py-3 pr-4 text-slate-500">{p.convenio ?? '—'}</td>
                      <td className="py-3 pr-4 text-slate-400">{p.currentStep}/8</td>
                      <td className="py-3 text-slate-400 whitespace-nowrap">
                        {new Date(p.createdAt).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Aba: Auditoria ── */}
      {tab === 'auditoria' && (
        <div className="max-w-5xl mx-auto p-6 space-y-6">
          {/* Log de segurança */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-800">Log de Segurança</h2>
              <button
                onClick={downloadCsv}
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-3 py-1.5 rounded-lg text-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                Exportar CSV
              </button>
            </div>
            <div className="space-y-1 max-h-[600px] overflow-y-auto">
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
              {!eventos?.length && (
                <p className="text-sm text-slate-400 py-4 text-center">Nenhum evento registrado.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Aba: Certificado ICP-Brasil ── */}
      {tab === 'certificado' && <PainelCertificado />}
    </div>
  )
}

function PainelCertificado() {
  const { data, isLoading, refetch, isFetching } = trpc.admin.saudeCertificado.useQuery()

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
          <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500 mt-2">Verificando certificado…</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  const corStatus =
    data.status === 'configurado' && data.valido && !data.vencendoEm60Dias ? 'green' :
    data.status === 'configurado' && data.vencendoEm60Dias ? 'yellow' :
    data.status === 'demo' ? 'yellow' : 'red'

  const cores: Record<string, { bg: string; text: string; border: string }> = {
    green:  { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200' },
    yellow: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
    red:    { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200' },
  }
  const c = cores[corStatus]

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Certificado Digital ICP-Brasil</h2>
            <p className="text-xs text-slate-500 mt-1">Usado para assinar PDFs (PAdES B-B compatível com validador ITI)</p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
          >
            {isFetching ? 'Verificando…' : 'Atualizar'}
          </button>
        </div>

        {/* Banner de status */}
        <div className={`rounded-lg border ${c.border} ${c.bg} p-4 mb-4`}>
          <p className={`text-sm font-semibold ${c.text}`}>
            {data.status === 'configurado' && data.valido && !data.vencendoEm60Dias && '✓ Certificado válido e configurado'}
            {data.status === 'configurado' && data.vencendoEm60Dias && `⚠ Certificado vence em ${data.diasRestantes} dia(s) — providencie a renovação`}
            {data.status === 'configurado' && !data.valido && '✗ Certificado fora do período de validade'}
            {data.status === 'demo' && '⚠ Modo DEMO — sem certificado configurado (dev local)'}
            {data.status === 'erro' && '✗ Erro ao ler o certificado'}
          </p>
          {data.mensagem && <p className={`text-xs ${c.text} mt-1`}>{data.mensagem}</p>}
        </div>

        {/* Tabela de detalhes */}
        {data.status === 'configurado' && (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Titular</dt>
              <dd className="font-medium text-slate-800">{data.titular ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Emissor (AC)</dt>
              <dd className="font-medium text-slate-800">{data.emissor ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Serial</dt>
              <dd className="font-mono text-xs text-slate-700">{data.serial ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Dias restantes</dt>
              <dd className={`font-semibold ${data.vencendoEm60Dias ? 'text-yellow-700' : 'text-green-700'}`}>
                {data.diasRestantes ?? '—'} dia(s)
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Válido a partir de</dt>
              <dd className="text-slate-700">{data.validoDe ? new Date(data.validoDe).toLocaleDateString('pt-BR') : '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Válido até</dt>
              <dd className="text-slate-700">{data.validoAte ? new Date(data.validoAte).toLocaleDateString('pt-BR') : '—'}</dd>
            </div>
          </dl>
        )}

        {/* Instruções para DEMO/erro */}
        {(data.status === 'demo' || data.status === 'erro') && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 space-y-2">
            <p className="font-medium text-slate-700">Como configurar o certificado:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Em produção (Railway): defina <code className="bg-slate-200 px-1 rounded">ICP_PFX_BASE64</code> e <code className="bg-slate-200 px-1 rounded">ICP_PFX_PASSWORD</code> nas variáveis de ambiente</li>
              <li>Em desenvolvimento: coloque <code className="bg-slate-200 px-1 rounded">werciley.pfx</code> em <code className="bg-slate-200 px-1 rounded">server/certs/</code></li>
              <li>Para gerar o base64 do .pfx: <code className="bg-slate-200 px-1 rounded">base64 -w 0 werciley.pfx</code></li>
            </ol>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-800 mb-2">Validação ITI</h3>
        <p className="text-xs text-slate-600 leading-relaxed">
          Os documentos gerados são assinados em padrão <strong>PAdES B-B</strong> (PDF Advanced Electronic Signatures, nível básico)
          com PKCS#7 detached SignedData via <code className="bg-slate-100 px-1 rounded">@signpdf</code>. Para validar, baixe qualquer PDF
          gerado pelo sistema e suba em{' '}
          <a href="https://verificador.iti.gov.br/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            verificador.iti.gov.br
          </a>.
        </p>
      </div>
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
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${colors[status] ?? 'bg-slate-100 text-slate-500'}`}>
      {status}
    </span>
  )
}
