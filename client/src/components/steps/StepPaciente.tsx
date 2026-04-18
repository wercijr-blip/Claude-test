import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { trpc } from '../../lib/trpc.ts'
import { validarCpf } from '../../../../server/_core/cpfValidator.ts'
import { ERROR_MESSAGES } from '@shared/const.ts'

const schema = z.object({
  cpf: z.string().refine(validarCpf, ERROR_MESSAGES.CPF_INVALID),
  nome: z.string().min(3, 'Nome muito curto'),
  dataNascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  sexo: z.enum(['masculino', 'feminino', 'outro']),
  nomeSocial: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  pacienteId: number | null
  onNext: (pacienteId?: number) => void
  onBack: () => void
}

export default function StepPaciente({ pacienteId, onNext }: Props) {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const salvar = trpc.paciente.salvarStep1.useMutation({
    onSuccess: (data) => onNext(data.pacienteId),
  })

  const onSubmit = (data: FormData) => salvar.mutate(data)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800 mb-5">Dados Pessoais</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="Nome completo" error={errors.nome?.message}>
          <input {...register('nome')} className={inputCls(!!errors.nome)} placeholder="Como consta no documento" />
        </Field>

        <Field label="CPF" error={errors.cpf?.message}>
          <input {...register('cpf')} className={inputCls(!!errors.cpf)} placeholder="000.000.000-00" maxLength={14} />
        </Field>

        <Field label="Data de nascimento" error={errors.dataNascimento?.message}>
          <input {...register('dataNascimento')} type="date" className={inputCls(!!errors.dataNascimento)} />
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
