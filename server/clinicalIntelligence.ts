/**
 * Clinical Intelligence System — Dr. Werciley Saraiva Vieira Junior | CRM-DF 16381
 * 11 prompts for AI-assisted clinical documentation, knowledge synthesis, and reporting.
 */

import Anthropic from '@anthropic-ai/sdk'
import { env } from './_core/env.ts'
import { logger } from './_core/logger.ts'
import { redis } from './_core/redis.ts'

// ─── Shared API helper ────────────────────────────────────────────────────────

const MODEL_HAIKU  = 'claude-haiku-4-5'    // CIS-01, CIS-02b, CIS-04
const MODEL_SONNET = 'claude-sonnet-4-6'   // CIS-02a, CIS-03, CIS-05–09
const MODEL_OPUS   = 'claude-opus-4-7'     // CIS-10, CIS-11

const anthropic = new Anthropic({
  apiKey: env.BUILT_IN_FORGE_API_KEY ?? '',
  baseURL: env.BUILT_IN_FORGE_API_URL,
})

// ─── Opus daily budget (Redis counter) ───────────────────────────────────────

function opusDateKey(): string {
  return `cis:opus:tokens:${new Date().toISOString().slice(0, 10)}`
}

async function getOpusTokensToday(): Promise<number> {
  try {
    const val = await redis.get(opusDateKey())
    if (!val) return 0
    const n = parseInt(val, 10)
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0  // Redis indisponível → fail open (não bloqueia chamada)
  }
}

async function incrOpusTokens(tokens: number): Promise<void> {
  try {
    const key = opusDateKey()
    const newVal = await redis.incrby(key, tokens)
    if (newVal <= tokens) {
      // Primeira incrementação do dia — define TTL de 48h (mantém dado de ontem para auditoria)
      await redis.expire(key, 48 * 3600)
    }
  } catch {
    // Falha no rastreamento não é crítica — apenas registra silenciosamente
  }
}

/** Retorna status atual do orçamento diário de Opus para monitoramento. */
export async function getOpusBudgetStatus(): Promise<{
  usado: number
  limite: number
  percentual: number
  dataKey: string
}> {
  const usado = await getOpusTokensToday()
  const limite = env.OPUS_DAILY_TOKEN_BUDGET
  return {
    usado,
    limite,
    percentual: limite > 0 ? Math.min(100, Math.round((usado / limite) * 100)) : 0,
    dataKey: opusDateKey(),
  }
}

// Status codes that warrant a retry with exponential backoff
const RETRYABLE_STATUS = new Set([429, 502, 503])
const MAX_API_RETRIES  = 3

