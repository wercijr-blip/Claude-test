import { useState, useEffect, useRef } from 'react'
import { trpc } from '../lib/trpc.ts'
import { useLocation } from 'wouter'

type Etapa = 'tipo_consulta' | 'tem_exame' | 'upload_exame' | 'gerar_pedido' | 'aguardando_ia' | 'em_revisao_medica' | 'aprovado' | 'rejeitado' | 'expirado'
type TipoConsulta = 'primeiro_atendimento' | 'ja_faco_prep'

const btnPrimary = 'w-full bg-brand text-white py-3.5 rounded-2xl font-semibold hover:bg-brand-dark disabled:opacity-50 transition-all shadow-md hover:shadow-lg text-sm'

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-warm-bg py-10 px-4">
      <div className="max-w-lg mx-auto">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand rounded-xl flex items-center justify-center shadow-sm">
              <svg className="w-4.5 h-4.5 text-white w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <span className="font-bold text-brand-dark">Facilita PrEP</span>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

function StatusCard({
  icon, iconBg, iconColor, title, subtitle, children,
}: {
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  title: string
  subtitle?: string
  children?: React.ReactNode
}) {
  return (
    <PageShell>
      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-10 text-center">
        <div className={`w-20 h-20 ${iconBg} rounded-full flex items-center justify-center mx-auto mb-6`}>
          <div className={iconColor}>{icon}</div>
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">{title}</h2>
        {subtitle && <p className="text-slate-500 text-sm leading-relaxed mb-4">{subtitle}</p>}
        {children}
      </div>
    </PageShell>
  )
}

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
      fd.append('tipoExame', 'exame_hiv')
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Falha no upload')
      const { s3Key } = (await res.json()) as { s3Key: string }
      setEtapa('aguardando_ia')
      const result = await uploadMut.mutateAsync({ s3Key })
      setEtapa(result.status === 'aprovado' ? 'aprovado' : 'em_revisao_medica')
    } catch {
      setUploadError('Erro ao enviar o exame. Tente novamente.')
      setEtapa('upload_exame')
    } finally {
      setUploading(false)
    }
  }

  // ── Aprovado ──────────────────────────────────────────────────
  if (etapa === 'aprovado') {
    return (
      <StatusCard
        icon={<svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        iconBg="bg-sage-light" iconColor="text-sage"
        title="Tudo certo! Você pode seguir com segurança"
        subtitle="Seu exame não apresentou nenhuma alteração — você está no caminho certo. Estamos aqui para acompanhar cada passo do seu cuidado."
      >
        <div className="bg-sage-pale border border-sage-light rounded-2xl p-4 mb-6 text-left">
          <p className="text-sage-dark text-sm font-medium mb-1">Próximo passo:</p>
          <p className="text-sage text-sm">Preencha o formulário clínico para que nosso médico possa emitir sua receita com total segurança.</p>
        </div>
        <button onClick={() => navigate('/formulario')} className={btnPrimary}>
          Continuar para o formulário clínico →
        </button>
        <OndeRetirarPrep />
      </StatusCard>
    )
  }

  // ── Em revisão médica ─────────────────────────────────────────
  if (etapa === 'em_revisao_medica') {
    return (
      <StatusCard
        icon={<svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        iconBg="bg-honey-light" iconColor="text-honey"
        title="Seu exame está sendo avaliado"
        subtitle="Nosso médico está analisando seu resultado com atenção. Fique tranquilo(a) — você receberá o retorno por e-mail e WhatsApp em breve."
      >
        <div className="bg-honey-light border border-honey-light rounded-2xl p-4 text-left">
          <p className="text-honey-dark text-sm font-medium mb-1">Como será notificado:</p>
          <div className="space-y-1.5">
            {['Por e-mail', 'Por WhatsApp'].map(c => (
              <p key={c} className="text-honey text-sm flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                {c}
              </p>
            ))}
          </div>
        </div>
      </StatusCard>
    )
  }

  // ── Aguardando IA ─────────────────────────────────────────────
  if (etapa === 'aguardando_ia') {
    return (
      <StatusCard
        icon={
          <svg className="w-10 h-10 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        }
        iconBg="bg-brand-light" iconColor="text-brand"
        title="Verificando seu exame…"
        subtitle="Estamos analisando seu resultado com cuidado. Isso costuma levar apenas alguns instantes — aguarde."
      />
    )
  }

  // ── Rejeitado ─────────────────────────────────────────────────
  if (etapa === 'rejeitado') {
    return (
      <StatusCard
        icon={<svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" /></svg>}
        iconBg="bg-terra-light" iconColor="text-terra"
        title="Precisamos conversar com você"
        subtitle="Identificamos algo no seu exame que precisa de atenção antes de iniciarmos a PrEP. Nossa equipe está pronta para orientar você com cuidado e sem julgamentos."
      >
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left">
          <p className="text-slate-700 text-sm">
            Para mais informações, entre em contato com nossa equipe:
          </p>
          <a href="tel:+556140427188" className="text-brand text-sm font-medium mt-2 flex items-center gap-1.5 hover:underline">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            (61) 4042-7188
          </a>
        </div>
      </StatusCard>
    )
  }

  // ── Expirado ──────────────────────────────────────────────────
  if (etapa === 'expirado') {
    return (
      <StatusCard
        icon={<svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        iconBg="bg-slate-100" iconColor="text-slate-400"
        title="Seu link de acesso expirou"
        subtitle="O prazo para envio do exame foi encerrado. Entre em contato e renovaremos seu acesso rapidamente — estamos aqui para ajudar."
      >
        <a href="tel:+556140427188" className="inline-flex items-center gap-2 text-brand text-sm font-medium hover:underline">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          Ligar para (61) 4042-7188
        </a>
      </StatusCard>
    )
  }

  // ── Tipo de consulta ──────────────────────────────────────────
  if (etapa === 'tipo_consulta') {
    return (
      <PageShell>
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-brand-light rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800">Como você chega até nós hoje?</h2>
            <p className="text-slate-400 text-sm mt-1">Cada jornada é única — nos conte sua situação para que possamos cuidar de você da melhor forma.</p>
          </div>

          <div className="space-y-4">
            <TipoCard
              titulo="Primeiro atendimento PrEP"
              descricao="Estou iniciando o uso da PrEP pela primeira vez e quero começar com segurança."
              icon={
                <svg className="w-6 h-6 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              }
              iconBg="bg-brand-light"
              onClick={() => setEtapa('tem_exame')}
              onSelect={() => setTipoConsulta('primeiro_atendimento')}
            />
            <TipoCard
              titulo="Já faço PrEP"
              descricao="Já estou em uso da PrEP e preciso de renovação ou acompanhamento periódico."
              icon={
                <svg className="w-6 h-6 text-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              }
              iconBg="bg-sage-light"
              onClick={() => setEtapa('tem_exame')}
              onSelect={() => setTipoConsulta('ja_faco_prep')}
            />
          </div>
        </div>
      </PageShell>
    )
  }

  // ── Pergunta sobre exame recente ──────────────────────────────
  if (etapa === 'tem_exame') {
    return (
      <PageShell>
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
          <button onClick={() => setEtapa('tipo_consulta')} className="flex items-center gap-1 text-slate-400 hover:text-brand text-sm mb-6 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Voltar
          </button>

          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-sage-light rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800">Você tem exame de HIV recente?</h2>
            <p className="text-slate-400 text-sm mt-1">O exame precisa ter sido realizado há <strong className="text-slate-600">menos de 7 dias</strong>.</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => tipoConsulta && escolherTipoConsulta(tipoConsulta, true)}
              disabled={iniciarMut.isPending}
              className="w-full bg-sage-pale border-2 border-sage-light hover:border-sage rounded-2xl p-5 text-left transition-all group hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-sage-light rounded-xl flex items-center justify-center shrink-0 group-hover:bg-sage-light transition-colors">
                  <svg className="w-5 h-5 text-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-sage-dark">Sim, tenho exame recente</p>
                  <p className="text-sage text-sm mt-0.5">Ótimo! Vou enviar o resultado agora.</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => tipoConsulta && escolherTipoConsulta(tipoConsulta, false)}
              disabled={iniciarMut.isPending}
              className="w-full bg-white border-2 border-slate-200 hover:border-brand rounded-2xl p-5 text-left transition-all group hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-brand-light transition-colors">
                  <svg className="w-5 h-5 text-slate-500 group-hover:text-brand transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-slate-800">Não tenho exame recente</p>
                  <p className="text-slate-500 text-sm mt-0.5">Sem problema — geramos o pedido assinado para você levar ao laboratório.</p>
                </div>
              </div>
            </button>
          </div>

          {iniciarMut.isPending && (
            <p className="text-slate-400 text-sm mt-4 text-center flex items-center justify-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Salvando…
            </p>
          )}
        </div>
      </PageShell>
    )
  }

  // ── Gerar pedido de exames ─────────────────────────────────────
  if (etapa === 'gerar_pedido') {
    return (
      <PageShell>
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-brand-light rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800">Pedido de exames</h2>
            <p className="text-slate-400 text-sm mt-1">Seus pedidos serão assinados digitalmente com certificado ICP-Brasil.</p>
          </div>

          <div className="bg-honey-light border border-honey-light rounded-2xl p-4 mb-6 flex gap-3">
            <span className="text-honey text-lg shrink-0">⏱</span>
            <div>
              <p className="text-honey-dark text-sm font-semibold">Prazo de 7 dias</p>
              <p className="text-honey text-sm mt-0.5">Realize os exames e envie os resultados em até 7 dias. Você receberá lembretes por e-mail e WhatsApp.</p>
            </div>
          </div>

          <BotaoBaixarPedidos tipoConsulta={tipoConsulta!} onBaixou={() => {}} />

          <div className="mt-6 border-t border-slate-100 pt-6">
            <p className="text-sm font-medium text-slate-700 mb-3 text-center">Já realizou os exames? Envie o resultado aqui:</p>
            <button onClick={() => setEtapa('upload_exame')} className={btnPrimary}>
              Enviar resultado do exame HIV →
            </button>
          </div>

          <OndeRetirarPrep />
        </div>
      </PageShell>
    )
  }

  // ── Upload do exame ────────────────────────────────────────────
  return (
    <PageShell>
      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-sage-light rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800">Envio do exame de HIV</h2>
          <p className="text-slate-400 text-sm mt-1">
            Envie o resultado do exame <strong className="text-slate-600">Anti-HIV 1/2 (4ª geração)</strong> realizado há menos de 7 dias.
          </p>
        </div>

        <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-slate-200 hover:border-sage rounded-2xl py-10 cursor-pointer bg-slate-50 hover:bg-sage-pale transition-all mb-4 group">
          {uploading ? (
            <>
              <svg className="w-10 h-10 text-sage animate-bounce mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sage text-sm font-medium">Enviando…</p>
            </>
          ) : (
            <>
              <svg className="w-12 h-12 text-slate-300 group-hover:text-sage mb-3 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-slate-500 text-sm font-medium group-hover:text-sage transition-colors">Clique para selecionar o arquivo</p>
              <p className="text-slate-300 text-xs mt-1">PDF, JPG ou PNG · Máximo 10 MB</p>
            </>
          )}
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
        </label>

        {uploadError && <p className="text-terra text-sm mb-3">{uploadError}</p>}
        {uploadMut.error && <p className="text-terra text-sm mb-3">{uploadMut.error.message}</p>}

        <div className="bg-brand-pale border border-brand-light rounded-2xl p-4">
          <p className="text-brand-dark text-sm font-semibold mb-2">Critérios de validação automática</p>
          <div className="space-y-1.5">
            {[
              'Exame realizado há menos de 7 dias',
              'Imagem legível, sem cortes ou desfoque',
              'Nome do paciente visível e compatível',
              'Resultado não reagente / negativo',
            ].map(c => (
              <p key={c} className="text-brand text-sm flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                {c}
              </p>
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  )
}

function OndeRetirarPrep() {
  return (
    <div className="mt-8 border-t border-slate-100 pt-6">
      <p className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
        <svg className="w-4 h-4 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Saiba onde retirar sua PrEP
      </p>

      <div className="space-y-3">
        {/* Particular */}
        <div className="bg-brand-pale border border-brand-light rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">💊</span>
            <p className="font-semibold text-brand-dark text-sm">Farmácias e drogarias (particular)</p>
          </div>
          <p className="text-brand text-xs leading-relaxed">
            Com a receita emitida pelo Facilita PrEP (assinada digitalmente com ICP-Brasil),
            você pode retirar o <strong>TDF/FTC</strong> em qualquer farmácia ou drogaria do Brasil.
            A receita tem validade jurídica e é aceita em todo o território nacional.
          </p>
        </div>

        {/* SUS */}
        <div className="bg-sage-pale border border-sage-light rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🏥</span>
            <p className="font-semibold text-sage-dark text-sm">Rede pública (SUS — gratuito)</p>
          </div>
          <p className="text-sage text-xs leading-relaxed mb-3">
            A PrEP é distribuída gratuitamente nas <strong>Unidades Dispensadoras de Medicamentos (UDMs)</strong>.
            Para localizar a unidade mais próxima de você:
          </p>
          <ol className="text-xs text-sage-dark space-y-1 mb-3">
            {[
              'Acesse o site oficial do Departamento de HIV, Hepatites Virais e IST',
              'Clique em "Consulte uma UDM"',
              'Escolha o seu estado para ver as unidades disponíveis',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="bg-sage-light text-sage-dark font-bold rounded-full w-4 h-4 flex items-center justify-center shrink-0 text-xs mt-0.5">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <a
            href="https://azt.aids.gov.br"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-sage text-white text-xs font-semibold px-3 py-2 rounded-xl hover:bg-sage-dark transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Acessar azt.aids.gov.br → Consulte uma UDM
          </a>
        </div>
      </div>
    </div>
  )
}

function TipoCard({ titulo, descricao, icon, iconBg, onClick, onSelect }: {
  titulo: string
  descricao: string
  icon: React.ReactNode
  iconBg: string
  onClick: () => void
  onSelect: () => void
}) {
  return (
    <button
      className="w-full bg-white border-2 border-slate-200 hover:border-brand rounded-2xl p-5 text-left transition-all group hover:shadow-md"
      onClick={() => { onSelect(); onClick() }}
    >
      <div className="flex items-start gap-4">
        <div className={`w-11 h-11 ${iconBg} rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
        <div>
          <p className="font-bold text-slate-800 group-hover:text-brand transition-colors">{titulo}</p>
          <p className="text-slate-500 text-sm mt-0.5 leading-relaxed">{descricao}</p>
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

  const DownloadIcon = () => (
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
          className="w-full border-2 border-brand-light bg-brand-pale text-brand py-3.5 rounded-2xl font-medium hover:bg-brand-light disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-sm"
        >
          <DownloadIcon />
          {gerarMut.isPending ? 'Gerando PDFs assinados…' : 'Gerar pedidos de exame (4 documentos)'}
        </button>
        {gerarMut.error && <p className="text-terra text-sm">{gerarMut.error.message}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
        <svg className="w-4 h-4 text-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        Pedidos prontos — assinados com ICP-Brasil
      </p>
      {PEDIDOS_INFO.map(({ key, label, desc }) => {
        const url = data[key]
        if (!url) return null
        return (
          <div key={key} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 hover:border-brand-light transition-colors">
            <div>
              <p className="text-sm font-semibold text-slate-800">{label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
            </div>
            <div className="flex gap-2 ml-3 shrink-0">
              <a
                href={url}
                download
                className="text-xs bg-brand text-white px-3 py-1.5 rounded-xl hover:bg-brand-dark flex items-center gap-1 transition-colors shadow-sm"
              >
                <DownloadIcon /> Download
              </a>
              <button
                onClick={() => window.open(url, '_blank')}
                className="text-xs bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-xl hover:bg-slate-50 transition-colors"
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
