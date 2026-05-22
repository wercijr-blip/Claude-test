/**
 * CIS-02a — MedScribe: SOAP Note
 * CIS-02b — MedScribe: Knowledge Metadata
 */

import { z } from "zod";
import {
  callClaude,
  parseJsonResponse,
  MODEL_HAIKU,
  MODEL_SONNET,
  INTEGRITY_GUARD,
  INJECTION_GUARD,
  PII_GUARD,
  OUTPUT_CONTRACT_JSON,
} from "./client.ts";

export const KnowledgeMetadataSchema = z
  .object({
    diagnostico_principal: z
      .object({
        nome: z.string(),
        cid10: z.string(),
        certeza: z.enum(["confirmado", "provavel", "suspeito"]),
        categoria: z.enum(["infeccioso", "nao_infeccioso", "misto"]),
      })
      .passthrough(),
    diagnosticos_diferenciais: z.array(z.string()).default([]),
    apresentacao_clinica: z
      .object({
        tempo_evolucao_dias: z.number(),
        sintomas_principais: z.array(z.string()).default([]),
        sinais_vitais_alterados: z.array(z.string()).default([]),
        achados_exame_fisico: z.array(z.string()).default([]),
      })
      .passthrough(),
    perfil_paciente: z
      .object({
        faixa_etaria: z.enum(["pediatrico", "adulto_jovem", "adulto", "idoso"]),
        sexo: z.enum(["M", "F", "nao_informado"]),
        imunocomprometido: z.boolean(),
        tipo_imunocomprometimento: z
          .enum(["transplante", "hiv", "quimioterapia", "corticoide", "outro"])
          .nullable(),
        comorbidades: z.array(z.string()).default([]),
      })
      .passthrough(),
    microbiologia: z
      .object({
        agente_identificado: z.string().nullable(),
        metodo_diagnostico: z.array(z.string()).default([]),
        perfil_resistencia: z.string().nullable(),
      })
      .passthrough(),
    conduta: z
      .object({
        antibioticos: z
          .array(
            z
              .object({
                nome: z.string(),
                dose: z.string(),
                via: z.string(),
                frequencia: z.string(),
                duracao_dias: z.number(),
              })
              .passthrough(),
          )
          .default([]),
        outros_medicamentos: z.array(z.string()).default([]),
        internacao_indicada: z.boolean(),
        nivel_cuidado: z.enum(["ambulatorial", "internacao", "UTI"]),
      })
      .passthrough(),
    busca_pubmed: z
      .object({
        termos_mesh: z.array(z.string()).default([]),
        query_sugerida: z.string(),
        prioridade: z.enum(["alta", "media", "baixa"]),
      })
      .passthrough(),
    palavras_gatilho_relatorio: z.array(z.string()).default([]),
    caso_atipico: z
      .object({
        atipico: z.boolean(),
        criterios_objetivos: z.array(z.string()).default([]),
        tipo_sugerido: z.enum(["relato_de_caso", "serie_de_casos", "nenhum"]),
      })
      .passthrough(),
    tags: z.array(z.string()).default([]),
    plano_terapeutico: z.array(z.string()).default([]),
    populacao: z.string().optional(),
  })
  .passthrough();

