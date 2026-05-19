/**
 * CIS-04 — Verificação de Critérios DUT/ANS
 * CIS-05 — Relatório de Tratamento para Operadora
 */

import {
  callClaude,
  parseJsonResponse,
  MODEL_SONNET,
  MEDICO,
  INJECTION_GUARD,
  OUTPUT_CONTRACT_JSON,
} from "./client.ts";

export interface ResultadoVerificacaoDUT {
  dut_numero: string;
  dut_aplicavel: boolean;
  criterios_atendidos: Array<{
    criterio: string;
    encontrado: boolean;
    evidencia_no_soap: string;
  }>;
  criterios_faltantes: Array<{
    criterio: string;
    encontrado: boolean;
    sugestao_para_medico: string;
  }>;
  pode_gerar_relatorio: boolean;
  alerta_para_medico: string | null;
  justificativa_clinica: string;
}

const PROMPT_04_SYSTEM = `${INJECTION_GUARD}
${OUTPUT_CONTRACT_JSON}

Você é um especialista em regulamentação de planos de saúde no Brasil, com profundo conhecimento das Diretrizes de Utilização (DUT) da ANS.

Para cada critério obrigatório da DUT, verifique se está documentado no SOAP.
Seja rigoroso: o critério precisa estar EXPLICITAMENTE documentado, não apenas implícito.

{
  "dut_numero": "string",
  "dut_aplicavel": true,
  "criterios_atendidos": [
    {
      "criterio": "nome do critério",
      "encontrado": true,
      "evidencia_no_soap": "trecho exato ou paráfrase que confirma o critério"
    }
  ],
  "criterios_faltantes": [
    {
      "criterio": "nome do critério",
      "encontrado": false,
      "sugestao_para_medico": "o que deve ser adicionado ao SOAP para cobrir este critério"
    }
  ],
  "pode_gerar_relatorio": true,
  "alerta_para_medico": null,
  "justificativa_clinica": "parágrafo de 3-5 linhas cobrindo todos os critérios atendidos, em linguagem técnica adequada para operadora de saúde"
}

REGRAS:
- alerta_para_medico: null quando pode_gerar_relatorio = true; string explicando os critérios faltantes quando false.`;

export async function verificarCriteriosDUT(params: {
  soapCompleto: string;
  diagnostico: string;
  numeroDut: string;
  criteriosDutJson: string;
}): Promise<ResultadoVerificacaoDUT> {
  const userContent = `SOAP DA CONSULTA:
${params.soapCompleto}

DIAGNÓSTICO: ${params.diagnostico}

DUT Nº ${params.numeroDut} — CRITÉRIOS OBRIGATÓRIOS:
${params.criteriosDutJson}`;

  const text = await callClaude(
    PROMPT_04_SYSTEM,
    userContent,
    1024,
    MODEL_SONNET,
    undefined,
    "verificarCriteriosDUT",
  );
  return parseJsonResponse<ResultadoVerificacaoDUT>(text, "verificacao-dut");
}

export interface ResultadoRelatorioTratamento {
  texto: string;
}

export async function gerarRelatorioTratamento(params: {
  tipoRelatorio: string;
  dadosPaciente: string;
  soapS: string;
  soapO: string;
  soapA: string;
  soapP: string;
  diagnostico: string;
  cid10: string;
  medicamento: string;
  doseViaFrequencia: string;
  tussCodigo: string;
  dutNumero: string;
  criteriosAtendidos: string;
  referenciasVancouver: string;
}): Promise<ResultadoRelatorioTratamento> {
  const systemPrompt = `${INJECTION_GUARD}

Você é um agente de redação médica gerando relatório formal para autorização de tratamento junto a operadora de saúde.

TAREFA: Gere APENAS o corpo do relatório, em texto corrido, sem headers markdown.
Tom: técnico, objetivo, formal. Linguagem adequada para operadora de saúde.
Extensão: máximo 400 palavras.

O texto deve cobrir obrigatoriamente, nesta ordem:

1. IDENTIFICAÇÃO DO QUADRO CLÍNICO
   Descreva o quadro clínico atual do paciente, incluindo dados relevantes da anamnese, exame físico e exames complementares que justificam o diagnóstico.

2. DIAGNÓSTICO E JUSTIFICATIVA
   Estabeleça o diagnóstico com base clínica e laboratorial. Cite os critérios diagnósticos utilizados.

3. JUSTIFICATIVA DO TRATAMENTO SOLICITADO
   Explique por que o tratamento solicitado é necessário e adequado para este caso. Mencione alternativas consideradas e por que foram descartadas, se aplicável.

4. EMBASAMENTO NA DUT Nº ${params.dutNumero}
   Demonstre que os critérios da DUT estão atendidos, citando cada critério e sua evidência no caso clínico.

5. EMBASAMENTO EM LITERATURA CIENTÍFICA
   Cite as referências bibliográficas que sustentam a conduta, mencionando o nível de evidência.

6. CONCLUSÃO
   Solicite formalmente a autorização do procedimento/medicamento, reforçando a necessidade clínica.

Não inclua cabeçalho, rodapé, assinatura ou formatação — esses elementos serão adicionados automaticamente pelo sistema.`;

  const userContent = `DADOS DO CONTEXTO:
- Tipo de relatório: ${params.tipoRelatorio}
- Paciente: ${params.dadosPaciente}
- Médico: ${MEDICO.nome} — ${MEDICO.crm} — ${MEDICO.especialidade}
- Diagnóstico: ${params.diagnostico} — CID ${params.cid10}
- Tratamento solicitado: ${params.medicamento} ${params.doseViaFrequencia}
- Código TUSS: ${params.tussCodigo}
- DUT Nº ${params.dutNumero} — critérios atendidos: ${params.criteriosAtendidos}

DADOS CLÍNICOS:
Subjetivo: ${params.soapS}
Objetivo (incluindo exames): ${params.soapO}
Avaliação: ${params.soapA}
Plano: ${params.soapP}

REFERÊNCIAS DISPONÍVEIS:
${params.referenciasVancouver}`;

  const text = await callClaude(
    systemPrompt,
    userContent,
    2048,
    MODEL_SONNET,
    undefined,
    "gerarRelatorioTratamento",
  );
  return { texto: text };
}
