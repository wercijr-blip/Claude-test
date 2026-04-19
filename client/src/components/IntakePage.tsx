import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { trpc } from '../lib/trpc.ts'
import { PLANOS_VALIDOS, HORARIO_ATENDIMENTO } from '@shared/const.ts'

const ABERTURA = HORARIO_ATENDIMENTO.ABERTURA_HORA
const FECHAMENTO = HORARIO_ATENDIMENTO.FECHAMENTO_HORA

function isDentroHorarioAtendimento(): boolean {
  const agora = new Date()
  const spTime = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const hora = spTime.getHours()
  const dia = spTime.getDay()
  return dia >= 1 && dia <= 5 && hora >= ABERTURA && hora < FECHAMENTO
}

const schema = z.object({
  nome: z.string().min(2, 'Nome muito curto'),
  telefone: z.string().min(10, 'Telefone inválido'),
  cpf: z.string().min(11, 'CPF inválido'),
  email: z.string().email('E-mail inválido'),
  plano: z.string().optional(),
})

type FormData = z.infer<typeof schema>
type Etapa = 'escolha' | 'formulario' | 'aguardando' | 'sucesso'
type Tipo = 'particular' | 'plano'

const inputCls = 'w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white transition-all placeholder:text-slate-400'
const labelCls = 'block text-sm font-medium text-slate-700 mb-1.5'
const errCls = 'text-red-500 text-xs mt-1.5'

function TrustBadge({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-full px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
      <span>{icon}</span>
      <span>{text}</span>
    </div>
  )
}

function HeroIllustration() {
  return (
    <svg viewBox="0 0 320 280" className="w-full max-w-sm mx-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Background blob */}
      <ellipse cx="160" cy="150" rx="145" ry="125" fill="#EFF6FF" />

      {/* Phone / device */}
      <rect x="110" y="70" width="100" height="160" rx="16" fill="white" stroke="#BFDBFE" strokeWidth="3"/>
      <rect x="120" y="85" width="80" height="110" rx="8" fill="#DBEAFE"/>
      <circle cx="160" cy="215" r="8" fill="#BFDBFE"/>

      {/* Screen content — chart lines */}
      <polyline points="128,155 140,140 153,148 166,128 178,135 192,120" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <circle cx="166" cy="128" r="3.5" fill="#2563EB"/>

      {/* Shield */}
      <path d="M225 55 L255 65 L255 98 C255 115 240 126 225 132 C210 126 195 115 195 98 L195 65 Z" fill="#A7F3D0" stroke="#34D399" strokeWidth="2"/>
      <path d="M215 93 L224 102 L240 83" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>

      {/* Heart */}
      <path d="M68 108 C68 97 78 90 88 97 C98 90 108 97 108 108 C108 120 88 136 88 136 C88 136 68 120 68 108 Z" fill="#FCA5A5" stroke="#F87171" strokeWidth="1.5"/>

      {/* Person silhouette */}
      <circle cx="88" cy="168" r="18" fill="#FED7AA" stroke="#FDBA74" strokeWidth="2"/>
      <path d="M62 230 Q88 205 114 230 L114 258 Q88 244 62 258 Z" fill="#FED7AA" stroke="#FDBA74" strokeWidth="2"/>

      {/* Stars / sparkles */}
      <circle cx="50" cy="75" r="5" fill="#FDE68A"/>
      <circle cx="280" cy="100" r="4" fill="#C4B5FD"/>
      <circle cx="260" cy="200" r="6" fill="#A5F3FC"/>
      <circle cx="55" cy="195" r="4" fill="#BBF7D0"/>

      {/* Lock / privacy icon */}
      <rect x="148" y="99" width="24" height="18" rx="3" fill="#BFDBFE" stroke="#60A5FA" strokeWidth="1.5"/>
      <path d="M152 99 L152 95 C152 91 172 91 172 95 L172 99" stroke="#60A5FA" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="160" cy="109" r="3" fill="#3B82F6"/>
    </svg>
  )
}

