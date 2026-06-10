import { useState, useEffect, useRef } from "react";
import * as Sentry from "@sentry/react";
import { trpc } from "../lib/trpc.ts";
import { useLocation } from "wouter";
import { LogoWordmark } from "./Logo.tsx";
import { useAuth } from "../_core/hooks/useAuth.ts";

type Etapa =
  | "tipo_consulta"
  | "tem_exame"
  | "upload_exame"
  | "gerar_pedido"
  | "aguardando_ia"
  | "em_revisao_medica"
  | "aprovado"
  | "rejeitado"
  | "rejeitado_data_invalida"
  | "rejeitado_nome_invalido"
  | "rejeitado_tipo_invalido"
  | "expirado";
type TipoConsulta = "primeiro_atendimento" | "ja_faco_prep";

const btnPrimary =
  "w-full bg-brand text-white py-3.5 rounded-2xl font-semibold hover:bg-brand-dark disabled:opacity-50 transition-all shadow-md hover:shadow-lg text-sm";

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-warm-bg py-10 px-4">
      <div className="max-w-lg mx-auto">
        <div className="flex justify-center mb-8">
          <LogoWordmark size={40} mode="light" />
        </div>
        {children}
      </div>
    </div>
  );
}

// Linha de critério validado (✓ / ✗ / ?) com título e valor lido pela IA.
type CheckState = "ok" | "falhou" | "nao_avaliado";
function CritCheck({
  estado,
  titulo,
  valor,
  sub,
}: {
  estado: CheckState;
  titulo: string;
  valor: string;
  sub?: string;
}) {
  const cls =
    estado === "ok"
      ? "bg-sage text-white"
      : estado === "falhou"
        ? "bg-terra text-white"
        : "bg-slate-200 text-slate-500";
  const tituloCls =
    estado === "falhou"
      ? "text-terra"
      : estado === "nao_avaliado"
        ? "text-slate-400"
        : "text-sage-dark";
  const valorCls =
    estado === "falhou"
      ? "text-terra"
      : estado === "nao_avaliado"
        ? "text-slate-500"
        : "text-sage-dark";
  return (
    <div className="flex items-start gap-3">
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${cls}`}
      >
        {estado === "ok" && (
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        )}
        {estado === "falhou" && (
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        )}
        {estado === "nao_avaliado" && (
          <span className="text-xs font-bold">?</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`text-xs font-semibold uppercase tracking-wide ${tituloCls}`}
        >
          {titulo}
        </p>
        <p className={`text-sm font-medium break-words ${valorCls}`}>{valor}</p>
        {sub && (
          <p className="text-xs mt-0.5 break-words text-slate-500">{sub}</p>
        )}
      </div>
    </div>
  );
}

function StatusCard({
  icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <PageShell>
      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-10 text-center">
        <div
          className={`w-20 h-20 ${iconBg} rounded-full flex items-center justify-center mx-auto mb-6`}
        >
          <div className={iconColor}>{icon}</div>
        </div>
        <h2 className="font-display text-2xl font-medium text-fp-dark mb-2 leading-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="text-slate-500 text-sm leading-relaxed mb-4">
            {subtitle}
          </p>
        )}
        {children}
      </div>
    </PageShell>
  );
}

const TERMINAL_ETAPAS: Etapa[] = ["aprovado", "rejeitado", "expirado"];

export default function SegundaParteInicio() {
  const [, navigate] = useLocation();

  // If ?codigo= is present, validate it immediately and overwrite any existing
  // JWT — prevents shared-device from showing the wrong patient's data (LGPD).
  const [codigoFromUrl] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    const code = p.get("codigo") ?? "";
    if (code) window.history.replaceState({}, "", "/inicio");
    return code;
  });
  const { setToken } = useAuth();
  const [isValidating, setIsValidating] = useState(!!codigoFromUrl);
  const [validationError, setValidationError] = useState<string | null>(null);
  const validarCodigo = trpc.token.validarEDecidirFase.useMutation({
    onSuccess: (data) => {
      setToken(data.sessionToken);
      setIsValidating(false);
      if (data.proximaFase !== "/inicio") {
        navigate(data.proximaFase);
      }
    },
    onError: (err) => {
      setToken(null);
      if (err.message === "LINK_EXPIRED") {
        setValidationError("LINK_EXPIRED");
      } else {
        const raw = (err.message ?? "").toLowerCase();
        const mensagem =
          raw.includes("not found") || raw.includes("não encontrado")
            ? "Não encontramos esse link. Verifique se está completo ou solicite um novo acesso."
            : raw.includes("already used") || raw.includes("já utilizado")
              ? "Este link já foi utilizado. Solicite um novo acesso."
              : "O link de acesso parece inválido. Por favor, verifique o código recebido por e-mail.";
        setValidationError(mensagem);
        Sentry.captureException(err, {
          tags: { route: "inicio", stage: "token-validar" },
          extra: { friendlyMessage: mensagem },
        });
      }
      setIsValidating(false);
    },
  });
  const hasValidated = useRef(false);
  useEffect(() => {
    if (!codigoFromUrl || hasValidated.current) return;
    hasValidated.current = true;
    validarCodigo.mutate({ token: codigoFromUrl });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [etapa, setEtapa] = useState<Etapa>("tipo_consulta");
  const [tipoConsulta, setTipoConsulta] = useState<TipoConsulta | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [exameNome, setExameNome] = useState<string | null>(null);
  const [iniciarError, setIniciarError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isTerminal = TERMINAL_ETAPAS.includes(etapa);
  const statusQuery = trpc.consulta.status.useQuery(undefined, {
    enabled: !isValidating,
    refetchInterval: isTerminal ? false : 5000,
  });
  const iniciarMut = trpc.consulta.iniciar.useMutation();
  const uploadMut = trpc.consulta.uploadExame.useMutation();

  useEffect(() => {
    const s = statusQuery.data;
    if (!s) return;
    if (s.status === "aprovado" || s.status === "aprovado_ia") {
      setEtapa("aprovado");
      return;
    }
    if (s.status === "rejeitado") {
      setEtapa("rejeitado");
      return;
    }
    if (s.status === "rejeitado_data_invalida") {
      setEtapa("rejeitado_data_invalida");
      return;
    }
    if (s.status === "rejeitado_nome_invalido") {
      setEtapa("rejeitado_nome_invalido");
      return;
    }
    if (s.status === "rejeitado_tipo_invalido") {
      setEtapa("rejeitado_tipo_invalido");
      return;
    }
    if (
      s.status === "pendente_revisao_medica" ||
      s.status === "pendente_revisao_medica_urgente" ||
      s.status === "em_validacao_medica"
    ) {
      setEtapa("em_revisao_medica");
      return;
    }
    if (s.status === "em_validacao_ia") {
      setEtapa("aguardando_ia");
      return;
    }
    if (s.status === "aguardando_upload") {
      setTipoConsulta(s.tipoConsulta as TipoConsulta);
      setEtapa(s.temExameRecente ? "upload_exame" : "gerar_pedido");
    }
  }, [statusQuery.data]);

  async function escolherTipoConsulta(tipo: TipoConsulta, temExame: boolean) {
    setIniciarError(null);
    try {
      await iniciarMut.mutateAsync({
        tipoConsulta: tipo,
        temExameRecente: temExame,
      });
      setTipoConsulta(tipo);
      setEtapa(temExame ? "upload_exame" : "gerar_pedido");
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : "Erro ao iniciar atendimento. Tente novamente.";
      setIniciarError(msg);
    }
  }

  async function uploadExame(file: File) {
    setUploading(true);
    setUploadError(null);
    setExameNome(file.name);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("tipo", "exame_hiv");
      const token = localStorage.getItem("fp_token");
      const res = await fetch("/api/upload", {
        method: "POST",
        body: fd,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Falha no upload");
      const { s3Key } = (await res.json()) as { s3Key: string };
      setEtapa("aguardando_ia");
      const result = await uploadMut.mutateAsync({ s3Key });
      if (result.status === "aprovado_ia" || result.status === "aprovado") {
        setEtapa("aprovado");
      } else if (result.status === "rejeitado_data_invalida") {
        setEtapa("rejeitado_data_invalida");
      } else if (result.status === "rejeitado_nome_invalido") {
        setEtapa("rejeitado_nome_invalido");
      } else {
        setEtapa("em_revisao_medica");
      }
    } catch {
      setUploadError("Erro ao enviar o exame. Tente novamente.");
      setEtapa("upload_exame");
    } finally {
      setUploading(false);
    }
  }

  // ── Validando código da URL ────────────────────────────────────
  if (isValidating) {
    return (
      <PageShell>
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-10 text-center">
          <div className="w-8 h-8 border-4 border-brand-light border-t-brand rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 text-sm">Validando seu acesso…</p>
        </div>
      </PageShell>
    );
  }

  // ── Código inválido ou expirado ────────────────────────────────
  if (validationError) {
    if (validationError === "LINK_EXPIRED") {
      return (
        <PageShell>
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-10 text-center">
            <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-amber-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">
              Link Expirado
            </h2>
            <p className="text-slate-600 text-sm mb-2">
              Este link tem validade de <strong>7 dias</strong> devido à
              validade dos exames.
            </p>
            <p className="text-slate-600 text-sm mb-6">
              Se você ainda não enviou o exame e acabou de realizá-lo, pode
              solicitar um novo link abaixo.
            </p>
            <a
              href="/reenviar-acesso"
              className="inline-block w-full bg-brand text-white py-3 rounded-2xl font-semibold hover:bg-brand-dark transition-all text-sm mb-3"
            >
              Solicitar novo link de acesso
            </a>
            <a
              href="/cadastro"
              className="inline-block w-full border border-slate-200 text-slate-600 py-3 rounded-2xl font-semibold hover:bg-slate-50 transition-all text-sm"
            >
              Iniciar novo atendimento
            </a>
            <p className="text-slate-400 text-xs mt-4">
              Dúvidas?{" "}
              <a
                href="mailto:contato@facilitaprep.com.br"
                className="text-brand hover:underline"
              >
                contato@facilitaprep.com.br
              </a>{" "}
              ou WhatsApp (61) 99401-8161
            </p>
          </div>
        </PageShell>
      );
    }

    return (
      <PageShell>
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-10 text-center">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-7 h-7 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z"
              />
            </svg>
          </div>
          <p className="text-slate-700 font-medium mb-2">
            Código de acesso inválido
          </p>
          <p className="text-slate-500 text-sm mb-4">{validationError}</p>
          <a
            href="/cadastro"
            className="text-brand text-sm font-medium hover:underline"
          >
            Solicitar novo acesso
          </a>
        </div>
      </PageShell>
    );
  }

  // ── Loading inicial ────────────────────────────────────────────
  if (statusQuery.isLoading) {
    return (
      <PageShell>
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-10 text-center">
          <div className="w-8 h-8 border-4 border-brand-light border-t-brand rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 text-sm">Carregando…</p>
        </div>
      </PageShell>
    );
  }

  // ── Erro de conexão ────────────────────────────────────────────
  if (statusQuery.isError && !statusQuery.data) {
    return (
      <PageShell>
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-10 text-center">
          <p className="text-slate-700 font-medium mb-2">
            Não foi possível carregar seu atendimento
          </p>
          <p className="text-slate-500 text-sm mb-4">
            Verifique sua conexão e tente novamente.
          </p>
          <button
            onClick={() => statusQuery.refetch()}
            className="text-sm bg-brand text-white px-5 py-2 rounded-xl hover:bg-brand-dark transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </PageShell>
    );
  }

  // Renderiza os 3 critérios principais (Nome, Resultado, Data) com base
  // nos checks que o servidor calculou. O check "tipo" não é mostrado aqui
  // porque tem tela própria; aparece como "?" se a IA não conseguiu ler.
  const renderCriterios = (bgCls: string, borderCls: string) => {
    const checks = statusQuery.data?.checks;
    const nomeNoExame = statusQuery.data?.nomeExame;
    const nomeCadastro = statusQuery.data?.nomeCadastro;
    const dataValidada = statusQuery.data?.dataExame;
    const resultadoHiv = statusQuery.data?.resultadoHiv;
    const eNome = (checks?.nome ?? "nao_avaliado") as CheckState;
    const eRes = (checks?.resultado ?? "nao_avaliado") as CheckState;
    const eData = (checks?.data ?? "nao_avaliado") as CheckState;
    const valorNome =
      nomeNoExame ??
      (eNome === "ok"
        ? "Confere com o cadastro"
        : "Não foi possível ler o nome");
    const valorRes =
      resultadoHiv === "nao_reagente"
        ? "Não reagente / Negativo"
        : resultadoHiv === "reagente"
          ? "Reagente / Positivo"
          : resultadoHiv === "inconclusivo"
            ? "Inconclusivo"
            : "Não foi possível ler";
    const valorData = dataValidada ?? "Não foi possível ler a data";
    const subNome =
      nomeCadastro &&
      nomeNoExame &&
      nomeNoExame.toUpperCase() !== nomeCadastro.toUpperCase()
        ? `Cadastro: ${nomeCadastro}`
        : undefined;
    return (
      <div
        className={`${bgCls} border ${borderCls} rounded-2xl p-4 mb-4 text-left space-y-3`}
      >
        <CritCheck
          estado={eNome}
          titulo="Nome do paciente"
          valor={valorNome}
          sub={subNome}
        />
        <CritCheck
          estado={eRes}
          titulo="Resultado HIV (deve ser não reagente)"
          valor={valorRes}
        />
        <CritCheck
          estado={eData}
          titulo="Data do exame (≤ 7 dias)"
          valor={valorData}
        />
      </div>
    );
  };

  // ── Aprovado ──────────────────────────────────────────────────
  if (etapa === "aprovado") {
    return (
      <StatusCard
        icon={
          <svg
            className="w-10 h-10"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        }
        iconBg="bg-sage-light"
        iconColor="text-sage"
        title="Tudo certo! Você pode seguir com segurança"
        subtitle="Verificamos os 3 critérios do seu exame de HIV — está tudo dentro do esperado."
      >
        {renderCriterios("bg-sage-pale", "border-sage-light")}
        <div className="bg-brand-pale border border-brand-light rounded-2xl p-4 mb-6 text-left">
          <p className="text-brand-dark text-sm font-medium mb-1">
            Próximo passo:
          </p>
          <p className="text-brand text-sm">
            Preencha o formulário clínico para que nosso médico possa emitir sua
            receita com total segurança.
          </p>
        </div>
        <button onClick={() => navigate("/formulario")} className={btnPrimary}>
          Continuar para o formulário clínico →
        </button>
        <OndeRetirarPrep />
      </StatusCard>
    );
  }

  // ── Em revisão médica ─────────────────────────────────────────
  if (etapa === "em_revisao_medica") {
    return (
      <StatusCard
        icon={
          <svg
            className="w-10 h-10"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        }
        iconBg="bg-honey-light"
        iconColor="text-honey"
        title="Seu exame está sendo avaliado"
        subtitle="Nosso médico está analisando seu resultado com atenção. Fique tranquilo(a) — você receberá o retorno por e-mail e WhatsApp em breve."
      >
        <div className="bg-honey-light border border-honey-light rounded-2xl p-4 text-left">
          <p className="text-honey-dark text-sm font-medium mb-1">
            Como será notificado:
          </p>
          <div className="space-y-1.5">
            {["Por e-mail", "Por WhatsApp"].map((c) => (
              <p key={c} className="text-honey text-sm flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                {c}
              </p>
            ))}
          </div>
        </div>
      </StatusCard>
    );
  }

  // ── Aguardando IA ─────────────────────────────────────────────
  if (etapa === "aguardando_ia") {
    return (
      <StatusCard
        icon={
          <svg
            className="w-10 h-10 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        }
        iconBg="bg-brand-light"
        iconColor="text-brand"
        title="Verificando seu exame…"
        subtitle="Estamos analisando seu resultado com cuidado. Isso costuma levar apenas alguns instantes — aguarde."
      />
    );
  }

  // ── Exame com data inválida (pode reenviar) ───────────────────
  if (etapa === "rejeitado_data_invalida") {
    const tentativas = statusQuery.data?.tentativasReenvio ?? 1;
    const restantes = 2 - tentativas;
    return (
      <StatusCard
        icon={
          <svg
            className="w-10 h-10"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        }
        iconBg="bg-honey-light"
        iconColor="text-honey"
        title="Exame fora da validade"
        subtitle="A data do exame está fora do período aceito. Veja abaixo o que conferimos:"
      >
        {renderCriterios("bg-white", "border-slate-200")}
        <div className="bg-honey-light border border-honey-light rounded-2xl p-4 mb-4 text-left">
          <p className="text-honey-dark text-sm font-medium mb-1">
            Tentativa {tentativas} de 2
          </p>
          <p className="text-honey text-sm">
            {restantes > 0
              ? `Realize um novo exame Anti-HIV (4ª geração) e envie o resultado — ele precisa ter sido realizado há até 7 dias (inclusive). Você tem ${restantes} tentativa${restantes > 1 ? "s" : ""}.`
              : "Seu caso será analisado por um de nossos médicos."}
          </p>
        </div>
        <button onClick={() => setEtapa("upload_exame")} className={btnPrimary}>
          Enviar novo exame →
        </button>
      </StatusCard>
    );
  }

  // ── Nome divergente (pode reenviar) ───────────────────────────
  if (etapa === "rejeitado_nome_invalido") {
    const tentativas = statusQuery.data?.tentativasReenvio ?? 1;
    const restantes = 2 - tentativas;
    return (
      <StatusCard
        icon={
          <svg
            className="w-10 h-10"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        }
        iconBg="bg-honey-light"
        iconColor="text-honey"
        title="O nome do exame não confere com o cadastro"
        subtitle="Para garantir sua segurança, o nome no exame precisa ser o mesmo do cadastro. Veja abaixo o que conferimos:"
      >
        {renderCriterios("bg-white", "border-slate-200")}
        <div className="bg-honey-light border border-honey-light rounded-2xl p-4 mb-4 text-left">
          <p className="text-honey-dark text-sm font-medium mb-1">
            Tentativa {tentativas} de 2
          </p>
          <p className="text-honey text-sm">
            {restantes > 0
              ? `Confira se enviou o exame correto. Você ainda tem ${restantes} tentativa${restantes > 1 ? "s" : ""}.`
              : "Seu caso será analisado por um de nossos médicos."}
          </p>
        </div>
        <button onClick={() => setEtapa("upload_exame")} className={btnPrimary}>
          Enviar novo exame →
        </button>
      </StatusCard>
    );
  }

  // ── Documento enviado não é exame de HIV ──────────────────────
  if (etapa === "rejeitado_tipo_invalido") {
    return (
      <StatusCard
        icon={
          <svg
            className="w-10 h-10"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
        }
        iconBg="bg-honey-light"
        iconColor="text-honey"
        title="Esse documento não parece ser um exame de HIV"
        subtitle="Confira se você anexou o resultado do exame Anti-HIV 1/2 (4ª geração). Pode ser que tenha enviado outro arquivo por engano."
      >
        <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4 text-left space-y-3">
          <CritCheck
            estado="falhou"
            titulo="Tipo de documento"
            valor="Não foi reconhecido como exame de HIV"
            sub="Esperado: laudo Anti-HIV 1/2 (4ª geração)"
          />
          <CritCheck
            estado="nao_avaliado"
            titulo="Nome do paciente"
            valor="Não avaliado — tipo de documento incorreto"
          />
          <CritCheck
            estado="nao_avaliado"
            titulo="Resultado HIV"
            valor="Não avaliado — tipo de documento incorreto"
          />
          <CritCheck
            estado="nao_avaliado"
            titulo="Data do exame"
            valor="Não avaliado — tipo de documento incorreto"
          />
        </div>
        <div className="bg-honey-light border border-honey-light rounded-2xl p-4 mb-4 text-left">
          <p className="text-honey-dark text-sm font-medium mb-2">
            O que enviar:
          </p>
          <ul className="space-y-1.5">
            {[
              "Laudo do exame Anti-HIV 1/2",
              "Imagem ou PDF legível, com nome e resultado visíveis",
              "Realizado há até 7 dias (inclusive)",
            ].map((t) => (
              <li key={t} className="text-honey text-sm flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <button onClick={() => setEtapa("upload_exame")} className={btnPrimary}>
          Enviar exame correto →
        </button>
      </StatusCard>
    );
  }

  // ── Rejeitado ─────────────────────────────────────────────────
  if (etapa === "rejeitado") {
    return (
      <StatusCard
        icon={
          <svg
            className="w-10 h-10"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z"
            />
          </svg>
        }
        iconBg="bg-terra-light"
        iconColor="text-terra"
        title="Precisamos conversar com você"
        subtitle="Identificamos algo no seu exame que precisa de atenção antes de iniciarmos a PrEP. Nossa equipe está pronta para orientar você com cuidado e sem julgamentos."
      >
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left">
          <p className="text-slate-700 text-sm">
            Para mais informações, entre em contato com nossa equipe:
          </p>
          <a
            href="tel:+556140427188"
            className="text-brand text-sm font-medium mt-2 flex items-center gap-1.5 hover:underline"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
            (61) 4042-7188
          </a>
        </div>
      </StatusCard>
    );
  }

  // ── Expirado ──────────────────────────────────────────────────
  if (etapa === "expirado") {
    return (
      <StatusCard
        icon={
          <svg
            className="w-10 h-10"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        }
        iconBg="bg-slate-100"
        iconColor="text-slate-400"
        title="Seu link de acesso expirou"
        subtitle="O prazo para envio do exame foi encerrado. Se você realizou o exame recentemente, solicite um novo link abaixo."
      >
        <a
          href="/reenviar-acesso"
          className="inline-block w-full bg-brand text-white py-3 rounded-2xl font-semibold hover:bg-brand-dark transition-all text-sm mb-3 text-center"
        >
          Solicitar novo link de acesso
        </a>
        <a
          href="tel:+556140427188"
          className="inline-flex items-center justify-center gap-2 text-slate-500 text-sm font-medium hover:underline w-full"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
            />
          </svg>
          Ligar para (61) 4042-7188
        </a>
      </StatusCard>
    );
  }

  // ── Tipo de consulta ──────────────────────────────────────────
  if (etapa === "tipo_consulta") {
    return (
      <PageShell>
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-brand-light rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-7 h-7 text-brand"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800">
              Como você chega até nós hoje?
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Cada jornada é única — nos conte sua situação para que possamos
              cuidar de você da melhor forma.
            </p>
          </div>

          <div className="space-y-4">
            <TipoCard
              titulo="Primeiro atendimento PrEP"
              descricao="Estou iniciando o uso da PrEP pela primeira vez e quero começar com segurança."
              icon={
                <svg
                  className="w-6 h-6 text-brand"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              }
              iconBg="bg-brand-light"
              onClick={() => setEtapa("tem_exame")}
              onSelect={() => setTipoConsulta("primeiro_atendimento")}
            />
            <TipoCard
              titulo="Já faço PrEP"
              descricao="Já estou em uso da PrEP e preciso de renovação ou acompanhamento periódico."
              icon={
                <svg
                  className="w-6 h-6 text-sage"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              }
              iconBg="bg-sage-light"
              onClick={() => setEtapa("tem_exame")}
              onSelect={() => setTipoConsulta("ja_faco_prep")}
            />
          </div>
        </div>
      </PageShell>
    );
  }

  // ── Pergunta sobre exame recente ──────────────────────────────
  if (etapa === "tem_exame") {
    return (
      <PageShell>
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
          <button
            onClick={() => setEtapa("tipo_consulta")}
            className="flex items-center gap-1 text-slate-400 hover:text-brand text-sm mb-6 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Voltar
          </button>

          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-sage-light rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-7 h-7 text-sage"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800">
              Você tem exame de HIV recente?
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              O exame precisa ter sido realizado há{" "}
              <strong className="text-slate-600">até 7 dias</strong>{" "}
              (inclusive).
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() =>
                tipoConsulta && escolherTipoConsulta(tipoConsulta, true)
              }
              disabled={iniciarMut.isPending}
              className="w-full bg-sage-pale border-2 border-sage-light hover:border-sage rounded-2xl p-5 text-left transition-all group hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-sage-light rounded-xl flex items-center justify-center shrink-0 group-hover:bg-sage-light transition-colors">
                  <svg
                    className="w-5 h-5 text-sage"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-sage-dark">
                    Sim, tenho exame recente
                  </p>
                  <p className="text-sage text-sm mt-0.5">
                    Ótimo! Vou enviar o resultado agora.
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() =>
                tipoConsulta && escolherTipoConsulta(tipoConsulta, false)
              }
              disabled={iniciarMut.isPending}
              className="w-full bg-white border-2 border-slate-200 hover:border-brand rounded-2xl p-5 text-left transition-all group hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-brand-light transition-colors">
                  <svg
                    className="w-5 h-5 text-slate-500 group-hover:text-brand transition-colors"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-slate-800">
                    Não tenho exame recente
                  </p>
                  <p className="text-slate-500 text-sm mt-0.5">
                    Sem problema — geramos o pedido assinado para você levar ao
                    laboratório.
                  </p>
                </div>
              </div>
            </button>
          </div>

          {iniciarMut.isPending && (
            <p className="text-slate-400 text-sm mt-4 text-center flex items-center justify-center gap-2">
              <svg
                className="w-4 h-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Salvando…
            </p>
          )}
          {iniciarError && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 text-center">
              {iniciarError}
            </div>
          )}
        </div>
      </PageShell>
    );
  }

  // ── Gerar pedido de exames ─────────────────────────────────────
  if (etapa === "gerar_pedido") {
    return (
      <PageShell>
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-brand-light rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-7 h-7 text-brand"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800">
              Pedido de exames
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Seus pedidos serão assinados digitalmente com certificado
              ICP-Brasil.
            </p>
          </div>

          {(() => {
            const expiresAt = statusQuery.data?.linkExpiresAt;
            const diasRestantes = expiresAt
              ? Math.max(
                  0,
                  Math.ceil(
                    (new Date(expiresAt).getTime() - Date.now()) / 86_400_000,
                  ),
                )
              : 7;
            const isUrgente = diasRestantes <= 2;
            return (
              <div
                className={`border rounded-2xl p-4 mb-6 flex gap-3 ${isUrgente ? "bg-red-50 border-red-200" : "bg-honey-light border-honey-light"}`}
              >
                <span
                  className={`text-lg shrink-0 ${isUrgente ? "text-red-500" : "text-honey"}`}
                >
                  ⏱
                </span>
                <div>
                  <p
                    className={`text-sm font-semibold ${isUrgente ? "text-red-700" : "text-honey-dark"}`}
                  >
                    {isUrgente
                      ? diasRestantes === 0
                        ? "Prazo encerrado hoje!"
                        : `Atenção: apenas ${diasRestantes} dia${diasRestantes > 1 ? "s" : ""} restante${diasRestantes > 1 ? "s" : ""}!`
                      : `${diasRestantes} dia${diasRestantes > 1 ? "s" : ""} para enviar o exame`}
                  </p>
                  <p
                    className={`text-sm mt-0.5 ${isUrgente ? "text-red-600" : "text-honey"}`}
                  >
                    {isUrgente
                      ? "Realize o exame Anti-HIV e envie o resultado urgente. Você receberá lembretes por e-mail e WhatsApp."
                      : "Realize os exames e envie os resultados dentro do prazo. Você receberá lembretes por e-mail e WhatsApp."}
                  </p>
                </div>
              </div>
            );
          })()}

          <BotaoBaixarPedidos
            tipoConsulta={tipoConsulta!}
            onBaixou={() => {}}
          />

          <div className="mt-6 border-t border-slate-100 pt-6">
            <p className="text-sm font-medium text-slate-700 mb-3 text-center">
              Já realizou os exames? Envie o resultado aqui:
            </p>
            <button
              onClick={() => setEtapa("upload_exame")}
              className={btnPrimary}
            >
              Enviar resultado do exame HIV →
            </button>
          </div>

          <OndeRetirarPrep />
        </div>
      </PageShell>
    );
  }

  // ── Upload do exame ────────────────────────────────────────────
  return (
    <PageShell>
      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-sage-light rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-7 h-7 text-sage"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800">
            Envio do exame de HIV
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Envie o resultado do exame{" "}
            <strong className="text-slate-600">
              Anti-HIV 1/2 (4ª geração)
            </strong>{" "}
            realizado há até 7 dias (inclusive).
          </p>
          {(() => {
            const dataMinima = new Date();
            dataMinima.setDate(dataMinima.getDate() - 7);
            const dataMinimaStr = dataMinima.toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            });
            return (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-left">
                <p className="text-amber-800 text-xs font-semibold">
                  📅 Data mínima aceita: {dataMinimaStr}
                </p>
                <p className="text-amber-700 text-xs mt-0.5">
                  Exames anteriores a esta data serão recusados automaticamente.
                </p>
              </div>
            );
          })()}
        </div>

        <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-slate-200 hover:border-sage rounded-2xl py-10 cursor-pointer bg-slate-50 hover:bg-sage-pale transition-all mb-4 group px-4">
          {uploading ? (
            <>
              <div className="w-10 h-10 border-2 border-sage-light border-t-sage rounded-full animate-spin mb-3" />
              <p className="text-sage text-sm font-medium">Enviando…</p>
              {exameNome && (
                <p className="text-slate-500 text-xs mt-1 max-w-full truncate">
                  {exameNome}
                </p>
              )}
            </>
          ) : exameNome ? (
            <>
              <svg
                className="w-10 h-10 text-sage mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sage text-sm font-medium">Exame anexado</p>
              <p className="text-slate-600 text-xs mt-1 max-w-full truncate font-medium">
                {exameNome}
              </p>
              <p className="text-brand text-xs mt-2 underline">
                Clique para trocar
              </p>
            </>
          ) : (
            <>
              <svg
                className="w-12 h-12 text-slate-300 group-hover:text-sage mb-3 transition-colors"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-slate-500 text-sm font-medium group-hover:text-sage transition-colors">
                Clique para selecionar o arquivo
              </p>
              <p className="text-slate-300 text-xs mt-1">
                PDF, JPG ou PNG · Máximo 10 MB
              </p>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadExame(file);
              e.target.value = "";
            }}
          />
        </label>

        {uploadError && (
          <p className="text-terra text-sm mb-3">{uploadError}</p>
        )}
        {uploadMut.error && (
          <p className="text-terra text-sm mb-3">{uploadMut.error.message}</p>
        )}

        <div className="bg-brand-pale border border-brand-light rounded-2xl p-4">
          <p className="text-brand-dark text-sm font-semibold mb-2">
            Critérios de validação automática
          </p>
          <div className="space-y-1.5">
            {[
              "Exame realizado há até 7 dias (inclusive)",
              "Imagem legível, sem cortes ou desfoque",
              "Nome do paciente visível e compatível",
              "Resultado não reagente / negativo",
            ].map((c) => (
              <p key={c} className="text-brand text-sm flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                {c}
              </p>
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function OndeRetirarPrep() {
  return (
    <div className="mt-8 border-t border-slate-100 pt-6">
      <p className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
        <svg
          className="w-4 h-4 text-brand"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        Saiba onde retirar sua PrEP
      </p>

      <div className="space-y-3">
        {/* Particular */}
        <div className="bg-brand-pale border border-brand-light rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">💊</span>
            <p className="font-semibold text-brand-dark text-sm">
              Farmácias e drogarias (particular)
            </p>
          </div>
          <p className="text-brand text-xs leading-relaxed">
            Com a receita emitida pelo Facilita PrEP (assinada digitalmente com
            ICP-Brasil), você pode retirar o <strong>TDF/FTC</strong> em
            qualquer farmácia ou drogaria do Brasil. A receita tem validade
            jurídica e é aceita em todo o território nacional.
          </p>
        </div>

        {/* SUS */}
        <div className="bg-sage-pale border border-sage-light rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🏥</span>
            <p className="font-semibold text-sage-dark text-sm">
              Rede pública (SUS)
            </p>
          </div>
          <p className="text-sage text-xs leading-relaxed mb-3">
            A PrEP é distribuída pelas{" "}
            <strong>Unidades Dispensadoras de Medicamentos (UDMs)</strong>. Para
            localizar a unidade mais próxima de você:
          </p>
          <ol className="text-xs text-sage-dark space-y-1 mb-3">
            {[
              "Acesse o site oficial do Departamento de HIV, Hepatites Virais e IST",
              'Clique em "Consulte uma UDM"',
              "Escolha o seu estado para ver as unidades disponíveis",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="bg-sage-light text-sage-dark font-bold rounded-full w-4 h-4 flex items-center justify-center shrink-0 text-xs mt-0.5">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <a
            href="https://azt.aids.gov.br"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-sage text-white text-xs font-semibold px-3 py-2 rounded-xl hover:bg-sage-dark transition-colors"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
            Acessar azt.aids.gov.br → Consulte uma UDM
          </a>
        </div>
      </div>
    </div>
  );
}

function TipoCard({
  titulo,
  descricao,
  icon,
  iconBg,
  onClick,
  onSelect,
}: {
  titulo: string;
  descricao: string;
  icon: React.ReactNode;
  iconBg: string;
  onClick: () => void;
  onSelect: () => void;
}) {
  return (
    <button
      className="w-full bg-white border-2 border-slate-200 hover:border-brand rounded-2xl p-5 text-left transition-all group hover:shadow-md"
      onClick={() => {
        onSelect();
        onClick();
      }}
    >
      <div className="flex items-start gap-4">
        <div
          className={`w-11 h-11 ${iconBg} rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}
        >
          {icon}
        </div>
        <div>
          <p className="font-bold text-slate-800 group-hover:text-brand transition-colors">
            {titulo}
          </p>
          <p className="text-slate-500 text-sm mt-0.5 leading-relaxed">
            {descricao}
          </p>
        </div>
      </div>
    </button>
  );
}