async function callClaude(
  systemPrompt: string,
  userContent: string,
  maxTokens: number,
  model = MODEL_SONNET,
  temperature?: number,
  fnName = '',
): Promise<string> {
  // Verifica orçamento diário antes de chamar Opus
  let effectiveModel = model
  if (model === MODEL_OPUS && env.OPUS_DAILY_TOKEN_BUDGET > 0) {
    const tokensHoje = await getOpusTokensToday()
    const limiteAlerta = Math.floor(env.OPUS_DAILY_TOKEN_BUDGET * 0.8)
    if (tokensHoje >= limiteAlerta && tokensHoje < env.OPUS_DAILY_TOKEN_BUDGET) {
      logger.warn('[cis] Orçamento Opus em 80% — considere aumentar OPUS_DAILY_TOKEN_BUDGET', {
        tokensHoje,
        limiteAlerta,
        limite: env.OPUS_DAILY_TOKEN_BUDGET,
        percentual: Math.round((tokensHoje / env.OPUS_DAILY_TOKEN_BUDGET) * 100),
      })
    }
    if (tokensHoje >= env.OPUS_DAILY_TOKEN_BUDGET) {
      logger.warn('[cis] Orçamento diário de Opus atingido — downgrade para Sonnet', {
        tokensHoje,
        limite: env.OPUS_DAILY_TOKEN_BUDGET,
      })
      effectiveModel = MODEL_SONNET
    }
  }

  for (let attempt = 0; attempt <= MAX_API_RETRIES; attempt++) {
    const start = Date.now()
    try {
      const response = await anthropic.messages.create({
        model: effectiveModel,
        max_tokens: maxTokens,
        // System as array enables prompt caching for static system prompts.
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userContent }],
        // Opus 4.7 removed temperature/top_p/top_k — omit them to avoid 400 errors.
        ...(temperature !== undefined && effectiveModel !== MODEL_OPUS ? { temperature } : {}),
      })

      // Registra tokens consumidos se chamada Opus foi efetivamente executada
      if (effectiveModel === MODEL_OPUS) {
        const total = (response.usage.input_tokens ?? 0) + (response.usage.output_tokens ?? 0)
        await incrOpusTokens(total)
        logger.info('[cis] Tokens Opus registrados', { total, key: opusDateKey() })
      }

      logger.info('[cis] latência', { fn: fnName, model: effectiveModel, ms: Date.now() - start, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens })

      const block = response.content[0]
      return block?.type === 'text' ? block.text : ''
    } catch (err) {
      if (err instanceof Anthropic.APIError) {
        if (RETRYABLE_STATUS.has(err.status) && attempt < MAX_API_RETRIES) {
          const delayMs = (2 ** attempt) * 1000  // 1s → 2s → 4s
          logger.warn('[cis] Erro transiente na API — aguardando para retry', {
            attempt: attempt + 1,
            status: err.status,
            delayMs,
            model: effectiveModel,
          })
          await new Promise(r => setTimeout(r, delayMs))
          continue
        }
        logger.error('[cis] Erro na API Anthropic', {
          status: err.status,
          message: err.message,
          model: effectiveModel,
        })
        throw new Error(`Erro na API de IA (HTTP ${err.status}): ${err.message}`)
      }
      throw err
    }
  }
  // Unreachable — loop always returns or throws
  throw new Error('[cis] callClaude: estado inesperado após retries')
}

// ─── Batch API ────────────────────────────────────────────────────────────────

export interface BatchRequest {
  id: string
  systemPrompt: string
  userContent: string
  maxTokens: number
  model?: string
  temperature?: number
}

/**
 * Submits multiple independent Claude requests as one batch job — 50% cheaper.
 * Polls until all requests complete or timeout is reached.
 * Returns a Map<id, text>; failed/expired requests map to empty string.
 */
export async function callClaudeBatch(
  requests: BatchRequest[],
  { pollIntervalMs = 30_000, timeoutMs = 30 * 60_000 } = {},
): Promise<Map<string, string>> {
  if (requests.length === 0) return new Map()

  const batch = await anthropic.messages.batches.create({
    requests: requests.map(r => ({
      custom_id: r.id,
      params: {
        model: r.model ?? MODEL_SONNET,
        max_tokens: r.maxTokens,
        system: [{ type: 'text' as const, text: r.systemPrompt, cache_control: { type: 'ephemeral' as const } }],
        messages: [{ role: 'user' as const, content: r.userContent }],
        ...(r.temperature !== undefined && (r.model ?? MODEL_SONNET) !== MODEL_OPUS
          ? { temperature: r.temperature }
          : {}),
      },
    })),
  })

  logger.info('[cis] Batch submetido', { batchId: batch.id, n: requests.length })

  const deadline = Date.now() + timeoutMs
  let current = batch
  while (current.processing_status !== 'ended') {
    if (Date.now() > deadline) {
      await anthropic.messages.batches.cancel(batch.id).catch(() => null)
      throw new Error(`[cis] Batch timeout após ${timeoutMs / 60_000} min (id: ${batch.id})`)
    }
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
    current = await anthropic.messages.batches.retrieve(batch.id)
    logger.info('[cis] Batch aguardando', {
      batchId: batch.id,
      processing: current.request_counts.processing,
      succeeded: current.request_counts.succeeded,
    })
  }

  const results = new Map<string, string>()
  for await (const result of await anthropic.messages.batches.results(batch.id)) {
    if (result.result.type === 'succeeded') {
      const block = result.result.message.content[0]
      results.set(result.custom_id, block?.type === 'text' ? block.text : '')
    } else {
      logger.warn('[cis] Batch request falhou', { id: result.custom_id, type: result.result.type })
      results.set(result.custom_id, '')
    }
  }

  logger.info('[cis] Batch concluído', { batchId: batch.id, resultados: results.size })
  return results
}