export interface KnowledgeMetadata {
  diagnostico_principal: {
    nome: string;
    cid10: string;
    certeza: "confirmado" | "provavel" | "suspeito";
    categoria: "infeccioso" | "nao_infeccioso" | "misto";
  };
  diagnosticos_diferenciais: string[];
  apresentacao_clinica: {
    tempo_evolucao_dias: number;
    sintomas_principais: string[];
    sinais_vitais_alterados: string[];
    achados_exame_fisico: string[];
  };
  perfil_paciente: {
    faixa_etaria: "pediatrico" | "adulto_jovem" | "adulto" | "idoso";
    sexo: "M" | "F" | "nao_informado";
    imunocomprometido: boolean;
    tipo_imunocomprometimento:
      | "transplante"
      | "hiv"
      | "quimioterapia"
      | "corticoide"
      | "outro"
      | null;
    comorbidades: string[];
  };
  microbiologia: {
    agente_identificado: string | null;
    metodo_diagnostico: string[];
    perfil_resistencia: string | null;
  };
  conduta: {
    antibioticos: Array<{
      nome: string;
      dose: string;
      via: string;
      frequencia: string;
      duracao_dias: number;
    }>;
    outros_medicamentos: string[];
    internacao_indicada: boolean;
    nivel_cuidado: "ambulatorial" | "internacao" | "UTI";
  };
  busca_pubmed: {
    termos_mesh: string[];
    query_sugerida: string;
    prioridade: "alta" | "media" | "baixa";
  };
  palavras_gatilho_relatorio: string[];
  caso_atipico: {
    atipico: boolean;
    criterios_objetivos: string[];
    tipo_sugerido: "relato_de_caso" | "serie_de_casos" | "nenhum";
  };
  tags: string[];
}

export async function gerarSOAP(params: {
  transcricaoOuTexto: string;
  dadosExamesJson?: string;
  template:
    | "infectologia_geral"
    | "prep_ist"
    | "opat"
    | "pos_transplante"
    | "neutropenia_febril"
    | "hiv_cronico"
    | "tb";
  tipoConsulta?: "primeira_consulta" | "retorno" | "seguimento";
}): Promise<string> {
  const tipoConsultaLabel = {
    primeira_consulta:
      "PRIMEIRA CONSULTA — documente anamnese completa, antecedentes e epidemiologia detalhados.",
    retorno:
      "RETORNO — foque na evolução desde a última consulta: resposta ao tratamento, novos sintomas, resultados de exames pendentes.",
    seguimento:
      "SEGUIMENTO (condição crônica) — registre controle da doença, adesão, efeitos adversos, ajustes de conduta e metas terapêuticas.",
  };
  const tipoCtx = params.tipoConsulta
    ? `\nTIPO DE CONSULTA: ${tipoConsultaLabel[params.tipoConsulta]}`
    : "";

  const systemPrompt = `${INTEGRITY_GUARD}
${INJECTION_GUARD}
${PII_GUARD}

Você é o MedScribe, assistente de documentação clínica especializado em Infectologia e Medicina Interna, treinado para o contexto brasileiro.

TEMPLATE ATIVO: ${params.template}${tipoCtx}

Gere o SOAP note clínico completo no formato abaixo. Seja preciso, objetivo e use terminologia médica adequada.

### S — Subjetivo
- Queixa principal com tempo de evolução preciso
- HDA: início, progressão cronológica, fatores de melhora e piora, sintomas associados
- Medicamentos em uso: nome comercial e genérico, dose, via, frequência, há quanto tempo
- Alergias documentadas (se nenhuma: "NADA")
- Antecedentes relevantes: internações prévias, cirurgias, comorbidades
- Epidemiologia (CRÍTICO em infectologia): viagens recentes, contatos com doentes, animais, água, solo, exposição sexual, uso de drogas, procedimentos invasivos recentes
- Histórico vacinal quando relevante

### O — Objetivo
- Sinais vitais completos: PA, FC, FR, Tax, SpO2, peso, altura, IMC quando disponível
- Estado geral e nível de consciência
- Exame físico por sistemas — apenas os relevantes para a queixa
- [Se exames importados: inserir resumo estruturado dos achados laboratoriais]

### A — Avaliação
- Diagnóstico principal com grau de certeza: (confirmado | provável | suspeito)
- CID-10 correspondente
- Diagnósticos diferenciais em ordem de probabilidade (máximo 4)
- Raciocínio clínico resumido: 2-4 linhas justificando o diagnóstico principal

### P — Plano
- Prescrições: nome genérico (nome comercial), dose, via, frequência, duração
- Exames solicitados com justificativa clínica
- Orientações ao paciente
- Critérios de retorno de urgência (sinais de alarme)
- Retorno programado: prazo e objetivo

Retorne APENAS o texto do SOAP note. Nenhum JSON, nenhum bloco de código.
Dado ausente na transcrição: escreva "[NÃO INFORMADO]" — nunca presuma nem invente.`;

  const userContent = `ENTRADA DO MÉDICO:
${params.transcricaoOuTexto}

EXAMES IMPORTADOS (se houver):
${params.dadosExamesJson ?? "Nenhum exame importado"}`;

  return callClaude(
    systemPrompt,
    userContent,
    4096,
    MODEL_SONNET,
    0.2,
    "gerarSOAP",
  );
}

