/**
 * CIS-07 — Digest Diário
 * CIS-08 — Digest Semanal
 * CIS-09 — Digest Mensal
 */

import {
  callClaude,
  callClaudeBatch,
  MODEL_SONNET,
  DIGEST_BASE_STR,
  type BatchRequest,
} from "./client.ts";
import type { DigestDiario, DigestSemanal, DigestMensal } from "./synthesis.ts";

export type { DigestDiario, DigestSemanal, DigestMensal };

// ─── PROMPT 07 — Digest Diário ────────────────────────────────────────────────

export async function gerarDigestDiario(params: {
  data: string;
  totalPacientes: number;
  consultasJson: string;
  artigosSintetizadosJson: string;
  alertasCondutaJson: string;
  relatoriosGerados: string;
}): Promise<DigestDiario> {
  const systemPrompt = `${DIGEST_BASE_STR}

Gere o resumo do dia. Máximo 600 palavras.

## Resumo do Dia — [data do userContent]

**[N] pacientes atendidos**
[Diagnósticos/hipóteses em bullets concisos, agrupando similares]

---

## ⚠️ Alertas de Conduta

[Se houver: diagnóstico, conduta atual vs. recomendada, nível GRADE, fonte]
[Se não houver: "Nenhum alerta de conduta hoje."]

---

## Novas Evidências

[GRADE 1A/1B: diagnóstico, achado principal em 1 linha, fonte]
[GRADE 2A/2B: apenas se couber no limite de palavras]
[Se não houver: "Nenhuma nova evidência sintetizada hoje."]

---

## Sistema

[1-2 linhas: artigos indexados, notas geradas, relatórios emitidos]

Termine com: "Próximo resumo: amanhã."`;

  const userContent = `DADOS DO DIA — ${params.data}:
- Total de pacientes atendidos: ${params.totalPacientes}
- Consultas: ${params.consultasJson}
- Artigos sintetizados hoje: ${params.artigosSintetizadosJson}
- Alertas de conduta gerados: ${params.alertasCondutaJson}
- Relatórios emitidos: ${params.relatoriosGerados}`;

  const text = await callClaude(
    systemPrompt,
    userContent,
    1500,
    MODEL_SONNET,
    0.2,
    "gerarDigestDiario",
  );
  return { texto: text };
}

// ─── PROMPT 08 — Digest Semanal ───────────────────────────────────────────────

type DigestSemanalParams = {
  semana: string;
  totalPacientes: number;
  diagnosticosJson: string;
  artigosSemanaJson: string;
  alertasSemanaJson: string;
  seriesStatusJson: string;
  relatoriosSemana: string;
};

const PROMPT_08_SYSTEM = `${DIGEST_BASE_STR}

Gere o resumo semanal. Máximo 800 palavras.

## Resumo Semanal — [semana do userContent]

### Visão Geral
[N] pacientes · [principais diagnósticos com quantidade] · [destaques em 2 linhas]

---

### ⚠️ Alertas de Conduta — Revisar

[SEMPRE inclua se houver. Para cada: diagnóstico, o que muda, nível GRADE, fonte]
[Se não houver: "Nenhum alerta de conduta esta semana."]

---

### Evidências GRADE 1A/1B da Semana

[Máximo 5 itens. Formato: **Diagnóstico** — achado principal (Fonte, Ano, GRADE)]
[Se houver mais: "X evidências adicionais disponíveis no painel."]
[Se não houver: "Nenhuma evidência de alto nível sintetizada esta semana."]

---

### Séries de Casos — Status

[Para cada CID: casos acumulados, quantos faltam para threshold, status do rascunho]
[Se não houver: "Nenhuma série em progresso."]

---

### Conhecimento Acumulado

[Artigos sintetizados na semana, total acumulado, relatórios emitidos]

Termine com: "Próximo resumo semanal: próxima sexta-feira às 19h."`;

function digestSemanalUserContent(params: DigestSemanalParams): string {
  return `DADOS DA SEMANA — ${params.semana}:
- Total de pacientes: ${params.totalPacientes}
- Diagnósticos da semana: ${params.diagnosticosJson}
- Artigos sintetizados: ${params.artigosSemanaJson}
- Alertas de conduta: ${params.alertasSemanaJson}
- Status das séries de casos: ${params.seriesStatusJson}
- Relatórios emitidos: ${params.relatoriosSemana}`;
}

export async function gerarDigestSemanal(
  params: DigestSemanalParams,
): Promise<DigestSemanal> {
  const text = await callClaude(
    PROMPT_08_SYSTEM,
    digestSemanalUserContent(params),
    2000,
    MODEL_SONNET,
    0.2,
    "gerarDigestSemanal",
  );
  return { texto: text };
}