function parseJsonResponse<T>(text: string, context: string): T {
  // Strip markdown code fences if the model wrapped the JSON in ```json … ```
  const stripped = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)?.[1] ?? text
  const match = stripped.match(/\{[\s\S]*\}/)
  const jsonStr = match ? match[0] : stripped
  try {
    return JSON.parse(jsonStr) as T
  } catch (err) {
    logger.error(`[clinicalIntelligence] Falha ao parsear JSON — ${context}`, {
      error: (err as Error).message,
      preview: text.slice(0, 300),
    })
    throw new Error(`Resposta da IA não é JSON válido (${context})`)
  }
}

// ─── Global variables injected into prompts ───────────────────────────────────

const MEDICO = {
  nome: env.MEDICO_NOME,
  crm: `CRM-${env.MEDICO_CRM_UF} ${env.MEDICO_CRM}`,
  rqe: env.MEDICO_RQE,
  especialidade: 'Infectologia',
  cbo: '2251-50',
  clinicaNome: env.CLINICA_NOME,
  cnes: env.SUS_CNES,
}

// ─── Reusable prompt blocks ───────────────────────────────────────────────────
import { INTEGRITY_GUARD, INJECTION_GUARD, PII_GUARD, OUTPUT_CONTRACT_JSON, EVIDENCE_GRADING, DIGEST_BASE } from './cis/blocks.ts'

const DIGEST_BASE_STR = DIGEST_BASE(MEDICO.nome, MEDICO.crm)

// ─── PROMPT 01 — Extrator de Exames ──────────────────────────────────────────

export interface ParametroLaboratorial {
  nome: string
  nome_normalizado: string
  valor: string
  valor_numerico: number | null
  unidade: string | null
  valor_referencia_min: number | null
  valor_referencia_max: number | null
  valor_referencia_texto: string | null
  status: 'normal' | 'baixo' | 'alto' | 'critico_baixo' | 'critico_alto' | 'indeterminado'
  categoria: 'hemograma' | 'bioquimica' | 'coagulacao' | 'urina' | 'microbiologia' | 'imunologia' | 'sorologias' | 'hormonio' | 'gasometria' | 'outro'
  flag_critico: boolean
  observacao: string | null
}

