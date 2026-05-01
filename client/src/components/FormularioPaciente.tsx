import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLocation } from 'wouter'
import { FORM_STEPS, TOTAL_FORM_STEPS } from '@shared/const.ts'
import { LogoWordmark } from './Logo.tsx'
import StepPaciente from './steps/StepPaciente.tsx'
import StepDemografico from './steps/StepDemografico.tsx'
import StepContato from './steps/StepContato.tsx'
import StepConduta from './steps/StepConduta.tsx'
import StepPrescricao from './steps/StepPrescricao.tsx'
import StepServico from './steps/StepServico.tsx'
import StepAutorizados from './steps/StepAutorizados.tsx'
import StepTcle from './StepTcle.tsx'
import { trpc } from '../lib/trpc.ts'

interface Props {
  pacienteId?: number
  initialStep?: number
}

type TipoPdf = { id: number; tipo: string; assinadoEm: Date | null; url: string }

const LABEL_PDF: Record<string, string> = {
  formulario: 'Formulário Clínico',
  prescricao: 'Receita PrEP',
  cadastro: 'Ficha de Cadastro',
  pedido_completo: 'Pedido de Exames Completo PrEP',
  pedido_ist: 'Pedido de Sorológicos IST',
  pedido_hiv: 'Pedido Anti-HIV',
  pedido_densitometria: 'Pedido de Densitometria Óssea',
}

