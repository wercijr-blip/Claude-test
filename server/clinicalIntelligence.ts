/**
 * Clinical Intelligence System — Dr. Werciley Saraiva Vieira Junior | CRM-DF 16381
 * 11 prompts for AI-assisted clinical documentation, knowledge synthesis, and reporting.
 */

import { env } from './_core/env.ts'
import { logger } from './_core/logger.ts'

// ─── Shared API helper ────────────────────────────────────────────────────────

const MODEL = 'claude-sonnet-4-20250514'

async function callClaude(systemPrompt: string, userContent: string, maxTokens: number): Promise<string> {
  let response: Response
  try {
    response = await fetch(`${env.BUILT_IN_FORGE_API_URL}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.BUILT_IN_FORGE_API_KEY ?? '',
        'anthropic-version': '2023-06-01',
      },
      signal: AbortSignal.timeout(60000),
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    })
  } catch (fetchErr) {
    throw new Error(`Falha na requisição à API de IA: ${(fetchErr as Error).message}`)
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Erro na API de IA (HTTP ${response.status}): ${body.slice(0, 200)}`)
  }

  const data = (await response.json()) as { content: Array<{ text: string }> }
  return data.content[0]?.text ?? ''
}

function parseJsonResponse<T>(text: string, context: string): T {
  const match = text.match(/\{[\s\S]*\}/)
  const jsonStr = match ? match[0] : text
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
  resumo_clinico: string
}

const PROMPT_01_SYSTEM = `Você é um sistema especializado em extração de dados de laudos laboratoriais médicos brasileiros.

Analise o resultado de exame fornecido e extraia TODOS os parâmetros laboratoriais encontrados, sem exceção.

Retorne APENAS um objeto JSON válido com esta estrutura exata, sem markdown, sem texto antes ou depois:

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
      "valor_numerico": 0.0,
      "unidade": "unidade de medida ou null",
      "valor_referencia_min": 0.0,
      "valor_referencia_max": 0.0,
      "valor_referencia_texto": "VR como aparece no laudo",
      "status": "normal | baixo | alto | critico_baixo | critico_alto | indeterminado",
      "categoria": "hemograma | bioquimica | coagulacao | urina | microbiologia | imunologia | sorologias | hormonio | gasometria | outro",
      "flag_critico": false,
      "observacao": "nota adicional do laudo sobre este parâmetro ou null"
    }
  ],
  "observacoes_gerais": "observações gerais do laudo ou null",
  "metodo": "método utilizado se mencionado ou null",
  "confianca_extracao": "alta | media | baixa",
  "resumo_clinico": "parágrafo de 2-3 linhas resumindo os achados mais relevantes em linguagem clínica"
}

REGRAS OBRIGATÓRIAS:
- Retorne APENAS o JSON. Nenhum texto adicional, nenhum markdown.
- Se um valor não estiver visível, use null — nunca invente dados.
- Para microbiologia: capture agente identificado, sensibilidade, resistência e CIM quando disponíveis.
- Para hemograma: normalize nomes abreviados (ex: "Leuc." → "Leucócitos", "Hgb" → "Hemoglobina", "Plaq." → "Plaquetas").
- Para sorologias: capture resultado qualitativo (Reagente/Não reagente) e quantitativo (titulação) quando disponíveis.
- Se o documento tiver múltiplas páginas ou múltiplos exames, extraia todos em um único array de parâmetros.

CRITÉRIOS DE VALOR CRÍTICO (flag_critico: true):
- Leucócitos > 30.000 /mm³ OU < 2.000 /mm³
- Hemoglobina < 7,0 g/dL
- Plaquetas < 20.000 /mm³ OU > 1.000.000 /mm³
- PCR > 200 mg/L
- Creatinina > 10 mg/dL
- Potássio > 6,5 mEq/L OU < 2,5 mEq/L
- Sódio > 160 mEq/L OU < 120 mEq/L
- Glicose > 500 mg/dL OU < 40 mg/dL
- pH < 7,20 OU > 7,60
- Lactato > 4 mmol/L
- INR > 5,0
- Hemocultura: qualquer crescimento bacteriano ou fúngico`

