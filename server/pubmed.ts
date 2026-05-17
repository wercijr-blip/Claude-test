import { env } from './_core/env.ts'
import { logger } from './_core/logger.ts'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ArtigoPubMed {
  pmid: string
  titulo: string
  autores: string[]
  revista: string
  ano: string
  abstract: string
  doi: string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EUTILS_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'
const DEFAULT_MAX_ARTIGOS = 5
const DEFAULT_MAX_ARTIGOS_DUAL = 10

// Without API key: 3 req/s. With key: 10 req/s.
// We fetch in two sequential calls (esearch → efetch) so no explicit throttle needed.
function apiKeyParam(): string {
  return env.NCBI_API_KEY ? `&api_key=${env.NCBI_API_KEY}` : ''
}

// ── esearch: query → list of PMIDs ────────────────────────────────────────────

async function esearch(query: string, retmax: number): Promise<string[]> {
  const url =
    `${EUTILS_BASE}/esearch.fcgi?db=pubmed&retmode=json&retmax=${retmax}` +
    `&term=${encodeURIComponent(query)}${apiKeyParam()}`

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`esearch HTTP ${res.status}`)

  const json = (await res.json()) as { esearchresult?: { idlist?: string[] } }
  return json.esearchresult?.idlist ?? []
}

// ── efetch MEDLINE: PMIDs → raw text ─────────────────────────────────────────

async function efetch(pmids: string[]): Promise<string> {
  if (pmids.length === 0) return ''

  const url =
    `${EUTILS_BASE}/efetch.fcgi?db=pubmed&rettype=medline&retmode=text` +
    `&id=${pmids.join(',')}${apiKeyParam()}`

  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`efetch HTTP ${res.status}`)

  return res.text()
}

// ── MEDLINE parser ────────────────────────────────────────────────────────────
//
// MEDLINE format uses tagged lines: "TAG - value". Multi-line values are
// continuation lines that start with 6 spaces. Each record is separated
// by a blank line. We collect all tag→value pairs and map them to ArtigoPubMed.

interface MedlineRecord {
  [tag: string]: string[]
}

function parseMedline(raw: string): MedlineRecord[] {
  const records: MedlineRecord[] = []
  let current: MedlineRecord = {}
  let lastTag = ''

  for (const line of raw.split('\n')) {
    if (line.trim() === '') {
      if (Object.keys(current).length > 0) {
        records.push(current)
        current = {}
        lastTag = ''
      }
      continue
    }

    // Tagged line: "TAG - value" (tag is 2-4 chars, then " - ")
    const match = /^([A-Z]{2,4})\s+-\s+(.*)$/.exec(line)
    if (match) {
      lastTag = match[1]!
      if (!current[lastTag]) current[lastTag] = []
      current[lastTag]!.push(match[2]!.trim())
    } else if (line.startsWith('      ') && lastTag) {
      // Continuation of previous tag
      const prev = current[lastTag]
      if (prev && prev.length > 0) {
        prev[prev.length - 1] += ' ' + line.trim()
      }
    }
  }

  if (Object.keys(current).length > 0) records.push(current)
  return records
}

