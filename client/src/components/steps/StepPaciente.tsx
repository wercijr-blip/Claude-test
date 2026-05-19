import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { trpc } from '../../lib/trpc.ts'
import { useAuth } from '../../_core/hooks/useAuth.ts'
import { validarCpf } from '@shared/validators.ts'
import { ERROR_MESSAGES } from '@shared/const.ts'
import { useFormDraft } from '../../hooks/useFormDraft.ts'
import { toast } from '../../lib/use-toast.ts'
import { traduzirErroTrpc } from '../../lib/errorMessages.ts'

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

export default function StepPaciente({ pacienteId: _pacienteId, onNext, defaultValues }: Props) {
  const hasIntakeNome = !!defaultValues?.nome
  const hasIntakeCpf = !!defaultValues?.cpf
  const { setToken } = useAuth()

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { nome: defaultValues?.nome ?? '', cpf: defaultValues?.cpf ?? '' },
  })
  const { register, handleSubmit, formState: { errors } } = form
  const { clearDraft } = useFormDraft(form, 'step-paciente-draft', { omitFields: ['cpf', 'dataNascimento', 'nomeMae'] })

  const salvar = trpc.paciente.salvarStep1.useMutation({
    onSuccess: (data) => {
      clearDraft()
      if (data.newSessionToken) setToken(data.newSessionToken)
      onNext(data.pacienteId)
    },
    onError: (err) => {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'error' })
    },
  })

  const onSubmit = (data: FormData) => salvar.mutate(data)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800 mb-5">Dados Pessoais</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Nome — se veio do cadastro, mostra como leitura; senão, input editável */}
        {hasIntakeNome ? (
          <Field label="Nome completo">
            <ReadonlyValue value={defaultValues!.nome!} />
            <input type="hidden" {...register('nome')} />
            <p className="mt-1 text-xs text-slate-400">Preenchido automaticamente do cadastro · não editável</p>
          </Field>
        ) : (
          <Field label="Nome completo" error={errors.nome?.message} name="nome">
            <input
              id="nome"
              {...register('nome')}
              className={inputCls(!!errors.nome)}
              aria-invalid={errors.nome ? true : undefined}
              aria-describedby={errors.nome ? 'nome-err' : undefined}
              placeholder="Como consta no documento"
            />
          </Field>
        )}

        {hasIntakeCpf ? (
          <Field label="CPF">
            <ReadonlyValue value={defaultValues!.cpf!} />
            <input type="hidden" {...register('cpf')} />
            <p className="mt-1 text-xs text-slate-400">Preenchido automaticamente do cadastro · não editável</p>
          </Field>
        ) : (
          <Field label="CPF" error={errors.cpf?.message} name="cpf">
            <input
              id="cpf"
              {...register('cpf')}
              className={inputCls(!!errors.cpf)}
              aria-invalid={errors.cpf ? true : undefined}
              aria-describedby={errors.cpf ? 'cpf-err' : undefined}
              placeholder="000.000.000-00"
              maxLength={14}
            />
          </Field>
        )}

        <Field label="Data de nascimento" error={errors.dataNascimento?.message} name="dataNascimento">
          <input id="dataNascimento" {...register('dataNascimento')} type="date" className={inputCls(!!errors.dataNascimento)} aria-invalid={errors.dataNascimento ? true : undefined} aria-describedby={errors.dataNascimento ? 'dataNascimento-err' : undefined} />
        </Field>

        <Field label="Nome completo da mãe" error={errors.nomeMae?.message} name="nomeMae">
          <input
            id="nomeMae"
            {...register('nomeMae')}
            className={inputCls(!!errors.nomeMae)}
            aria-invalid={errors.nomeMae ? true : undefined}
            aria-describedby={errors.nomeMae ? 'nomeMae-err' : undefined}
            placeholder="Nome completo da mãe (obrigatório)"
          />
        </Field>

        <Field label="Sexo ao nascimento" error={errors.sexo?.message} name="sexo">
          <select id="sexo" {...register('sexo')} className={inputCls(!!errors.sexo)} aria-describedby={errors.sexo ? 'sexo-err' : undefined}>
            <option value="">Selecione</option>
            <option value="masculino">Masculino</option>
            <option value="feminino">Feminino</option>
            <option value="outro">Intersexo</option>
          </select>
        </Field>

        {salvar.error && <p className="text-red-500 text-sm">{traduzirErroTrpc(salvar.error)}</p>}

        <div className="flex justify-end pt-2">
          <button type="submit" disabled={salvar.isPending} className={btnPrimary}>
            {salvar.isPending ? 'Salvando…' : 'Próximo →'}
          </button>
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

/** Caixa que mostra um valor já preenchido — visualmente igual a um input
 *  desabilitado, mas o valor real fica num <input type="hidden"/> registrado
 *  no formulário (evita race conditions com defaultValues do useForm). */
function ReadonlyValue({ value }: { value: string }) {
  return (
    <div className="w-full border border-slate-200 bg-slate-50 text-slate-700 rounded-lg px-3 py-2 text-sm">
      {value}
    </div>
  )
}

const inputCls = (hasError: boolean) =>
  `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${hasError ? 'border-red-400' : 'border-slate-300'}`

const btnPrimary = 'bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 px-6 rounded-lg transition-colors'
