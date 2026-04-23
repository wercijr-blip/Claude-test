import { z } from 'zod'
import { router, adminProcedure, n8nProcedure } from '../_core/trpc.ts'
import { TRPCError } from '@trpc/server'
import { db } from '../db.ts'
import {
  pubmedArticles,
  articleTopicLinks,
  articleClusters,
} from '../../drizzle/schema.ts'
import { eq, desc, and, sql } from 'drizzle-orm'

const saveArticleInput = z.object({
  pmid: z.string().max(20),
  doi: z.string().max(255).optional().nullable(),
  title: z.string().min(1),
  journal: z.string().max(255).optional(),
  year: z.number().int().optional(),
  abstract: z.string().optional(),
  zoteroItemKey: z.string().max(50).optional(),
  pdfAvailable: z.boolean().default(false),
  pdfUrl: z.string().max(500).optional().nullable(),
})

const linkToTopicInput = z.object({
  pmid: z.string().max(20),
  knowledgeTopicId: z.number().int(),
  consultationId: z.number().int().optional().nullable(),
  doctorId: z.number().int().optional().nullable(),
  clinicId: z.number().int(),
  notePathObsidian: z.string().max(500).optional(),
})

export const articlesRouter = router({
  // Buscar artigo por PMID
  getByPmid: n8nProcedure
    .input(z.object({ pmid: z.string() }))
    .query(async ({ input }) => {
      const [article] = await db
        .select()
        .from(pubmedArticles)
        .where(eq(pubmedArticles.pmid, input.pmid))
        .limit(1)
      return article ?? null
    }),

  // Salvar novo artigo (idempotente — ignora se PMID já existe)
  save: n8nProcedure
    .input(saveArticleInput)
    .mutation(async ({ input }) => {
      const existing = await db
        .select({ id: pubmedArticles.id })
        .from(pubmedArticles)
        .where(eq(pubmedArticles.pmid, input.pmid))
        .limit(1)

      if (existing.length > 0) {
        return { id: existing[0].id, created: false }
      }

      const [result] = await db.insert(pubmedArticles).values({
        pmid: input.pmid,
        doi: input.doi ?? null,
        title: input.title,
        journal: input.journal ?? null,
        year: input.year ?? null,
        abstract: input.abstract ?? null,
        zoteroItemKey: input.zoteroItemKey ?? null,
        pdfAvailable: input.pdfAvailable,
        pdfUrl: input.pdfUrl ?? null,
        totalNotesGenerated: 0,
        firstSeenAt: new Date(),
        lastCitedAt: new Date(),
      })

      return { id: (result as { insertId: number }).insertId, created: true }
    }),

  // Registrar vínculo artigo ↔ tópico e incrementar contador
  linkToTopic: n8nProcedure
    .input(linkToTopicInput)
    .mutation(async ({ input }) => {
      const [article] = await db
        .select({ id: pubmedArticles.id })
        .from(pubmedArticles)
        .where(eq(pubmedArticles.pmid, input.pmid))
        .limit(1)

      if (!article) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `PMID ${input.pmid} não encontrado` })
      }

      await db.insert(articleTopicLinks).values({
        articleId: article.id,
        knowledgeTopicId: input.knowledgeTopicId,
        consultationId: input.consultationId ?? null,
        doctorId: input.doctorId ?? null,
        clinicId: input.clinicId,
        notePathObsidian: input.notePathObsidian ?? null,
        createdAt: new Date(),
      })

      await db
        .update(pubmedArticles)
        .set({
          totalNotesGenerated: sql`${pubmedArticles.totalNotesGenerated} + 1`,
          lastCitedAt: new Date(),
        })
        .where(eq(pubmedArticles.id, article.id))

      return { ok: true }
    }),

  // Artigos mais citados na clínica
  mostCited: adminProcedure
    .input(
      z.object({
        medicalSpecialty: z.string().optional(),
        clinicId: z.number().int().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        limit: z.number().int().max(50).default(20),
      }),
    )
    .query(async ({ input }) => {
      return db
        .select()
        .from(pubmedArticles)
        .orderBy(desc(pubmedArticles.totalNotesGenerated))
        .limit(input.limit)
    }),

  // Timeline de um artigo: notas, consultas, médicos, tópicos
  timeline: adminProcedure
    .input(z.object({ pmid: z.string() }))
    .query(async ({ input }) => {
      const [article] = await db
        .select()
        .from(pubmedArticles)
        .where(eq(pubmedArticles.pmid, input.pmid))
        .limit(1)

      if (!article) throw new TRPCError({ code: 'NOT_FOUND' })

      const links = await db
        .select()
        .from(articleTopicLinks)
        .where(eq(articleTopicLinks.articleId, article.id))
        .orderBy(desc(articleTopicLinks.createdAt))

      return { article, links }
    }),

  // Salvar cluster + meta-análise
  saveCluster: n8nProcedure
    .input(
      z.object({
        clinicId: z.number().int(),
        referenceMonth: z.string().regex(/^\d{4}-\d{2}$/),
        clusterTopic: z.string().max(255),
        medicalSpecialty: z.string().max(100).optional(),
        articlePmids: z.array(z.string()),
        totalArticles: z.number().int(),
        totalNotesGenerated: z.number().int().default(0),
        metaAnalysisText: z.string().optional(),
        evidenceLevel: z.enum(['A', 'B', 'C']).optional(),
        consensus: z.enum(['concordante', 'controverso', 'inconclusivo']).optional(),
        clinicalRecommendation: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const [result] = await db.insert(articleClusters).values({
        clinicId: input.clinicId,
        referenceMonth: input.referenceMonth,
        clusterTopic: input.clusterTopic,
        medicalSpecialty: input.medicalSpecialty ?? null,
        articlePmids: input.articlePmids,
        totalArticles: input.totalArticles,
        totalNotesGenerated: input.totalNotesGenerated,
        metaAnalysisText: input.metaAnalysisText ?? null,
        evidenceLevel: input.evidenceLevel ?? null,
        consensus: input.consensus ?? null,
        clinicalRecommendation: input.clinicalRecommendation ?? null,
        createdAt: new Date(),
      })

      return { id: (result as { insertId: number }).insertId }
    }),

  // Listar clusters com filtros
  getClusters: adminProcedure
    .input(
      z.object({
        referenceMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
        medicalSpecialty: z.string().optional(),
        evidenceLevel: z.enum(['A', 'B', 'C']).optional(),
        consensus: z.enum(['concordante', 'controverso', 'inconclusivo']).optional(),
        clinicId: z.number().int().optional(),
        limit: z.number().int().max(100).default(50),
      }),
    )
    .query(async ({ input }) => {
      const conditions = []
      if (input.referenceMonth) conditions.push(eq(articleClusters.referenceMonth, input.referenceMonth))
      if (input.medicalSpecialty) conditions.push(eq(articleClusters.medicalSpecialty, input.medicalSpecialty))
      if (input.evidenceLevel) conditions.push(eq(articleClusters.evidenceLevel, input.evidenceLevel))
      if (input.consensus) conditions.push(eq(articleClusters.consensus, input.consensus))
      if (input.clinicId) conditions.push(eq(articleClusters.clinicId, input.clinicId))

      return db
        .select()
        .from(articleClusters)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(articleClusters.createdAt))
        .limit(input.limit)
    }),
})
