/**
 * Zotero API client — integração com biblioteca pessoal do médico.
 *
 * Usos no CIS:
 *  - Prompt 03 (síntese PubMed): enriquece com referências salvas no Zotero
 *  - Prompt 10 (série de casos): puxa referências relevantes por tag/CID
 *  - Prompt 11 (revisão): combina PubMed + Zotero numa base única
 *  - salvarArtigoPubMed: persiste artigos encontrados pelo CIS na biblioteca Zotero
 */

import { env } from './_core/env.ts'
import { logger } from './_core/logger.ts'
import type { ArtigoPubMed } from './pubmed.ts'
import { CircuitBreaker } from './_core/circuitBreaker.ts'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ZoteroItem {
  key: string
  pmid: string | null
  titulo: string
  autores: string[]
  revista: string
  ano: string
  abstract: string
  doi: string | null
  url: string | null
  tags: string[]
}

interface ZoteroApiItem {
  key: string
  data: {
    itemType: string
    title?: string
    creators?: Array<{ creatorType: string; firstName?: string; lastName?: string; name?: string }>
    abstractNote?: string
    publicationTitle?: string
    date?: string
    DOI?: string
    url?: string
    extra?: string
    tags?: Array<{ tag: string }>
  }
}

// ─── Config ───────────────────────────────────────────────────────────────────

const ZOTERO_BASE = 'https://api.zotero.org'
const TAG_AUTO = 'cis-auto'  // tag aplicada aos artigos salvos automaticamente pelo CIS
const zoteroCircuit = new CircuitBreaker('zotero')

function headers(): Record<string, string> {
  return {
    'Zotero-API-Key': env.ZOTERO_API_KEY!,
    'Zotero-API-Version': '3',
    'Content-Type': 'application/json',
  }
}

function userBase(): string {
  return `${ZOTERO_BASE}/users/${env.ZOTERO_USER_ID}`
}

/** Retorna false se as variáveis de ambiente do Zotero não estiverem configuradas. */
export function zoteroDisponivel(): boolean {
  return Boolean(env.ZOTERO_API_KEY && env.ZOTERO_USER_ID)
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

function parseItem(raw: ZoteroApiItem): ZoteroItem {
  const d = raw.data
  const autores = (d.creators ?? [])
    .filter(c => c.creatorType === 'author')
    .map(c => c.name ?? [c.lastName, c.firstName].filter(Boolean).join(', '))

  // PMID pode estar em d.extra: "PMID: 12345678\n..."
  const pmidMatch = d.extra?.match(/PMID:\s*(\d+)/i)

  return {
    key: raw.key,
    pmid: pmidMatch?.[1] ?? null,
    titulo: d.title ?? '',
    autores,
    revista: d.publicationTitle ?? '',
    ano: (d.date ?? '').slice(0, 4),
    abstract: d.abstractNote ?? '',
    doi: d.DOI ?? null,
    url: d.url ?? null,
    tags: (d.tags ?? []).map(t => t.tag),
  }
}

// ─── Busca ────────────────────────────────────────────────────────────────────

/**
 * Busca itens na biblioteca pessoal por query de texto livre.
 * Útil para complementar busca PubMed com referências já salvas pelo médico.
 */
export async function buscarReferenciasPorQuery(
  query: string,
  limit = 10,
): Promise<ZoteroItem[]> {
  if (!zoteroDisponivel()) return []
  if (zoteroCircuit.isOpen()) return []

  const url = `${userBase()}/items?q=${encodeURIComponent(query)}&itemType=journalArticle&limit=${limit}&format=json`

  try {
    const res = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(10_000) })
    if (!res.ok) {
      logger.warn('[zotero] buscarReferenciasPorQuery falhou', { status: res.status, query })
      zoteroCircuit.recordFailure()
      return []
    }
    const items = (await res.json()) as ZoteroApiItem[]
    zoteroCircuit.recordSuccess()
    return items.map(parseItem)
  } catch (err) {
    logger.warn('[zotero] buscarReferenciasPorQuery erro', { query, err: String(err) })
    zoteroCircuit.recordFailure()
    return []
  }
}

/**
 * Busca itens por tag — ex: tag por CID-10 ("B20", "J18.9") ou especialidade.
 * O médico pode organizar sua biblioteca Zotero com tags por diagnóstico.
 */