export interface ResultadoExtracaoExames {
  laboratorio: string | null
  data_coleta: string | null
  data_resultado: string | null
  medico_solicitante: string | null
  parametros: ParametroLaboratorial[]
  observacoes_gerais: string | null
  metodo: string | null
  confianca_extracao: 'alta' | 'media' | 'baixa'
  metricas_extracao: {
    total_parametros: number
    criticos: number
    alterados: number
    normais: number
  }
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
- Hemocultura: qualquer crescimento bacteriano ou fúngico`

export async function extrairExamesLaboratoriais(textoLaudo: string): Promise<ResultadoExtracaoExames> {
  const text = await callClaude(PROMPT_01_SYSTEM, textoLaudo, 2048, MODEL_HAIKU, 0.1, 'extrairExamesLaboratoriais')
  return parseJsonResponse<ResultadoExtracaoExames>(text, 'extrator-exames')
}

// ─── CIS-02a — MedScribe: SOAP Note ──────────────────────────────────────────

export interface KnowledgeMetadata {
  diagnostico_principal: {
    nome: string
    cid10: string
    certeza: 'confirmado' | 'provavel' | 'suspeito'
    categoria: 'infeccioso' | 'nao_infeccioso' | 'misto'
  }
  diagnosticos_diferenciais: string[]
  apresentacao_clinica: {
    tempo_evolucao_dias: number
    sintomas_principais: string[]
    sinais_vitais_alterados: string[]
    achados_exame_fisico: string[]
  }
  perfil_paciente: {
    faixa_etaria: 'pediatrico' | 'adulto_jovem' | 'adulto' | 'idoso'
    sexo: 'M' | 'F' | 'nao_informado'
    imunocomprometido: boolean
    tipo_imunocomprometimento: 'transplante' | 'hiv' | 'quimioterapia' | 'corticoide' | 'outro' | null
    comorbidades: string[]
  }
  microbiologia: {
    agente_identificado: string | null
    metodo_diagnostico: string[]
    perfil_resistencia: string | null
  }
  conduta: {
    antibioticos: Array<{
      nome: string
      dose: string
      via: string
      frequencia: string
      duracao_dias: number
    }>
    outros_medicamentos: string[]
    internacao_indicada: boolean
    nivel_cuidado: 'ambulatorial' | 'internacao' | 'UTI'
  }
  busca_pubmed: {
    termos_mesh: string[]
    query_sugerida: string
    prioridade: 'alta' | 'media' | 'baixa'
  }
  palavras_gatilho_relatorio: string[]
  caso_atipico: {
    atipico: boolean
    criterios_objetivos: string[]
    tipo_sugerido: 'relato_de_caso' | 'serie_de_casos' | 'nenhum'
  }
  tags: string[]
}

export async function gerarSOAP(params: {
  transcricaoOuTexto: string
  dadosExamesJson?: string
  template: 'infectologia_geral' | 'prep_ist' | 'opat' | 'pos_transplante' | 'neutropenia_febril' | 'hiv_cronico' | 'tb'
}): Promise<string> {
  const systemPrompt = `${INTEGRITY_GUARD}
${INJECTION_GUARD}
${PII_GUARD}

Você é o MedScribe, assistente de documentação clínica especializado em Infectologia e Medicina Interna, treinado para o contexto brasileiro.

TEMPLATE ATIVO: ${params.template}

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
Dado ausente na transcrição: escreva "[NÃO INFORMADO]" — nunca presuma nem invente.`

  const userContent = `ENTRADA DO MÉDICO:
${params.transcricaoOuTexto}

EXAMES IMPORTADOS (se houver):
${params.dadosExamesJson ?? 'Nenhum exame importado'}`

  return callClaude(systemPrompt, userContent, 4096, MODEL_SONNET, 0.2, 'gerarSOAP')
}

// ─── CIS-02b — MedScribe: Knowledge Metadata ─────────────────────────────────

export async function gerarKnowledgeMetadata(params: {
  soapTexto: string
  template: 'infectologia_geral' | 'prep_ist' | 'opat' | 'pos_transplante' | 'neutropenia_febril' | 'hiv_cronico' | 'tb'
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
  criterios_objetivos: liste apenas os critérios efetivamente verificáveis no SOAP ([] se atipico = false)`

  const text = await callClaude(systemPrompt, params.soapTexto, 1024, MODEL_HAIKU, 0.1, 'gerarTermosMeSH')
  return parseJsonResponse<KnowledgeMetadata>(text, 'knowledge-metadata')
}

// ─── Tipo compartilhado para todos os outputs de texto livre ─────────────────

export interface ResultadoTexto { texto: string }

// Aliases mantidos para compatibilidade com callers existentes
export type SinteseArtigos            = ResultadoTexto
export type DigestDiario              = ResultadoTexto
export type DigestSemanal             = ResultadoTexto
export type DigestMensal              = ResultadoTexto
export type ResultadoSerieCasos       = ResultadoTexto
export type ResultadoRevisaoLiteratura = ResultadoTexto

// ─── PROMPT 03 — Síntese Analítica de Artigos PubMed ─────────────────────────

