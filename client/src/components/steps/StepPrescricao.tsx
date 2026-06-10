import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "../../lib/trpc.ts";
import { useFormDraft } from "../../hooks/useFormDraft.ts";
import { traduzirErroTrpc } from "../../lib/errorMessages.ts";
import { SubmitButton } from "../SubmitButton.tsx";
import { PREP_MODALIDADE, type PrepModalidade } from "@shared/const.ts";

const schema = z.object({
  pacienteId: z.number(),
  prepModalidade: z.enum([PREP_MODALIDADE.DIARIA, PREP_MODALIDADE.SOB_DEMANDA]),
});

type FormData = z.infer<typeof schema>;
interface Props {
  pacienteId: number | null;
  onNext: () => void;
  onBack: () => void;
}

export default function StepPrescricao({ pacienteId, onNext, onBack }: Props) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      pacienteId: pacienteId ?? 0,
      prepModalidade: PREP_MODALIDADE.DIARIA,
    },
  });
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = form;
  const { clearDraft } = useFormDraft(form, "step-prescricao-draft");

  const salvar = trpc.paciente.salvarStep5.useMutation({
    onSuccess: () => {
      clearDraft();
      onNext();
    },
  });
  const escolha = watch("prepModalidade");

  if (!pacienteId) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800 mb-1">
        Modalidade da PrEP
      </h2>
      <p className="text-sm text-slate-500 mb-5">
        Escolha como prefere tomar a PrEP.{" "}
        <strong>A PrEP diária é o esquema preferencial</strong> recomendado pelo
        Ministério da Saúde.
      </p>

      <form
        onSubmit={handleSubmit((d) => salvar.mutate(d))}
        className="space-y-4"
      >
        <ModalidadeCard
          value={PREP_MODALIDADE.DIARIA}
          escolha={escolha}
          register={register("prepModalidade")}
          titulo="PrEP diária"
          subtitulo="Esquema preferencial — recomendado para a maioria dos casos"
          recomendado
        >
          <ul className="text-xs text-slate-600 space-y-1 mt-2">
            <li>
              • <strong>1 comprimido todos os dias</strong>, em horário fixo
            </li>
            <li>
              • Proteção máxima após 7 dias (relação anal) ou 20 dias (vaginal)
            </li>
            <li>
              • Indicado para qualquer pessoa em risco de infecção pelo HIV
            </li>
            <li>
              • Pode ser interrompido após 28 dias sem exposição (com orientação
              médica)
            </li>
          </ul>
        </ModalidadeCard>

        <ModalidadeCard
          value={PREP_MODALIDADE.SOB_DEMANDA}
          escolha={escolha}
          register={register("prepModalidade")}
          titulo="PrEP sob demanda (Esquema 2-1-1)"
          subtitulo="Apenas para homens cis HSH adultos com relações sexuais programadas e infrequentes"
        >
          <ul className="text-xs text-slate-600 space-y-1 mt-2">
            <li>
              • <strong>2 comprimidos</strong> de 2 a 24 horas antes da relação
              sexual
            </li>
            <li>
              • <strong>1 comprimido</strong> 24 horas após a 1ª dose
            </li>
            <li>
              • <strong>1 comprimido</strong> 48 horas após a 1ª dose
            </li>
            <li>
              • <strong>Não é indicado</strong> para mulheres cis, pessoas
              trans, hepatite B ou rim alterado
            </li>
          </ul>
        </ModalidadeCard>

        {errors.prepModalidade && (
          <p role="alert" className="text-red-500 text-sm">
            {errors.prepModalidade.message}
          </p>
        )}
        {salvar.error && (
          <p role="alert" className="text-red-500 text-sm">
            {traduzirErroTrpc(salvar.error)}
          </p>
        )}

        <div className="flex justify-between pt-2">
          <button type="button" onClick={onBack} className={btnSecondary}>
            ← Anterior
          </button>
          <SubmitButton isPending={salvar.isPending} />
        </div>
      </form>
    </div>
  );
}

function ModalidadeCard({
  value,
  escolha,
  register,
  titulo,
  subtitulo,
  recomendado,
  children,
}: {
  value: PrepModalidade;
  escolha: PrepModalidade | undefined;
  register: ReturnType<ReturnType<typeof useForm<FormData>>["register"]>;
  titulo: string;
  subtitulo: string;
  recomendado?: boolean;
  children: React.ReactNode;
}) {
  const ativo = escolha === value;
  return (
    <label
      className={`block border-2 rounded-xl p-4 cursor-pointer transition-all ${
        ativo
          ? "border-blue-500 bg-blue-50"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <div className="flex items-start gap-3">
        <input type="radio" value={value} {...register} className="mt-1" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-semibold ${ativo ? "text-blue-700" : "text-slate-800"}`}
            >
              {titulo}
            </span>
            {recomendado && (
              <span className="text-[10px] uppercase tracking-wide bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">
                Recomendada
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{subtitulo}</p>
          {children}
        </div>
      </div>
    </label>
  );
}

const btnSecondary =
  "text-slate-600 hover:text-slate-800 font-medium py-2 px-4 rounded-lg transition-colors";