type PedidosData = {
  urlCompleto: string;
  urlIst: string | null;
  urlHiv: string;
  urlDensitometria: string | null;
  urlOrientacao: string;
};

const PEDIDOS_INFO = [
  {
    key: "urlOrientacao" as const,
    label: "📘 Orientação para Início da PrEP",
    desc: "Leia primeiro — explica os exames e próximos passos",
  },
  {
    key: "urlHiv" as const,
    label: "Exame Anti-HIV (obrigatório)",
    desc: "Anti-HIV 1/2 com Ag p24 (4ª geração)",
  },
  {
    key: "urlIst" as const,
    label: "Sorológicos de IST (recomendado)",
    desc: "Sífilis, Hepatites, Gonorreia, Clamídia",
  },
  {
    key: "urlCompleto" as const,
    label: "Painel completo de exames (recomendado)",
    desc: "Inclui função renal/hepática para uso seguro do TDF",
  },
  {
    key: "urlDensitometria" as const,
    label: "Densitometria óssea",
    desc: "Monitoramento ósseo — uso de Tenofovir (TDF)",
  },
];

function BotaoBaixarPedidos({
  tipoConsulta: _tipoConsulta,
  onBaixou,
}: {
  tipoConsulta: TipoConsulta;
  onBaixou: () => void;
}) {
  const gerarMut = trpc.consulta.gerarPedidos.useMutation({
    onSuccess: onBaixou,
  });
  const data = gerarMut.data as PedidosData | undefined;

  const DownloadIcon = () => (
    <svg
      className="w-4 h-4 flex-shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );

  if (!data) {
    return (
      <div className="space-y-3">
        <button
          onClick={() => gerarMut.mutate()}
          disabled={gerarMut.isPending}
          className="w-full border-2 border-brand-light bg-brand-pale text-brand py-3.5 rounded-2xl font-medium hover:bg-brand-light disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-sm"
        >
          <DownloadIcon />
          {gerarMut.isPending
            ? "Gerando PDFs assinados…"
            : "Gerar pedidos de exame + orientação"}
        </button>
        {gerarMut.error && (
          <p className="text-terra text-sm">{gerarMut.error.message}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
        <svg
          className="w-4 h-4 text-sage"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
        Pedidos prontos — assinados com ICP-Brasil
      </p>
      {PEDIDOS_INFO.map(({ key, label, desc }) => {
        const url = data[key];
        if (!url) return null;
        return (
          <div
            key={key}
            className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 hover:border-brand-light transition-colors"
          >
            <div>
              <p className="text-sm font-semibold text-slate-800">{label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
            </div>
            <div className="flex gap-2 ml-3 shrink-0">
              <a
                href={url}
                download
                className="text-xs bg-brand text-white px-3 py-1.5 rounded-xl hover:bg-brand-dark flex items-center gap-1 transition-colors shadow-sm"
              >
                <DownloadIcon /> Download
              </a>
              <button
                onClick={() => window.open(url, "_blank")}
                className="text-xs bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Imprimir
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
