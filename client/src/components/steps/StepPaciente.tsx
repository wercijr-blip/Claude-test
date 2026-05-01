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
  cns: z.string().max(20).optional(),
  sexo: z.enum(['masculino', 'feminino', 'outro']),
  nomeSocial: z.string().optional(),
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
        <Field label="Nome completo" error={errors.nome?.message}>
          <input
            {...register('nome')}
            className={inputCls(!!errors.nome)}
            placeholder="Como consta no documento"
            readOnly={hasIntakeNome}
            style={hasIntakeNome ? { background: '#f8fafc', color: '#64748b' } : undefined}
          />
          {hasIntakeNome && <p className="mt-0.5 text-xs text-slate-400">Preenchido automaticamente do cadastro</p>}
        </Field>

        <Field label="CPF" error={errors.cpf?.message}>
          <input
            {...register('cpf')}
            className={inputCls(!!errors.cpf)}
            placeholder="000.000.000-00"
            maxLength={14}
            readOnly={hasIntakeCpf}
            style={hasIntakeCpf ? { background: '#f8fafc', color: '#64748b' } : undefined}
          />
          {hasIntakeCpf && <p className="mt-0.5 text-xs text-slate-400">Preenchido automaticamente do cadastro</p>}
        </Field>

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

        <Field label="CNS — Cartão Nacional de Saúde (opcional)" error={errors.cns?.message}>
          <input
            {...register('cns')}
            className={inputCls(false)}
            placeholder="000 0000 0000 0000"
            maxLength={20}
          />
        </Field>

        <Field label="Sexo biológico" error={errors.sexo?.message}>
          <select {...register('sexo')} className={inputCls(!!errors.sexo)}>
            <option value="">Selecione</option>
            <option value="masculino">Masculino</option>
            <option value="feminino">Feminino</option>
            <option value="outro">Outro</option>
          </select>
        </Field>

        <Field label="Nome social (opcional)" error={errors.nomeSocial?.message}>
          <input {...register('nomeSocial')} className={inputCls(false)} placeholder="Nome pelo qual prefere ser chamado(a)" />
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
