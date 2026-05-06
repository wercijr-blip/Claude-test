import { env } from './_core/env.ts'
import { logger } from './_core/logger.ts'
import { getPresignedUrl } from './storage.ts'

export interface ExtracacaoExame {
  // Tipo de exame identificado pela IA — usado para garantir que estamos
  // analisando um exame de HIV e não outro (creatinina, hepatite, etc).
  tipoExameDetectado: 'hiv' | 'outro' | 'nao_identificado'
  nomeExame: string | null
  resultadoHiv: 'reagente' | 'nao_reagente' | 'inconclusivo' | 'nao_identificado'
  // Texto literal do resultado conforme escrito no laudo
  // (ex.: "Não reagente", "Negativo", "Anti-HIV: NEGATIVO"). Auditoria.
  resultadoTexto: string | null
  dataColeta: string | null // DD/MM/YYYY — data da coleta do material
  dataResultado: string | null // DD/MM/YYYY — data de emissão/liberação do laudo
  dataExame: string | null // DD/MM/YYYY — efetiva: a MAIS RECENTE entre coleta e resultado
  confianca: number // 0–1
  processadoEm: string
}

// ─── Utility: fuzzy name similarity (normalized Levenshtein) ─────────────────

function normalizarTexto(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

// Stopwords removidas antes de tokenizar (preposições e conectivos comuns).
const STOPWORDS_NOME = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])

function tokenizarNome(s: string): string[] {
  return normalizarTexto(s)
    .split(/\s+/)
    .filter((t) => t.length >= 1 && !STOPWORDS_NOME.has(t))
}

// Verifica se dois tokens batem. Aceita:
// - igualdade
// - abreviação: um token de 1 char é inicial e o outro começa com essa letra (J ↔ JOAO)
// - Levenshtein normalizado ≥ 0.85 (cobre erros de OCR)
function tokensBatem(a: string, b: string): boolean {
  if (a === b) return true
  if (a.length === 1 && b.startsWith(a)) return true
  if (b.length === 1 && a.startsWith(b)) return true
  const max = Math.max(a.length, b.length)
  if (max === 0) return false
  return (max - levenshtein(a, b)) / max >= 0.85
}

// Compara primeiro nome (deve ser IGUAL ou com erro mínimo de OCR) e
// demais tokens (que podem ser abreviados ou ter pequenas variações).
// Retorna 0 se o primeiro nome não bater (rejeição automática).
// Caso contrário, retorna fração de matches dos demais tokens.
export function calcularSimilaridadeNome(nomeExame: string, nomeEsperado: string): number {
  const tokensExame = tokenizarNome(nomeExame)
  const tokensEsperado = tokenizarNome(nomeEsperado)
  if (tokensEsperado.length === 0 || tokensExame.length === 0) return 0

  // Primeiro nome: deve ser igual ou ter Levenshtein ≥ 0.90 (cobre 1 char errado de OCR).
  // NÃO aceita abreviação aqui — primeiro nome precisa estar por extenso.
  const primeiroEsperado = tokensEsperado[0]
  const primeiroBate = tokensExame.some((e) => {
    if (e === primeiroEsperado) return true
    if (e.length < 2 || primeiroEsperado.length < 2) return false
    const max = Math.max(e.length, primeiroEsperado.length)
    return (max - levenshtein(e, primeiroEsperado)) / max >= 0.90
  })
  if (!primeiroBate) return 0

  // Demais tokens (sobrenomes): podem ser abreviados (J ↔ JOAO) ou ter erros pequenos.
  const demais = tokensEsperado.slice(1)
  if (demais.length === 0) return 1

  let matches = 0
  for (const t of demais) {
    if (tokensExame.some((e) => tokensBatem(t, e))) matches++
  }
  return matches / demais.length
}

// ─── AI extraction: nome, resultado, data, confiança ─────────────────────────

