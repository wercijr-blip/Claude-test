"use client";

import { useState, useEffect, type ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "../lib/trpc";
import { PLANOS_VALIDOS, HORARIO_ATENDIMENTO } from "@shared/const";
import { Logo, LogoWordmark } from "./Logo";
import {
  trackFormStart,
  trackFormSubmit,
  trackConversion,
} from "../lib/analytics";
import CheckoutAsaas from "./CheckoutAsaas";
import SeletorMetodoPagamento from "./SeletorMetodoPagamento";

const ABERTURA = HORARIO_ATENDIMENTO.ABERTURA_HORA;
const FECHAMENTO = HORARIO_ATENDIMENTO.FECHAMENTO_HORA;

function isDentroHorarioAtendimento(): boolean {
  const agora = new Date();
  const spTime = new Date(
    agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }),
  );
  const hora = spTime.getHours();
  const dia = spTime.getDay();
  return dia >= 1 && dia <= 5 && hora >= ABERTURA && hora < FECHAMENTO;
}

const schema = z.object({
  nome: z.string().min(2, "Nome muito curto"),
  telefone: z
    .string()
    .refine((v) => v.replace(/\D/g, "").length >= 10, "Telefone inválido"),
  cpf: z.string().min(11, "CPF inválido"),
  email: z.string().email("E-mail inválido"),
  plano: z.string().optional(),
});

type FormData = z.infer<typeof schema>;
type Etapa =
  | "escolha"
  | "formulario"
  | "seletor"
  | "aguardando"
  | "checkout"
  | "sucesso";
type Tipo = "particular" | "plano";

interface PixData {
  paymentId: string;
  pixQrCode: string;
  pixCopiaECola: string;
}

const inputCls =
  "w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent bg-white transition-all placeholder:text-slate-400";
const labelCls = "block text-sm font-medium text-slate-700 mb-1.5";
const errCls = "text-terra text-xs mt-1.5";

function TrustBadge({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-full px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
      <span>{icon}</span>
      <span>{text}</span>
    </div>
  );
}

type Props = {
  initialTipo?: Tipo;
  autoStart?: boolean;
};

