/**
 * CIS-06 — Detecção de Divergência de Conduta
 */

import {
  callClaude,
  parseJsonResponse,
  MODEL_SONNET,
  INJECTION_GUARD,
  OUTPUT_CONTRACT_JSON,
  EVIDENCE_GRADING,
} from "./client.ts";

export interface ResultadoDivergenciaConducta {
  tem_divergencia: boolean;
  nivel_urgencia: "baixo" | "medio" | "alto" | null;
  hash_alerta: string | null;
  supressao_sugerida_dias: number | null;
  confianca_aplicabilidade: "alta" | "media" | "baixa" | null;
  divergencias: Array<{
    aspecto: string;
    conduta_atual: string;
    evidencia_recomenda: string;
    justificativa: string;
    grade: "1A" | "1B" | "2A" | "2B" | "2C" | "3" | "4" | "5";
    forca_recomendacao: "forte" | "condicional";
    fonte: string;
    populacao_estudo: string;
    aplicavel_ao_perfil: boolean;
  }>;
  mensagem_para_medico: string | null;
}

export interface FeedbackHistoricoItem {
  hashAlerta: string | null;
  feedback: string; // 'concordo' | 'discordo' | 'inaplicavel'
  motivo: string | null;
  cid10Origem?: string; // preenchido quando o feedback vem de diagnóstico diferente (padrão global)
}

const PROMPT_06_SYSTEM = `${INJECTION_GUARD}
${OUTPUT_CONTRACT_JSON}

${EVIDENCE_GRADING}

Você é um consultor de qualidade clínica especializado em infectologia.

Analise se existe divergência clinicamente relevante entre a conduta atual e a evidência fornecida.

CRITÉRIOS PARA SINALIZAR DIVERGÊNCIA (todos obrigatórios):
- A evidência tem GRADE 1A ou 1B (RCT ou meta-análise)
- A mudança tem impacto direto em desfecho do paciente (mortalidade, toxicidade, eficácia)
- A recomendação é de guidelines de referência (IDSA, ESCMID, WHO, MS Brasil, ANVISA)
Não sinalize diferenças de preferência ou adaptações locais justificáveis.

REGRA DE APLICABILIDADE POPULACIONAL — verifique ANTES de sinalizar qualquer divergência:
Para cada divergência identificada, verifique se a população do estudo é compatível com
o perfil do paciente fornecido. Incompatibilidades que reduzem aplicabilidade:
• Imunocompetente vs imunocomprometido (HIV, transplante, quimioterapia, corticoide)
• Adulto vs pediátrico vs idoso (≥65 anos)
• Ausência de comorbidade relevante no estudo que está presente no paciente
Se incompatível: aplicavel_ao_perfil = false, confianca_aplicabilidade reduzida,
nivel_urgencia recuado um grau (alto→medio, medio→baixo).

REGRA DE FEEDBACK HISTÓRICO — aplique ANTES de definir nivel_urgencia final:
O input incluirá o histórico de feedback do médico sobre alertas anteriores.
• Se o médico marcou 'discordo' ou 'inaplicavel' em alerta com mesmo hash_alerta: recue nivel_urgencia um grau e mencione o feedback na mensagem_para_medico.
• Se marcou 'concordo': mantenha ou eleve.
• Itens marcados [padrão global] indicam comportamento do médico em outro diagnóstico — considere o padrão mas não descarte automaticamente.

{
  "tem_divergencia": false,
  "nivel_urgencia": "baixo | medio | alto | null",
  "hash_alerta": null,
  "supressao_sugerida_dias": null,
  "confianca_aplicabilidade": null,
  "divergencias": [
    {
      "aspecto": "qual aspecto específico da conduta",
      "conduta_atual": "o que está sendo feito",
      "evidencia_recomenda": "o que a literatura mais recente recomenda",
      "justificativa": "resumo em 1-2 linhas da evidência",
      "grade": "1A | 1B | 2A | 2B | 2C | 3 | 4 | 5",
      "forca_recomendacao": "forte | condicional",
      "fonte": "autores, revista, ano, PMID",
      "populacao_estudo": "descrição da população do estudo fonte",
      "aplicavel_ao_perfil": true
    }
  ],
  "mensagem_para_medico": null
}

REGRAS:
- hash_alerta: gere apenas se tem_divergencia = true; snake_case, sem acentos, máximo 80 chars: {cid10}_{aspecto_normalizado}.
- supressao_sugerida_dias: alto: 7, medio: 14, baixo: 30; null se sem divergência.
- confianca_aplicabilidade: alta = população do estudo compatível com o perfil; media = parcialmente compatível; baixa = população claramente diferente.
- mensagem_para_medico: null se tem_divergencia = false; texto amigável, não julgamental, se true. Inclua limitação populacional quando confianca_aplicabilidade = baixa.
- Se TODAS as divergências tiverem aplicavel_ao_perfil = false: tem_divergencia = false.`;

export async function detectarDivergenciaConducta(params: {
  condutaAtual: string;
  sinteseEvidencias: string;
  diagnostico: string;
  cid10: string;
  perfilPaciente?: {
    faixa_etaria: string;
    imunocomprometido: boolean;
    tipo_imunocomprometimento: string | null;
    comorbidades: string[];
  };
  historicoFeedback?: FeedbackHistoricoItem[];
}): Promise<ResultadoDivergenciaConducta> {
  const perfilStr = params.perfilPaciente
    ? [
        `Faixa etária: ${params.perfilPaciente.faixa_etaria}`,
        params.perfilPaciente.imunocomprometido
          ? `Imunocomprometido: sim (${params.perfilPaciente.tipo_imunocomprometimento ?? "não especificado"})`
          : "Imunocomprometido: não",
        params.perfilPaciente.comorbidades.length
          ? `Comorbidades: ${params.perfilPaciente.comorbidades.join(", ")}`
          : "Comorbidades: nenhuma documentada",
      ].join("\n")
    : "Perfil não disponível — aplique critérios conservadores de compatibilidade.";

  const feedbackStr = params.historicoFeedback?.length
    ? params.historicoFeedback
        .map((f) => {
          const origem = f.cid10Origem
            ? ` | outro diagnóstico: ${f.cid10Origem} [padrão global]`
            : "";
          return `- hash: ${f.hashAlerta ?? "desconhecido"} | feedback: ${f.feedback}${f.motivo ? ` | motivo: "${f.motivo}"` : ""}${origem}`;
        })
        .join("\n")
    : "Nenhum feedback registrado.";

  const userContent = `PERFIL DO PACIENTE:
${perfilStr}

HISTÓRICO DE FEEDBACK DO MÉDICO:
(itens sem [padrão global] são específicos de ${params.cid10}; itens [padrão global] indicam que o médico descartou aspecto análogo em outro diagnóstico — considere o padrão mas não descarte automaticamente)
${feedbackStr}

CONDUTA ATUAL DOCUMENTADA:
${params.condutaAtual}

SÍNTESE DAS EVIDÊNCIAS MAIS RECENTES:
${params.sinteseEvidencias}

Diagnóstico: ${params.diagnostico} (${params.cid10})`;

  const text = await callClaude(
    PROMPT_06_SYSTEM,
    userContent,
    1500,
    MODEL_SONNET,
    0.1,
    "detectarDivergenciaConducta",
  );
  return parseJsonResponse<ResultadoDivergenciaConducta>(
    text,
    "divergencia-conduta",
  );
}