function buildDigestSemanalRequest(
  params: DigestSemanalParams,
  id: string,
): BatchRequest {
  return {
    id,
    systemPrompt: PROMPT_08_SYSTEM,
    userContent: digestSemanalUserContent(params),
    maxTokens: 2000,
    model: MODEL_SONNET,
    temperature: 0.2,
  };
}

/** Gera digests semanais para múltiplos médicos em um único batch (50% mais barato). */
export async function gerarDigestSemanalLote(
  entradas: Array<{ id: string; params: DigestSemanalParams }>,
): Promise<Map<string, string>> {
  return callClaudeBatch(
    entradas.map((e) => buildDigestSemanalRequest(e.params, e.id)),
  );
}

// ─── PROMPT 09 — Digest Mensal ────────────────────────────────────────────────

type DigestMensalParams = {
  mesAno: string;
  totalPacientes: number;
  diagnosticosMesJson: string;
  artigosMesJson: string;
  alertasMesJson: string;
  seriesGeradasJson: string;
  seriesPublicadasJson: string;
  totalAcumuladoJson: string;
  cronogramaPublicacaoJson: string;
};

const PROMPT_09_SYSTEM = `${DIGEST_BASE_STR}

Gere o resumo mensal analítico. Máximo 1000 palavras. Seja analítico — identifique padrões, priorize informações acionáveis.

## Resumo Mensal — [mês/ano do userContent]

### Performance Clínica
[N] pacientes · [top 5 diagnósticos com %, padrões identificados]
[Padrões epidemiológicos: aumento de diagnósticos, perfil de pacientes]

---

### ⚠️ Alertas de Conduta — Mês

[Lista consolidada agrupada por diagnóstico]
[Para cada: o que mudou, quando detectado, nível GRADE, se já incorporado]
[Se não houver: "Nenhum alerta de conduta no mês."]

---

### Top 5 Evidências GRADE 1A/1B do Mês

[As 5 mais impactantes com justificativa da seleção]
[**Diagnóstico** — achado (Fonte, Ano, GRADE) — relevância para sua prática]
[Se não houver: "Nenhuma evidência de alto nível sintetizada este mês."]

---

### Balanço de Conhecimento

- Artigos sintetizados no mês: [N] | Total acumulado: [N]
- Séries geradas: [lista] | Séries publicadas: [lista com revista]

---

### Próximas Publicações

[2-3 publicações mais próximas de estar prontas, com base no cronograma e volume de casos]

---

### Foco para o Próximo Mês

[2-3 pontos de atenção: séries quase prontas, diagnósticos em ascensão, alertas pendentes]

Termine com: "Próximo resumo mensal: último dia de [próximo mês]."`;

function digestMensalUserContent(params: DigestMensalParams): string {
  return `DADOS DO MÊS — ${params.mesAno}:
- Total de pacientes no mês: ${params.totalPacientes}
- Diagnósticos do mês: ${params.diagnosticosMesJson}
- Artigos sintetizados no mês: ${params.artigosMesJson}
- Alertas de conduta do mês: ${params.alertasMesJson}
- Séries de casos geradas: ${params.seriesGeradasJson}
- Séries publicadas: ${params.seriesPublicadasJson}
- Totais acumulados (desde o início): ${params.totalAcumuladoJson}
- Cronograma de publicação: ${params.cronogramaPublicacaoJson}`;
}

export async function gerarDigestMensal(
  params: DigestMensalParams,
): Promise<DigestMensal> {
  const text = await callClaude(
    PROMPT_09_SYSTEM,
    digestMensalUserContent(params),
    2500,
    MODEL_SONNET,
    0.2,
    "gerarDigestMensal",
  );
  return { texto: text };
}

function buildDigestMensalRequest(
  params: DigestMensalParams,
  id: string,
): BatchRequest {
  return {
    id,
    systemPrompt: PROMPT_09_SYSTEM,
    userContent: digestMensalUserContent(params),
    maxTokens: 2500,
    model: MODEL_SONNET,
    temperature: 0.2,
  };
}

/** Gera digests mensais para múltiplos médicos em um único batch (50% mais barato). */
export async function gerarDigestMensalLote(
  entradas: Array<{ id: string; params: DigestMensalParams }>,
): Promise<Map<string, string>> {
  return callClaudeBatch(
    entradas.map((e) => buildDigestMensalRequest(e.params, e.id)),
  );
}
