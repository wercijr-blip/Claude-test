/**
 * case-series queue — BullMQ
 *
 * Disparado automaticamente quando N ≥ 3 casos do mesmo CID-10 são detectados,
 * ou manualmente via endpoint tRPC gerarSerie.
 *
 * Pipeline: buscar SOAPs → anonimizar → buscar artigos PubMed + Zotero
 *           → gerarSerieCasos (Prompt 10, Opus)
 *           → salvar publicationDraft
 *           → publicar no Obsidian
 */

import { Queue, Worker } from "bullmq";
import { env } from "./_core/env.ts";
import { redis, QUEUE_PREFIX } from "./_core/redis.ts";
import { sendToDlq } from "./_core/dlq.ts";
import { db } from "./db.ts";
import { soapNotes, publicationDrafts } from "../drizzle/cis-schema.ts";
import { eq, and, inArray, gte, desc } from "drizzle-orm";
import { buscarArtigosDual } from "./pubmed.ts";
import {
  buscarReferenciasPorQuery,
  formatarZoteroParaPrompt,
} from "./zotero.ts";
import { gerarSerieCasos } from "./clinicalIntelligence.ts";
import { publicarSerieCasos } from "./obsidian.ts";
import { logger } from "./_core/logger.ts";

// ─── Configuração ─────────────────────────────────────────────────────────────

export const CASE_SERIES_QUEUE_NAME = "case-series";

const WORKER_OPTS = {
  lockDuration: 300_000, // até 5 min (Opus pode ser lento)
  stalledInterval: 180_000,
  maxStalledCount: 1,
  removeOnComplete: { count: 20 },
  removeOnFail: { count: 20 },
} as const;

export const caseSeriesQueue = new Queue(CASE_SERIES_QUEUE_NAME, {
  connection: redis,
  prefix: QUEUE_PREFIX,
});

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface CaseSeriesJobData {
  medicoId: number;
  cid10: string;
  diagnostico: string;
  soapNoteIds: number[]; // mínimo 3
  disparadoPor: "automatico" | "manual";
}

// ─── Enqueue público ──────────────────────────────────────────────────────────

/**
 * Enfileira geração de série de casos.
 * jobId determinístico por (medicoId, cid10) — evita duplicatas simultâneas.
 * Se já existe draft ativo para este CID-10, não enfileira.
 */