export async function extrairExamesLaboratoriais(textoLaudo: string): Promise<ResultadoExtracaoExames> {
  const text = await callClaude(PROMPT_01_SYSTEM, textoLaudo, 2048)
  return parseJsonResponse<ResultadoExtracaoExames>(text, 'extrator-exames')
}

// ─── PROMPT 02 — MedScribe: SOAP + Knowledge Metadata ────────────────────────

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
  potencial_publicacao: {
    caso_incomum: boolean
    justificativa: string | null
    tipo_sugerido: 'relato_de_caso' | 'serie_de_casos' | 'nenhum'
  }
  tags: string[]
}

export interface ResultadoMedScribe {
  soap: string
  knowledge_metadata: KnowledgeMetadata
}

export async function gerarMedScribe(params: {
  transcricaoOuTexto: string
  dadosExamesJson?: string
  template: 'infectologia_geral' | 'prep_ist' | 'opat' | 'pos_transplante' | 'neutropenia_febril' | 'hiv_cronico' | 'tb'
}): Promise<ResultadoMedScribe> {
  const systemPrompt = `Você é o MedScribe, assistente de documentação clínica especializado em Infectologia e Medicina Interna, treinado para o contexto brasileiro.

Seu papel é DUPLO e obrigatório:
1. Gerar um SOAP note clínico completo, preciso e juridicamente adequado
2. Extrair metadados estruturados para o sistema de geração de conhecimento clínico

TEMPLATE ATIVO: ${params.template}
(infectologia_geral | prep_ist | opat | pos_transplante | neutropenia_febril | hiv_cronico | tb)

## TAREFA 1 — SOAP NOTE CLÍNICO

Gere o SOAP note completo no seguinte formato. Seja preciso, objetivo e use terminologia médica adequada.

### S — Subjetivo
- Queixa principal com tempo de evolução preciso
- HDA: início, progressão cronológica, fatores de melhora e piora, sintomas associados
- Medicamentos em uso: nome comercial e genérico, dose, via, frequência, há quanto tempo
- Alergias medicamentosas documentadas (se nenhuma: "NADA")
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

---

## TAREFA 2 — KNOWLEDGE METADATA (OBRIGATÓRIO)

Após o SOAP note, gere OBRIGATORIAMENTE o seguinte bloco JSON.
Este bloco será processado automaticamente pelo sistema — não omita nenhum campo, não altere a estrutura.

\`\`\`json
{
  "knowledge_metadata": {
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
      "faixa_etaria": "adulto",
      "sexo": "nao_informado",
      "imunocomprometido": false,
      "tipo_imunocomprometimento": null,
      "comorbidades": []
    },
    "microbiologia": {
      "agente_identificado": null,
      "metodo_diagnostico": [],
      "perfil_resistencia": null
    },
    "conduta": {
      "antibioticos": [],
      "outros_medicamentos": [],
      "internacao_indicada": false,
      "nivel_cuidado": "ambulatorial"
    },
    "busca_pubmed": {
      "termos_mesh": [],
      "query_sugerida": "",
      "prioridade": "media"
    },
    "palavras_gatilho_relatorio": [],
    "potencial_publicacao": {
      "caso_incomum": false,
      "justificativa": null,
      "tipo_sugerido": "nenhum"
    },
    "tags": []
  }
}
\`\`\`

REGRAS para o knowledge_metadata:
- Use vocabulário MeSH padrão nos termos de busca PubMed
- A query_sugerida deve ser executável diretamente no PubMed
- Se caso tiver apresentação atípica ou rara, marque caso_incomum como true
- Sempre inclua o bloco completo, mesmo que alguns campos sejam null`

  const userContent = `ENTRADA DO MÉDICO:
${params.transcricaoOuTexto}

EXAMES IMPORTADOS (se houver):
${params.dadosExamesJson ?? 'Nenhum exame importado'}`

  const text = await callClaude(systemPrompt, userContent, 4096)

  // Extract SOAP (text before the JSON block) and knowledge_metadata (JSON block)
  const jsonMatch = text.match(/```json\s*(\{[\s\S]*?\})\s*```/)
  const metadataJson = jsonMatch ? jsonMatch[1] : null

  let knowledge_metadata: KnowledgeMetadata
  if (metadataJson) {
    const parsed = parseJsonResponse<{ knowledge_metadata: KnowledgeMetadata }>(metadataJson, 'medscribe-metadata')
    knowledge_metadata = parsed.knowledge_metadata
  } else {
    // Fallback: try to extract bare JSON object
    const bareJson = text.match(/\{[\s\S]*"knowledge_metadata"[\s\S]*\}/)
    if (bareJson) {
      const parsed = parseJsonResponse<{ knowledge_metadata: KnowledgeMetadata }>(bareJson[0], 'medscribe-metadata-fallback')
      knowledge_metadata = parsed.knowledge_metadata
    } else {
      throw new Error('MedScribe não retornou knowledge_metadata estruturado')
    }
  }

  const soap = jsonMatch
    ? text.slice(0, text.indexOf('```json')).trim()
    : text.slice(0, text.lastIndexOf('{')).trim()

  return { soap, knowledge_metadata }
}

