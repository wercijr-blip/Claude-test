import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { trpc } from '../../lib/trpc.ts'
import { useFormDraft } from '../../hooks/useFormDraft.ts'
import { traduzirErroTrpc } from '../../lib/errorMessages.ts'
import { SubmitButton } from '../SubmitButton.tsx'
import {
  COR_RACA_OPTIONS,
  ESCOLARIDADE_OPTIONS,
  IDENTIDADE_GENERO_OPTIONS,
  ORIENTACAO_SEXUAL_OPTIONS,
  ESTADOS_BR,
} from '@shared/const.ts'

const schema = z.object({
  pacienteId: z.number(),
  corRaca: z.string().min(1, 'Selecione uma opção'),
  escolaridade: z.string().min(1, 'Selecione uma opção'),
  identidadeGenero: z.string().optional(),
  orientacaoSexual: z.string().optional(),
  ufNascimento: z.string().optional(),
  municipioNascimento: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props { pacienteId: number | null; onNext: () => void; onBack: () => void }

export default function StepDemografico({ pacienteId, onNext, onBack }: Props) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { pacienteId: pacienteId ?? 0 },
  })
  const { register, handleSubmit, formState: { errors } } = form
  const { clearDraft } = useFormDraft(form, 'step-demografico-draft')

  const salvar = trpc.paciente.salvarStep2.useMutation({ onSuccess: () => { clearDraft(); onNext() } })

  if (!pacienteId) return null

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800 mb-5">Dados Demográficos</h2>

      <form onSubmit={handleSubmit((d) => salvar.mutate(d))} className="space-y-4">
        <Field label="Cor/Raça" error={errors.corRaca?.message} name="corRaca">
          <select id="corRaca" {...register('corRaca')} className={inputCls(!!errors.corRaca)} aria-invalid={errors.corRaca ? true : undefined} aria-describedby={errors.corRaca ? 'corRaca-err' : undefined}>
            <option value="">Selecione</option>
            {COR_RACA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>

        <Field label="Escolaridade" error={errors.escolaridade?.message} name="escolaridade">
          <select id="escolaridade" {...register('escolaridade')} className={inputCls(!!errors.escolaridade)} aria-invalid={errors.escolaridade ? true : undefined} aria-describedby={errors.escolaridade ? 'escolaridade-err' : undefined}>
            <option value="">Selecione</option>
            {ESCOLARIDADE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>

        <Field label="Identidade de gênero (opcional)" error={undefined}>
          <select {...register('identidadeGenero')} className={inputCls(false)}>
            <option value="">Selecione (opcional)</option>
            {IDENTIDADE_GENERO_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>

        <Field label="Orientação sexual (opcional)" error={undefined}>
          <select {...register('orientacaoSexual')} className={inputCls(false)}>
            <option value="">Selecione (opcional)</option>
            {ORIENTACAO_SEXUAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="UF de nascimento (opcional)" error={undefined}>
            <select {...register('ufNascimento')} className={inputCls(false)}>
              <option value="">Selecione</option>
              {ESTADOS_BR.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </Field>

          <Field label="Município de nascimento (opcional)" error={undefined}>
            <input {...register('municipioNascimento')} className={inputCls(false)} placeholder="Nome do município" />
          </Field>
        </div>

        {salvar.error && <p role="alert" className="text-red-500 text-sm">{traduzirErroTrpc(salvar.error)}</p>}

        <div className="flex justify-between pt-2">
          <button type="button" onClick={onBack} className={btnSecondary}>← Anterior</button>
          <SubmitButton isPending={salvar.isPending} />
        </div>
      </form>
    </div>
  )
}

function Field({ label, error, children, name }: { label: string; error?: string; children: React.ReactNode; name?: string }) {
  const errorId = name && error ? `${name}-err` : undefined
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
      {error && <p id={errorId} role="alert" className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

const inputCls = (e: boolean) => `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${e ? 'border-red-400' : 'border-slate-300'}`
const btnSecondary = 'text-slate-600 hover:text-slate-800 font-medium py-2 px-4 rounded-lg transition-colors'
