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

interface Props {
  pacienteId?: number
  initialStep?: number
}

export default function FormularioPaciente({ pacienteId: initialPacienteId, initialStep = 1 }: Props) {
  const [currentStep, setCurrentStep] = useState(initialStep)
  const [pacienteId, setPacienteId] = useState<number | null>(initialPacienteId ?? null)

  const next = (newPacienteId?: number) => {
    if (newPacienteId) setPacienteId(newPacienteId)
    setCurrentStep((s) => Math.min(s + 1, TOTAL_FORM_STEPS))
  }

  const back = () => setCurrentStep((s) => Math.max(s - 1, 1))

  const progress = ((currentStep - 1) / (TOTAL_FORM_STEPS - 1)) * 100

  const stepProps = { pacienteId, onNext: next, onBack: back }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
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

        {/* Etapa atual */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            {currentStep === 1 && <StepPaciente {...stepProps} />}
            {currentStep === 2 && <StepDemografico {...stepProps} />}
            {currentStep === 3 && <StepContato {...stepProps} />}
            {currentStep === 4 && <StepConduta {...stepProps} />}
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
