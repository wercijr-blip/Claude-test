/**
 * CIS-03 — Síntese Analítica de Artigos PubMed
 */

import {
  callClaude,
  MODEL_SONNET,
  INTEGRITY_GUARD,
  EVIDENCE_GRADING,
} from "./client.ts";

// ─── Tipo compartilhado para todos os outputs de texto livre ─────────────────

export interface ResultadoTexto {
  texto: string;
}

// Aliases mantidos para compatibilidade com callers existentes
export type SinteseArtigos = ResultadoTexto;
export type DigestDiario = ResultadoTexto;
export type DigestSemanal = ResultadoTexto;
export type DigestMensal = ResultadoTexto;
export type ResultadoSerieCasos = ResultadoTexto;
export type ResultadoRevisaoLiteratura = ResultadoTexto;

export async function sintetizarArtigosPubMed(params: {
  soapResumido: string;
  diagnostico: string;
  cid10: string;
  populacao: string;
  condutaAtual: string;
  artigosJson: string;
  /** Número de artigos fornecidos — injetado no prompt como {N} */
  n?: number;
  /** Referências da biblioteca Zotero do médico — formatadas com [Z1], [Z2] */
  zoteroReferencias?: string;
}): Promise<SinteseArtigos> {
  const n = params.n ?? "N";
  const temZotero = Boolean(params.zoteroReferencias?.trim());

  const systemPrompt = `${INTEGRITY_GUARD}

Você é um agente de síntese de evidências clínicas com expertise em infectologia e medicina baseada em evidências.

${EVIDENCE_GRADING}

TAREFA: Síntese analítica estruturada. Escreva em português. Máximo 900 palavras. Todo dado clínico citado com [PMID] ou [ZN].

SISTEMA DE CITAÇÃO:
• [PMID XXXXXXXX] — artigos do PubMed fornecidos abaixo
• [Z1], [Z2], … — referências da biblioteca pessoal do médico (Zotero), fornecidas abaixo${temZotero ? "" : "\n• (Sem referências Zotero nesta síntese)"}

## 1. Panorama Atual

O que os artigos FORNECIDOS mostram sobre mudanças recentes no manejo.
Mencione apenas o que está explícito nos textos. Cite [PMID] ou [ZN] para cada ponto.

## 2. Evidências Aplicáveis a Este Caso

Como os artigos se aplicam ao perfil do paciente descrito.
Se nenhum artigo aborda diretamente este perfil, declare explicitamente.
Cite [PMID] ou [ZN] para cada aplicação.

## 3. Recomendações com Nível GRADE

Lista numerada. Para cada recomendação:
- O que fazer
- Nível GRADE (ex.: GRADE 1A, GRADE 2B) usando a hierarquia acima
- Fonte: [PMID] ou [ZN] Autor, Revista, Ano
- Limitação: se a recomendação vem de população diferente do caso, informe

## 4. Cobertura e Artigos Desatualizados

**4a. Lacunas de cobertura** — perguntas clínicas relevantes para ESTE caso que os artigos fornecidos NÃO respondem (máximo 3 itens).

**4b. Artigos > 5 anos** — marque com [DESATUALIZADO] qualquer artigo publicado antes de 2021.
Formato: [PMID] ou [ZN] Autor et al. (Ano) — [DESATUALIZADO] e motivo de cautela se aplicável.
Se todos são recentes: "Todos os artigos fornecidos são de 2021 ou mais recentes."

## 5. Referências Utilizadas

Liste APENAS os artigos efetivamente citados nas seções acima.
PubMed: [PMID] Autor et al. Título. Revista. Ano. DOI: xxx
Zotero: [ZN] Autor et al. Título. Revista. Ano.
Artigos fornecidos mas não citados: NÃO incluir.

-----

⚠️ VERIFICAÇÃO FINAL:
- Toda afirmação tem [PMID] ou [ZN]? → Se não: remover ou corrigir
- Citei artigo não fornecido? → Se sim: remover
- Classifiquei evidência com nível GRADE correto? → Se não: corrigir
- Artigos anteriores a 2021 estão marcados [DESATUALIZADO]? → Verificar`;

  const userContent = `CASO CLÍNICO ATUAL:
${params.soapResumido}

Diagnóstico: ${params.diagnostico} (${params.cid10})
Perfil do paciente: ${params.populacao}
Conduta em uso: ${params.condutaAtual}

-----

ARTIGOS PUBMED FORNECIDOS (${n} artigos):
(ATENÇÃO: sintetize APENAS o conteúdo presente nestes artigos)

${params.artigosJson}${
    temZotero
      ? `

-----

REFERÊNCIAS DA BIBLIOTECA PESSOAL DO MÉDICO (Zotero) — cite como [Z1], [Z2], etc.:
(Estas referências foram salvas pelo médico — têm igual validade que os artigos PubMed)

${params.zoteroReferencias}`
      : ""
  }`;

  const text = await callClaude(
    systemPrompt,
    userContent,
    4096,
    MODEL_SONNET,
    0.2,
    "sintetizarArtigosPubMed",
  );
  return { texto: text };
}