export async function sintetizarArtigosPubMed(params: {
  soapResumido: string
  diagnostico: string
  cid10: string
  populacao: string
  condutaAtual: string
  artigosJson: string
  /** Número de artigos fornecidos — injetado no prompt como {N} */
  n?: number
  /** Referências da biblioteca Zotero do médico — formatadas com [Z1], [Z2] */
  zoteroReferencias?: string
}): Promise<SinteseArtigos> {
  const n = params.n ?? 'N'
  const temZotero = Boolean(params.zoteroReferencias?.trim())

  const systemPrompt = `${INTEGRITY_GUARD}

Você é um agente de síntese de evidências clínicas com expertise em infectologia e medicina baseada em evidências.

${EVIDENCE_GRADING}

TAREFA: Síntese analítica estruturada. Escreva em português. Máximo 900 palavras. Todo dado clínico citado com [PMID] ou [ZN].

SISTEMA DE CITAÇÃO:
• [PMID XXXXXXXX] — artigos do PubMed fornecidos abaixo
• [Z1], [Z2], … — referências da biblioteca pessoal do médico (Zotero), fornecidas abaixo${temZotero ? '' : '\n• (Sem referências Zotero nesta síntese)'}

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
- Artigos anteriores a 2021 estão marcados [DESATUALIZADO]? → Verificar`

  const userContent = `CASO CLÍNICO ATUAL:
${params.soapResumido}

Diagnóstico: ${params.diagnostico} (${params.cid10})
Perfil do paciente: ${params.populacao}
Conduta em uso: ${params.condutaAtual}

-----

ARTIGOS PUBMED FORNECIDOS (${n} artigos):
(ATENÇÃO: sintetize APENAS o conteúdo presente nestes artigos)

${params.artigosJson}${temZotero ? `

-----

REFERÊNCIAS DA BIBLIOTECA PESSOAL DO MÉDICO (Zotero) — cite como [Z1], [Z2], etc.:
(Estas referências foram salvas pelo médico — têm igual validade que os artigos PubMed)

${params.zoteroReferencias}` : ''}`

  const text = await callClaude(systemPrompt, userContent, 4096, MODEL_SONNET, 0.2, 'sintetizarArtigosPubMed')
  return { texto: text }
}

// ─── PROMPT 04 — Verificação de Critérios DUT ────────────────────────────────

