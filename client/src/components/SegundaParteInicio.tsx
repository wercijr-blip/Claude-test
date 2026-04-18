import { useState, useEffect, useRef } from 'react'
import { trpc } from '../lib/trpc.ts'
import { useLocation } from 'wouter'

type Etapa = 'tipo_consulta' | 'tem_exame' | 'upload_exame' | 'gerar_pedido' | 'aguardando_ia' | 'em_revisao_medica' | 'aprovado' | 'rejeitado' | 'expirado'
type TipoConsulta = 'primeiro_atendimento' | 'ja_faco_prep'

const btnPrimary = 'w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors'
const btnCard = 'bg-white border-2 border-slate-200 hover:border-blue-400 rounded-2xl p-6 text-left transition-all w-full group'

export default function SegundaParteInicio() {
  const [, navigate] = useLocation()
  const [etapa, setEtapa] = useState<Etapa>('tipo_consulta')
  const [tipoConsulta, setTipoConsulta] = useState<TipoConsulta | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const statusQuery = trpc.consulta.status.useQuery(undefined, { refetchInterval: 5000 })
  const iniciarMut = trpc.consulta.iniciar.useMutation()
  const uploadMut = trpc.consulta.uploadExame.useMutation()
  const gerarMut = trpc.consulta.gerarPedidos.useMutation()

  // Sincronizar estado com backend
  useEffect(() => {
    const s = statusQuery.data
    if (!s) return
    if (s.status === 'aprovado') { setEtapa('aprovado'); return }
    if (s.status === 'rejeitado') { setEtapa('rejeitado'); return }
    if (s.status === 'em_validacao_medica') { setEtapa('em_revisao_medica'); return }
    if (s.status === 'em_validacao_ia') { setEtapa('aguardando_ia'); return }
    if (s.status === 'aguardando_upload') {
      setTipoConsulta(s.tipoConsulta as TipoConsulta)
      setEtapa(s.temExameRecente ? 'upload_exame' : 'gerar_pedido')
      return
    }
  }, [statusQuery.data])

  async function escolherTipoConsulta(tipo: TipoConsulta, temExame: boolean) {
    try {
      await iniciarMut.mutateAsync({ tipoConsulta: tipo, temExameRecente: temExame })
      setTipoConsulta(tipo)
      setEtapa(temExame ? 'upload_exame' : 'gerar_pedido')
    } catch (e: unknown) {
      console.error(e)
    }
  }

  async function uploadExame(file: File) {
    setUploading(true)
    setUploadError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('tipo', 'exame_hiv')
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Falha no upload')
      const { s3Key } = (await res.json()) as { s3Key: string }

      setEtapa('aguardando_ia')
      const result = await uploadMut.mutateAsync({ s3Key })

      if (result.status === 'aprovado') {
        setEtapa('aprovado')
      } else {
        setEtapa('em_revisao_medica')
      }
    } catch {
      setUploadError('Erro ao enviar o exame. Tente novamente.')
      setEtapa('upload_exame')
    } finally {
      setUploading(false)
    }
  }

  // ── Aprovado → seguir para formulário clínico ─────────────────
  if (etapa === 'aprovado') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Exame validado!</h2>
          <p className="text-slate-500 text-sm mb-6">Seu resultado de HIV está dentro dos critérios. Prossiga para o preenchimento do formulário clínico.</p>
          <button onClick={() => navigate('/formulario')} className={btnPrimary}>
            Continuar para o formulário →
          </button>
        </div>
      </div>
    )
  }

  // ── Em revisão médica ──────────────────────────────────────────
  if (etapa === 'em_revisao_medica') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Em análise médica</h2>
          <p className="text-slate-500 text-sm mb-4">A validação automática identificou uma inconsistência no exame. Um médico irá revisar manualmente.</p>
          <p className="text-slate-400 text-xs">Você será notificado por e-mail e WhatsApp quando houver uma atualização.</p>
        </div>
      </div>
    )
  }

  // ── Aguardando IA ─────────────────────────────────────────────
  if (etapa === 'aguardando_ia') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Validando exame…</h2>
          <p className="text-slate-500 text-sm">Nossa IA está analisando o resultado. Isso leva alguns segundos.</p>
        </div>
      </div>
    )
  }

  // ── Rejeitado ──────────────────────────────────────────────────
  if (etapa === 'rejeitado') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Não foi possível prosseguir</h2>
          <p className="text-slate-500 text-sm mb-4">Após análise médica, seu atendimento não pôde ser liberado. Entre em contato com a clínica para mais informações.</p>
        </div>
      </div>
    )
  }

  // ── Expirado ───────────────────────────────────────────────────
  if (etapa === 'expirado') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
          <h2 className="text-xl font-bold text-slate-800 mb-2">Prazo expirado</h2>
          <p className="text-slate-500 text-sm">O prazo para envio do exame expirou. Entre em contato com a clínica para obter um novo link.</p>
        </div>
      </div>
    )
  }

  // ── Escolha do tipo de consulta ───────────────────────────────
  if (etapa === 'tipo_consulta') {
    return (
      <div className="min-h-screen bg-slate-50 py-10 px-4">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-blue-700 mb-1">Facilita PrEP</h1>
            <p className="text-slate-500 text-sm">Formulário clínico</p>
          </div>

          <h2 className="text-lg font-semibold text-slate-800 mb-4">Qual é o seu tipo de atendimento?</h2>

          <div className="space-y-4 mb-8">
            <TipoCard
              titulo="Primeiro atendimento PrEP"
              descricao="Estou iniciando o uso da PrEP pela primeira vez."
              icon="🩺"
              onClick={() => setEtapa('tem_exame')}
              onSelect={() => setTipoConsulta('primeiro_atendimento')}
            />
            <TipoCard
              titulo="Já faço PrEP"
              descricao="Já estou em uso da PrEP e preciso de renovação ou acompanhamento."
              icon="💊"
              onClick={() => setEtapa('tem_exame')}
              onSelect={() => setTipoConsulta('ja_faco_prep')}
            />
          </div>
        </div>
      </div>
    )
  }

  // ── Pergunta sobre exame recente ──────────────────────────────
  if (etapa === 'tem_exame') {
    return (
      <div className="min-h-screen bg-slate-50 py-10 px-4">
        <div className="max-w-xl mx-auto">
          <button onClick={() => setEtapa('tipo_consulta')} className="text-blue-600 text-sm mb-6">← Voltar</button>

          <div className="bg-white rounded-2xl border border-slate-200 p-8">
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Você tem um exame de HIV recente?</h2>
            <p className="text-slate-500 text-sm mb-6">O exame precisa ter sido realizado há <strong>menos de 7 dias</strong>.</p>

            <div className="space-y-3">
              <button
                onClick={() => tipoConsulta && escolherTipoConsulta(tipoConsulta, true)}
                disabled={iniciarMut.isPending}
                className="w-full border-2 border-emerald-200 hover:border-emerald-500 bg-emerald-50 hover:bg-emerald-100 rounded-xl p-4 text-left transition-all"
              >
                <p className="font-semibold text-emerald-800">Sim, tenho exame recente</p>
                <p className="text-emerald-700 text-sm mt-0.5">Vou enviar o resultado agora.</p>
              </button>

              <button
                onClick={() => tipoConsulta && escolherTipoConsulta(tipoConsulta, false)}
                disabled={iniciarMut.isPending}
                className="w-full border-2 border-slate-200 hover:border-blue-400 bg-white hover:bg-blue-50 rounded-xl p-4 text-left transition-all"
              >
                <p className="font-semibold text-slate-800">Não tenho exame recente</p>
                <p className="text-slate-500 text-sm mt-0.5">Quero receber o pedido de exame para fazer.</p>
              </button>
            </div>

            {iniciarMut.isPending && <p className="text-slate-400 text-sm mt-4 text-center">Salvando…</p>}
          </div>
        </div>
      </div>
    )
  }

  // ── Gerar pedido de exames ─────────────────────────────────────
  if (etapa === 'gerar_pedido') {
    return (
      <div className="min-h-screen bg-slate-50 py-10 px-4">
        <div className="max-w-xl mx-auto">
          <div className="bg-white rounded-2xl border border-slate-200 p-8">
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Pedido de exames</h2>
            <p className="text-slate-500 text-sm mb-6">
              Geramos dois pedidos de exame para você. Realize os exames em um laboratório de sua escolha e volte aqui para enviar os resultados.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <p className="text-amber-800 text-sm font-medium">⏱ Prazo de 7 dias</p>
              <p className="text-amber-700 text-sm mt-1">Envie os resultados em até 7 dias. Você receberá lembretes diários por e-mail e WhatsApp.</p>
            </div>

            <BotaoBaixarPedidos tipoConsulta={tipoConsulta!} onBaixou={() => {}} />

            <div className="mt-6">
              <p className="text-sm font-medium text-slate-700 mb-3">Já fez os exames? Envie aqui:</p>
              <button
                onClick={() => setEtapa('upload_exame')}
                className={btnPrimary}
              >
                Enviar resultado do exame HIV →
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Upload do exame ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 p-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Envio do exame de HIV</h2>
          <p className="text-slate-500 text-sm mb-6">
            Envie o resultado do exame <strong>Anti-HIV 1/2 (4ª geração)</strong> realizado há menos de 7 dias.
          </p>

          <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-6 text-center mb-4">
            <svg className="w-10 h-10 text-slate-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-slate-500 text-sm mb-3">PDF, JPG ou PNG · Máximo 10MB</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) uploadExame(file)
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {uploading ? 'Enviando…' : 'Selecionar arquivo'}
            </button>
          </div>

          {uploadError && <p className="text-red-500 text-sm mt-2">{uploadError}</p>}
          {uploadMut.error && <p className="text-red-500 text-sm mt-2">{uploadMut.error.message}</p>}

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-4">
            <p className="text-blue-800 text-sm font-medium mb-1">Critérios de validação automática</p>
            <ul className="text-blue-700 text-sm space-y-0.5 list-disc list-inside">
              <li>Exame realizado há menos de 7 dias</li>
              <li>Imagem legível e sem cortes</li>
              <li>Nome do paciente visível e compatível</li>
              <li>Resultado não reagente / negativo</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

function TipoCard({ titulo, descricao, icon, onClick, onSelect }: {
  titulo: string; descricao: string; icon: string
  onClick: () => void; onSelect: () => void
}) {
  return (
    <button className={btnCard} onClick={() => { onSelect(); onClick() }}>
      <div className="flex items-start gap-4">
        <span className="text-3xl">{icon}</span>
        <div>
          <p className="font-semibold text-slate-800 group-hover:text-blue-700 transition-colors">{titulo}</p>
          <p className="text-slate-500 text-sm mt-0.5">{descricao}</p>
        </div>
      </div>
    </button>
  )
}

type PedidosData = {
  urlCompleto: string
  urlIst: string | null
  urlHiv: string
  urlDensitometria: string | null
}

const PEDIDOS_INFO = [
  { key: 'urlCompleto' as const, label: 'Painel completo de exames', desc: 'Todos os exames do protocolo PrEP' },
  { key: 'urlIst' as const, label: 'Sorológicos de IST', desc: 'HIV, Sífilis, Hepatite B/C, Gonorreia, Clamídia' },
  { key: 'urlHiv' as const, label: 'Exame Anti-HIV isolado', desc: 'Anti-HIV 1/2 com Ag p24 (4ª geração)' },
  { key: 'urlDensitometria' as const, label: 'Densitometria óssea', desc: 'Monitoramento ósseo — uso de Tenofovir (TDF)' },
]

function BotaoBaixarPedidos({ tipoConsulta: _tipoConsulta, onBaixou }: { tipoConsulta: TipoConsulta; onBaixou: () => void }) {
  const gerarMut = trpc.consulta.gerarPedidos.useMutation({ onSuccess: onBaixou })
  const data = gerarMut.data as PedidosData | undefined

  const downloadIcon = (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )

  if (!data) {
    return (
      <div className="space-y-3">
        <button
          onClick={() => gerarMut.mutate()}
          disabled={gerarMut.isPending}
          className="w-full border border-blue-300 bg-blue-50 text-blue-700 py-3 rounded-xl font-medium hover:bg-blue-100 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {downloadIcon}
          {gerarMut.isPending ? 'Gerando PDFs assinados…' : 'Gerar pedidos de exame (4 documentos)'}
        </button>
        {gerarMut.error && <p className="text-red-500 text-sm">{gerarMut.error.message}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Pedidos prontos — assinados com ICP-Brasil</p>
      {PEDIDOS_INFO.map(({ key, label, desc }) => {
        const url = data[key]
        if (!url) return null
        return (
          <div key={key} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-800">{label}</p>
              <p className="text-xs text-slate-500">{desc}</p>
            </div>
            <div className="flex gap-2 ml-3">
              <a
                href={url}
                download
                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 flex items-center gap-1 transition-colors"
              >
                {downloadIcon} Download
              </a>
              <button
                onClick={() => window.open(url, '_blank')}
                className="text-xs bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Imprimir
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
