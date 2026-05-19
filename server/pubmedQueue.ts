/**
 * pubmed-synthesis queue — BullMQ
 *
 * Disparado por evento após processarConsulta (scriba.ts).
 * Pipeline: buscarArtigosDual (query+MeSH, dedup, 10 art.) → sintetizarArtigosPubMed (Prompt 03)
 *           → salvar em soap_notes.sintese_evidencias
 *           → re-executar detectarDivergenciaConducta com síntese (best-effort)
 */

import { Queue, Worker } from 'bullmq'
import { sendToDlq } from './_core/dlq.ts'
import { env } from './_core/env.ts'
import { redis, QUEUE_PREFIX } from './_core/redis.ts'
import { db } from './db.ts'
import { soapNotes, conductAlerts } from '../drizzle/cis-schema.ts'
import { eq, and, isNotNull, desc, gt, ne, inArray } from 'drizzle-orm'
import { buscarArtigosDual } from './pubmed.ts'
import { enriquecerArtigos, formatarArtigosEnriquecidosParaPrompt } from './unpaywall.ts'
import { buscarReferenciasPorQuery, salvarArtigoPubMed, formatarZoteroParaPrompt } from './zotero.ts'
import { sintetizarArtigosPubMed, detectarDivergenciaConducta, type FeedbackHistoricoItem } from './clinicalIntelligence.ts'
import { publicarNotaSintese, publicarAlertaConduta } from './obsidian.ts'
import { notificarAlertaConduta } from './n8n.ts'
import { logger } from './_core/logger.ts'

// ─── Configuração ─────────────────────────────────────────────────────────────

export const PUBMED_QUEUE_NAME = 'pubmed-synthesis'

const WORKER_OPTS = {
  lockDuration: 180_000,  // síntese pode levar até 3 min (PubMed + Claude)
  stalledInterval: 120_000,
  maxStalledCount: 1,
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 30 },
  drainDelay: 30, // 30s — mais responsivo que digest pois alimenta alertas
} as const

export const pubmedQueue = new Queue(PUBMED_QUEUE_NAME, {
  connection: redis,
  prefix: QUEUE_PREFIX,
})

// ─── Tipos de job ─────────────────────────────────────────────────────────────

export interface PubmedJobData {
  soapNoteId: number
  medicoId: number
  pubmedQuery: string
  diagnosticoPrincipal: string
  cid10: string
  soapTexto: string          // para compor soapResumido no Prompt 03
  condutaAtual: string       // extraído do soapTexto (seção Plan/Conduta)
  populacao: string          // extraído do knowledge_metadata
  perfilPacienteJson: string // JSON do perfil_paciente para Prompt 06
  template: string           // template clínico — tag automática no Zotero
  termosMesh: string[]       // termos MeSH gerados pelo Prompt 02b
  requestId?: string
}

// ─── Extrator de metadados de qualidade de evidência ─────────────────────────

interface EvidenceGradeMetadata {
  grade1A: number; grade1B: number
  grade2A: number; grade2B: number; grade2C: number
  grade3: number;  grade4: number;  grade5: number
  lacunas: string[]
  totalCitacoes: number
}

