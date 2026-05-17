/**
 * Obsidian integration — publica notas Markdown no vault do médico via GitHub API.
 *
 * Fluxo: CIS gera conteúdo → obsidian.ts formata como .md → GitHub API → Obsidian Git pull
 *
 * Estrutura de pastas no vault:
 *   CIS/SOAP/          → notas de consulta (CIS-02a)
 *   CIS/Evidencias/    → sínteses PubMed (CIS-03)
 *   CIS/Alertas/       → divergências de conduta (CIS-06)
 *   CIS/Digests/       → resumos diário/semanal/mensal (CIS-07/08/09)
 *   CIS/Series/        → rascunhos de série de casos (CIS-10)
 *   CIS/Revisoes/      → revisões de literatura (CIS-11)
 */

import { env } from './_core/env.ts'
import { logger } from './_core/logger.ts'
import type { KnowledgeMetadata, ResultadoDivergenciaConducta } from './clinicalIntelligence.ts'

// ─── Config ───────────────────────────────────────────────────────────────────

const GITHUB_API = 'https://api.github.com'

export function obsidianDisponivel(): boolean {
  return Boolean(env.OBSIDIAN_GITHUB_TOKEN && env.OBSIDIAN_GITHUB_REPO)
}

function ghHeaders(): Record<string, string> {
  return {
    Authorization: `token ${env.OBSIDIAN_GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  }
}

// ─── GitHub API ───────────────────────────────────────────────────────────────

async function getSha(path: string): Promise<string | null> {
  const url = `${GITHUB_API}/repos/${env.OBSIDIAN_GITHUB_REPO}/contents/${encodeURIComponent(path)}`
  const res = await fetch(url, { headers: ghHeaders(), signal: AbortSignal.timeout(8_000) })
  if (res.status === 404) return null
  if (!res.ok) return null
  const data = await res.json() as { sha?: string }
  return data.sha ?? null
}

/**
 * Cria ou atualiza um arquivo no repositório GitHub do vault Obsidian.
 * Se o arquivo já existir, sobrescreve (útil para notas que acumulam conteúdo).
 */
export async function publicarNotaObsidian(params: {
  path: string      // caminho relativo no vault, ex: "CIS/SOAP/2026-05-17-B20.md"
  conteudo: string  // markdown completo
  mensagemCommit?: string
}): Promise<boolean> {
  if (!obsidianDisponivel()) return false

  const sha = await getSha(params.path)
  const body: Record<string, string> = {
    message: params.mensagemCommit ?? `CIS: ${params.path}`,
    content: Buffer.from(params.conteudo, 'utf-8').toString('base64'),
  }
  if (sha) body['sha'] = sha

  try {
    const res = await fetch(
      `${GITHUB_API}/repos/${env.OBSIDIAN_GITHUB_REPO}/contents/${encodeURIComponent(params.path)}`,
      { method: 'PUT', headers: ghHeaders(), body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) },
    )
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      logger.warn('[obsidian] Falha ao publicar nota', { path: params.path, status: res.status, txt: txt.slice(0, 200) })
      return false
    }
    logger.info('[obsidian] Nota publicada', { path: params.path })
    return true
  } catch (err) {
    logger.warn('[obsidian] Erro ao publicar nota', { path: params.path, err: String(err) })
    return false
  }
}

// ─── Helpers de data ──────────────────────────────────────────────────────────

function dataHoje(): string {
  return new Date().toISOString().slice(0, 10)
}

function dataHoraAgora(): string {
  return new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

// ─── Formatadores por tipo de nota ───────────────────────────────────────────

/** CIS-02a + CIS-02b: SOAP + metadados clínicos */
export async function publicarNotaSOAP(params: {
  soapNoteId: number
  soapTexto: string
  metadata: KnowledgeMetadata
  pacienteRef?: string  // ex: "Paciente 001" — nunca nome real
}): Promise<boolean> {
  const diag = metadata.diagnostico_principal
  const cid = diag?.cid10?.replace('.', '') ?? 'SEM-CID'
  const data = dataHoje()
  const path = `CIS/SOAP/${data}-${cid}-${params.soapNoteId}.md`

  const tags = [
    'soap',
    cid.toLowerCase(),
    metadata.perfil_paciente.imunocomprometido ? 'imunocomprometido' : null,
    ...metadata.tags.slice(0, 5),
  ].filter(Boolean).map(t => `  - ${t}`).join('\n')

  const antibioticos = metadata.conduta.antibioticos.length > 0
    ? metadata.conduta.antibioticos.map(a => `- ${a.nome} ${a.dose} ${a.via} ${a.frequencia} × ${a.duracao_dias}d`).join('\n')
    : '_Nenhum antibiótico documentado_'

  const markdown = `---
tipo: soap
data: ${data}
soapNoteId: ${params.soapNoteId}
diagnostico: "${diag?.nome ?? 'Não definido'}"
cid10: "${diag?.cid10 ?? ''}"
certeza: ${diag?.certeza ?? 'suspeito'}
template: ${metadata.conduta.nivel_cuidado}
tags:
${tags}
gerado_em: "${dataHoraAgora()}"
---

# SOAP — ${diag?.nome ?? 'Consulta'} (${diag?.cid10 ?? ''})
> ${params.pacienteRef ?? 'Paciente'} · ${data}

${params.soapTexto}

---

## Metadados Clínicos

**Diagnóstico principal:** ${diag?.nome} \`${diag?.cid10}\` — ${diag?.certeza}
**Nível de cuidado:** ${metadata.conduta.nivel_cuidado}
**Internação indicada:** ${metadata.conduta.internacao_indicada ? 'Sim' : 'Não'}

### Conduta antibiótica
${antibioticos}

### Busca PubMed sugerida
\`\`\`
${metadata.busca_pubmed?.query_sugerida ?? 'Não gerada'}
\`\`\`

${metadata.caso_atipico.atipico ? `### ⚠️ Caso Atípico\n${metadata.caso_atipico.criterios_objetivos.map(c => `- ${c}`).join('\n')}\n**Tipo sugerido:** ${metadata.caso_atipico.tipo_sugerido}` : ''}
`

  return publicarNotaObsidian({ path, conteudo: markdown, mensagemCommit: `soap(${cid}): nota #${params.soapNoteId}` })
}

/** CIS-03: Síntese de artigos PubMed */
export async function publicarNotaSintese(params: {
  soapNoteId: number
  diagnostico: string
  cid10: string
  sinteseTexto: string
  nArtigos: number
}): Promise<boolean> {
  const cid = params.cid10.replace('.', '')
  const data = dataHoje()
  const path = `CIS/Evidencias/${data}-${cid}-sintese-${params.soapNoteId}.md`

  const markdown = `---
tipo: sintese-pubmed
data: ${data}
soapNoteId: ${params.soapNoteId}
diagnostico: "${params.diagnostico}"
cid10: "${params.cid10}"
artigos: ${params.nArtigos}
tags:
  - evidencia
  - pubmed
  - ${cid.toLowerCase()}
gerado_em: "${dataHoraAgora()}"
---

# Síntese de Evidências — ${params.diagnostico}
> ${params.nArtigos} artigo(s) · ${data} · SOAP #${params.soapNoteId}

${params.sinteseTexto}
`

  return publicarNotaObsidian({ path, conteudo: markdown, mensagemCommit: `sintese(${cid}): ${params.nArtigos} artigos #${params.soapNoteId}` })
}

/** CIS-06: Alerta de divergência de conduta */
export async function publicarAlertaConduta(params: {
  soapNoteId: number
  diagnostico: string
  cid10: string
  alerta: ResultadoDivergenciaConducta
}): Promise<boolean> {
  if (!params.alerta.tem_divergencia) return false

  const cid = params.cid10.replace('.', '')
  const data = dataHoje()
  const urgencia = params.alerta.nivel_urgencia ?? 'baixo'
  const emoji = urgencia === 'alto' ? '🔴' : urgencia === 'medio' ? '🟡' : '🟢'
  const path = `CIS/Alertas/${data}-${cid}-${urgencia}-${params.soapNoteId}.md`

  const divergencias = params.alerta.divergencias.map(d =>
    `### ${d.aspecto}\n- **Conduta atual:** ${d.conduta_atual}\n- **Evidência recomenda:** ${d.evidencia_recomenda}\n- **Justificativa:** ${d.justificativa}\n- **GRADE:** ${d.grade} · ${d.forca_recomendacao}\n- **Fonte:** ${d.fonte}`
  ).join('\n\n')

  const markdown = `---
tipo: alerta-conduta
data: ${data}
soapNoteId: ${params.soapNoteId}
diagnostico: "${params.diagnostico}"
cid10: "${params.cid10}"
urgencia: ${urgencia}
hash_alerta: "${params.alerta.hash_alerta ?? ''}"
tags:
  - alerta
  - conduta
  - ${cid.toLowerCase()}
  - urgencia-${urgencia}
gerado_em: "${dataHoraAgora()}"
---

# ${emoji} Alerta de Conduta — ${params.diagnostico}
> Urgência: **${urgencia.toUpperCase()}** · SOAP #${params.soapNoteId} · ${data}

## Mensagem
${params.alerta.mensagem_para_medico ?? '_Sem mensagem_'}

## Divergências Detectadas

${divergencias}
`

  return publicarNotaObsidian({ path, conteudo: markdown, mensagemCommit: `alerta(${urgencia}/${cid}): #${params.soapNoteId}` })
}

/** CIS-07/08/09: Digests diário, semanal e mensal */
export async function publicarDigest(params: {
  tipo: 'diario' | 'semanal' | 'mensal'
  periodoRef: string  // ex: "2026-05-17", "2026-W20", "2026-05"
  texto: string
}): Promise<boolean> {
  const path = `CIS/Digests/${params.periodoRef}-${params.tipo}.md`
  const tipoLabel = { diario: 'Digest Diário', semanal: 'Digest Semanal', mensal: 'Digest Mensal' }[params.tipo]

  const markdown = `---
tipo: digest-${params.tipo}
periodo: "${params.periodoRef}"
tags:
  - digest
  - ${params.tipo}
gerado_em: "${dataHoraAgora()}"
---

# ${tipoLabel} — ${params.periodoRef}

${params.texto}
`

  return publicarNotaObsidian({ path, conteudo: markdown, mensagemCommit: `digest(${params.tipo}): ${params.periodoRef}` })
}

/** CIS-10: Rascunho de série de casos */
export async function publicarSerieCasos(params: {
  diagnostico: string
  cid10: string
  nCasos: number
  texto: string
}): Promise<boolean> {
  const cid = params.cid10.replace('.', '')
  const data = dataHoje()
  const path = `CIS/Series/${cid}-serie-${params.nCasos}casos-${data}.md`

  const markdown = `---
tipo: serie-casos
data: ${data}
diagnostico: "${params.diagnostico}"
cid10: "${params.cid10}"
n_casos: ${params.nCasos}
status: rascunho
tags:
  - serie-casos
  - publicacao
  - ${cid.toLowerCase()}
gerado_em: "${dataHoraAgora()}"
---

# Série de Casos — ${params.diagnostico} (n=${params.nCasos})
> Rascunho gerado em ${data} · Requer TCLE + aprovação CEP antes da submissão

${params.texto}
`

  return publicarNotaObsidian({ path, conteudo: markdown, mensagemCommit: `serie(${cid}): rascunho ${params.nCasos} casos` })
}

/** CIS-11: Revisão narrativa de literatura */
export async function publicarRevisaoLiteratura(params: {
  tema: string
  nArtigos: number
  texto: string
}): Promise<boolean> {
  const data = dataHoje()
  const slug = params.tema.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)
  const path = `CIS/Revisoes/${data}-${slug}.md`

  const markdown = `---
tipo: revisao-literatura
data: ${data}
tema: "${params.tema}"
n_artigos: ${params.nArtigos}
tags:
  - revisao
  - literatura
gerado_em: "${dataHoraAgora()}"
---

# Revisão de Literatura — ${params.tema}
> ${params.nArtigos} artigo(s) · ${data}

${params.texto}
`

  return publicarNotaObsidian({ path, conteudo: markdown, mensagemCommit: `revisao: ${params.tema.slice(0, 50)}` })
}