export default function IntakePage({ initialTipo, autoStart }: Props = {}) {
  const [etapa, setEtapa] = useState<Etapa>(
    autoStart ? "formulario" : "escolha",
  );
  const [tipo, setTipo] = useState<Tipo>(initialTipo ?? "particular");
  const [dentroHorario, setDentroHorario] = useState(
    isDentroHorarioAtendimento(),
  );
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [precadastroId, setPrecadastroId] = useState<number | null>(null);
  const [carteirinhaKey, setCarteirinhaKey] = useState<string | null>(null);
  const [carteirinhaNome, setCarteirinhaNome] = useState<string | null>(null);
  const [documentoKey, setDocumentoKey] = useState<string | null>(null);
  const [documentoNome, setDocumentoNome] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [planosAbertos, setPlanosAbertos] = useState(false);

  useEffect(() => {
    const interval = setInterval(
      () => setDentroHorario(isDentroHorarioAtendimento()),
      60_000,
    );
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (autoStart) trackFormStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const { data: valorData } = trpc.intake.consultarValor.useQuery();
  const valorFormatado = valorData?.valorFormatado;

  const criar = trpc.intake.criar.useMutation();
  const iniciarPagamento = trpc.intake.iniciarPagamento.useMutation({
    onSuccess: (data) => {
      if (data.tipo === "cartao") {
        window.location.href = data.invoiceUrl;
        return;
      }
      trackConversion(undefined, "BRL");
      setPixData({
        paymentId: data.paymentId,
        pixQrCode: data.pixQrCode,
        pixCopiaECola: data.pixCopiaECola,
      });
      setEtapa("checkout");
    },
  });

  function escolher(t: Tipo) {
    setTipo(t);
    setEtapa("formulario");
    trackFormStart();
  }

  async function uploadArquivo(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("tipo", "documento_intake");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) throw new Error("Falha no upload");
    const json = (await res.json()) as { s3Key: string };
    return json.s3Key;
  }

  async function onSubmit(data: FormData) {
    setUploadError(null);
    criar.reset();
    iniciarPagamento.reset();
    if (tipo === "plano" && (!carteirinhaKey || !documentoKey)) {
      setUploadError("Envie a carteirinha e o documento de identidade.");
      return;
    }
    try {
      const result = await criar.mutateAsync({
        nome: data.nome,
        telefone: `+55${data.telefone.replace(/\D/g, "")}`,
        cpf: data.cpf.replace(/\D/g, ""),
        email: data.email,
        tipo,
        plano: tipo === "plano" ? data.plano : undefined,
        carteirinhaS3Key: carteirinhaKey ?? undefined,
        documentoS3Key: documentoKey ?? undefined,
      });
      if (tipo === "particular") {
        trackFormSubmit("particular");
        setPrecadastroId(result.precadastroId);
        setEtapa("seletor");
      } else {
        trackFormSubmit("plano");
        trackConversion(undefined, "BRL");
        setEtapa("aguardando");
      }
    } catch (err: unknown) {
      console.error(err);
    }
  }

  // ── Tela de escolha ───────────────────────────────────────────
  if (etapa === "escolha") {
    return (
      <div className="min-h-screen bg-warm-bg">
        <header className="px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
          <LogoWordmark size={44} mode="light" />
          <a
            href="/duvidas"
            className="text-sm text-slate-500 hover:text-fp-accent transition-colors"
          >
            Dúvidas sobre PrEP →
          </a>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-6 lg:py-10 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div className="text-center lg:text-left order-2 lg:order-1">
            <div className="flex justify-center lg:justify-start mb-6">
              <Logo size={180} mode="light" />
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-light text-fp-dark mb-4 leading-tight tracking-tight">
              Sua saúde em boas mãos,
              <br className="hidden sm:block" />
              <span className="text-fp-accent italic">
                de onde você estiver
              </span>
            </h1>
            <p className="text-slate-500 text-base leading-relaxed mb-6 max-w-md mx-auto lg:mx-0">
              Acesso rápido, sigiloso e 100% digital à PrEP. Do cadastro à
              receita assinada digitalmente — tudo sem sair de casa.
            </p>
            <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
              <TrustBadge icon="🔒" text="100% sigiloso" />
              <TrustBadge icon="✅" text="Assinatura ICP-Brasil" />
              <TrustBadge icon="⚡" text="Receita em horas" />
              <TrustBadge icon="🏥" text="CFM 2.299/2021" />
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
              <div className="text-center mb-8">
                <span className="inline-block bg-brand-pale text-brand text-xs font-semibold px-3 py-1 rounded-full mb-3">
                  Comece agora
                </span>
                <h2 className="text-xl font-bold text-slate-800">
                  Como podemos cuidar de você hoje?
                </h2>
                <p className="text-slate-400 text-sm mt-1">
                  Escolha a modalidade que melhor combina com você
                </p>
              </div>

              <div className="space-y-4">
                <button
                  onClick={() => escolher("particular")}
                  className="w-full bg-brand-pale border-2 border-brand-light hover:border-brand rounded-2xl p-5 text-left transition-all group hover:shadow-md"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-brand-light rounded-xl flex items-center justify-center shrink-0 group-hover:bg-brand-light transition-colors">
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
                          d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                        />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-800 text-base">
                          Particular
                        </h3>
                        <span className="text-xs bg-brand-light text-brand px-2 py-0.5 rounded-full font-medium">
                          Acesso imediato
                        </span>
                      </div>
                      {valorFormatado ? (
                        <div className="mt-2 bg-brand-pale rounded-xl px-3 py-2 inline-block">
                          <span className="text-xs text-slate-500 font-medium">
                            Valor da consulta{" "}
                          </span>
                          <span className="text-base font-bold text-brand">
                            {valorFormatado}
                          </span>
                        </div>
                      ) : (
                        <div className="mt-2 h-8 w-32 bg-brand-pale rounded-xl animate-pulse" />
                      )}
                      <p className="text-slate-500 text-sm mt-2">
                        PIX, cartão de crédito ou débito. Acesso liberado de
                        forma simples e rápida.
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => escolher("plano")}
                  className="w-full bg-sage-pale border-2 border-sage-light hover:border-sage rounded-2xl p-5 text-left transition-all group hover:shadow-md"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-sage-light rounded-xl flex items-center justify-center shrink-0 group-hover:bg-sage-light transition-colors">
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
                          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                        />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-800 text-base">
                          Plano de Saúde
                        </h3>
                      </div>
                      <p className="text-slate-500 text-sm mt-1">
                        Atendimento coberto pelo seu plano de saúde. Nossa
                        equipe verifica tudo para você, com cuidado.
                      </p>
                      <p className="text-xs text-honey mt-1.5 font-medium flex items-center gap-1">
                        <svg
                          className="w-3 h-3"
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
                        Atendimento seg.–sex., das 08h às 18h
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              <p className="text-center text-xs text-slate-400 mt-6">
                Ao continuar, você concorda com nossos termos e com a{" "}
                <span className="underline cursor-pointer hover:text-slate-600">
                  Política de Privacidade (LGPD)
                </span>
              </p>
            </div>

            <div className="mt-4 bg-white/70 border border-slate-200 rounded-2xl p-4 text-center">
              <p className="text-xs text-slate-500">
                Quer a PrEP pelo SUS?{" "}
                <a
                  href="/duvidas"
                  className="text-brand hover:underline font-medium"
                >
                  Veja como encontrar a UDM mais próxima →
                </a>
              </p>
            </div>
          </div>
        </main>

        {/* ── Como funciona ── */}
        <section className="max-w-6xl mx-auto px-4 pb-12">
          <div className="text-center mb-10">
            <h2 className="font-display text-3xl font-light text-fp-dark">
              Como utilizar o Facilita PrEP
            </h2>
            <p className="text-slate-500 text-sm mt-2">
              Do cadastro à receita — em poucos passos, sem sair de casa.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {[
              {
                n: "1",
                cor: "bg-brand",
                titulo: "Cadastro e escolha do tipo",
                desc: "Informe nome, CPF, e-mail e telefone. Escolha atendimento particular ou via plano de saúde aceito pela plataforma.",
              },
              {
                n: "2",
                cor: "bg-sage",
                titulo: "Exame de HIV válido",
                desc: "Envie seu exame Anti-HIV realizado há menos de 7 dias. Sem exame? O Facilita PrEP gera o pedido assinado digitalmente para você levar ao laboratório.",
              },
              {
                n: "3",
                cor: "bg-brand-dark",
                titulo: "Validação por IA + médico",
                desc: "O exame é analisado automaticamente por IA sob supervisão médica. A validação é ágil, segura e sigilosa.",
              },
              {
                n: "4",
                cor: "bg-sage",
                titulo: "Formulário clínico",
                desc: "Com o exame validado, preencha o formulário de triagem clínica. Os dados do cadastro já vêm pré-preenchidos.",
              },
              {
                n: "5",
                cor: "bg-brand",
                titulo: "Documentos no seu e-mail",
                desc: "Receita, formulário clínico e ficha de cadastro — todos assinados digitalmente com certificado ICP-Brasil — chegam ao seu e-mail em horas.",
              },
              {
                n: "6",
                cor: "bg-terra",
                titulo: "Retire sua PrEP",
                desc: "Com a receita em mãos, retire o TDF/FTC em qualquer farmácia ou drogaria. Pelo SUS, procure a UDM mais próxima.",
              },
            ].map(({ n, cor, titulo, desc }) => (
              <div
                key={n}
                className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div
                  className={`w-9 h-9 ${cor} text-white rounded-xl flex items-center justify-center text-sm font-bold mb-3`}
                >
                  {n}
                </div>
                <p className="font-semibold text-slate-800 text-sm mb-1.5">
                  {titulo}
                </p>
                <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <button
              onClick={() => setPlanosAbertos((v) => !v)}
              className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-slate-50 transition-colors"
            >
              <div>
                <p className="font-semibold text-slate-800">
                  Veja os planos que atualmente aceitamos
                </p>
                <p className="text-slate-500 text-xs mt-0.5">
                  Atendemos os principais convênios médicos — clique para
                  conferir a lista
                </p>
              </div>
              <svg
                className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${planosAbertos ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {planosAbertos && (
              <div className="px-6 pb-6 border-t border-slate-100">
                <p className="text-xs text-slate-500 mt-4 mb-4 leading-relaxed">
                  Confira abaixo os planos atualmente aceitos pela plataforma.
                  Novos convênios são adicionados periodicamente.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-4">
                  {PLANOS_VALIDOS.filter((p) => p !== "Outro").map((plano) => (
                    <div
                      key={plano}
                      className="flex items-center gap-1.5 text-xs text-slate-700 bg-slate-50 rounded-lg px-3 py-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                      {plano}
                    </div>
                  ))}
                </div>
                <div className="bg-honey-light border border-honey-light rounded-xl p-3">
                  <p className="text-xs text-honey-dark leading-relaxed">
                    <strong>⚠️ Atenção:</strong> esta lista pode sofrer
                    modificações conforme as contratualizações vigentes. Em caso
                    de dúvida, entre em contato com nossa equipe antes de
                    iniciar o cadastro.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  // ── Seletor de método de pagamento ───────────────────────────
  if (etapa === "seletor" && precadastroId) {
    return (
      <SeletorMetodoPagamento
        precadastroId={precadastroId}
        loading={iniciarPagamento.isPending}
        onSelect={(metodo) =>
          iniciarPagamento.mutate({ precadastroId, metodo })
        }
      />
    );
  }

  // ── Checkout PIX Asaas ────────────────────────────────────────
  if (etapa === "checkout" && pixData) {
    return (
      <CheckoutAsaas
        paymentId={pixData.paymentId}
        pixQrCode={pixData.pixQrCode}
        pixCopiaECola={pixData.pixCopiaECola}
      />
    );
  }

  // ── Aguardando validação do plano ─────────────────────────────
  if (etapa === "aguardando") {
    return (
      <div className="min-h-screen bg-warm-bg flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-10 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-sage-light rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-10 h-10 text-sage"
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
          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            Recebemos tudo com sucesso!
          </h2>
          <p className="text-slate-500 text-sm mb-6 leading-relaxed">
            Estamos com seus dados e iremos verificar seus documentos com
            cuidado. Em breve entraremos em contato com você.
          </p>
          <div className="bg-honey-light border border-honey-light rounded-2xl p-5 text-left space-y-2">
            <p className="text-honey-dark text-sm font-semibold mb-2">
              O que acontece agora:
            </p>
            {[
              "Nossa secretaria verifica seus documentos",
              "Você recebe um link por e-mail e WhatsApp",
              "Retorno em até 1 dia útil (seg.–sex., 08h–18h)",
            ].map((step) => (
              <div key={step} className="flex items-start gap-2">
                <span className="text-honey text-base mt-0.5">•</span>
                <p className="text-honey text-sm">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Formulário de cadastro ────────────────────────────────────
  const isPlano = tipo === "plano";
  const foraHorario = isPlano && !dentroHorario;
  const errServer =
    criar.error?.message ?? iniciarPagamento.error?.message ?? null;

  return (
    <div className="min-h-screen bg-warm-bg py-10 px-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setEtapa("escolha")}
            className="flex items-center gap-1.5 text-slate-500 hover:text-brand text-sm transition-colors"
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
          <LogoWordmark size={36} mode="light" />
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6 ${isPlano ? "bg-sage-light text-sage" : "bg-brand-light text-brand"}`}
          >
            <div
              className={`w-2 h-2 rounded-full ${isPlano ? "bg-sage-pale0" : "bg-brand-pale0"}`}
            />
            {isPlano ? "Plano de Saúde" : "Atendimento Particular"}
          </div>

          <h2 className="text-xl font-bold text-slate-800 mb-1">
            Vamos começar — seus dados ficam protegidos
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            Tratamos suas informações com total sigilo. Nenhum dado é
            compartilhado sem sua autorização.
          </p>

          {foraHorario && (
            <div className="bg-honey-light border border-honey-light rounded-2xl p-4 mb-6 flex gap-3">
              <span className="text-honey text-xl shrink-0">⏰</span>
              <div>
                <p className="text-honey-dark text-sm font-semibold">
                  Fora do horário de atendimento
                </p>
                <p className="text-honey text-sm mt-1">
                  O atendimento por plano funciona de{" "}
                  <strong>segunda a sexta, das 08h às 18h</strong>. Envie seus
                  dados agora — a validação ocorrerá no próximo dia útil.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label htmlFor="intake-nome" className={labelCls}>
                Nome completo
              </label>
              <input
                {...register("nome")}
                id="intake-nome"
                className={inputCls}
                placeholder="Seu nome completo"
              />
              {errors.nome && <p className={errCls}>{errors.nome.message}</p>}
            </div>

            <div>
              <label htmlFor="intake-telefone" className={labelCls}>
                Telefone (WhatsApp)
              </label>
              <div className="flex items-stretch">
                <div className="flex items-center gap-1.5 border border-r-0 border-slate-200 rounded-l-xl px-3 bg-slate-50 text-sm text-slate-600 shrink-0 select-none">
                  <span className="text-base">🇧🇷</span>
                  <span>+55</span>
                </div>
                <input
                  {...register("telefone", {
                    onChange: (e: ChangeEvent<HTMLInputElement>) => {
                      const digits = e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 11);
                      let v = digits;
                      if (digits.length > 7)
                        v = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
                      else if (digits.length > 2)
                        v = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
                      e.target.value = v;
                    },
                  })}
                  id="intake-telefone"
                  inputMode="tel"
                  className="flex-1 border border-slate-200 rounded-r-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent bg-white transition-all placeholder:text-slate-400"
                  placeholder="(11) 99999-9999"
                />
              </div>
              {errors.telefone && (
                <p className={errCls}>{errors.telefone.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="intake-cpf" className={labelCls}>
                CPF
              </label>
              <input
                {...register("cpf", {
                  onChange: (e: ChangeEvent<HTMLInputElement>) => {
                    const d = e.target.value.replace(/\D/g, "").slice(0, 11);
                    let v = d;
                    if (d.length > 9) v = `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
                    else if (d.length > 6) v = `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
                    else if (d.length > 3) v = `${d.slice(0, 3)}.${d.slice(3)}`;
                    e.target.value = v;
                  },
                })}
                id="intake-cpf"
                inputMode="numeric"
                className={inputCls}
                placeholder="000.000.000-00"
              />
              {errors.cpf && <p className={errCls}>{errors.cpf.message}</p>}
            </div>

            <div>
              <label htmlFor="intake-email" className={labelCls}>
                E-mail
              </label>
              <input
                {...register("email")}
                id="intake-email"
                type="email"
                className={inputCls}
                placeholder="seu@email.com"
              />
              {errors.email && <p className={errCls}>{errors.email.message}</p>}
            </div>

            {isPlano && (
              <>
                <div>
                  <label htmlFor="intake-plano" className={labelCls}>
                    Plano de saúde
                  </label>
                  <select
                    {...register("plano")}
                    id="intake-plano"
                    className={inputCls}
                  >
                    <option value="">Selecione seu plano</option>
                    {PLANOS_VALIDOS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bg-brand-pale border border-brand-light rounded-2xl p-4">
                  <p className="text-brand-dark text-sm font-semibold mb-1">
                    Documentos necessários
                  </p>
                  <p className="text-brand text-sm">
                    Envie sua carteirinha do plano e um documento de identidade
                    (RG ou CNH).
                  </p>
                </div>

                <div>
                  <label className={labelCls}>Carteirinha do plano</label>
                  <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-slate-200 hover:border-brand rounded-2xl py-5 cursor-pointer bg-slate-50 hover:bg-brand-pale transition-all">
                    <svg
                      className="w-8 h-8 text-slate-300 mb-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    <span className="text-sm text-slate-400">
                      {carteirinhaKey
                        ? "✓ Carteirinha enviada"
                        : "Clique para enviar"}
                    </span>
                    {carteirinhaNome ? (
                      <span className="text-xs text-brand font-medium mt-0.5 max-w-[220px] truncate">
                        {carteirinhaNome}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300 mt-0.5">
                        PDF, JPG ou PNG
                      </span>
                    )}
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setCarteirinhaNome(file.name);
                        try {
                          setCarteirinhaKey(await uploadArquivo(file));
                        } catch {
                          setUploadError(
                            "Erro ao enviar carteirinha. Tente novamente.",
                          );
                        }
                      }}
                    />
                  </label>
                  {carteirinhaKey && (
                    <p className="text-sage text-xs mt-1.5 flex items-center gap-1">
                      ✓ Carteirinha recebida com sucesso
                    </p>
                  )}
                </div>

                <div>
                  <label className={labelCls}>
                    Documento de identidade (RG ou CNH)
                  </label>
                  <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-slate-200 hover:border-brand rounded-2xl py-5 cursor-pointer bg-slate-50 hover:bg-brand-pale transition-all">
                    <svg
                      className="w-8 h-8 text-slate-300 mb-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    <span className="text-sm text-slate-400">
                      {documentoKey
                        ? "✓ Documento enviado"
                        : "Clique para enviar"}
                    </span>
                    {documentoNome ? (
                      <span className="text-xs text-brand font-medium mt-0.5 max-w-[220px] truncate">
                        {documentoNome}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300 mt-0.5">
                        PDF, JPG ou PNG
                      </span>
                    )}
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setDocumentoNome(file.name);
                        try {
                          setDocumentoKey(await uploadArquivo(file));
                        } catch {
                          setUploadError(
                            "Erro ao enviar documento. Tente novamente.",
                          );
                        }
                      }}
                    />
                  </label>
                  {documentoKey && (
                    <p className="text-sage text-xs mt-1.5 flex items-center gap-1">
                      ✓ Documento recebido com sucesso
                    </p>
                  )}
                </div>
              </>
            )}

            {uploadError && <p className="text-terra text-sm">{uploadError}</p>}
            {errServer && <p className="text-terra text-sm">{errServer}</p>}

            {isPlano ? (
              <button
                type="submit"
                disabled={criar.isPending || !carteirinhaKey || !documentoKey}
                className="w-full bg-sage text-white py-3.5 rounded-2xl font-semibold disabled:opacity-50 hover:bg-sage-dark transition-all shadow-md hover:shadow-lg text-sm"
              >
                {criar.isPending ? "Enviando…" : "Enviar para validação →"}
              </button>
            ) : (
              <button
                type="submit"
                disabled={criar.isPending || iniciarPagamento.isPending}
                className="w-full bg-brand text-white py-3.5 rounded-2xl font-semibold disabled:opacity-50 hover:bg-brand-dark transition-all shadow-md hover:shadow-lg text-sm"
              >
                {criar.isPending || iniciarPagamento.isPending
                  ? "Aguarde…"
                  : "Ir para o pagamento →"}
              </button>
            )}

            {!isPlano && (
              <div className="flex items-center justify-center gap-4 pt-1">
                {["PIX", "Crédito", "Débito"].map((m) => (
                  <span
                    key={m}
                    className="text-xs text-slate-400 flex items-center gap-1"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 inline-block" />
                    {m}
                  </span>
                ))}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