// ─── PROMPT 03 — Síntese Analítica de Artigos PubMed ─────────────────────────

export interface SinteseArtigos {
  texto: string
}

export async function sintetizarArtigosPubMed(params: {
  soapResumido: string
  diagnostico: string
  cid10: string
  populacao: string
  condutaAtual: string
  artigosJson: string
  /** Número de artigos fornecidos — injetado no prompt como {N} */
  n?: number
}): Promise<SinteseArtigos> {
  const n = params.n ?? 'N'
  const systemPrompt = `Você é um agente de síntese de evidências clínicas com expertise em infectologia e medicina baseada em evidências.

═══════════════════════════════════════════════════════════════
REGRAS ABSOLUTAS DE INTEGRIDADE — LEIA ANTES DE QUALQUER COISA
═══════════════════════════════════════════════════════════════

1. PROIBIDO INVENTAR DADOS
   Nunca crie, extrapole ou suponha informações que não estejam
   explicitamente presentes nos artigos fornecidos abaixo.
   Se um dado não consta no texto do artigo: NÃO MENCIONE.

2. PROIBIDO CRIAR SUPOSIÇÕES SOBRE ARTIGOS
   Nunca assuma o que um artigo "provavelmente concluiu" ou
   "deve ter encontrado". Use apenas o que está no texto fornecido.
   Se o abstract é parcial: cite apenas o que está disponível.

3. PROIBIDO CITAR ARTIGOS NÃO FORNECIDOS
   Só cite artigos presentes na lista abaixo com PMID explícito.
   Nunca acrescente referências do seu conhecimento interno,
   mesmo que sejam reais e relevantes.

4. PROIBIDO GENERALIZAR ALÉM DOS DADOS
   Se um artigo estudou população específica (ex: adultos HIV+),
   não extrapole para outras populações sem indicar essa limitação.

5. QUANDO HOUVER DÚVIDA: DECLARE INCERTEZA
   Use frases como:
   - "Os dados disponíveis são insuficientes para…"
   - "Este artigo não aborda especificamente…"
   - "Não há evidência nos artigos fornecidos sobre…"
   Incerteza declarada é preferível a qualquer suposição.

6. RASTREABILIDADE OBRIGATÓRIA
   Cada afirmação clínica DEVE ter o PMID correspondente
   entre colchetes. Ex: "…redução de mortalidade de 23% [PMID 40198765]."
   Afirmação sem PMID = não deve existir na síntese.

═══════════════════════════════════════════════════════════════

TAREFA: Gere síntese analítica estruturada. Escreva em português.
Direto e objetivo. Máximo 800 palavras. Todo dado citado com PMID.

## 1. Panorama Atual

O que os artigos FORNECIDOS mostram sobre mudanças recentes no manejo.
Mencione apenas o que está explícito nos textos. Cite PMID para cada ponto.

## 2. Evidências Aplicáveis a Este Caso

Como os artigos se aplicam ao perfil do paciente descrito.
Se nenhum artigo aborda diretamente este perfil, declare isso explicitamente.
Cite PMID para cada aplicação.

## 3. Recomendações Baseadas nos Artigos Fornecidos

Lista numerada. Para cada recomendação:
- O que fazer
- Nível de evidência do artigo que suporta: (A = RCT/meta-análise | B = coorte/observacional | C = opinião)
- Fonte: [PMID] Autor, Revista, Ano
- Limitação: se a recomendação vem de população diferente do caso, informe

## 4. ⚠️ Mudanças de Conduta Detectadas

PREENCHA APENAS se houver divergência EXPLÍCITA nos artigos fornecidos.
Formato obrigatório:
- CONDUTA ATUAL: [o que está sendo feito]
- ARTIGO RECOMENDA: [citação literal ou paráfrase fiel do artigo]
- PMID: [número]
- LIMITAÇÃO: [se o contexto do artigo difere do caso clínico atual]

Se não houver divergência nos artigos fornecidos:
Escreva exatamente: "Nenhuma divergência identificada nos artigos fornecidos. Isso não exclui divergência com literatura não incluída nesta busca."

## 5. O Que os Artigos Não Respondem

Liste perguntas clínicas relevantes para este caso que os artigos
fornecidos NÃO respondem. Máximo 3 itens.
(Não confundir com lacunas gerais da literatura — apenas o que estes artigos específicos não abordam)

## 6. Referências Utilizadas

Liste APENAS os artigos efetivamente citados nas seções acima.
Formato: [PMID] Autor et al. Título. Revista. Ano. DOI: xxx
Artigos fornecidos mas não citados: NÃO incluir.

-----

⚠️ VERIFICAÇÃO FINAL ANTES DE RESPONDER:
- Toda afirmação tem PMID? → Se não: remover ou corrigir
- Citei artigo não listado acima? → Se sim: remover
- Fiz suposição sobre o que um artigo "deve ter concluído"? → Se sim: remover
- Extrapolei para população diferente sem avisar? → Se sim: adicionar limitação`

  const userContent = `CASO CLÍNICO ATUAL:
${params.soapResumido}

Diagnóstico: ${params.diagnostico} (${params.cid10})
Perfil do paciente: ${params.populacao}
Conduta em uso: ${params.condutaAtual}

-----

ARTIGOS FORNECIDOS (${n} artigos):
(ATENÇÃO: sintetize APENAS o conteúdo presente nestes artigos)

${params.artigosJson}`

  const text = await callClaude(systemPrompt, userContent, 4096)
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

const PROMPT_04_SYSTEM = `Você é um especialista em regulamentação de planos de saúde no Brasil, com profundo conhecimento das Diretrizes de Utilização (DUT) da ANS.

Para cada critério obrigatório da DUT, verifique se está documentado no SOAP.
Seja rigoroso: o critério precisa estar EXPLICITAMENTE documentado, não apenas implícito.

Retorne APENAS JSON válido, sem markdown, sem texto adicional:

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
  "alerta_para_medico": "null se tudo ok | texto claro explicando o que falta caso contrário",
  "justificativa_clinica": "parágrafo de 3-5 linhas cobrindo todos os critérios atendidos, em linguagem técnica adequada para operadora de saúde"
}`

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

  const text = await callClaude(PROMPT_04_SYSTEM, userContent, 1024)
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
  const systemPrompt = `Você é um médico especialista redigindo um relatório médico formal para autorização de tratamento junto a operadora de saúde.

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

  const text = await callClaude(systemPrompt, userContent, 2048)
  return { texto: text }
}

// ─── PROMPT 06 — Detecção de Divergência de Conduta ──────────────────────────

export interface ResultadoDivergenciaConducta {
  tem_divergencia: boolean
  nivel_urgencia: 'baixo' | 'medio' | 'alto' | null
  divergencias: Array<{
    aspecto: string
    conduta_atual: string
    evidencia_recomenda: string
    justificativa: string
    nivel_evidencia: 'A' | 'B' | 'C'
    fonte: string
  }>
  mensagem_para_medico: string | null
}

const PROMPT_06_SYSTEM = `Você é um consultor de qualidade clínica especializado em infectologia.

Analise se existe divergência clinicamente relevante entre a conduta atual e a evidência mais recente.

Considere divergência relevante apenas quando:
- A evidência tem nível A (ensaio clínico randomizado ou meta-análise)
- A mudança tem impacto direto em desfecho do paciente (mortalidade, toxicidade, eficácia)
- A recomendação é de guidelines de referência (IDSA, ESCMID, WHO, MS Brasil)

Não sinalize como divergência diferenças de preferência ou adaptações locais justificáveis.

Retorne APENAS JSON válido:

{
  "tem_divergencia": false,
  "nivel_urgencia": "baixo | medio | alto | null",
  "divergencias": [
    {
      "aspecto": "qual aspecto específico da conduta",
      "conduta_atual": "o que está sendo feito",
      "evidencia_recomenda": "o que a literatura mais recente recomenda",
      "justificativa": "resumo em 1-2 linhas da evidência",
      "nivel_evidencia": "A | B | C",
      "fonte": "autores, revista, ano, PMID"
    }
  ],
  "mensagem_para_medico": "null se sem divergência | texto amigável, não julgamental, que explica a divergência e sugere revisão da conduta"
}`

export async function detectarDivergenciaConducta(params: {
  condutaAtual: string
  sinteseEvidencias: string
  diagnostico: string
  cid10: string
}): Promise<ResultadoDivergenciaConducta> {
  const userContent = `CONDUTA ATUAL DOCUMENTADA:
${params.condutaAtual}

SÍNTESE DAS EVIDÊNCIAS MAIS RECENTES (2024-2026):
${params.sinteseEvidencias}

Diagnóstico: ${params.diagnostico} (${params.cid10})`

  const text = await callClaude(PROMPT_06_SYSTEM, userContent, 1024)
  return parseJsonResponse<ResultadoDivergenciaConducta>(text, 'divergencia-conduta')
}

// ─── PROMPT 07 — Digest Diário ────────────────────────────────────────────────

export interface DigestDiario {
  texto: string
}

export async function gerarDigestDiario(params: {
  data: string
  totalPacientes: number
  consultasJson: string
  artigosSintetizadosJson: string
  alertasCondutaJson: string
  relatoriosGerados: string
}): Promise<DigestDiario> {
  const systemPrompt = `Você é o assistente de síntese clínica do ${MEDICO.nome}, infectologista em Brasília-DF.

Gere um resumo clínico do dia em até 2 páginas (máximo 600 palavras).
Tom: colega médico conversando, não robótico. Direto ao ponto.
Idioma: português brasileiro.

ESTRUTURA OBRIGATÓRIA:

## Resumo do Dia — {data}

**{total_pacientes} pacientes atendidos**
[Liste os diagnósticos/hipóteses em bullets concisos, agrupando similares se houver]

---

## Novas Evidências Geradas Hoje

[PRIORIDADE 1 — Mudanças de conduta: se houver alertas, abra com eles]
⚠️ ATENÇÃO — Mudança de conduta sugerida:
[Para cada alerta: diagnóstico, conduta atual vs. recomendada, fonte]

[PRIORIDADE 2 — Evidências nível A relevantes]
[Para cada artigo relevante: diagnóstico, achado principal em 1 linha, fonte]

[PRIORIDADE 3 — Demais evidências, se couber no espaço]

---

## Para o Seu Conhecimento

[1-2 linhas sobre o que o sistema fez hoje: artigos indexados, notas geradas]

---

REGRAS:
- Máximo absoluto: 600 palavras
- Se houver muito conteúdo: corte primeiro as evidências nível C, depois nível B, nunca corte mudanças de conduta
- Se não houver novas evidências relevantes: diga isso diretamente em uma linha
- Não use linguagem de marketing ou elogios
- Termine sempre com: "Próximo resumo: [frequência configurada]"`

  const userContent = `DADOS DO DIA — ${params.data}:
- Total de pacientes atendidos: ${params.totalPacientes}
- Consultas: ${params.consultasJson}
- Artigos sintetizados hoje: ${params.artigosSintetizadosJson}
- Alertas de conduta gerados: ${params.alertasCondutaJson}
- Relatórios emitidos: ${params.relatoriosGerados}`

  const text = await callClaude(systemPrompt, userContent, 1500)
  return { texto: text }
}

// ─── PROMPT 08 — Digest Semanal ───────────────────────────────────────────────

export interface DigestSemanal {
  texto: string
}

export async function gerarDigestSemanal(params: {
  semana: string
  totalPacientes: number
  diagnosticosJson: string
  artigosSemanaJson: string
  alertasSemanaJson: string
  seriesStatusJson: string
  relatoriosSemana: string
}): Promise<DigestSemanal> {
  const systemPrompt = `Você é o assistente de síntese clínica do ${MEDICO.nome}, infectologista em Brasília-DF.

Gere um resumo semanal em até 2 páginas (máximo 800 palavras).
Tom: colega médico conversando, analítico mas direto. Sem floreios.
Idioma: português brasileiro.

ESTRUTURA OBRIGATÓRIA:

## Resumo Semanal — {semana}

### Visão Geral
{total_pacientes} pacientes · [principais diagnósticos com quantidade] · [destaques da semana em 2 linhas]

---

### ⚠️ Mudanças de Conduta — Revisar
[SEMPRE inclua se houver alertas. Para cada um: diagnóstico, o que muda e por quê, fonte]
[Se não houver: "Nenhuma mudança de conduta detectada esta semana."]

---

### Evidências Mais Relevantes da Semana
[Máximo 5 itens, priorizando nível A e impacto clínico direto]
[Formato: **Diagnóstico** — achado principal (Fonte, ano, nível evidência)]

---

### Séries de Casos — Status
[Para cada CID com casos acumulados: quantos casos, quantos faltam para threshold, se rascunho está pronto]

---

### Conhecimento Acumulado
[1-2 linhas: artigos sintetizados, notas geradas, total acumulado desde início]

---

REGRAS:
- Máximo absoluto: 800 palavras
- Priorize sempre: mudanças de conduta > evidências nível A > séries próximas do threshold
- Se houver mais de 5 evidências relevantes: mencione as demais em uma linha como "X evidências adicionais disponíveis no painel"
- Nunca elogie o médico ou use linguagem motivacional
- Termine com: "Próximo resumo semanal: próxima sexta-feira às 19h"`

  const userContent = `DADOS DA SEMANA — ${params.semana}:
- Total de pacientes: ${params.totalPacientes}
- Diagnósticos da semana: ${params.diagnosticosJson}
- Artigos sintetizados: ${params.artigosSemanaJson}
- Alertas de conduta: ${params.alertasSemanaJson}
- Status das séries de casos: ${params.seriesStatusJson}
- Relatórios emitidos: ${params.relatoriosSemana}`

  const text = await callClaude(systemPrompt, userContent, 2000)
  return { texto: text }
}

// ─── PROMPT 09 — Digest Mensal ────────────────────────────────────────────────

export interface DigestMensal {
  texto: string
}

export async function gerarDigestMensal(params: {
  mesAno: string
  totalPacientes: number
  diagnosticosMesJson: string
  artigosMesJson: string
  alertasMesJson: string
  seriesGeradasJson: string
  seriesPublicadasJson: string
  totalAcumuladoJson: string
  cronogramaPublicacaoJson: string
}): Promise<DigestMensal> {
  const systemPrompt = `Você é o assistente de síntese clínica do ${MEDICO.nome}, infectologista em Brasília-DF.

Gere um resumo mensal analítico em até 2 páginas (máximo 1000 palavras).
Tom: relatório clínico analítico, como um colega senior avaliando a prática do mês.
Idioma: português brasileiro.

ESTRUTURA OBRIGATÓRIA:

## Resumo Mensal — {mes_ano}

### Performance Clínica
{total_pacientes} pacientes · [top 5 diagnósticos com %, padrões identificados]
[Identifique qualquer padrão epidemiológico relevante: aumento de algum diagnóstico, perfil de pacientes]

---

### ⚠️ Mudanças de Conduta — Mês
[Lista consolidada de todos os alertas do mês, agrupados por diagnóstico]
[Para cada um: o que mudou, quando foi detectado, se já foi incorporado]

---

### Top 5 Evidências do Mês
[As 5 evidências mais impactantes, justificando a seleção]
[Formato: **Diagnóstico** — achado (Fonte) — por que é relevante para sua prática]

---

### Geração de Conhecimento — Balanço Mensal
- Artigos sintetizados no mês: [N] | Total acumulado: [N]
- Séries de casos geradas este mês: [lista]
- Séries publicadas: [lista com revista]

---

### Próximas Publicações
[Com base no cronograma e no volume atual de casos, indique as 2-3 publicações mais próximas de estarem prontas]

---

### Destaques para o Próximo Mês
[2-3 pontos de atenção: séries quase prontas, diagnósticos com muitos casos, alertas pendentes de revisão]

---

REGRAS:
- Máximo absoluto: 1000 palavras
- Seja analítico, não apenas descritivo. Identifique padrões.
- Priorize informações acionáveis sobre estatísticas brutas
- Nunca use linguagem motivacional ou elogios
- Termine com: "Próximo resumo mensal: último dia de [próximo mês]"`

  const userContent = `DADOS DO MÊS — ${params.mesAno}:
- Total de pacientes no mês: ${params.totalPacientes}
- Diagnósticos do mês: ${params.diagnosticosMesJson}
- Artigos sintetizados no mês: ${params.artigosMesJson}
- Alertas de conduta do mês: ${params.alertasMesJson}
- Séries de casos geradas: ${params.seriesGeradasJson}
- Séries publicadas: ${params.seriesPublicadasJson}
- Totais acumulados (desde o início): ${params.totalAcumuladoJson}
- Cronograma de publicação: ${params.cronogramaPublicacaoJson}`

  const text = await callClaude(systemPrompt, userContent, 2500)
  return { texto: text }
}

// ─── PROMPT 10 — Geração de Série de Casos ───────────────────────────────────

export interface ResultadoSerieCasos {
  texto: string
}

export async function gerarSerieCasos(params: {
  diagnostico: string
  cid10: string
  nCasos: number
  casosJson: string
  artigosReferenciasJson: string
}): Promise<ResultadoSerieCasos> {
  const systemPrompt = `Você é um médico infectologista redigindo uma série de casos para publicação científica, seguindo as CARE guidelines (CAse REport guidelines).

AUTOR: ${MEDICO.nome} — ${MEDICO.crm} | RQE 14486
Infectologista — Brasília-DF, Brasil

TAREFA:
Gere o rascunho completo da série de casos em português, seguindo rigorosamente a estrutura CARE guidelines adaptada para série de casos.
Todos os pacientes devem ser anonimizados: use Caso 1, Caso 2, etc.
Língua: português (manuscrito pode ser traduzido depois para submissão em inglês).

ESTRUTURA OBRIGATÓRIA:

## TÍTULO
[Título descritivo incluindo: diagnóstico, número de casos, contexto/população — máximo 20 palavras]

## RESUMO (máximo 250 palavras)
Contexto, objetivo, relato dos casos (resumido), discussão, conclusão.

## 1. INTRODUÇÃO
- Relevância clínica e epidemiológica do diagnóstico
- Lacunas no conhecimento que esta série contribui para preencher
- Objetivo da série
[Máximo 200 palavras]

## 2. RELATO DOS CASOS

### Tabela Comparativa
[Gere uma tabela markdown com: Caso | Idade/Sexo | Comorbidades | Apresentação | Diagnóstico (método) | Tratamento | Desfecho]

### Descrição dos Casos
[Para cada caso: 3-5 parágrafos cobrindo apresentação, investigação, diagnóstico, tratamento, evolução e desfecho]

## 3. DISCUSSÃO
- Análise dos padrões comuns e divergências entre os casos
- Comparação com literatura existente (citar artigos fornecidos)
- Aspectos inovadores ou incomuns desta série
- Implicações clínicas práticas
[Máximo 400 palavras]

## 4. CONCLUSÃO
[2-3 parágrafos: achados principais, implicações para a prática, necessidade de estudos futuros]

## 5. REFERÊNCIAS
[Liste em Vancouver as referências dos artigos utilizados na discussão]

---

REGRAS:
- Anonimização rigorosa: nenhum dado que permita identificar o paciente
- Use linguagem científica adequada para publicação em revista indexada
- Cite as referências no corpo do texto usando [número]
- Identifique claramente onde há necessidade de dados adicionais que o médico deve preencher: [INSERIR: dado específico]`

  const userContent = `DIAGNÓSTICO: ${params.diagnostico} — CID ${params.cid10}
NÚMERO DE CASOS: ${params.nCasos}

DADOS DOS CASOS:
${params.casosJson}

ARTIGOS DE REFERÊNCIA DISPONÍVEIS:
${params.artigosReferenciasJson}`

  const text = await callClaude(systemPrompt, userContent, 4096)
  return { texto: text }
}

// ─── PROMPT 11 — Revisão de Literatura Automática ────────────────────────────

export interface ResultadoRevisaoLiteratura {
  texto: string
}

export async function gerarRevisaoLiteratura(params: {
  tema: string
  nArtigos: number
  artigosJson: string
  contextoClinico: string
}): Promise<ResultadoRevisaoLiteratura> {
  const systemPrompt = `Você é um infectologista especialista em medicina baseada em evidências, redigindo uma revisão narrativa para publicação ou uso clínico.

TAREFA:
Gere uma revisão narrativa estruturada, clínica e aplicável.
Extensão total: máximo 1200 palavras (aproximadamente 2 páginas A4).
Idioma: português brasileiro.
Use linguagem adequada para publicação em revista médica indexada.

## TÍTULO
[Título da revisão — conciso e descritivo]

## RESUMO
[Máximo 150 palavras: contexto, métodos de busca, principais achados, conclusão]

## 1. INTRODUÇÃO E RELEVÂNCIA
[Importância clínica e epidemiológica do tema, lacunas no conhecimento]
[Máximo 150 palavras]

## 2. EPIDEMIOLOGIA E FATORES DE RISCO
[Dados epidemiológicos mais recentes, fatores de risco identificados]
[Máximo 150 palavras]

## 3. DIAGNÓSTICO — EVIDÊNCIAS ATUAIS
[Métodos diagnósticos, sensibilidade/especificidade, novos biomarcadores]
[Máximo 200 palavras]

## 4. TRATAMENTO — EVIDÊNCIAS 2023-2026
[Primeira linha, alternativas, duração, situações especiais]
[Máximo 250 palavras — esta é a seção mais importante]

## 5. MUDANÇAS RECENTES NAS RECOMENDAÇÕES
[O que mudou vs. guidelines anteriores. Liste apenas mudanças com nível de evidência A ou B]
[Máximo 150 palavras]

## 6. IMPLICAÇÕES PRÁTICAS PARA O CONTEXTO BRASILEIRO
[Disponibilidade dos medicamentos no Brasil, SUS vs. particular, ANVISA, protocolos MS]
[Máximo 100 palavras]

## 7. CONCLUSÃO
[Síntese dos principais pontos e próximas direções de pesquisa]
[Máximo 100 palavras]

## REFERÊNCIAS
[Lista em Vancouver, apenas artigos efetivamente citados no texto]

---

REGRAS:
- Máximo absoluto: 1200 palavras (sem contar referências)
- Cite todos os artigos usados com [número] no texto
- Nível de evidência ao lado de cada recomendação: (Nível A | B | C)
- Se algum artigo for irrelevante para o tema, ignore-o
- Identifique contradições entre estudos quando existirem
- Nunca cite artigos que não estão na lista fornecida`

  const userContent = `TEMA DA REVISÃO: ${params.tema}
CONTEXTO CLÍNICO: ${params.contextoClinico}
ARTIGOS DISPONÍVEIS: ${params.nArtigos} artigos (2023-2026)

ARTIGOS:
${params.artigosJson}`

  const text = await callClaude(systemPrompt, userContent, 4096)
  return { texto: text }
}