function TelaDocumentos({ pacienteId }: { pacienteId: number }) {
  const { data: pdfs, isLoading } = trpc.paciente.downloadPdfs.useQuery(
    { pacienteId },
    {
      refetchInterval: (query) => (query.state.data && query.state.data.length > 0 ? false : 4000),
      refetchIntervalInBackground: false,
    },
  )

  const handlePrint = (url: string) => {
    const win = window.open(url, '_blank')
    win?.focus()
    win?.print()
  }

  return (
    <div className="min-h-screen bg-warm-bg flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-8 max-w-lg w-full">
        <div className="flex justify-center mb-4">
          <LogoWordmark size={40} mode="light" />
        </div>
        <h2 className="font-display text-3xl font-light text-fp-dark text-center mb-1">Pronto! Seus documentos estão prontos</h2>
        <p className="text-slate-500 text-sm text-center mb-6">
          Obrigado por confiar no Facilita PrEP. Em instantes você receberá tudo no seu e-mail — assinado digitalmente com certificado ICP-Brasil.
        </p>

        {isLoading || !pdfs || pdfs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-8 h-8 border-4 border-brand-light border-t-brand rounded-full animate-spin" />
            <p className="text-slate-500 text-sm">Gerando documentos assinados…</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700 mb-2">Documentos prontos para download:</p>
            {(pdfs as TipoPdf[]).map((pdf) => (
              <div key={pdf.id} className="flex items-center justify-between bg-slate-50 rounded-xl p-3 border border-slate-200">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {LABEL_PDF[pdf.tipo] ?? pdf.tipo}
                  </p>
                  <p className="text-xs text-slate-500">Assinatura digital ICP-Brasil</p>
                </div>
                <div className="flex gap-2">
                  <a
                    href={pdf.url}
                    download
                    className="text-xs bg-brand text-white px-3 py-1.5 rounded-lg hover:bg-brand-dark transition-colors"
                  >
                    Download
                  </a>
                  <button
                    onClick={() => handlePrint(pdf.url)}
                    className="text-xs bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-300 transition-colors"
                  >
                    Imprimir
                  </button>
                </div>
              </div>
            ))}
            <div className="bg-sage-pale border border-sage-light rounded-xl p-3 mt-4">
              <p className="text-sage-dark text-xs font-medium">
                Documentos também enviados para seu e-mail.
              </p>
            </div>

            {/* Saiba onde retirar sua PrEP */}
            <div className="mt-6 border-t border-slate-100 pt-6 space-y-4">
              <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <svg className="w-4 h-4 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Saiba onde retirar sua PrEP
              </p>

              {/* Particular */}
              <div className="bg-brand-pale border border-brand-light rounded-xl p-4">
                <p className="text-brand-dark text-xs font-semibold mb-1">💊 Farmácias e drogarias (particular)</p>
                <p className="text-brand text-xs leading-relaxed">
                  Apresente a receita digital em qualquer farmácia ou drogaria do Brasil. A assinatura ICP-Brasil tem validade jurídica em todo o território nacional.
                </p>
              </div>

              {/* SUS */}
              <div className="bg-sage-pale border border-sage-light rounded-xl p-4">
                <p className="text-sage-dark text-xs font-semibold mb-3">🏥 Rede pública — o que levar à UDM</p>

                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-sage-dark mb-1.5">Se é sua primeira retirada:</p>
                    <ul className="space-y-1">
                      {[
                        'Ficha de Cadastro (gerada pelo Facilita PrEP)',
                        'Receita Médica (gerada pelo Facilita PrEP)',
                        'Formulário PrEP (gerado pelo Facilita PrEP)',
                        'Resultado do exame Anti-HIV (até 7 dias — o mesmo enviado aqui)',
                      ].map(item => (
                        <li key={item} className="flex items-start gap-1.5 text-xs text-sage-dark">
                          <svg className="w-3.5 h-3.5 text-sage shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="border-t border-sage-light pt-3">
                    <p className="text-xs font-semibold text-sage-dark mb-1.5">Se já usa PrEP regularmente:</p>
                    <ul className="space-y-1">
                      {[
                        'Receita Médica (gerada pelo Facilita PrEP)',
                        'Formulário PrEP (gerado pelo Facilita PrEP)',
                        'Resultado do exame Anti-HIV (até 7 dias — o mesmo enviado aqui)',
                      ].map(item => (
                        <li key={item} className="flex items-start gap-1.5 text-xs text-sage-dark">
                          <svg className="w-3.5 h-3.5 text-sage shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <a
                  href="https://azt.aids.gov.br"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-3 bg-sage text-white text-xs font-semibold px-3 py-2 rounded-xl hover:bg-sage-dark transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Encontrar UDM mais próxima → azt.aids.gov.br
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function FormularioPaciente({ pacienteId: initialPacienteId, initialStep = 1 }: Props) {
  const [, navigate] = useLocation()
  const [currentStep, setCurrentStep] = useState(initialStep)
  const [pacienteId, setPacienteId] = useState<number | null>(initialPacienteId ?? null)
  const [finalizado, setFinalizado] = useState(false)

  const { data: intakeData } = trpc.paciente.dadosIntake.useQuery(undefined, { retry: false })
  const { data: consultaStatus } = trpc.consulta.status.useQuery(undefined, { retry: false })

  const next = (newPacienteId?: number) => {
    if (newPacienteId) setPacienteId(newPacienteId)
    if (currentStep === TOTAL_FORM_STEPS) {
      setFinalizado(true)
    } else {
      setCurrentStep((s) => Math.min(s + 1, TOTAL_FORM_STEPS))
    }
  }

  const back = () => setCurrentStep((s) => Math.max(s - 1, 1))

  if (finalizado && pacienteId) {
    return <TelaDocumentos pacienteId={pacienteId} />
  }

  const progress = ((currentStep - 1) / (TOTAL_FORM_STEPS - 1)) * 100
  const stepProps = { pacienteId, onNext: next, onBack: back }

  return (
    <div className="min-h-screen bg-warm-bg py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <button
            type="button"
            onClick={() => navigate('/inicio')}
            className="text-xs text-slate-500 hover:text-brand transition-colors flex items-center gap-1 mb-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Voltar para etapas anteriores
          </button>
          <h1 className="text-xl font-bold text-brand">Facilita PrEP</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Etapa {currentStep} de {TOTAL_FORM_STEPS} — {FORM_STEPS[currentStep - 1]?.titulo}
          </p>
          <div className="mt-3 h-2 bg-slate-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-brand-pale0 rounded-full"
              animate={{ width: `${progress}%` }}
              transition={{ ease: 'easeInOut', duration: 0.4 }}
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            {currentStep === 1 && (
              <StepPaciente
                {...stepProps}
                defaultValues={{
                  nome: intakeData?.nome,
                  cpf: intakeData?.cpf,
                  dataNascimento: intakeData?.dataNascimento ?? undefined,
                }}
              />
            )}
            {currentStep === 2 && <StepDemografico {...stepProps} />}
            {currentStep === 3 && (
              <StepContato
                {...stepProps}
                defaultValues={{ email: intakeData?.email, telefone: intakeData?.telefone }}
              />
            )}
            {currentStep === 4 && (
              <StepConduta
                {...stepProps}
                examData={{
                  dataExame: (consultaStatus as { dataExame?: string | null })?.dataExame,
                  resultadoHiv: (consultaStatus as { resultadoHiv?: string | null })?.resultadoHiv,
                }}
              />
            )}
            {currentStep === 5 && <StepPrescricao {...stepProps} />}
            {currentStep === 6 && (
              <StepServico
                {...stepProps}
                defaultValues={intakeData ? {
                  tipoAtendimento: intakeData.tipo === 'plano' ? 'convenio' : 'particular',
                  convenio: intakeData.plano ?? undefined,
                } : undefined}
              />
            )}
            {currentStep === 7 && <StepAutorizados {...stepProps} />}
            {currentStep === 8 && <StepTcle {...stepProps} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
