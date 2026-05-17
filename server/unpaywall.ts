/**
 * Unpaywall client — busca texto completo (open access) de artigos por DOI.
 *
 * API gratuita, sem chave — só exige e-mail para identificação.
 * Limites: 100k requisições/dia (mais que suficiente para uso clínico).
 *
 * Uso no CIS:
 *  - Enriquece artigos do PubMed com URL de PDF/HTML quando disponível
 *  - Prompt 03 passa a receber texto completo quando open access, não só abstract
 */

import { env } from './_core/env.ts'
import { logger } from './_core/logger.ts'
import type { ArtigoPubMed } from './pubmed.ts'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TextoCompletoInfo {
  doi: string
  is_oa: boolean
  url_pdf: string | null
  url_html: string | null
  licenca: string | null
  versao: 'publisher' | 'repository' | 'preprint' | null
}

export interface ArtigoPubMedEnriquecido extends ArtigoPubMed {
  texto_completo: TextoCompletoInfo | null
}

interface UnpaywallLocation {
  url: string | null
  url_for_pdf: string | null
  host_type: string | null
  license: string | null
  version: string | null
}

interface UnpaywallResponse {
  doi: string
  is_oa: boolean
  best_oa_location: UnpaywallLocation | null
}

// ─── Config ───────────────────────────────────────────────────────────────────

const UNPAYWALL_BASE = 'https://api.unpaywall.org/v2'
const DELAY_ENTRE_REQUESTS_MS = 200  // respeita limite de taxa sem agressividade

function unpaywallDisponivel(): boolean {
  return Boolean(env.UNPAYWALL_EMAIL)
}

// ─── Core ─────────────────────────────────────────────────────────────────────

/**
 * Busca informações de acesso aberto para um DOI específico.
 * Retorna null se o artigo não tiver versão open access ou se o DOI for inválido.
 */
export async function buscarTextoCompleto(doi: string): Promise<TextoCompletoInfo | null> {
  if (!unpaywallDisponivel() || !doi?.trim()) return null

  const url = `${UNPAYWALL_BASE}/${encodeURIComponent(doi)}?email=${encodeURIComponent(env.UNPAYWALL_EMAIL!)}`

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) })

    // 404 = DOI não encontrado no Unpaywall (comum para artigos sem DOI registrado)
    if (res.status === 404) return null

    if (!res.ok) {
      logger.warn('[unpaywall] Requisição falhou', { doi, status: res.status })
      return null
    }

    const data = (await res.json()) as UnpaywallResponse

    if (!data.is_oa || !data.best_oa_location) {
      return { doi, is_oa: false, url_pdf: null, url_html: null, licenca: null, versao: null }
    }

    const loc = data.best_oa_location
    const versao = loc.host_type === 'publisher'
      ? 'publisher'
      : loc.version?.includes('preprint')
        ? 'preprint'
        : 'repository'

    return {
      doi,
      is_oa: true,
      url_pdf: loc.url_for_pdf ?? null,
      url_html: loc.url ?? null,
      licenca: loc.license ?? null,
      versao,
    }
  } catch (err) {
    logger.warn('[unpaywall] Erro ao buscar DOI', { doi, err: String(err) })
    return null
  }
}

/**
 * Enriquece uma lista de artigos PubMed com informações de texto completo.
 * Processa sequencialmente com delay para respeitar a API.
 * Artigos sem DOI são retornados com texto_completo: null.
 */
export async function enriquecerArtigos(
  artigos: ArtigoPubMed[],
): Promise<ArtigoPubMedEnriquecido[]> {
  if (!unpaywallDisponivel()) {
    return artigos.map(a => ({ ...a, texto_completo: null }))
  }

  const resultado: ArtigoPubMedEnriquecido[] = []

  for (const artigo of artigos) {
    const textoCompleto = artigo.doi
      ? await buscarTextoCompleto(artigo.doi)
      : null

    resultado.push({ ...artigo, texto_completo: textoCompleto })

    if (artigo.doi) {
      await new Promise(resolve => setTimeout(resolve, DELAY_ENTRE_REQUESTS_MS))
    }
  }

  const comAcesso = resultado.filter(a => a.texto_completo?.is_oa).length
  logger.info('[unpaywall] Artigos enriquecidos', {
    total: artigos.length,
    com_acesso_aberto: comAcesso,
  })

  return resultado
}

// ─── Formatação para prompts ──────────────────────────────────────────────────

/**
 * Formata artigos enriquecidos para injeção em prompts do CIS.
 * Indica claramente quando há texto completo disponível vs só abstract.
 */
export function formatarArtigosEnriquecidosParaPrompt(
  artigos: ArtigoPubMedEnriquecido[],
): string {
  if (artigos.length === 0) return 'Nenhum artigo disponível.'

  return artigos.map((artigo, i) => {
    const autores = artigo.autores.slice(0, 3).join(', ') + (artigo.autores.length > 3 ? ' et al.' : '')
    const header = `[${i + 1}] PMID ${artigo.pmid} — ${autores}. "${artigo.titulo}". ${artigo.revista}. ${artigo.ano}.`

    const oa = artigo.texto_completo
    let acesso = '⚠️ Apenas abstract disponível.'

    if (oa?.is_oa) {
      const tipo = oa.versao === 'publisher' ? 'versão do editor' : oa.versao === 'preprint' ? 'preprint' : 'repositório'
      const licenca = oa.licenca ? ` (${oa.licenca})` : ''
      acesso = `✅ Texto completo open access — ${tipo}${licenca}.`
      if (oa.url_pdf) acesso += ` PDF: ${oa.url_pdf}`
    }

    const conteudo = artigo.abstract
      ? `Abstract: ${artigo.abstract}`
      : 'Abstract não disponível.'

    return `${header}\n${acesso}\n${conteudo}`
  }).join('\n\n---\n\n')
}