/** Extrai contagem de níveis GRADE e lacunas da síntese (Prompt 03) sem LLM. */
export function extrairGradeMetadata(sintese: string): EvidenceGradeMetadata {
  // Conta menções de cada nível GRADE no texto
  const gradeRe = /\bGRADE\s+(\d[A-C]?)\b/gi
  const counts: Record<string, number> = {}
  for (const m of sintese.matchAll(gradeRe)) {
    const k = m[1].toUpperCase()
    counts[k] = (counts[k] ?? 0) + 1
  }

  // Extrai bullets da seção "4a. Lacunas de cobertura"
  const lacunasMatch = sintese.match(/4a\.\s*Lacunas[^#\n]*\n([\s\S]*?)(?=\n##|\n\*\*4b\.|\n4b\.|\n---|\n# |$)/i)
  const lacunas = lacunasMatch
    ? [...lacunasMatch[1].matchAll(/^[-–•]\s+(.+)$/gm)].map(m => m[1].trim()).slice(0, 3)
    : []

  // Conta PMIDs únicos citados
  const pmids = new Set([...sintese.matchAll(/\[PMID\s+(\d+)\]/gi)].map(m => m[1]))

  return {
    grade1A: counts['1A'] ?? 0,
    grade1B: counts['1B'] ?? 0,
    grade2A: counts['2A'] ?? 0,
    grade2B: counts['2B'] ?? 0,
    grade2C: counts['2C'] ?? 0,
    grade3:  counts['3']  ?? 0,
    grade4:  counts['4']  ?? 0,
    grade5:  counts['5']  ?? 0,
    lacunas,
    totalCitacoes: pmids.size,
  }
}

// ─── Enqueue público ──────────────────────────────────────────────────────────

/**
 * Enfileira síntese PubMed para uma SOAP note.
 * jobId determinístico evita re-processamento se scriba rodar duas vezes.
 */
export async function enqueueSintesePubMed(params: PubmedJobData & { requestId?: string }): Promise<void> {
  if (!params.pubmedQuery?.trim()) return // sem query não há o que buscar

  await pubmedQueue.add('sintese-pubmed', params, {
    jobId: `pubmed-${params.soapNoteId}`,
    attempts: 2,
    backoff: { type: 'exponential', delay: 60_000 },
  })
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export function startPubmedWorker() {
  const worker = new Worker<PubmedJobData>(
    PUBMED_QUEUE_NAME,
    async (job) => {
      const { soapNoteId, medicoId, pubmedQuery, diagnosticoPrincipal, cid10, soapTexto, condutaAtual, populacao, perfilPacienteJson, template, termosMesh } = job.data
      const perfilPaciente = perfilPacienteJson ? JSON.parse(perfilPacienteJson) : undefined

      // 1. Buscar artigos PubMed; em paralelo já inicia busca Zotero (sem dependência entre si)
      const artigos = await buscarArtigosDual(pubmedQuery, termosMesh ?? [], 10)
      const artigosJson = JSON.stringify(artigos)

      // 1b. Unpaywall + Zotero em paralelo — ambos independentes entre si após PubMed
      const [artigosEnriquecidos, zoteroItems] = await Promise.all([
        enriquecerArtigos(artigos),
        buscarReferenciasPorQuery(`${diagnosticoPrincipal} ${cid10}`, 8).catch(() => {
          logger.warn('[pubmedQueue] Zotero indisponível — síntese prossegue sem biblioteca pessoal', { soapNoteId })
          return null
        }),
      ])
      const artigosFormatados = formatarArtigosEnriquecidosParaPrompt(artigosEnriquecidos)
      const zoteroReferencias = zoteroItems ? formatarZoteroParaPrompt(zoteroItems) : ''
      // Salva artigos PubMed no Zotero em fire-and-forget — não bloqueia síntese
      if (zoteroItems) {
        for (const artigo of artigos) salvarArtigoPubMed(artigo, { cid10, template }).catch(() => null)
      }

      // 2. Gerar síntese (Prompt 03)
      const soapResumido = soapTexto.slice(0, 3000)

      const sintese = await sintetizarArtigosPubMed({
        soapResumido,
        diagnostico: diagnosticoPrincipal,
        cid10,
        populacao,
        condutaAtual: condutaAtual,
        artigosJson: artigosFormatados,
        n: artigos.length,
        zoteroReferencias,
      })

      // 3. Salvar síntese + metadados de qualidade (GRADE, lacunas, citações)
      const evidenceMetadata = extrairGradeMetadata(sintese.texto)
      await db
        .update(soapNotes)
        .set({ sinteseEvidencias: sintese.texto, evidenceMetadata })
        .where(eq(soapNotes.id, soapNoteId))

      logger.info('[pubmedQueue] Síntese salva', {
        soapNoteId,
        requestId: job.data.requestId ?? undefined,
        artigos: artigos.length,
        grade1A: evidenceMetadata.grade1A,
        grade1B: evidenceMetadata.grade1B,
        lacunas: evidenceMetadata.lacunas.length,
      })

      // 3c. Verificar acumulação de casos — enfileira série se N ≥ 3 (best-effort)
      if (cid10 && diagnosticoPrincipal) {
        import('./caseSeriesQueue.ts')
          .then(({ checkCaseAccumulation }) => checkCaseAccumulation({ medicoId, cid10, diagnostico: diagnosticoPrincipal }))
          .catch(() => null)
      }

      // 3b. Publicar síntese no Obsidian (best-effort)
      publicarNotaSintese({
        soapNoteId,
        diagnostico: diagnosticoPrincipal,
        cid10,
        sinteseTexto: sintese.texto,
        nArtigos: artigos.length,
      }).catch(() => null)

      // 4. Re-executar divergência de conduta com síntese (best-effort)
      // Se falhar não bloqueia — alerta sem síntese já foi gerado em processarConsulta
      try {
        // Verifica supressão ativa — não re-executa se médico suprimiu alertas deste CID-10
        const [supressaoAtiva] = await db
          .select({ id: conductAlerts.id })
          .from(conductAlerts)
          .where(and(
            eq(conductAlerts.medicoId, medicoId),
            eq(conductAlerts.cid10, cid10),
            gt(conductAlerts.supressaoAte, new Date()),
          ))
          .limit(1)

        if (supressaoAtiva) {
          logger.info('[pubmedQueue] Alerta suprimido — supressaoAte ativa', { soapNoteId, requestId: job.data.requestId ?? undefined, cid10 })
          return { soapNoteId, artigosEncontrados: artigos.length }
        }

        // Busca histórico de feedback — mesmo CID-10 (até 10) + padrões descartados globalmente (até 5)
        const [feedbackCid10, feedbackGlobal] = await Promise.all([
          db.select({
            hashAlerta: conductAlerts.hashAlerta,
            feedbackMedico: conductAlerts.feedbackMedico,
            feedbackMotivo: conductAlerts.feedbackMotivo,
            cid10: conductAlerts.cid10,
          })
          .from(conductAlerts)
          .where(and(
            eq(conductAlerts.medicoId, medicoId),
            eq(conductAlerts.cid10, cid10),
            isNotNull(conductAlerts.feedbackMedico),
          ))
          .orderBy(desc(conductAlerts.feedbackEm))
          .limit(10),

          // Alertas descartados em outros diagnósticos — revela padrões sistemáticos do médico
          db.select({
            hashAlerta: conductAlerts.hashAlerta,
            feedbackMedico: conductAlerts.feedbackMedico,
            feedbackMotivo: conductAlerts.feedbackMotivo,
            cid10: conductAlerts.cid10,
          })
          .from(conductAlerts)
          .where(and(
            eq(conductAlerts.medicoId, medicoId),
            ne(conductAlerts.cid10, cid10),
            inArray(conductAlerts.feedbackMedico, ['discordo', 'inaplicavel']),
          ))
          .orderBy(desc(conductAlerts.feedbackEm))
          .limit(5),
        ])

        const historicoFeedback: FeedbackHistoricoItem[] = [
          ...feedbackCid10.map(r => ({
            hashAlerta: r.hashAlerta,
            feedback: r.feedbackMedico!,
            motivo: r.feedbackMotivo,
          })),
          ...feedbackGlobal.map(r => ({
            hashAlerta: r.hashAlerta,
            feedback: r.feedbackMedico!,
            motivo: r.feedbackMotivo,
            cid10Origem: r.cid10 ?? undefined,
          })),
        ]

        const alerta = await detectarDivergenciaConducta({
          diagnostico: diagnosticoPrincipal,
          cid10,
          condutaAtual: condutaAtual,
          sinteseEvidencias: sintese.texto,
          perfilPaciente,
          historicoFeedback,
        })

        if (alerta.tem_divergencia) {
          await db.insert(conductAlerts).values({
            soapNoteId,
            medicoId,
            diagnostico: diagnosticoPrincipal,
            cid10,
            nivelUrgencia: alerta.nivel_urgencia ?? 'baixo',
            hashAlerta: alerta.hash_alerta ?? null,
            alertaJson: alerta,
            mensagemMedico: alerta.mensagem_para_medico ?? null,
          }).onDuplicateKeyUpdate({
            // Se já existe alerta para esta soapNote, atualiza com a versão enriquecida
            set: {
              hashAlerta: alerta.hash_alerta ?? null,
              alertaJson: alerta,
              mensagemMedico: alerta.mensagem_para_medico ?? null,
            },
          })

          logger.info('[pubmedQueue] Alerta de conduta enriquecido com síntese', {
            soapNoteId,
            nivel: alerta.nivel_urgencia,
          })

          // Publicar alerta no Obsidian + notificar n8n (best-effort)
          publicarAlertaConduta({ soapNoteId, diagnostico: diagnosticoPrincipal, cid10, alerta }).catch(() => null)
          notificarAlertaConduta({
            soapNoteId,
            diagnostico: diagnosticoPrincipal,
            cid10,
            nivelUrgencia: alerta.nivel_urgencia ?? 'baixo',
            hashAlerta: alerta.hash_alerta ?? null,
            mensagemMedico: alerta.mensagem_para_medico ?? null,
          }).catch(() => null)
        }
      } catch (alertaErr) {
        logger.warn('[pubmedQueue] Falha ao re-executar divergência (best-effort)', { soapNoteId, err: alertaErr })
      }

      return { soapNoteId, artigosEncontrados: artigos.length }
    },
    { connection: redis, prefix: QUEUE_PREFIX, ...WORKER_OPTS },
  )

  worker.on('failed', (job, err) => {
    sendToDlq('pubmed-synthesis', job, err).catch(() => null)
  })

  worker.on('completed', (job, result) => {
    logger.info(`[pubmedQueue] Job ${job.id} concluído`, result)
  })

  return worker
}
