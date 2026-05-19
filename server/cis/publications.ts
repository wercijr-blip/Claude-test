/**
 * CIS-10 — Geração de Série de Casos (CARE)
 * CIS-11 — Revisão de Literatura Automática
 */

import {
  callClaude,
  MODEL_OPUS,
  MEDICO,
  INTEGRITY_GUARD,
  PII_GUARD,
  EVIDENCE_GRADING,
} from "./client.ts";
import type {
  ResultadoSerieCasos,
  ResultadoRevisaoLiteratura,
} from "./synthesis.ts";

export type { ResultadoSerieCasos, ResultadoRevisaoLiteratura };

export async function gerarSerieCasos(params: {
  diagnostico: string;
  cid10: string;
  nCasos: number;
  casosJson: string;
  artigosReferenciasJson: string;
  /** Referências adicionais da biblioteca Zotero do médico — formatadas com [Z1], [Z2] */
  zoteroReferencias?: string;
}): Promise<ResultadoSerieCasos> {
  if (params.nCasos < 3) {
    return {
      texto: `⚠️ SÉRIE DE CASOS NÃO GERADA\n\nPublicações de série de casos requerem mínimo de 3 casos documentados.\nCasos fornecidos: ${params.nCasos} (CID ${params.cid10}).\n\nAcumule mais casos antes de gerar o rascunho.`,
    };
  }

  const systemPrompt = `${INTEGRITY_GUARD}
${PII_GUARD}

Você é um agente de redação científica assistindo na elaboração de série de casos clínicos para publicação em periódico indexado.

AUTOR: ${MEDICO.nome} — ${MEDICO.crm} | ${MEDICO.rqe}
Infectologista — Brasília-DF, Brasil

FAIXAS ETÁRIAS PADRONIZADAS (use apenas estas — nunca idade exata):
• Pediátrico: < 2 anos | 2–11 anos | 12–17 anos
• Adulto jovem: 18–39 anos
• Adulto: 40–59 anos
• Idoso: 60–69 anos | 70–79 anos | ≥ 80 anos

TAREFA: Rascunho completo em português, CARE guidelines, máximo 2000 palavras.

## TÍTULO

[Descritivo: diagnóstico + N casos + população — máximo 20 palavras]

## NOTA ÉTICA (inclua este bloco literalmente)

Este rascunho requer, antes da submissão:
1. TCLE (Termo de Consentimento Livre e Esclarecido) de cada paciente ou representante legal
2. Aprovação de CEP (Comitê de Ética em Pesquisa) — obrigatória no Brasil (Res. CNS 466/2012)
3. Número do CAAE/CEP deve constar na seção Métodos

## RESUMO (máximo 250 palavras)

Contexto, objetivo, casos (resumido), conclusão.
Não inclua dados que não estejam nos casos fornecidos.

## 1. INTRODUÇÃO

Relevância clínica e epidemiológica — cite artigos fornecidos com [número].
Se não houver artigo sobre epidemiologia: declare explicitamente.
[Máximo 200 palavras]

## 2. RELATO DOS CASOS

### Tabela Comparativa

| Caso | Faixa etária/Sexo | Comorbidades | Apresentação | Diagnóstico | Tratamento | Desfecho |
(preencher APENAS com dados dos casos_json — campos sem dado: "não informado")

### Descrição Individual

Para cada caso: apresentação → investigação → diagnóstico → tratamento → desfecho.
Use faixas etárias padronizadas acima. Dado ausente: [INSERIR: dado faltante]

## 3. DISCUSSÃO

Compare os casos entre si e com os artigos fornecidos com [número].
Sem artigo comparável: "[Sem referência nos artigos fornecidos para este ponto]"
[Máximo 400 palavras]

## 4. CONCLUSÃO

Achados principais + implicações práticas + estudos necessários.
[Máximo 150 palavras]

## 5. REFERÊNCIAS

Apenas artigos citados nas seções acima, Vancouver. [PMID quando disponível]

-----

VERIFICAÇÃO FINAL:
- Todos os dados clínicos vêm dos casos_json? → Se não: remover ou marcar [INSERIR]
- Todas as referências estão na lista fornecida? → Se não: remover
- Faixas etárias padronizadas usadas? → Verificar
- Dados que permitam identificar o paciente? → Remover`;

  const userContent = `DIAGNÓSTICO: ${params.diagnostico} — CID ${params.cid10}
NÚMERO DE CASOS: ${params.nCasos}

DADOS DOS CASOS:
${params.casosJson}

ARTIGOS DE REFERÊNCIA DISPONÍVEIS (PubMed):
${params.artigosReferenciasJson}${
    params.zoteroReferencias?.trim()
      ? `

REFERÊNCIAS DA BIBLIOTECA PESSOAL DO MÉDICO (Zotero) — cite como [Z1], [Z2], etc.:
${params.zoteroReferencias}`
      : ""
  }`;

  const text = await callClaude(
    systemPrompt,
    userContent,
    4096,
    MODEL_OPUS,
    undefined,
    "gerarSerieCasos",
  );
  return { texto: text };
}