export async function enqueueCaseSeries(
  params: CaseSeriesJobData,
): Promise<boolean> {
  if (params.soapNoteIds.length < 3) return false;

  // Verifica se já existe rascunho ativo para este CID-10
  const [existente] = await db
    .select({ id: publicationDrafts.id })
    .from(publicationDrafts)
    .where(
      and(
        eq(publicationDrafts.medicoId, params.medicoId),
        eq(publicationDrafts.tipo, "serie_casos"),
        eq(publicationDrafts.cid10, params.cid10),
        inArray(publicationDrafts.status, [
          "rascunho",
          "em_revisao",
          "submetido",
          "aceito",
        ]),
      ),
    )
    .limit(1);

  if (existente) {
    logger.info("[caseSeriesQueue] Rascunho ativo já existe — ignorando", {
      cid10: params.cid10,
      draftId: existente.id,
    });
    return false;
  }

  await caseSeriesQueue.add("gerar-serie", params, {
    jobId: `case-series-${params.medicoId}-${params.cid10}`,
    attempts: 2,
    backoff: { type: "exponential", delay: 120_000 },
  });

  logger.info("[caseSeriesQueue] Série enfileirada", {
    medicoId: params.medicoId,
    cid10: params.cid10,
    nCasos: params.soapNoteIds.length,
    disparadoPor: params.disparadoPor,
  });

  return true;
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export function startCaseSeriesWorker() {
  const worker = new Worker<CaseSeriesJobData>(
    CASE_SERIES_QUEUE_NAME,
    async (job) => {
      const { medicoId, cid10, diagnostico, soapNoteIds } = job.data;

      // 1. Buscar SOAPs incluídas na série (sem PII — pacienteNomeEncrypted excluído)
      const notas = await db
        .select({
          id: soapNotes.id,
          soapTexto: soapNotes.soapTexto,
          knowledgeMetadata: soapNotes.knowledgeMetadata,
          template: soapNotes.template,
          createdAt: soapNotes.createdAt,
        })
        .from(soapNotes)
        .where(
          and(
            eq(soapNotes.medicoId, medicoId),
            inArray(soapNotes.id, soapNoteIds),
          ),
        );

      if (notas.length < 3) {
        throw new Error(
          `Série cancelada: apenas ${notas.length} nota(s) encontradas (mínimo 3)`,
        );
      }

      // 2. Preparar JSON dos casos anonimizados para o Prompt 10
      const casosJson = JSON.stringify(
        notas.map((n, i) => ({
          caso: i + 1,
          template: n.template,
          createdAt: n.createdAt,
          // Inclui apenas metadados clínicos — sem soapTexto completo (pode ter dados do paciente)
          metadata: n.knowledgeMetadata,
        })),
      );

      // 3. Buscar artigos PubMed + Zotero em paralelo
      const [artigos, zoteroItems] = await Promise.all([
        buscarArtigosDual(
          `"${diagnostico}"[Title/Abstract] ${cid10}[MeSH]`,
          [],
          10,
        ),
        buscarReferenciasPorQuery(`${diagnostico} ${cid10}`, 8).catch(() => {
          logger.warn("[caseSeriesQueue] Zotero indisponível", { cid10 });
          return null;
        }),
      ]);
      const zoteroReferencias = zoteroItems
        ? formatarZoteroParaPrompt(zoteroItems)
        : "";

      // 4. Prompt 10 — gerarSerieCasos (Opus)
      const resultado = await gerarSerieCasos({
        diagnostico,
        cid10,
        nCasos: notas.length,
        casosJson,
        artigosReferenciasJson: JSON.stringify(artigos),
        zoteroReferencias,
      });

      // 5. Salvar draft no banco
      await db.insert(publicationDrafts).values({
        medicoId,
        tipo: "serie_casos",
        status: "rascunho",
        diagnostico,
        cid10,
        nCasos: notas.length,
        soapNoteIds: soapNoteIds,
        nArtigos: artigos.length,
        textoGerado: resultado.texto,
      });

      const [draft] = await db
        .select({ id: publicationDrafts.id })
        .from(publicationDrafts)
        .where(
          and(
            eq(publicationDrafts.medicoId, medicoId),
            eq(publicationDrafts.cid10, cid10),
            eq(publicationDrafts.status, "rascunho"),
          ),
        )
        .orderBy(desc(publicationDrafts.createdAt))
        .limit(1);

      logger.info("[caseSeriesQueue] Série gerada e salva", {
        medicoId,
        cid10,
        nCasos: notas.length,
        draftId: draft?.id,
      });

      // 6. Publicar rascunho no Obsidian (best-effort)
      publicarSerieCasos({
        diagnostico,
        cid10,
        nCasos: notas.length,
        texto: resultado.texto,
      }).catch(() => null);

      return { draftId: draft?.id, cid10, nCasos: notas.length };
    },
    { connection: redis, prefix: QUEUE_PREFIX, ...WORKER_OPTS },
  );

  worker.on("failed", (job, err) => {
    sendToDlq("case-series", job, err).catch(() => null);
  });

  worker.on("completed", (job, result) => {
    logger.info(`[caseSeriesQueue] Job ${job.id} concluído`, result);
  });

  return worker;
}

// ─── Acumulação automática ────────────────────────────────────────────────────

/**
 * Verifica se há N ≥ 3 casos do mesmo CID-10 para o médico.
 * Janela: últimos 365 dias (casos recentes o suficiente para uma série coerente).
 * Se sim, enfileira geração automática de série.
 */
export async function checkCaseAccumulation(params: {
  medicoId: number;
  cid10: string;
  diagnostico: string;
}): Promise<void> {
  if (!params.cid10) return;

  const limiteData = new Date();
  limiteData.setFullYear(limiteData.getFullYear() - 1);

  const casos = await db
    .select({ id: soapNotes.id })
    .from(soapNotes)
    .where(
      and(
        eq(soapNotes.medicoId, params.medicoId),
        eq(soapNotes.cid10, params.cid10),
        gte(soapNotes.createdAt, limiteData),
      ),
    )
    .limit(20);

  if (casos.length < 3) return;

  await enqueueCaseSeries({
    medicoId: params.medicoId,
    cid10: params.cid10,
    diagnostico: params.diagnostico,
    soapNoteIds: casos.map((c) => c.id),
    disparadoPor: "automatico",
  });
}
