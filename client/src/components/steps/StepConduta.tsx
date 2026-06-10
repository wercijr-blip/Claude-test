import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "../../lib/trpc.ts";
import { useFormDraft } from "../../hooks/useFormDraft.ts";
import { traduzirErroTrpc } from "../../lib/errorMessages.ts";
import { SubmitButton } from "../SubmitButton.tsx";

const schema = z.object({
  pacienteId: z.number(),
  conduta: z.object({
    temSintomasDst: z.boolean(),
    usoDrogas: z.boolean(),
    // 'prepAdesao' é obrigatório só quando tipoConsulta === 'ja_faco_prep'.
    // A validação cruzada acontece no submit (depende de prop externa).
    prepAdesao: z.enum(["diaria", "sob_demanda"]).optional(),
  }),
});

type FormData = z.infer<typeof schema>;

interface Props {
  pacienteId: number | null;
  onNext: () => void;
  onBack: () => void;
  examData?: { dataExame?: string | null; resultadoHiv?: string | null };
  tipoConsulta?: "primeiro_atendimento" | "ja_faco_prep" | null;
}

export default function StepConduta({
  pacienteId,
  onNext,
  onBack,
  examData,
  tipoConsulta,
}: Props) {
  const isJaFazPrep = tipoConsulta === "ja_faco_prep";

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      pacienteId: pacienteId ?? 0,
      conduta: { temSintomasDst: false, usoDrogas: false },
    },
  });
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = form;
  const { clearDraft } = useFormDraft(form, "step-conduta-draft");

  const salvar = trpc.paciente.salvarStep4.useMutation({
    onSuccess: () => {
      clearDraft();
      onNext();
    },
  });

  const temSintomasDst = watch("conduta.temSintomasDst") ?? false;
  const usoDrogas = watch("conduta.usoDrogas") ?? false;

  const onSubmit = (d: FormData) => {
    if (isJaFazPrep && !d.conduta.prepAdesao) {
      setError("conduta.prepAdesao", {
        message: "Selecione como tem tomado a PrEP.",
      });
      return;
    }
    clearErrors("conduta.prepAdesao");
    salvar.mutate(d);
  };

  if (!pacienteId) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800 mb-2">Conduta</h2>
      <p className="text-sm text-slate-500 mb-4">
        Informações clínicas confidenciais para avaliação médica.
      </p>

      {(examData?.dataExame || examData?.resultadoHiv) && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-5">
          <p className="text-blue-800 text-xs font-semibold mb-1">
            Resultado do exame Anti-HIV (validado)
          </p>
          {examData.dataExame && (
            <p className="text-blue-700 text-xs">
              Data do exame: <strong>{examData.dataExame}</strong>
            </p>
          )}
          {examData.resultadoHiv && (
            <p className="text-blue-700 text-xs">
              Resultado:{" "}
              <strong>
                {examData.resultadoHiv === "nao_reagente"
                  ? "Não reagente"
                  : "Reagente"}
              </strong>
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <BoolGroup
          label="Tem sintomas de DST/IST?"
          value={temSintomasDst}
          onChange={(v) =>
            setValue("conduta.temSintomasDst", v, {
              shouldValidate: true,
              shouldDirty: true,
            })
          }
        />

        <BoolGroup
          label="Faz uso de drogas?"
          value={usoDrogas}
          onChange={(v) =>
            setValue("conduta.usoDrogas", v, {
              shouldValidate: true,
              shouldDirty: true,
            })
          }
        />

        {isJaFazPrep && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Como tem tomado a PrEP?
            </label>
            <select
              {...register("conduta.prepAdesao")}
              className={inputCls(!!errors.conduta?.prepAdesao)}
            >
              <option value="">Selecione</option>
              <option value="diaria">Diária (1 comprimido por dia)</option>
              <option value="sob_demanda">
                Sob demanda (antes/depois da exposição)
              </option>
            </select>
            {errors.conduta?.prepAdesao && (
              <p role="alert" className="mt-1 text-xs text-red-500">
                {errors.conduta.prepAdesao.message}
              </p>
            )}
          </div>
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

function BoolGroup({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const opts: { val: boolean; label: string }[] = [
    { val: false, label: "Não" },
    { val: true, label: "Sim" },
  ];
  return (
    <div>
      <p className="text-sm font-medium text-slate-700 mb-2">{label}</p>
      <div className="flex gap-3">
        {opts.map((opt) => {
          const checked = value === opt.val;
          return (
            <button
              type="button"
              key={String(opt.val)}
              onClick={() => onChange(opt.val)}
              aria-pressed={checked}
              className={`flex-1 flex items-center justify-center gap-2 border rounded-lg py-2.5 px-4 cursor-pointer text-sm font-medium transition-colors ${checked ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const inputCls = (e: boolean) =>
  `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${e ? "border-red-400" : "border-slate-300"}`;
const btnSecondary =
  "text-slate-600 hover:text-slate-800 font-medium py-2 px-4 rounded-lg transition-colors";
