import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FORM_STEPS, TOTAL_FORM_STEPS } from '@shared/const.ts'
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
}

function TelaDocumentos({ pacienteId }: { pacienteId: number }) {
  const { data: pdfs, isLoading } = trpc.paciente.downloadPdfs.useQuery(
    { pacienteId },
    { refetchInterval: 4000, refetchIntervalInBackground: false },
  )

  const handlePrint = (url: string) => {
    const win = window.open(url, '_blank')
    win?.focus()
    win?.print()
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-lg w-full">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-800 text-center mb-1">Formulário enviado!</h2>
        <p className="text-slate-500 text-sm text-center mb-6">
          Seus documentos estão sendo assinados digitalmente com certificado ICP-Brasil.
        </p>

        {isLoading || !pdfs || pdfs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
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
                    className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
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
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mt-4">
              <p className="text-emerald-800 text-xs font-medium">
                Documentos também enviados para seu e-mail.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function FormularioPaciente({ pacienteId: initialPacienteId, initialStep = 1 }: Props) {
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
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-blue-700">Facilita PrEP</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Etapa {currentStep} de {TOTAL_FORM_STEPS} — {FORM_STEPS[currentStep - 1]?.titulo}
          </p>
          <div className="mt-3 h-2 bg-slate-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-blue-500 rounded-full"
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
                defaultValues={{ nome: intakeData?.nome, cpf: intakeData?.cpf }}
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
            {currentStep === 6 && <StepServico {...stepProps} />}
            {currentStep === 7 && <StepAutorizados {...stepProps} />}
            {currentStep === 8 && <StepTcle {...stepProps} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
