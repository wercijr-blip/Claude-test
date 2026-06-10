import { useState } from "react";
import StaffHeader from "./StaffHeader.tsx";

const sections = [
  { id: "diagnostico", label: "Diagnóstico", icon: "🔍", color: "#e74c3c" },
  { id: "trafego", label: "Tráfego Pago", icon: "🎯", color: "#e67e22" },
  { id: "copy", label: "Copy & CTA", icon: "✍️", color: "#8e44ad" },
  { id: "seo", label: "SEO Técnico", icon: "⚙️", color: "#2980b9" },
  { id: "confianca", label: "Credibilidade", icon: "🏥", color: "#27ae60" },
  { id: "acoes", label: "Plano de Ação", icon: "🚀", color: "#c0392b" },
];

const data = {
  diagnostico: {
    title: "Diagnóstico Geral",
    subtitle: "O que foi identificado na análise do site",
    items: [
      {
        severity: "crítico",
        title: "Renderização 100% client-side (React sem SSR eficaz)",
        desc: "O site retorna HTML quase vazio para crawlers do Google, Meta e ferramentas de auditoria. Isso prejudica drasticamente o SEO e o carregamento de anúncios pagos — bots de rastreamento de anúncio não conseguem ler o conteúdo.",
        fix: "Ativar SSR ou SSG no Next.js para as páginas principais. Usar generateMetadata() para título, descrição e OG tags dinâmicas.",
      },
      {
        severity: "crítico",
        title: "Meta description genérica e sem proposta de valor",
        desc: 'A meta-description atual é apenas "Plataforma de saúde digital para prevenção do HIV via PrEP" — sem benefício claro, sem urgência, sem diferencial.',
        fix: 'Exemplo melhorado: "Consulta médica online para PrEP em até 48h. Receita digital, assinatura ICP-Brasil e acompanhamento completo. Sem fila, sem deslocamento."',
      },
      {
        severity: "alto",
        title: "Ausência de OG Tags e Twitter Cards",
        desc: "Sem Open Graph tags, qualquer link compartilhado no WhatsApp, Instagram ou Twitter aparece sem imagem e com título genérico — desperdiçando tráfego orgânico de indicação.",
        fix: "Adicionar og:title, og:description, og:image (1200x630px), og:type e twitter:card em todas as páginas.",
      },
      {
        severity: "alto",
        title: "Sem pixel de rastreamento configurável via tag manager",
        desc: "Para campanhas pagas (Meta/Google), é essencial rastrear eventos: PageView, Lead, CompleteRegistration, Schedule. Sem isso, os algoritmos de anúncios não conseguem otimizar.",
        fix: "Implementar Google Tag Manager + Meta Pixel + eventos customizados nos formulários.",
      },
      {
        severity: "médio",
        title: "Velocidade de carregamento comprometida por bundle JS grande",
        desc: "Sites React sem otimização de bundle chegam a 3-5s no mobile 4G. O Google Ads penaliza páginas lentas com CPC maior e menor Quality Score.",
        fix: "Code splitting, lazy loading de componentes, next/image para imagens otimizadas, análise com Lighthouse.",
      },
    ],
  },
  trafego: {
    title: "Otimização para Tráfego Pago",
    subtitle: "Estratégia para Google Ads e Meta Ads",
    items: [
      {
        plataforma: "Google Ads",
        tipo: "Search",
        headline: "PrEP Online Sem Fila — Consulta Hoje",
        desc: "Descrição: Receita digital assinada por médico infectologista. Agendamento em 48h. Discrição total.",
        palavras: [
          "PrEP online Brasília",
          "consulta PrEP particular",
          "PrEP teleconsulta",
          "prescrição PrEP digital",
          "PrEP sem SUS",
        ],
        nota: 'Foco em intenção comercial alta. Evitar palavras muito amplas como "HIV prevenção".',
      },
      {
        plataforma: "Google Ads",
        tipo: "Performance Max",
        headline: "Sua proteção contra o HIV — rápida, discreta e online",
        desc: "Usar assets visuais: médico em atendimento, tela de app com consulta, selos de segurança (CFM, ICP-Brasil).",
        palavras: [
          "remarketing de visitantes",
          "lookalike de leads convertidos",
        ],
        nota: "Ideal para expansão após ter dados de conversão do Search.",
      },
      {
        plataforma: "Meta Ads",
        tipo: "Topo de funil (Awareness)",
        headline: "Você sabe o que é PrEP?",
        desc: 'Criativo educativo: vídeo curto (15-30s) explicando PrEP de forma acolhedora. CTA: "Saiba mais". Objetivo: Tráfego ou Engajamento.',
        palavras: [
          "Homens 20-45 interessados em saúde",
          "LGBT+",
          "Saúde sexual",
        ],
        nota: 'Não use a palavra "HIV" no texto do anúncio — pode ser reprovado. Use "proteção avançada contra IST".',
      },
      {
        plataforma: "Meta Ads",
        tipo: "Fundo de funil (Conversão)",
        headline: "Consulta PrEP online — Agenda aberta",
        desc: 'Criativo com urgência: "Vagas limitadas esta semana". Formato: carrossel com 3 etapas do processo (Agenda → Consulta → Receita). CTA: "Agendar agora".',
        palavras: [
          "Remarketing: visitou o site mas não converteu",
          "Lead Ads para captura de contato",
        ],
        nota: "Pixel de conversão obrigatório. Evento: Lead ou CompleteRegistration.",
      },
    ],
  },
  copy: {
    title: "Copy e CTAs",
    subtitle: "Recomendações de texto e chamadas para ação",
    blocks: [
      {
        atual: "Plataforma de saúde digital para prevenção do HIV via PrEP",
        problema: "Técnico, frio, não fala com o paciente",
        sugerido:
          "Sua proteção contra o HIV, do jeito certo — online, rápido e com médico de verdade",
        tipo: "Hero Headline",
      },
      {
        atual: "Faça seu cadastro",
        problema: "CTA genérico, sem benefício claro",
        sugerido: "Quero minha consulta PrEP agora →",
        tipo: "CTA Principal",
      },
      {
        atual: "(provavelmente ausente)",
        problema: "Nenhuma âncora de urgência ou escassez",
        sugerido: "⏱ Consultas disponíveis esta semana. Prescrição em até 48h.",
        tipo: "Urgência",
      },
      {
        atual: "(provavelmente ausente)",
        problema: "Falta social proof visível",
        sugerido:
          '"Recebi minha receita em 24h. Processo simples e médico muito atencioso." — Paciente via Facilita PrEP',
        tipo: "Depoimento",
      },
      {
        atual: "(provavelmente ausente)",
        problema: "Falta FAQs para objeções comuns",
        sugerido:
          "Por que não usar o SUS? É realmente privado? Meus dados ficam seguros? Funciona no meu estado?",
        tipo: "FAQ / Objeções",
      },
    ],
  },
  seo: {
    title: "SEO Técnico",
    subtitle: "Checklist de implementação para Next.js",
    checklist: [
      "generateMetadata() para cada rota com título único e description personalizada",
      "Open Graph tags: og:title, og:description, og:image (1200x630), og:type=website",
      "Twitter Card: twitter:card=summary_large_image",
      "sitemap.xml gerado automaticamente (next-sitemap)",
      "robots.txt permitindo indexação das páginas públicas",
      "Schema.org markup: MedicalBusiness, Physician, MedicalClinic",
      "Canonical URLs para evitar conteúdo duplicado",
      "Core Web Vitals: LCP < 2.5s, CLS < 0.1, FID < 100ms",
      "next/image em todas as imagens com width, height e priority nas acima da dobra",
      "Google Tag Manager implementado no _document.tsx",
      "Meta Pixel com eventos: PageView, Lead, CompleteRegistration, Schedule",
      "Google Analytics 4 com conversões configuradas",
    ],
  },
  confianca: {
    title: "Credibilidade e Conformidade",
    subtitle: "Elementos essenciais para saúde digital no Brasil",
    items: [
      {
        icon: "⚕️",
        title: "CRM e RQE visíveis",
        desc: 'Nome do médico responsável, CRM-DF 16381 e RQE 14486 devem aparecer no footer e na página "Quem somos". Isso é exigência legal e gera confiança.',
      },
      {
        icon: "🔒",
        title: "Selos de segurança",
        desc: 'ICP-Brasil, LGPD compliance, SSL visível. Adicionar seção "Seus dados estão seguros" com explicação simples sobre criptografia e privacidade.',
      },
      {
        icon: "📋",
        title: "CFM - Telemedicina",
        desc: "Referenciar conformidade com Resolução CFM 2.314/2022 na página de teleconsulta. Isso diferencia de plataformas ilegais ou gray-market.",
      },
      {
        icon: "🏥",
        title: "ATOS e IASO como âncoras institucionais",
        desc: "Mencionar que a plataforma é operada pelo mesmo médico RT das clínicas ATOS Saúde e IASO Saúde amplia a percepção de solidez.",
      },
      {
        icon: "📱",
        title: "WhatsApp de suporte visível",
        desc: "Para tráfego pago, um botão flutuante do WhatsApp aumenta conversão em 15-30%. Pacientes com dúvidas sobre PrEP preferem conversar antes de agendar.",
      },
      {
        icon: "⭐",
        title: "Social proof quantificado",
        desc: 'Ex: "Mais de 200 pacientes em PrEP acompanhados" ou "Prescrições emitidas em todos os estados". Números concretos vencem claims genéricos.',
      },
    ],
  },
  acoes: {
    title: "Plano de Ação Priorizado",
    subtitle: "O que fazer primeiro para maximizar retorno",
    fases: [
      {
        fase: "Fase 1 — Semana 1 (Fundação técnica)",
        cor: "#e74c3c",
        acoes: [
          "Ativar SSR/SSG no Next.js para homepage e página de agendamento",
          "Implementar generateMetadata() com title e description otimizados",
          "Adicionar Open Graph tags e imagem de preview (1200x630px)",
          "Instalar Google Tag Manager e Meta Pixel",
          "Configurar evento de conversão nos formulários de agendamento",
        ],
      },
      {
        fase: "Fase 2 — Semana 2 (Copy e CRO)",
        cor: "#e67e22",
        acoes: [
          "Reescrever hero section com headline orientada a benefício",
          "Adicionar CTA primário com urgência (vagas limitadas, 48h)",
          "Inserir seção de depoimentos de pacientes (anonimizados conforme LGPD)",
          "Criar FAQ respondendo as 5 objeções mais comuns",
          "Adicionar botão flutuante de WhatsApp",
          "Exibir CRM, RQE e selos de conformidade no footer",
        ],
      },
      {
        fase: "Fase 3 — Semana 3 (Campanhas pagas)",
        cor: "#8e44ad",
        acoes: [
          "Criar campanha Google Search com palavras-chave de alta intenção",
          "Configurar audiências de remarketing (visitou mas não converteu)",
          "Lançar Meta Ads de topo de funil com criativo educativo sobre PrEP",
          "Definir budget inicial: R$ 50-100/dia dividido 70% Google / 30% Meta",
          "Criar landing page dedicada para cada fonte de tráfego (LP Google, LP Meta)",
        ],
      },
      {
        fase: "Fase 4 — Mês 2 (Otimização)",
        cor: "#27ae60",
        acoes: [
          "Analisar dados de conversão e ajustar lances",
          "Testar A/B nos headlines dos anúncios",
          "Implementar Schema.org para médico e clínica",
          "Adicionar chat de triagem com IA para qualificar leads antes da consulta",
          "Criar conteúdo de blog para SEO orgânico de longo prazo",
        ],
      },
    ],
  },
};