export async function buscarReferenciasPorTag(
  tag: string,
  limit = 20,
): Promise<ZoteroItem[]> {
  if (!zoteroDisponivel()) return []
  if (zoteroCircuit.isOpen()) return []

  const url = `${userBase()}/items?tag=${encodeURIComponent(tag)}&itemType=journalArticle&limit=${limit}&format=json`

  try {
    const res = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(10_000) })
    if (!res.ok) {
      logger.warn('[zotero] buscarReferenciasPorTag falhou', { status: res.status, tag })
      zoteroCircuit.recordFailure()
      return []
    }
    const items = (await res.json()) as ZoteroApiItem[]
    zoteroCircuit.recordSuccess()
    return items.map(parseItem)
  } catch (err) {
    logger.warn('[zotero] buscarReferenciasPorTag erro', { tag, err: String(err) })
    zoteroCircuit.recordFailure()
    return []
  }
}

// ─── Salvar ───────────────────────────────────────────────────────────────────

/**
 * Salva um artigo encontrado pelo PubMed na biblioteca Zotero do médico.
 * Aplica tag 'cis-auto' para distinguir de referências adicionadas manualmente.
 * Se fornecidos, adiciona tags de CID-10 (ex: "B20") e template clínico (ex: "hiv_cronico").
 * Operação best-effort — falhas não bloqueiam o fluxo principal.
 */
export async function salvarArtigoPubMed(
  artigo: ArtigoPubMed,
  opcoes?: { cid10?: string; template?: string },
): Promise<boolean> {
  if (!zoteroDisponivel()) return false
  if (zoteroCircuit.isOpen()) return false

  const creators = artigo.autores.map(nome => {
    const partes = nome.split(/,\s*/)
    return {
      creatorType: 'author',
      lastName: partes[0] ?? nome,
      firstName: partes[1] ?? '',
    }
  })

  const tags: Array<{ tag: string }> = [{ tag: TAG_AUTO }, { tag: 'pubmed' }]
  if (opcoes?.cid10) tags.push({ tag: opcoes.cid10.replace('.', '').toUpperCase() })
  if (opcoes?.template) tags.push({ tag: opcoes.template })

  const payload = [{
    itemType: 'journalArticle',
    title: artigo.titulo,
    creators,
    abstractNote: artigo.abstract,
    publicationTitle: artigo.revista,
    date: artigo.ano,
    DOI: artigo.doi ?? '',
    url: artigo.doi ? `https://doi.org/${artigo.doi}` : '',
    extra: `PMID: ${artigo.pmid}`,
    tags,
  }]

  try {
    const res = await fetch(`${userBase()}/items`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      logger.warn('[zotero] salvarArtigoPubMed falhou', { status: res.status, pmid: artigo.pmid })
      zoteroCircuit.recordFailure()
      return false
    }
    logger.info('[zotero] Artigo salvo', { pmid: artigo.pmid, titulo: artigo.titulo.slice(0, 60) })
    zoteroCircuit.recordSuccess()
    return true
  } catch (err) {
    logger.warn('[zotero] salvarArtigoPubMed erro', { pmid: artigo.pmid, err: String(err) })
    zoteroCircuit.recordFailure()
    return false
  }
}

// ─── Formatação para prompts ──────────────────────────────────────────────────

/** Formata lista de itens Zotero em Vancouver para uso em prompts do CIS. */
export function formatarZoteroParaPrompt(items: ZoteroItem[]): string {
  if (items.length === 0) return 'Nenhuma referência encontrada na biblioteca Zotero.'

  return items.map((item, i) => {
    const autores = item.autores.length > 0
      ? item.autores.slice(0, 3).join(', ') + (item.autores.length > 3 ? ' et al.' : '')
      : 'Autores não disponíveis'
    const pmidStr = item.pmid ? ` PMID: ${item.pmid}.` : ''
    const doiStr = item.doi ? ` DOI: ${item.doi}.` : ''
    const abstract = item.abstract ? `\nAbstract: ${item.abstract.slice(0, 400)}${item.abstract.length > 400 ? '…' : ''}` : ''

    return `[Z${i + 1}] ${autores}. ${item.titulo}. ${item.revista}. ${item.ano}.${doiStr}${pmidStr}${abstract}`
  }).join('\n\n')
}