export async function gerarKnowledgeMetadata(params: {
  soapTexto: string;
  template:
    | "infectologia_geral"
    | "prep_ist"
    | "opat"
    | "pos_transplante"
    | "neutropenia_febril"
    | "hiv_cronico"
    | "tb";
}): Promise<KnowledgeMetadata> {
  const systemPrompt = `${INJECTION_GUARD}
${OUTPUT_CONTRACT_JSON}

Você é um extrator de metadados clínicos estruturados. Analise o SOAP note fornecido e extraia os dados para o sistema de geração de conhecimento clínico.

TEMPLATE: ${params.template}

{
  "diagnostico_principal": {
    "nome": "nome clínico completo",
    "cid10": "A00.0",
    "certeza": "confirmado | provavel | suspeito",
    "categoria": "infeccioso | nao_infeccioso | misto"
  },
  "diagnosticos_diferenciais": ["diagnóstico diferencial 1"],
  "apresentacao_clinica": {
    "tempo_evolucao_dias": 0,
    "sintomas_principais": ["sintoma1"],
    "sinais_vitais_alterados": ["febre"],
    "achados_exame_fisico": ["achado1"]
  },
  "perfil_paciente": {
    "faixa_etaria": "pediatrico | adulto_jovem | adulto | idoso",
    "sexo": "M | F | nao_informado",
    "imunocomprometido": false,
    "tipo_imunocomprometimento": "transplante | hiv | quimioterapia | corticoide | outro | null",
    "comorbidades": []
  },
  "microbiologia": {
    "agente_identificado": null,
    "metodo_diagnostico": [],
    "perfil_resistencia": null
  },
  "conduta": {
    "antibioticos": [{"nome": "", "dose": "", "via": "", "frequencia": "", "duracao_dias": 0}],
    "outros_medicamentos": [],
    "internacao_indicada": false,
    "nivel_cuidado": "ambulatorial | internacao | UTI"
  },
  "busca_pubmed": {
    "termos_mesh": [],
    "query_sugerida": "",
    "prioridade": "alta | media | baixa"
  },
  "palavras_gatilho_relatorio": [],
  "caso_atipico": {
    "atipico": false,
    "criterios_objetivos": [],
    "tipo_sugerido": "relato_de_caso | serie_de_casos | nenhum"
  },
  "tags": []
}

REGRAS:
- Use vocabulário MeSH padrão nos termos de busca PubMed
- A query_sugerida deve ser executável diretamente no PubMed
- Extraia apenas o que está explicitamente no SOAP note — não invente dados
- caso_atipico.atipico = true SOMENTE se ≥1 critério abaixo for verificável no SOAP:
  • Patógeno ou CID-10 com frequência estimada < 1:100.000 no Brasil
  • Apresentação clínica contrária ao quadro típico descrito em guideline de referência (IDSA/SBPT/MS/ANVISA)
  • Falha documentada a ≥1 esquema de primeira linha conforme guideline vigente
  • Coinfecção simultânea de 2 ou mais agentes incomuns
  • Perfil de resistência emergente (ex: KPC, NDM, VRE em infecção comunitária)
  • Manifestação em faixa etária ou imunocompetência discordante do padrão descrito em guidelines
  criterios_objetivos: liste apenas os critérios efetivamente verificáveis no SOAP ([] se atipico = false)`;

  const text = await callClaude(
    systemPrompt,
    params.soapTexto,
    1024,
    MODEL_HAIKU,
    0.1,
    "gerarTermosMeSH",
  );
  return parseJsonResponse<KnowledgeMetadata>(text, "knowledge-metadata");
}