export async function gerarRevisaoLiteratura(params: {
  tema: string;
  nArtigos: number;
  artigosJson: string;
  contextoClinico: string;
  /** Referências adicionais da biblioteca Zotero do médico — formatadas com [Z1], [Z2] */
  zoteroReferencias?: string;
}): Promise<ResultadoRevisaoLiteratura> {
  const anoAtual = new Date().getFullYear();
  const anoInicio = anoAtual - 5;

  const systemPrompt = `${INTEGRITY_GUARD}

Você é um agente de síntese de literatura clínica especializado em infectologia e medicina baseada em evidências.

${EVIDENCE_GRADING}

TAREFA: Revisão narrativa estruturada. Máximo 1200 palavras. Português brasileiro.

## TÍTULO

[Conciso e descritivo — inclua o período de publicação dos artigos fornecidos]

## RESUMO (máximo 150 palavras)

Objetivo, artigos utilizados (N=${params.nArtigos}), principais achados, conclusão.

## 1. INTRODUÇÃO E RELEVÂNCIA

[Importância clínica — cite com [N]. Se epidemiologia ausente: declare explicitamente]
[Máximo 150 palavras]

## 2. EPIDEMIOLOGIA E FATORES DE RISCO

[Dados dos artigos com [N] — se ausente: "Os artigos fornecidos não abordam epidemiologia."]
[Máximo 150 palavras]

## 3. DIAGNÓSTICO — EVIDÊNCIAS ATUAIS

[Métodos, sensibilidade/especificidade com [N]]
[Máximo 200 palavras]

## 4. TRATAMENTO — EVIDÊNCIAS DOS ARTIGOS FORNECIDOS

[Primeira linha, alternativas — apenas o que consta nos artigos com [N]]
[CONTRADIÇÕES: se artigos divergem, declare AMBAS as posições com [N] — nunca resolva artificialmente]
[Máximo 250 palavras]

## 5. MUDANÇAS NAS RECOMENDAÇÕES (${anoInicio}–${anoAtual})

[Apenas mudanças suportadas por GRADE 1A ou 1B]
[Para cada mudança: cite o ano de publicação — ex: "Em [Ano], Autor et al. [N] demonstraram que…"]
[Se nenhum artigo documenta mudança: "Os artigos fornecidos não documentam mudanças recentes em relação a guidelines anteriores."]
[Máximo 150 palavras]

## 6. IMPLICAÇÕES PARA O CONTEXTO BRASILEIRO

[INCLUIR APENAS se ≥1 artigo aborda explicitamente Brasil ou América Latina]
[OMITIR completamente esta seção se nenhum artigo tiver esse contexto — não escreva "Nenhum…"]
[Máximo 100 palavras]

## 7. CONCLUSÃO

[Síntese do que os artigos permitem concluir — não extrapole além dos dados disponíveis]
[Máximo 100 palavras]

## REFERÊNCIAS

[Apenas artigos citados no texto, Vancouver. PMID quando disponível]

-----

VERIFICAÇÃO FINAL:
- Toda afirmação tem [número]? → Se não: remover ou corrigir
- Citei artigo não fornecido? → Se sim: remover imediatamente
- Resolvi artificialmente contradições? → Se sim: desfazer — declare ambas as posições com [N]
- Seção 6 presente sem artigo brasileiro/latino-americano? → Remover completamente
- Afirmações sobre mudanças (§5) têm ano de publicação explícito? → Verificar
- Usei conhecimento interno para preencher lacunas? → Substituir por declaração de ausência`;

  const userContent = `TEMA DA REVISÃO: ${params.tema}
CONTEXTO CLÍNICO: ${params.contextoClinico}
ARTIGOS PUBMED DISPONÍVEIS: ${params.nArtigos}

ARTIGOS (PubMed):
${params.artigosJson}${
    params.zoteroReferencias?.trim()
      ? `

-----

REFERÊNCIAS DA BIBLIOTECA PESSOAL DO MÉDICO (Zotero) — cite como [Z1], [Z2], etc.:
(Complementam os artigos PubMed — têm igual validade na revisão)

${params.zoteroReferencias}`
      : ""
  }`;

  const text = await callClaude(
    systemPrompt,
    userContent,
    4096,
    MODEL_OPUS,
    undefined,
    "gerarRevisaoLiteratura",
  );
  return { texto: text };
}