export async function extrairDadosExame(s3Key: string): Promise<ExtracacaoExame> {
  const imageUrl = await getPresignedUrl(s3Key, 300)
  const isPdf = /\.pdf$/i.test(s3Key)

  const prompt = `Você é um especialista em leitura de laudos laboratoriais brasileiros.
Sua tarefa é analisar a imagem/PDF de UM EXAME DE HIV e extrair dados estruturados.

═══════════════════════════════════════════════════════════════
ETAPA 1 — IDENTIFICAR O TIPO DE EXAME
═══════════════════════════════════════════════════════════════
Antes de extrair qualquer dado, identifique se o documento é um exame
de HIV (também chamado de Anti-HIV, HIV 1/2, sorologia para HIV,
teste rápido HIV, ELISA HIV, quimioluminescência HIV, ECLIA HIV).

Se o documento NÃO é um exame de HIV (ex.: creatinina, hepatite,
hemograma, glicemia, ficha cadastral, RG, comprovante etc.), defina
"tipoExameDetectado": "outro" e devolva os demais campos como null/0.

Se você não consegue determinar com clareza, use "nao_identificado".

═══════════════════════════════════════════════════════════════
ETAPA 2 — EXTRAÇÃO (somente se tipoExameDetectado == "hiv")
═══════════════════════════════════════════════════════════════

CAMPOS:

1. nomeExame
   Nome completo do paciente exatamente como está escrito no exame
   (preserve maiúsculas/minúsculas e acentuação). Não invente —
   se o nome não estiver visível, use null.

2. resultadoHiv (use EXATAMENTE um destes códigos):
   • "nao_reagente" — quando o laudo diz: NÃO REAGENTE, NEGATIVO,
     NON-REACTIVE, AUSENTE, INDETECTÁVEL, < limite de detecção, ou
     equivalente. É o resultado esperado para PrEP.
   • "reagente" — REAGENTE, POSITIVO, REACTIVE, DETECTÁVEL, > corte.
   • "inconclusivo" — INCONCLUSIVO, INDETERMINADO, BORDERLINE,
     ZONA CINZENTA, NECESSÁRIO REPETIR.
   • "nao_identificado" — quando não conseguiu ler o resultado.

   ATENÇÃO: NÃO interprete valores de cargas virais sem rótulo.
   Confie no texto do laudo, não em números soltos.

3. resultadoTexto
   Copie LITERALMENTE como o resultado está escrito no laudo
   (ex.: "Não Reagente", "NEGATIVO", "Anti-HIV: NÃO REAGENTE - 0.12").
   Use null se não conseguiu ler.

4. dataColeta — formato "DD/MM/AAAA"
   Data em que o material biológico foi coletado.
   Rótulos típicos: "Data da coleta", "Coletado em", "Coleta:",
   "Data coleta", "Material coletado em".

5. dataResultado — formato "DD/MM/AAAA"
   Data em que o resultado/laudo foi emitido/liberado/assinado.
   Rótulos típicos: "Data de emissão", "Emitido em", "Liberado em",
   "Data de liberação", "Resultado liberado em", "Data do resultado",
   "Assinado em".

6. confianca — número de 0 a 1
   1.00 = laudo claro, todos os campos legíveis, sem ambiguidade
   0.85 = leitura boa, talvez 1 campo dúbio
   0.50 = imagem ruim ou laudo parcialmente ilegível
   0.00 = não conseguiu ler quase nada

═══════════════════════════════════════════════════════════════
REGRAS ANTI-ALUCINAÇÃO (CRÍTICAS)
═══════════════════════════════════════════════════════════════

• NUNCA invente datas. Se não conseguir ler com certeza, use null.
• NUNCA confunda data de nascimento, data de impressão do PDF,
  data de validade, ou data do convênio com as datas do exame.
• Datas válidas estão geralmente próximas a "hoje" — atualmente
  estamos em 2026. Datas de 2020, 2021, 2022 quase certamente
  são de nascimento.
• Se houver apenas UMA data no laudo, coloque-a em ambas
  (dataColeta E dataResultado).
• Se o nome no exame difere visualmente do que você espera,
  copie EXATAMENTE como está — não corrija.
• Se a imagem está borrada/cortada, abaixe a confiança.

═══════════════════════════════════════════════════════════════
FORMATO DA RESPOSTA — APENAS JSON, SEM TEXTO EXTRA
═══════════════════════════════════════════════════════════════

{
  "tipoExameDetectado": "hiv",
  "nomeExame": "JOÃO DA SILVA SAUDE",
  "resultadoHiv": "nao_reagente",
  "resultadoTexto": "Anti-HIV 1+2: Não Reagente",
  "dataColeta": "24/04/2026",
  "dataResultado": "25/04/2026",
  "confianca": 0.95
}`

  const fileContent = isPdf
    ? { type: 'document', source: { type: 'url', url: imageUrl } }
    : { type: 'image', source: { type: 'url', url: imageUrl } }

  let response: Response
  try {
    response = await fetch(`${env.BUILT_IN_FORGE_API_URL}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.BUILT_IN_FORGE_API_KEY ?? '',
        'anthropic-version': '2023-06-01',
      },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        // Sonnet 4.6: vision mais robusta para texto manuscrito/digitalizado
        // que Haiku. Custo é maior, mas exames são raros e o impacto de
        // erro é alto (paciente recebe PrEP errado). Mantemos Haiku como
        // fallback se Sonnet estiver indisponível.
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        messages: [
          {
            role: 'user',
            content: [
              fileContent,
              { type: 'text', text: prompt },
            ],
          },
        ],
      }),
    })
  } catch (fetchErr) {
    throw new Error(`Falha na requisição à API de IA: ${(fetchErr as Error).message}`)
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    logger.error('[examValidation] API IA respondeu erro', { status: response.status, body: body.slice(0, 500), isPdf })
    throw new Error(`Erro na análise por IA (HTTP ${response.status}): ${body.slice(0, 200)}`)
  }

  const data = (await response.json()) as { content: Array<{ text: string }> }
  const text = data.content[0]?.text ?? '{}'

  try {
    // Modelos vision às vezes embrulham o JSON em ```json ... ```. Extrai bloco.
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const jsonStr = jsonMatch ? jsonMatch[0] : text
    const parsed = JSON.parse(jsonStr) as Partial<Omit<ExtracacaoExame, 'processadoEm'>>
    const dataColeta = parsed.dataColeta ?? null
    const dataResultado = parsed.dataResultado ?? null
    // dataExame efetiva = a mais recente entre coleta e resultado (ou a única que existir).
    // Garante que exames com coleta antiga mas resultado liberado recente passem na regra de 7 dias.
    const dColeta = dataColeta ? parseDateBR(dataColeta) : null
    const dResult = dataResultado ? parseDateBR(dataResultado) : null
    let dataExameEfetiva: string | null = null
    if (dColeta && dResult) {
      dataExameEfetiva = dColeta >= dResult ? dataColeta : dataResultado
    } else {
      dataExameEfetiva = dataColeta ?? dataResultado
    }
    const tipoDetectado = parsed.tipoExameDetectado ?? 'nao_identificado'
    return {
      tipoExameDetectado: ['hiv', 'outro', 'nao_identificado'].includes(tipoDetectado)
        ? tipoDetectado as 'hiv' | 'outro' | 'nao_identificado'
        : 'nao_identificado',
      nomeExame: parsed.nomeExame ?? null,
      resultadoHiv: parsed.resultadoHiv ?? 'nao_identificado',
      resultadoTexto: parsed.resultadoTexto ?? null,
      dataColeta,
      dataResultado,
      dataExame: dataExameEfetiva,
      confianca: typeof parsed.confianca === 'number' ? Math.max(0, Math.min(1, parsed.confianca)) : 0,
      processadoEm: new Date().toISOString(),
    }
  } catch (parseErr) {
    logger.error('[examValidation] Falha ao parsear resposta da IA', { error: (parseErr as Error).message, textPreview: text.slice(0, 300) })
    return {
      tipoExameDetectado: 'nao_identificado',
      nomeExame: null,
      resultadoHiv: 'nao_identificado',
      resultadoTexto: null,
      dataColeta: null,
      dataResultado: null,
      dataExame: null,
      confianca: 0,
      processadoEm: new Date().toISOString(),
    }
  }
}

// ─── Date validation (no AI involved) ────────────────────────────────────────

export function parseDateBR(dataStr: string): Date | null {
  // Aceita "DD/MM/AAAA" mesmo com sufixos como horário ("24/04/2026 - 13:16:00")
  // ou texto adicional. Pega a primeira ocorrência válida.
  // Usa Date.UTC para ancorar a meia-noite e evitar shift de fuso quando o
  // servidor roda em UTC e o paciente está em BRT.
  const match = dataStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!match) return null
  const [, dd, mm, yyyy] = match
  const d = new Date(Date.UTC(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd)))
  if (isNaN(d.getTime())) return null
  return d
}

// Janela inclusiva: aceita exames com idade entre 0 e `diasMaximos` dias
// (ex.: 7 dias inclusive). "Hoje" é calculado no calendário de São Paulo,
// não no fuso do servidor — Railway roda em UTC, e a partir de 21:00 BRT
// "hoje" no servidor já era o dia seguinte, encurtando a janela em 1 dia.
export function isDataValida(dataExame: Date | null, diasMaximos = 7): boolean {
  if (!dataExame) return false
  const hojeBR = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  const [y, m, d] = hojeBR.split('-').map(Number)
  const hojeUTC = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999))
  const limiteUTC = new Date(Date.UTC(y, m - 1, d - diasMaximos, 0, 0, 0, 0))
  return dataExame >= limiteUTC && dataExame <= hojeUTC
}
