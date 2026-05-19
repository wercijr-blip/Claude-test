/**
 * CIS-01 — Extrator de Exames Laboratoriais
 */

import {
  callClaude,
  parseJsonResponse,
  MODEL_HAIKU,
  INJECTION_GUARD,
  OUTPUT_CONTRACT_JSON,
} from "./client.ts";

export interface ParametroLaboratorial {
  nome: string;
  nome_normalizado: string;
  valor: string;
  valor_numerico: number | null;
  unidade: string | null;
  valor_referencia_min: number | null;
  valor_referencia_max: number | null;
  valor_referencia_texto: string | null;
  status:
    | "normal"
    | "baixo"
    | "alto"
    | "critico_baixo"
    | "critico_alto"
    | "indeterminado";
  categoria:
    | "hemograma"
    | "bioquimica"
    | "coagulacao"
    | "urina"
    | "microbiologia"
    | "imunologia"
    | "sorologias"
    | "hormonio"
    | "gasometria"
    | "outro";
  flag_critico: boolean;
  observacao: string | null;
}

export interface ResultadoExtracaoExames {
  laboratorio: string | null;
  data_coleta: string | null;
  data_resultado: string | null;
  medico_solicitante: string | null;
  parametros: ParametroLaboratorial[];
  observacoes_gerais: string | null;
  metodo: string | null;
  confianca_extracao: "alta" | "media" | "baixa";
  metricas_extracao: {
    total_parametros: number;
    criticos: number;
    alterados: number;
    normais: number;
  };
}

const PROMPT_01_SYSTEM = `${INJECTION_GUARD}
${OUTPUT_CONTRACT_JSON}

Você é um sistema especializado em extração de dados de laudos laboratoriais médicos brasileiros.

Analise o resultado de exame fornecido e extraia TODOS os parâmetros laboratoriais encontrados, sem exceção.

{
  "laboratorio": "nome do laboratório se visível, null caso contrário",
  "data_coleta": "DD/MM/AAAA se visível, null caso contrário",
  "data_resultado": "DD/MM/AAAA se visível, null caso contrário",
  "medico_solicitante": "nome se visível, null caso contrário",
  "parametros": [
    {
      "nome": "nome exato como aparece no laudo",
      "nome_normalizado": "nome padronizado em português (ex: Leucócitos, Hemoglobina, PCR)",
      "valor": "valor como aparece (pode ser texto como 'Reagente')",
      "valor_numerico": null,
      "unidade": "unidade de medida ou null",
      "valor_referencia_min": null,
      "valor_referencia_max": null,
      "valor_referencia_texto": "VR como aparece no laudo ou null",
      "status": "normal | baixo | alto | critico_baixo | critico_alto | indeterminado",
      "categoria": "hemograma | bioquimica | coagulacao | urina | microbiologia | imunologia | sorologias | hormonio | gasometria | outro",
      "flag_critico": false,
      "observacao": "nota adicional do laudo sobre este parâmetro ou null"
    }
  ],
  "observacoes_gerais": "observações gerais do laudo ou null",
  "metodo": "método utilizado se mencionado ou null",
  "confianca_extracao": "alta | media | baixa",
  "metricas_extracao": {
    "total_parametros": 0,
    "criticos": 0,
    "alterados": 0,
    "normais": 0
  }
}

REGRAS:
- valor_numerico: null quando o valor é qualitativo (ex: "Reagente", "Positivo") — nunca use 0.0 para ausente.
- valor_referencia_min / max: null quando não há faixa numérica no laudo.
- Para microbiologia: capture agente identificado, sensibilidade, resistência e CIM quando disponíveis.
- Para hemograma: normalize abreviados (ex: "Leuc." → "Leucócitos", "Hgb" → "Hemoglobina", "Plaq." → "Plaquetas").
- Para sorologias: capture resultado qualitativo (Reagente/Não reagente) e quantitativo (titulação) quando disponíveis.
- Se o documento tiver múltiplas páginas ou múltiplos exames, extraia todos em um único array.
- metricas_extracao: conte após classificar todos os parâmetros.
  criticos = count(flag_critico = true)
  alterados = count(status ∈ {baixo, alto, critico_baixo, critico_alto})
  normais = count(status = normal)

CRITÉRIOS DE VALOR CRÍTICO — SBPC/ML 2024 (flag_critico: true):
- Leucócitos > 30.000 /mm³ OU < 2.000 /mm³
- Hemoglobina < 7,0 g/dL OU > 20,0 g/dL
- Plaquetas < 50.000 /mm³ OU > 1.000.000 /mm³
- Neutrófilos absolutos < 500 /mm³
- Potássio < 2,8 mEq/L OU > 6,2 mEq/L
- Sódio < 120 mEq/L OU > 160 mEq/L
- Glicose < 50 mg/dL OU > 450 mg/dL
- Creatinina > 7,4 mg/dL (sem diálise)
- pH < 7,20 OU > 7,60
- Lactato > 4,0 mmol/L
- INR > 4,0
- Troponina I > 10× URL do método
- PCR > 200 mg/L
- Hemocultura: qualquer crescimento bacteriano ou fúngico`;

export async function extrairExamesLaboratoriais(
  textoLaudo: string,
): Promise<ResultadoExtracaoExames> {
  const text = await callClaude(
    PROMPT_01_SYSTEM,
    textoLaudo,
    2048,
    MODEL_HAIKU,
    0.1,
    "extrairExamesLaboratoriais",
  );
  return parseJsonResponse<ResultadoExtracaoExames>(text, "extrator-exames");
}