export interface ResultadoVerificacaoDUT {
  dut_numero: string
  dut_aplicavel: boolean
  criterios_atendidos: Array<{
    criterio: string
    encontrado: boolean
    evidencia_no_soap: string
  }>
  criterios_faltantes: Array<{
    criterio: string
    encontrado: boolean
    sugestao_para_medico: string
  }>
  pode_gerar_relatorio: boolean
  alerta_para_medico: string | null
  justificativa_clinica: string
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
- alerta_para_medico: null quando pode_gerar_relatorio = true; string explicando os critérios faltantes quando false.`

export async function verificarCriteriosDUT(params: {
  soapCompleto: string
  diagnostico: string
  numeroDut: string
  criteriosDutJson: string
}): Promise<ResultadoVerificacaoDUT> {
  const userContent = `SOAP DA CONSULTA:
${params.soapCompleto}

DIAGNÓSTICO: ${params.diagnostico}

DUT Nº ${params.numeroDut} — CRITÉRIOS OBRIGATÓRIOS:
${params.criteriosDutJson}`

  const text = await callClaude(PROMPT_04_SYSTEM, userContent, 1024, MODEL_SONNET, undefined, 'verificarCriteriosDUT')
  return parseJsonResponse<ResultadoVerificacaoDUT>(text, 'verificacao-dut')
}

// ─── PROMPT 05 — Geração de Relatório de Tratamento ──────────────────────────

export interface ResultadoRelatorioTratamento {
  texto: string
}

export async function gerarRelatorioTratamento(params: {
  tipoRelatorio: string
  dadosPaciente: string
  soapS: string
  soapO: string
  soapA: string
  soapP: string
  diagnostico: string
  cid10: string
  medicamento: string
  doseViaFrequencia: string
  tussCodigo: string
  dutNumero: string
  criteriosAtendidos: string
  referenciasVancouver: string
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

Não inclua cabeçalho, rodapé, assinatura ou formatação — esses elementos serão adicionados automaticamente pelo sistema.`

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
${params.referenciasVancouver}`

  const text = await callClaude(systemPrompt, userContent, 2048, MODEL_SONNET, undefined, 'gerarRelatorioTratamento')
  return { texto: text }
}

// ─── PROMPT 06 — Detecção de Divergência de Conduta ──────────────────────────

export interface ResultadoDivergenciaConducta {
  tem_divergencia: boolean
  nivel_urgencia: 'baixo' | 'medio' | 'alto' | null
  hash_alerta: string | null
  supressao_sugerida_dias: number | null
  confianca_aplicabilidade: 'alta' | 'media' | 'baixa' | null
  divergencias: Array<{
    aspecto: string
    conduta_atual: string
    evidencia_recomenda: string
    justificativa: string
    grade: '1A' | '1B' | '2A' | '2B' | '2C' | '3' | '4' | '5'
    forca_recomendacao: 'forte' | 'condicional'
    fonte: string
    populacao_estudo: string
    aplicavel_ao_perfil: boolean
  }>
  mensagem_para_medico: string | null
}

export interface FeedbackHistoricoItem {
  hashAlerta: string | null
  feedback: string        // 'concordo' | 'discordo' | 'inaplicavel'
  motivo: string | null
  cid10Origem?: string    // preenchido quando o feedback vem de diagnóstico diferente (padrão global)
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
- Se TODAS as divergências tiverem aplicavel_ao_perfil = false: tem_divergencia = false.`

export async function detectarDivergenciaConducta(params: {
  condutaAtual: string
  sinteseEvidencias: string
  diagnostico: string
  cid10: string
  perfilPaciente?: {
    faixa_etaria: string
    imunocomprometido: boolean
    tipo_imunocomprometimento: string | null
    comorbidades: string[]
  }
  historicoFeedback?: FeedbackHistoricoItem[]
}): Promise<ResultadoDivergenciaConducta> {
  const perfilStr = params.perfilPaciente
    ? [
        `Faixa etária: ${params.perfilPaciente.faixa_etaria}`,
        params.perfilPaciente.imunocomprometido
          ? `Imunocomprometido: sim (${params.perfilPaciente.tipo_imunocomprometimento ?? 'não especificado'})`
          : 'Imunocomprometido: não',
        params.perfilPaciente.comorbidades.length
          ? `Comorbidades: ${params.perfilPaciente.comorbidades.join(', ')}`
          : 'Comorbidades: nenhuma documentada',
      ].join('\n')
    : 'Perfil não disponível — aplique critérios conservadores de compatibilidade.'

  const feedbackStr = params.historicoFeedback?.length
    ? params.historicoFeedback.map(f => {
        const origem = f.cid10Origem ? ` | outro diagnóstico: ${f.cid10Origem} [padrão global]` : ''
        return `- hash: ${f.hashAlerta ?? 'desconhecido'} | feedback: ${f.feedback}${f.motivo ? ` | motivo: "${f.motivo}"` : ''}${origem}`
      }).join('\n')
    : 'Nenhum feedback registrado.'

  const userContent = `PERFIL DO PACIENTE:
${perfilStr}

HISTÓRICO DE FEEDBACK DO MÉDICO:
(itens sem [padrão global] são específicos de ${params.cid10}; itens [padrão global] indicam que o médico descartou aspecto análogo em outro diagnóstico — considere o padrão mas não descarte automaticamente)
${feedbackStr}

CONDUTA ATUAL DOCUMENTADA:
${params.condutaAtual}

SÍNTESE DAS EVIDÊNCIAS MAIS RECENTES:
${params.sinteseEvidencias}

Diagnóstico: ${params.diagnostico} (${params.cid10})`

  const text = await callClaude(PROMPT_06_SYSTEM, userContent, 1500, MODEL_SONNET, 0.1, 'detectarDivergenciaConducta')
  return parseJsonResponse<ResultadoDivergenciaConducta>(text, 'divergencia-conduta')
}

// ─── PROMPT 07 — Digest Diário ────────────────────────────────────────────────

export async function gerarDigestDiario(params: {
  data: string
  totalPacientes: number
  consultasJson: string
  artigosSintetizadosJson: string
  alertasCondutaJson: string
  relatoriosGerados: string
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

Termine com: "Próximo resumo: amanhã."`

  const userContent = `DADOS DO DIA — ${params.data}:
- Total de pacientes atendidos: ${params.totalPacientes}
- Consultas: ${params.consultasJson}
- Artigos sintetizados hoje: ${params.artigosSintetizadosJson}
- Alertas de conduta gerados: ${params.alertasCondutaJson}
- Relatórios emitidos: ${params.relatoriosGerados}`

  const text = await callClaude(systemPrompt, userContent, 1500, MODEL_SONNET, 0.2, 'gerarDigestDiario')
  return { texto: text }
}

// ─── PROMPT 08 — Digest Semanal ───────────────────────────────────────────────

type DigestSemanalParams = {
  semana: string
  totalPacientes: number
  diagnosticosJson: string
  artigosSemanaJson: string
  alertasSemanaJson: string
  seriesStatusJson: string
  relatoriosSemana: string
}

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

Termine com: "Próximo resumo semanal: próxima sexta-feira às 19h."`

function digestSemanalUserContent(params: DigestSemanalParams): string {
  return `DADOS DA SEMANA — ${params.semana}:
- Total de pacientes: ${params.totalPacientes}
- Diagnósticos da semana: ${params.diagnosticosJson}
- Artigos sintetizados: ${params.artigosSemanaJson}
- Alertas de conduta: ${params.alertasSemanaJson}
- Status das séries de casos: ${params.seriesStatusJson}
- Relatórios emitidos: ${params.relatoriosSemana}`
}

export async function gerarDigestSemanal(params: DigestSemanalParams): Promise<DigestSemanal> {
  const text = await callClaude(PROMPT_08_SYSTEM, digestSemanalUserContent(params), 2000, MODEL_SONNET, 0.2, 'gerarDigestSemanal')
  return { texto: text }
}

function buildDigestSemanalRequest(params: DigestSemanalParams, id: string): BatchRequest {
  return { id, systemPrompt: PROMPT_08_SYSTEM, userContent: digestSemanalUserContent(params), maxTokens: 2000, model: MODEL_SONNET, temperature: 0.2 }
}

/** Gera digests semanais para múltiplos médicos em um único batch (50% mais barato). */
export async function gerarDigestSemanalLote(
  entradas: Array<{ id: string; params: DigestSemanalParams }>,
): Promise<Map<string, string>> {
  return callClaudeBatch(entradas.map(e => buildDigestSemanalRequest(e.params, e.id)))
}

// ─── PROMPT 09 — Digest Mensal ────────────────────────────────────────────────

type DigestMensalParams = {
  mesAno: string
  totalPacientes: number
  diagnosticosMesJson: string
  artigosMesJson: string
  alertasMesJson: string
  seriesGeradasJson: string
  seriesPublicadasJson: string
  totalAcumuladoJson: string
  cronogramaPublicacaoJson: string
}

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

Termine com: "Próximo resumo mensal: último dia de [próximo mês]."`

function digestMensalUserContent(params: DigestMensalParams): string {
  return `DADOS DO MÊS — ${params.mesAno}:
- Total de pacientes no mês: ${params.totalPacientes}
- Diagnósticos do mês: ${params.diagnosticosMesJson}
- Artigos sintetizados no mês: ${params.artigosMesJson}
- Alertas de conduta do mês: ${params.alertasMesJson}
- Séries de casos geradas: ${params.seriesGeradasJson}
- Séries publicadas: ${params.seriesPublicadasJson}
- Totais acumulados (desde o início): ${params.totalAcumuladoJson}
- Cronograma de publicação: ${params.cronogramaPublicacaoJson}`
}

export async function gerarDigestMensal(params: DigestMensalParams): Promise<DigestMensal> {
  const text = await callClaude(PROMPT_09_SYSTEM, digestMensalUserContent(params), 2500, MODEL_SONNET, 0.2, 'gerarDigestMensal')
  return { texto: text }
}

function buildDigestMensalRequest(params: DigestMensalParams, id: string): BatchRequest {
  return { id, systemPrompt: PROMPT_09_SYSTEM, userContent: digestMensalUserContent(params), maxTokens: 2500, model: MODEL_SONNET, temperature: 0.2 }
}

/** Gera digests mensais para múltiplos médicos em um único batch (50% mais barato). */
export async function gerarDigestMensalLote(
  entradas: Array<{ id: string; params: DigestMensalParams }>,
): Promise<Map<string, string>> {
  return callClaudeBatch(entradas.map(e => buildDigestMensalRequest(e.params, e.id)))
}

// ─── PROMPT 10 — Geração de Série de Casos ───────────────────────────────────

export async function gerarSerieCasos(params: {
  diagnostico: string
  cid10: string
  nCasos: number
  casosJson: string
  artigosReferenciasJson: string
  /** Referências adicionais da biblioteca Zotero do médico — formatadas com [Z1], [Z2] */
  zoteroReferencias?: string
}): Promise<ResultadoSerieCasos> {
  if (params.nCasos < 3) {
    return {
      texto: `⚠️ SÉRIE DE CASOS NÃO GERADA\n\nPublicações de série de casos requerem mínimo de 3 casos documentados.\nCasos fornecidos: ${params.nCasos} (CID ${params.cid10}).\n\nAcumule mais casos antes de gerar o rascunho.`,
    }
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
- Dados que permitam identificar o paciente? → Remover`

  const userContent = `DIAGNÓSTICO: ${params.diagnostico} — CID ${params.cid10}
NÚMERO DE CASOS: ${params.nCasos}

DADOS DOS CASOS:
${params.casosJson}

ARTIGOS DE REFERÊNCIA DISPONÍVEIS (PubMed):
${params.artigosReferenciasJson}${params.zoteroReferencias?.trim() ? `

REFERÊNCIAS DA BIBLIOTECA PESSOAL DO MÉDICO (Zotero) — cite como [Z1], [Z2], etc.:
${params.zoteroReferencias}` : ''}`

  const text = await callClaude(systemPrompt, userContent, 4096, MODEL_OPUS, undefined, 'gerarSerieCasos')
  return { texto: text }
}

// ─── PROMPT 11 — Revisão de Literatura Automática ────────────────────────────

export async function gerarRevisaoLiteratura(params: {
  tema: string
  nArtigos: number
  artigosJson: string
  contextoClinico: string
  /** Referências adicionais da biblioteca Zotero do médico — formatadas com [Z1], [Z2] */
  zoteroReferencias?: string
}): Promise<ResultadoRevisaoLiteratura> {
  const anoAtual = new Date().getFullYear()
  const anoInicio = anoAtual - 5

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
- Usei conhecimento interno para preencher lacunas? → Substituir por declaração de ausência`

  const userContent = `TEMA DA REVISÃO: ${params.tema}
CONTEXTO CLÍNICO: ${params.contextoClinico}
ARTIGOS PUBMED DISPONÍVEIS: ${params.nArtigos}

ARTIGOS (PubMed):
${params.artigosJson}${params.zoteroReferencias?.trim() ? `

-----

REFERÊNCIAS DA BIBLIOTECA PESSOAL DO MÉDICO (Zotero) — cite como [Z1], [Z2], etc.:
(Complementam os artigos PubMed — têm igual validade na revisão)

${params.zoteroReferencias}` : ''}`

  const text = await callClaude(systemPrompt, userContent, 4096, MODEL_OPUS, undefined, 'gerarRevisaoLiteratura')
  return { texto: text }
}