export default function IntakePage() {
  const [etapa, setEtapa] = useState<Etapa>('escolha')
  const [tipo, setTipo] = useState<Tipo>('particular')
  const [dentroHorario, setDentroHorario] = useState(isDentroHorarioAtendimento())
  const [precadastroId, setPrecadastroId] = useState<number | null>(null)
  const [carteirinhaKey, setCarteirinhaKey] = useState<string | null>(null)
  const [documentoKey, setDocumentoKey] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [planosAbertos, setPlanosAbertos] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => setDentroHorario(isDentroHorarioAtendimento()), 60_000)
    return () => clearInterval(interval)
  }, [])

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const criar = trpc.intake.criar.useMutation()
  const iniciarPagamento = trpc.intake.iniciarPagamento.useMutation({
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url
    },
  })

  function escolher(t: Tipo) {
    setTipo(t)
    setEtapa('formulario')
  }

  async function uploadArquivo(file: File): Promise<string> {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('tipo', 'documento_intake')
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    if (!res.ok) throw new Error('Falha no upload')
    const json = await res.json() as { s3Key: string }
    return json.s3Key
  }

  async function onSubmit(data: FormData) {
    setUploadError(null)
    if (tipo === 'plano' && (!carteirinhaKey || !documentoKey)) {
      setUploadError('Envie a carteirinha e o documento de identidade.')
      return
    }
    try {
      const result = await criar.mutateAsync({
        nome: data.nome,
        telefone: data.telefone,
        cpf: data.cpf.replace(/\D/g, ''),
        email: data.email,
        tipo,
        plano: tipo === 'plano' ? data.plano : undefined,
        carteirinhaS3Key: carteirinhaKey ?? undefined,
        documentoS3Key: documentoKey ?? undefined,
      })
      setPrecadastroId(result.precadastroId)
      if (tipo === 'particular') {
        await iniciarPagamento.mutateAsync({ precadastroId: result.precadastroId })
      } else {
        setEtapa('aguardando')
      }
    } catch (err: unknown) {
      console.error(err)
    }
  }

  // ── Tela de escolha ───────────────────────────────────────────
  if (etapa === 'escolha') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-teal-50">
        {/* Navbar */}
        <header className="px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <span className="font-bold text-blue-800 text-lg">Facilita PrEP</span>
          </div>
          <a href="/duvidas" className="text-sm text-slate-500 hover:text-blue-600 transition-colors">
            Dúvidas sobre PrEP →
          </a>
        </header>

        {/* Hero */}
        <main className="max-w-6xl mx-auto px-4 py-6 lg:py-10 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Lado esquerdo — mensagem + ilustração */}
          <div className="text-center lg:text-left order-2 lg:order-1">
            <HeroIllustration />
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-800 mb-4 leading-tight mt-4">
              Sua saúde em boas mãos,<br className="hidden sm:block" />
              <span className="text-blue-600"> de onde você estiver</span>
            </h1>
            <p className="text-slate-500 text-base leading-relaxed mb-6 max-w-md mx-auto lg:mx-0">
              Acesso rápido, sigiloso e 100% digital à PrEP. Do cadastro à receita assinada digitalmente — tudo sem sair de casa.
            </p>
            <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
              <TrustBadge icon="🔒" text="100% sigiloso" />
              <TrustBadge icon="✅" text="Assinatura ICP-Brasil" />
              <TrustBadge icon="⚡" text="Receita em horas" />
              <TrustBadge icon="🏥" text="CFM 2.299/2021" />
            </div>
          </div>

          {/* Lado direito — escolha de tipo */}
          <div className="order-1 lg:order-2">
            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
              <div className="text-center mb-8">
                <span className="inline-block bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full mb-3">Comece agora</span>
                <h2 className="text-xl font-bold text-slate-800">Como deseja ser atendido?</h2>
                <p className="text-slate-400 text-sm mt-1">Escolha a modalidade que melhor se encaixa para você</p>
              </div>

              <div className="space-y-4">
                {/* Particular */}
                <button
                  onClick={() => escolher('particular')}
                  className="w-full bg-gradient-to-r from-blue-50 to-sky-50 border-2 border-blue-200 hover:border-blue-500 rounded-2xl p-5 text-left transition-all group hover:shadow-md"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-blue-200 transition-colors">
                      <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-800 text-base">Particular</h3>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Acesso imediato</span>
                      </div>
                      <p className="text-slate-500 text-sm mt-1">Pagamento via PIX, cartão de crédito ou débito. Liberação automática após confirmação.</p>
                    </div>
                  </div>
                </button>

                {/* Plano de Saúde */}
                <button
                  onClick={() => escolher('plano')}
                  className="w-full bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 hover:border-emerald-500 rounded-2xl p-5 text-left transition-all group hover:shadow-md"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-emerald-200 transition-colors">
                      <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-800 text-base">Plano de Saúde</h3>
                      </div>
                      <p className="text-slate-500 text-sm mt-1">Atendimento coberto pelo convênio. Nossa equipe valida a cobertura com agilidade.</p>
                      <p className="text-xs text-amber-600 mt-1.5 font-medium flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Atendimento seg.–sex., das 08h às 18h
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              <p className="text-center text-xs text-slate-400 mt-6">
                Ao continuar, você concorda com nossos termos e com a{' '}
                <span className="underline cursor-pointer hover:text-slate-600">Política de Privacidade (LGPD)</span>
              </p>
            </div>

            {/* SUS note */}
            <div className="mt-4 bg-white/70 border border-slate-200 rounded-2xl p-4 text-center">
              <p className="text-xs text-slate-500">
                Quer a PrEP gratuitamente pelo SUS?{' '}
                <a href="/duvidas" className="text-blue-600 hover:underline font-medium">Veja como encontrar a UDM mais próxima →</a>
              </p>
            </div>
          </div>
        </main>

        {/* ── Como funciona o Facilita PrEP ── */}
        <section className="max-w-6xl mx-auto px-4 pb-12">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-slate-800">Como utilizar o Facilita PrEP</h2>
            <p className="text-slate-500 text-sm mt-2">Do cadastro à receita — em poucos passos, sem sair de casa.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {[
              {
                n: '1', cor: 'bg-blue-600', titulo: 'Cadastro e escolha do tipo',
                desc: 'Informe nome, CPF, e-mail e telefone. Escolha atendimento particular ou via plano de saúde aceito pela plataforma.',
              },
              {
                n: '2', cor: 'bg-teal-600', titulo: 'Exame de HIV válido',
                desc: 'Envie seu exame Anti-HIV realizado há menos de 7 dias. Sem exame? O Facilita PrEP gera o pedido assinado digitalmente para você levar ao laboratório.',
              },
              {
                n: '3', cor: 'bg-indigo-600', titulo: 'Validação por IA + médico',
                desc: 'O exame é analisado automaticamente por IA sob supervisão médica. A validação é ágil, segura e sigilosa.',
              },
              {
                n: '4', cor: 'bg-emerald-600', titulo: 'Formulário clínico',
                desc: 'Com o exame validado, preencha o formulário de triagem clínica. Os dados do cadastro já vêm pré-preenchidos.',
              },
              {
                n: '5', cor: 'bg-violet-600', titulo: 'Documentos no seu e-mail',
                desc: 'Receita, formulário clínico e ficha de cadastro — todos assinados digitalmente com certificado ICP-Brasil — chegam ao seu e-mail em horas.',
              },
              {
                n: '6', cor: 'bg-rose-500', titulo: 'Retire sua PrEP',
                desc: 'Com a receita em mãos, retire o TDF/FTC em qualquer farmácia ou drogaria. Pelo SUS, procure a UDM mais próxima.',
              },
            ].map(({ n, cor, titulo, desc }) => (
              <div key={n} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className={`w-9 h-9 ${cor} text-white rounded-xl flex items-center justify-center text-sm font-bold mb-3`}>{n}</div>
                <p className="font-semibold text-slate-800 text-sm mb-1.5">{titulo}</p>
                <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          {/* Planos aceitos */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <button
              onClick={() => setPlanosAbertos(v => !v)}
              className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-slate-50 transition-colors"
            >
              <div>
                <p className="font-semibold text-slate-800">Veja os planos que atualmente aceitamos</p>
                <p className="text-slate-500 text-xs mt-0.5">Atendemos os principais convênios médicos — clique para conferir a lista</p>
              </div>
              <svg
                className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${planosAbertos ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {planosAbertos && (
              <div className="px-6 pb-6 border-t border-slate-100">
                <p className="text-xs text-slate-500 mt-4 mb-4 leading-relaxed">
                  Confira abaixo os planos atualmente aceitos pela plataforma. Novos convênios são adicionados periodicamente.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-4">
                  {PLANOS_VALIDOS.filter(p => p !== 'Outro').map(plano => (
                    <div key={plano} className="flex items-center gap-1.5 text-xs text-slate-700 bg-slate-50 rounded-lg px-3 py-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                      {plano}
                    </div>
                  ))}
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-xs text-amber-800 leading-relaxed">
                    <strong>⚠️ Atenção:</strong> esta lista pode sofrer modificações conforme as contratualizações vigentes.
                    Em caso de dúvida, entre em contato com nossa equipe antes de iniciar o cadastro.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    )
  }

  // ── Aguardando validação do plano ─────────────────────────────
  if (etapa === 'aguardando') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-teal-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-10 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Dados recebidos!</h2>
          <p className="text-slate-500 text-sm mb-6 leading-relaxed">
            Recebemos seu cadastro com sucesso. Nossa equipe irá validar seus documentos e entrar em contato em breve.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-left space-y-2">
            <p className="text-amber-800 text-sm font-semibold mb-2">O que acontece agora:</p>
            {[
              'Nossa secretaria verifica seus documentos',
              'Você recebe um link por e-mail e WhatsApp',
              'Retorno em até 1 dia útil (seg.–sex., 08h–18h)',
            ].map(step => (
              <div key={step} className="flex items-start gap-2">
                <span className="text-amber-500 text-base mt-0.5">•</span>
                <p className="text-amber-700 text-sm">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Formulário de cadastro ────────────────────────────────────
  const isPlano = tipo === 'plano'
  const foraHorario = isPlano && !dentroHorario
  const errServer = criar.error?.message ?? iniciarPagamento.error?.message ?? null

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-teal-50 py-10 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setEtapa('escolha')} className="flex items-center gap-1.5 text-slate-500 hover:text-blue-600 text-sm transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Voltar
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <span className="font-bold text-blue-800 text-sm">Facilita PrEP</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
          {/* Badge de tipo */}
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6 ${isPlano ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
            <div className={`w-2 h-2 rounded-full ${isPlano ? 'bg-emerald-500' : 'bg-blue-500'}`} />
            {isPlano ? 'Plano de Saúde' : 'Atendimento Particular'}
          </div>

          <h2 className="text-xl font-bold text-slate-800 mb-1">Seus dados de cadastro</h2>
          <p className="text-slate-400 text-sm mb-6">Todas as informações são protegidas e criptografadas (LGPD).</p>

          {foraHorario && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex gap-3">
              <span className="text-amber-500 text-xl shrink-0">⏰</span>
              <div>
                <p className="text-amber-800 text-sm font-semibold">Fora do horário de atendimento</p>
                <p className="text-amber-700 text-sm mt-1">
                  O atendimento por plano funciona de <strong>segunda a sexta, das 08h às 18h</strong>.
                  Envie seus dados agora — a validação ocorrerá no próximo dia útil.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className={labelCls}>Nome completo</label>
              <input {...register('nome')} className={inputCls} placeholder="Seu nome completo" />
              {errors.nome && <p className={errCls}>{errors.nome.message}</p>}
            </div>

            <div>
              <label className={labelCls}>Telefone (WhatsApp)</label>
              <input {...register('telefone')} className={inputCls} placeholder="(11) 99999-9999" />
              {errors.telefone && <p className={errCls}>{errors.telefone.message}</p>}
            </div>

            <div>
              <label className={labelCls}>CPF</label>
              <input {...register('cpf')} className={inputCls} placeholder="000.000.000-00" />
              {errors.cpf && <p className={errCls}>{errors.cpf.message}</p>}
            </div>

            <div>
              <label className={labelCls}>E-mail</label>
              <input {...register('email')} type="email" className={inputCls} placeholder="seu@email.com" />
              {errors.email && <p className={errCls}>{errors.email.message}</p>}
            </div>

            {isPlano && (
              <>
                <div>
                  <label className={labelCls}>Plano de saúde</label>
                  <select {...register('plano')} className={inputCls}>
                    <option value="">Selecione seu plano</option>
                    {PLANOS_VALIDOS.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                  <p className="text-blue-800 text-sm font-semibold mb-1">Documentos necessários</p>
                  <p className="text-blue-600 text-sm">Envie sua carteirinha do plano e um documento de identidade (RG ou CNH).</p>
                </div>

                <div>
                  <label className={labelCls}>Carteirinha do plano</label>
                  <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl py-5 cursor-pointer bg-slate-50 hover:bg-blue-50 transition-all">
                    <svg className="w-8 h-8 text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="text-sm text-slate-400">{carteirinhaKey ? '✓ Carteirinha enviada' : 'Clique para enviar'}</span>
                    <span className="text-xs text-slate-300 mt-0.5">PDF, JPG ou PNG</span>
                    <input
                      type="file" accept="image/*,.pdf" className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        try { setCarteirinhaKey(await uploadArquivo(file)) }
                        catch { setUploadError('Erro ao enviar carteirinha. Tente novamente.') }
                      }}
                    />
                  </label>
                  {carteirinhaKey && <p className="text-emerald-600 text-xs mt-1.5 flex items-center gap-1">✓ Carteirinha recebida com sucesso</p>}
                </div>

                <div>
                  <label className={labelCls}>Documento de identidade (RG ou CNH)</label>
                  <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl py-5 cursor-pointer bg-slate-50 hover:bg-blue-50 transition-all">
                    <svg className="w-8 h-8 text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="text-sm text-slate-400">{documentoKey ? '✓ Documento enviado' : 'Clique para enviar'}</span>
                    <span className="text-xs text-slate-300 mt-0.5">PDF, JPG ou PNG</span>
                    <input
                      type="file" accept="image/*,.pdf" className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        try { setDocumentoKey(await uploadArquivo(file)) }
                        catch { setUploadError('Erro ao enviar documento. Tente novamente.') }
                      }}
                    />
                  </label>
                  {documentoKey && <p className="text-emerald-600 text-xs mt-1.5 flex items-center gap-1">✓ Documento recebido com sucesso</p>}
                </div>
              </>
            )}

            {uploadError && <p className="text-red-500 text-sm">{uploadError}</p>}
            {errServer && <p className="text-red-500 text-sm">{errServer}</p>}

            {isPlano ? (
              <button
                type="submit"
                disabled={foraHorario || criar.isPending}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-3.5 rounded-2xl font-semibold disabled:opacity-50 hover:from-emerald-600 hover:to-teal-700 transition-all shadow-md hover:shadow-lg text-sm"
              >
                {criar.isPending ? 'Enviando…' : 'Enviar para validação →'}
              </button>
            ) : (
              <button
                type="submit"
                disabled={criar.isPending || iniciarPagamento.isPending}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3.5 rounded-2xl font-semibold disabled:opacity-50 hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg text-sm"
              >
                {criar.isPending || iniciarPagamento.isPending ? 'Aguarde…' : 'Ir para o pagamento →'}
              </button>
            )}

            {!isPlano && (
              <div className="flex items-center justify-center gap-4 pt-1">
                {['PIX', 'Crédito', 'Débito'].map(m => (
                  <span key={m} className="text-xs text-slate-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 inline-block" />
                    {m}
                  </span>
                ))}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