function recordToArtigo(rec: MedlineRecord): ArtigoPubMed | null {
  const pmid = rec['PMID']?.[0]?.trim()
  const titulo = rec['TI']?.join(' ').trim()
  if (!pmid || !titulo) return null

  const autores = (rec['AU'] ?? []).map((a) => a.trim()).filter(Boolean)
  const revista = rec['TA']?.[0]?.trim() ?? rec['JT']?.[0]?.trim() ?? ''
  const dp = rec['DP']?.[0]?.trim() ?? ''
  const ano = /\d{4}/.exec(dp)?.[0] ?? ''
  const abstract = rec['AB']?.join(' ').trim() ?? ''

  // AID lines look like "10.1234/... [doi]"
  const doiLine = (rec['AID'] ?? []).find((l) => l.includes('[doi]'))
  const doi = doiLine ? doiLine.replace(/\s*\[doi\].*$/, '').trim() : null

  return { pmid, titulo, autores, revista, ano, abstract, doi }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Search PubMed and return parsed articles.
 * Uses esearch → efetch MEDLINE pipeline.
 */
export async function buscarArtigosPubMed(
  query: string,
  maxArtigos = DEFAULT_MAX_ARTIGOS,
): Promise<ArtigoPubMed[]> {
  try {
    const pmids = await esearch(query, maxArtigos)
    if (pmids.length === 0) {
      logger.info('[pubmed] esearch retornou 0 resultados', { query })
      return []
    }

    const raw = await efetch(pmids)
    const records = parseMedline(raw)
    const artigos = records.map(recordToArtigo).filter((a): a is ArtigoPubMed => a !== null)

    logger.info('[pubmed] busca concluída', { query, found: artigos.length })
    return artigos
  } catch (err) {
    logger.error('[pubmed] erro na busca', { query, err })
    return []
  }
}

/**
 * Busca dual: query livre + query MeSH em paralelo, com deduplicação por PMID.
 * Garante cobertura maior: a query livre captura artigos recentes ainda sem indexação
 * MeSH completa; a query MeSH garante precisão nos artigos já indexados.
 */
export async function buscarArtigosDual(
  query: string,
  termosMesh: string[],
  maxArtigos = DEFAULT_MAX_ARTIGOS_DUAL,
): Promise<ArtigoPubMed[]> {
  try {
    const meshQuery = termosMesh.length > 0
      ? termosMesh.map(t => `"${t}"[MeSH Terms]`).join(' AND ')
      : null

    // Busca livre + MeSH em paralelo; cada uma pede metade do máximo
    const perBusca = Math.ceil(maxArtigos / 2)
    const [pmidsFree, pmidsMesh] = await Promise.all([
      esearch(query, perBusca),
      meshQuery ? esearch(meshQuery, perBusca) : Promise.resolve([] as string[]),
    ])

    // Deduplicação preservando ordem: livre primeiro (mais recentes), depois MeSH exclusivos
    const seen = new Set<string>()
    const merged: string[] = []
    for (const id of [...pmidsFree, ...pmidsMesh]) {
      if (!seen.has(id)) { seen.add(id); merged.push(id) }
    }
    const pmids = merged.slice(0, maxArtigos)

    if (pmids.length === 0) {
      logger.info('[pubmed] buscarArtigosDual retornou 0 resultados', { query, meshQuery })
      return []
    }

    const raw = await efetch(pmids)
    const records = parseMedline(raw)
    const artigos = records.map(recordToArtigo).filter((a): a is ArtigoPubMed => a !== null)

    logger.info('[pubmed] buscarArtigosDual concluída', {
      query,
      termosMesh: termosMesh.length,
      pmidsUnicos: pmids.length,
      artigos: artigos.length,
    })
    return artigos
  } catch (err) {
    logger.error('[pubmed] erro em buscarArtigosDual', { query, err })
    return []
  }
}

/**
 * Format articles for injection into Claude prompts (03 and 11).
 * Produces a compact numbered list with metadata + abstract.
 */
export function formatarArtigosParaPrompt(artigos: ArtigoPubMed[]): string {
  if (artigos.length === 0) return 'Nenhum artigo encontrado no PubMed para esta consulta.'

  return artigos
    .map((a, i) => {
      const autoresStr = a.autores.length > 0
        ? a.autores.slice(0, 3).join(', ') + (a.autores.length > 3 ? ' et al.' : '')
        : 'Autores desconhecidos'
      const doiStr = a.doi ? `DOI: ${a.doi}` : `PMID: ${a.pmid}`
      const abstractStr = a.abstract
        ? `\nAbstract: ${a.abstract.slice(0, 800)}${a.abstract.length > 800 ? '…' : ''}`
        : ''

      return `[${i + 1}] ${a.titulo}\n${autoresStr}. ${a.revista}. ${a.ano}. ${doiStr}${abstractStr}`
    })
    .join('\n\n---\n\n')
}