const severityColor: Record<string, string> = {
  crítico: "#e74c3c",
  alto: "#e67e22",
  médio: "#f39c12",
};

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2
        style={{
          margin: "0 0 4px",
          color: "#ccd6f6",
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        {title}
      </h2>
      <p style={{ margin: 0, color: "#8892b0", fontSize: 13 }}>{subtitle}</p>
    </div>
  );
}

export default function AuditoriaPage() {
  const [active, setActive] = useState("diagnostico");
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});

  const toggleCheck = (i: number) => {
    setCheckedItems((prev) => ({ ...prev, [i]: !prev[i] }));
  };

  return (
    <>
      <StaffHeader />
      <div
        style={{
          fontFamily: "'Georgia', serif",
          background: "#0f1117",
          minHeight: "100vh",
          color: "#e8e8e8",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #1a1f35 0%, #0d1528 100%)",
            borderBottom: "1px solid #2a3050",
            padding: "32px 24px 24px",
          }}
        >
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#c0392b",
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: 3,
                  textTransform: "uppercase",
                  color: "#8892b0",
                  fontFamily: "monospace",
                }}
              >
                AUDITORIA · FACILITA PREP
              </span>
            </div>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 700,
                margin: "0 0 8px",
                color: "#ccd6f6",
                letterSpacing: -0.5,
              }}
            >
              Relatório de Otimização para Tráfego Pago
            </h1>
            <p
              style={{
                margin: 0,
                color: "#8892b0",
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              Análise técnica e estratégica da plataforma facilitaprep.com.br —
              foco em conversão, credibilidade e performance em campanhas pagas.
            </p>
          </div>
        </div>

        {/* Nav */}
        <div
          style={{
            background: "#13172a",
            borderBottom: "1px solid #1e2540",
            overflowX: "auto",
          }}
        >
          <div
            style={{
              maxWidth: 900,
              margin: "0 auto",
              display: "flex",
              gap: 2,
              padding: "0 24px",
            }}
          >
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                style={{
                  background: active === s.id ? s.color + "22" : "transparent",
                  border: "none",
                  borderBottom:
                    active === s.id
                      ? `2px solid ${s.color}`
                      : "2px solid transparent",
                  color: active === s.id ? s.color : "#8892b0",
                  padding: "16px 18px 14px",
                  cursor: "pointer",
                  fontSize: 13,
                  fontFamily: "inherit",
                  fontWeight: active === s.id ? 600 : 400,
                  whiteSpace: "nowrap",
                  transition: "all 0.2s",
                }}
              >
                {s.icon} {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
          {/* DIAGNÓSTICO */}
          {active === "diagnostico" && (
            <div>
              <SectionHeader
                title={data.diagnostico.title}
                subtitle={data.diagnostico.subtitle}
              />
              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                {data.diagnostico.items.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      background: "#13172a",
                      border: `1px solid ${severityColor[item.severity]}33`,
                      borderLeft: `4px solid ${severityColor[item.severity]}`,
                      borderRadius: 8,
                      padding: 20,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                        marginBottom: 8,
                      }}
                    >
                      <span
                        style={{
                          background: severityColor[item.severity] + "22",
                          color: severityColor[item.severity],
                          padding: "2px 10px",
                          borderRadius: 20,
                          fontSize: 11,
                          fontFamily: "monospace",
                          textTransform: "uppercase",
                          letterSpacing: 1,
                          flexShrink: 0,
                          marginTop: 2,
                        }}
                      >
                        {item.severity}
                      </span>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: 15,
                          color: "#ccd6f6",
                          fontWeight: 600,
                        }}
                      >
                        {item.title}
                      </h3>
                    </div>
                    <p
                      style={{
                        margin: "0 0 12px",
                        color: "#8892b0",
                        fontSize: 13,
                        lineHeight: 1.7,
                      }}
                    >
                      {item.desc}
                    </p>
                    <div
                      style={{
                        background: "#0d1528",
                        borderRadius: 6,
                        padding: "10px 14px",
                      }}
                    >
                      <span
                        style={{
                          color: "#27ae60",
                          fontSize: 11,
                          fontFamily: "monospace",
                          textTransform: "uppercase",
                          letterSpacing: 1,
                        }}
                      >
                        ✓ solução{" "}
                      </span>
                      <span style={{ color: "#a8b2d8", fontSize: 13 }}>
                        {item.fix}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TRÁFEGO PAGO */}
          {active === "trafego" && (
            <div>
              <SectionHeader
                title={data.trafego.title}
                subtitle={data.trafego.subtitle}
              />
              <div
                style={{ display: "flex", flexDirection: "column", gap: 20 }}
              >
                {data.trafego.items.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      background: "#13172a",
                      border: "1px solid #1e2540",
                      borderRadius: 10,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        background:
                          item.plataforma === "Google Ads"
                            ? "#1a3a6b"
                            : "#1a2f5a",
                        padding: "12px 20px",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <span style={{ fontSize: 18 }}>
                        {item.plataforma === "Google Ads" ? "🔵" : "🟣"}
                      </span>
                      <div>
                        <span
                          style={{
                            color: "#ccd6f6",
                            fontWeight: 700,
                            fontSize: 14,
                          }}
                        >
                          {item.plataforma}
                        </span>
                        <span
                          style={{
                            color: "#8892b0",
                            fontSize: 12,
                            marginLeft: 10,
                          }}
                        >
                          — {item.tipo}
                        </span>
                      </div>
                    </div>
                    <div style={{ padding: 20 }}>
                      <div
                        style={{
                          background: "#0d1528",
                          borderRadius: 8,
                          padding: 14,
                          marginBottom: 14,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            color: "#64ffda",
                            fontFamily: "monospace",
                            marginBottom: 4,
                          }}
                        >
                          HEADLINE
                        </div>
                        <div
                          style={{
                            fontSize: 15,
                            color: "#e8e8e8",
                            fontWeight: 600,
                          }}
                        >
                          "{item.headline}"
                        </div>
                      </div>
                      <p
                        style={{
                          color: "#8892b0",
                          fontSize: 13,
                          lineHeight: 1.7,
                          marginBottom: 14,
                        }}
                      >
                        {item.desc}
                      </p>
                      <div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "#8892b0",
                            fontFamily: "monospace",
                            marginBottom: 8,
                          }}
                        >
                          PALAVRAS-CHAVE / AUDIÊNCIAS
                        </div>
                        <div
                          style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
                        >
                          {item.palavras.map((p, j) => (
                            <span
                              key={j}
                              style={{
                                background: "#1e2540",
                                border: "1px solid #2a3558",
                                color: "#a8b2d8",
                                padding: "4px 10px",
                                borderRadius: 20,
                                fontSize: 12,
                              }}
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                      {item.nota && (
                        <div
                          style={{
                            marginTop: 12,
                            padding: "8px 12px",
                            background: "#1a1f35",
                            borderRadius: 6,
                            borderLeft: "3px solid #f39c12",
                          }}
                        >
                          <span
                            style={{
                              color: "#f39c12",
                              fontSize: 11,
                              fontFamily: "monospace",
                            }}
                          >
                            ⚠ nota:{" "}
                          </span>
                          <span style={{ color: "#8892b0", fontSize: 12 }}>
                            {item.nota}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* COPY */}
          {active === "copy" && (
            <div>
              <SectionHeader
                title={data.copy.title}
                subtitle={data.copy.subtitle}
              />
              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                {data.copy.blocks.map((block, i) => (
                  <div
                    key={i}
                    style={{
                      background: "#13172a",
                      border: "1px solid #1e2540",
                      borderRadius: 10,
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ background: "#1e2540", padding: "8px 16px" }}>
                      <span
                        style={{
                          fontSize: 11,
                          color: "#64ffda",
                          fontFamily: "monospace",
                          textTransform: "uppercase",
                          letterSpacing: 1,
                        }}
                      >
                        {block.tipo}
                      </span>
                    </div>
                    <div
                      style={{
                        padding: 20,
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 16,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "#e74c3c",
                            fontFamily: "monospace",
                            marginBottom: 6,
                            textTransform: "uppercase",
                            letterSpacing: 1,
                          }}
                        >
                          ✗ Atual
                        </div>
                        <div
                          style={{
                            background: "#0d1528",
                            borderRadius: 6,
                            padding: 12,
                            color: "#8892b0",
                            fontSize: 13,
                            fontStyle: "italic",
                            borderLeft: "3px solid #e74c3c33",
                          }}
                        >
                          {block.atual}
                        </div>
                        <div
                          style={{
                            marginTop: 8,
                            fontSize: 11,
                            color: "#e74c3c",
                          }}
                        >
                          {block.problema}
                        </div>
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "#27ae60",
                            fontFamily: "monospace",
                            marginBottom: 6,
                            textTransform: "uppercase",
                            letterSpacing: 1,
                          }}
                        >
                          ✓ Sugerido
                        </div>
                        <div
                          style={{
                            background: "#0d2818",
                            borderRadius: 6,
                            padding: 12,
                            color: "#ccd6f6",
                            fontSize: 13,
                            fontWeight: 500,
                            borderLeft: "3px solid #27ae60",
                          }}
                        >
                          {block.sugerido}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SEO */}
          {active === "seo" && (
            <div>
              <SectionHeader
                title={data.seo.title}
                subtitle={data.seo.subtitle}
              />
              <div
                style={{
                  background: "#13172a",
                  border: "1px solid #1e2540",
                  borderRadius: 10,
                  padding: 24,
                }}
              >
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
                >
                  {data.seo.checklist.map((item, i) => (
                    <div
                      key={i}
                      onClick={() => toggleCheck(i)}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                        padding: "12px 14px",
                        background: checkedItems[i] ? "#0d2818" : "#0d1528",
                        borderRadius: 8,
                        cursor: "pointer",
                        border: `1px solid ${checkedItems[i] ? "#27ae6044" : "#1e2540"}`,
                        transition: "all 0.2s",
                      }}
                    >
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 4,
                          border: `2px solid ${checkedItems[i] ? "#27ae60" : "#2a3558"}`,
                          background: checkedItems[i]
                            ? "#27ae60"
                            : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          marginTop: 1,
                          transition: "all 0.2s",
                        }}
                      >
                        {checkedItems[i] && (
                          <span style={{ color: "white", fontSize: 12 }}>
                            ✓
                          </span>
                        )}
                      </div>
                      <span
                        style={{
                          color: checkedItems[i] ? "#64ffda" : "#a8b2d8",
                          fontSize: 13,
                          lineHeight: 1.5,
                          textDecoration: checkedItems[i]
                            ? "line-through"
                            : "none",
                        }}
                      >
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    marginTop: 16,
                    textAlign: "right",
                    color: "#8892b0",
                    fontSize: 12,
                  }}
                >
                  {Object.values(checkedItems).filter(Boolean).length} /{" "}
                  {data.seo.checklist.length} concluídos
                </div>
              </div>
            </div>
          )}

          {/* CREDIBILIDADE */}
          {active === "confianca" && (
            <div>
              <SectionHeader
                title={data.confianca.title}
                subtitle={data.confianca.subtitle}
              />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                }}
              >
                {data.confianca.items.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      background: "#13172a",
                      border: "1px solid #1e2540",
                      borderRadius: 10,
                      padding: 20,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <span style={{ fontSize: 28 }}>{item.icon}</span>
                    <h3
                      style={{
                        margin: 0,
                        color: "#ccd6f6",
                        fontSize: 14,
                        fontWeight: 700,
                      }}
                    >
                      {item.title}
                    </h3>
                    <p
                      style={{
                        margin: 0,
                        color: "#8892b0",
                        fontSize: 12,
                        lineHeight: 1.7,
                      }}
                    >
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PLANO DE AÇÃO */}
          {active === "acoes" && (
            <div>
              <SectionHeader
                title={data.acoes.title}
                subtitle={data.acoes.subtitle}
              />
              <div
                style={{ display: "flex", flexDirection: "column", gap: 20 }}
              >
                {data.acoes.fases.map((fase, i) => (
                  <div
                    key={i}
                    style={{
                      background: "#13172a",
                      border: "1px solid #1e2540",
                      borderLeft: `4px solid ${fase.cor}`,
                      borderRadius: 10,
                      padding: 20,
                    }}
                  >
                    <div
                      style={{
                        color: fase.cor,
                        fontFamily: "monospace",
                        fontSize: 12,
                        textTransform: "uppercase",
                        letterSpacing: 1,
                        marginBottom: 14,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          background: fase.cor,
                          color: "white",
                          borderRadius: "50%",
                          width: 22,
                          height: 22,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {i + 1}
                      </span>
                      {fase.fase}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      {fase.acoes.map((acao, j) => (
                        <div
                          key={j}
                          style={{
                            display: "flex",
                            gap: 10,
                            alignItems: "flex-start",
                          }}
                        >
                          <span
                            style={{
                              color: fase.cor,
                              fontSize: 12,
                              marginTop: 2,
                              flexShrink: 0,
                            }}
                          >
                            →
                          </span>
                          <span
                            style={{
                              color: "#a8b2d8",
                              fontSize: 13,
                              lineHeight: 1.6,
                            }}
                          >
                            {acao}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Budget recomendado */}
              <div
                style={{
                  marginTop: 24,
                  background: "#13172a",
                  border: "1px solid #27ae6044",
                  borderRadius: 10,
                  padding: 20,
                }}
              >
                <h3
                  style={{
                    color: "#27ae60",
                    margin: "0 0 16px",
                    fontSize: 14,
                    fontFamily: "monospace",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  💰 Budget Inicial Recomendado (Mês 1)
                </h3>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 12,
                  }}
                >
                  {[
                    {
                      label: "Google Search",
                      valor: "R$ 1.500/mês",
                      nota: "Alta intenção",
                    },
                    {
                      label: "Meta Ads",
                      valor: "R$ 600/mês",
                      nota: "Awareness + remarketing",
                    },
                    {
                      label: "Total inicial",
                      valor: "R$ 2.100/mês",
                      nota: "~R$ 70/dia",
                    },
                  ].map((b, i) => (
                    <div
                      key={i}
                      style={{
                        background: "#0d1528",
                        borderRadius: 8,
                        padding: 14,
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          color: "#8892b0",
                          fontSize: 11,
                          marginBottom: 6,
                        }}
                      >
                        {b.label}
                      </div>
                      <div
                        style={{
                          color: "#64ffda",
                          fontSize: 18,
                          fontWeight: 700,
                          marginBottom: 4,
                        }}
                      >
                        {b.valor}
                      </div>
                      <div style={{ color: "#8892b0", fontSize: 11 }}>
                        {b.nota}
                      </div>
                    </div>
                  ))}
                </div>
                <p
                  style={{
                    margin: "14px 0 0",
                    color: "#8892b0",
                    fontSize: 12,
                    lineHeight: 1.6,
                  }}
                >
                  <strong style={{ color: "#a8b2d8" }}>
                    Meta de CPL (Custo por Lead):
                  </strong>{" "}
                  R$ 40–80 no Google Search | R$ 15–40 no Meta (leads frios).
                  Com ticket médio de consulta entre R$ 150–250, break-even a
                  partir de 1 conversão a cada 2–3 leads qualificados.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: "1px solid #1e2540",
            padding: "20px 24px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              margin: 0,
              color: "#4a5568",
              fontSize: 11,
              fontFamily: "monospace",
            }}
          >
            FACILITA PREP · AUDITORIA TÉCNICA E ESTRATÉGICA · 2026
          </p>
        </div>
      </div>
    </>
  );
}
