import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { trpc } from '../../lib/trpc.ts'
import { useAuth } from '../../_core/hooks/useAuth.ts'
import { validarCpf } from '../../../../server/_core/cpfValidator.ts'
import { ERROR_MESSAGES } from '@shared/const.ts'

const schema = z.object({
  cpf: z.string().refine(validarCpf, ERROR_MESSAGES.CPF_INVALID),
  nome: z.string().min(3, 'Nome muito curto'),
  dataNascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  nomeMae: z.string().min(3, 'Informe o nome completo da mãe'),
  sexo: z.enum(['masculino', 'feminino', 'outro']),
})

type FormData = z.infer<typeof schema>

interface Props {
  pacienteId: number | null
  onNext: (pacienteId?: number) => void
  onBack: () => void
  defaultValues?: { nome?: string; cpf?: string }
}

export default function StepPaciente({ pacienteId, onNext, defaultValues }: Props) {
  const hasIntakeNome = !!defaultValues?.nome
  const hasIntakeCpf = !!defaultValues?.cpf
  const { setToken } = useAuth()

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { nome: defaultValues?.nome ?? '', cpf: defaultValues?.cpf ?? '' },
  })

  const salvar = trpc.paciente.salvarStep1.useMutation({
    onSuccess: (data) => {
      // Refresh the stored JWT so page reloads preserve pacienteId
      if (data.newSessionToken) setToken(data.newSessionToken)
      onNext(data.pacienteId)
    },
  })

  const onSubmit = (data: FormData) => salvar.mutate(data)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800 mb-5">Dados Pessoais</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Nome e CPF: vêm do cadastro inicial; armazenados via hidden input,
            sem exibição (instrução: campos já preenchidos não precisam ser mostrados) */}
        {hasIntakeNome
          ? <input type="hidden" {...register('nome')} />
          : (
            <Field label="Nome completo" error={errors.nome?.message}>
              <input
                {...register('nome')}
                className={inputCls(!!errors.nome)}
                placeholder="Como consta no documento"
              />
            </Field>
          )}

        {hasIntakeCpf
          ? <input type="hidden" {...register('cpf')} />
          : (
            <Field label="CPF" error={errors.cpf?.message}>
              <input
                {...register('cpf')}
                className={inputCls(!!errors.cpf)}
                placeholder="000.000.000-00"
                maxLength={14}
              />
            </Field>
          )}

        <Field label="Data de nascimento" error={errors.dataNascimento?.message}>
          <input {...register('dataNascimento')} type="date" className={inputCls(!!errors.dataNascimento)} />
        </Field>

        <Field label="Nome completo da mãe" error={errors.nomeMae?.message}>
          <input
            {...register('nomeMae')}
            className={inputCls(!!errors.nomeMae)}
            placeholder="Nome completo da mãe (obrigatório)"
          />
        </Field>

        <Field label="Sexo ao nascimento" error={errors.sexo?.message}>
          <select {...register('sexo')} className={inputCls(!!errors.sexo)}>
            <option value="">Selecione</option>
            <option value="masculino">Masculino</option>
            <option value="feminino">Feminino</option>
            <option value="outro">Intersexo</option>
          </select>
        </Field>

        {salvar.error && <p className="text-red-500 text-sm">{salvar.error.message}</p>}

        <div className="flex justify-end pt-2">
          <button type="submit" disabled={salvar.isPending} className={btnPrimary}>
            {salvar.isPending ? 'Salvando…' : 'Próximo →'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

const inputCls = (hasError: boolean) =>
  `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${hasError ? 'border-red-400' : 'border-slate-300'}`

const btnPrimary = 'bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 px-6 rounded-lg transition-colors'
