/**
 * REST API pública do CIS — para integrações externas (n8n, Obsidian scripts, curl).
 *
 * Autenticação: header X-CIS-Api-Key deve corresponder à variável CIS_API_KEY.
 * O médico é identificado pela variável CIS_MEDICO_USER_ID (sistema single-doctor).
 *
 * Endpoints:
 *   GET /api/cis/notas             — lista SOAP notes com filtros e paginação
 *   GET /api/cis/notas/:id         — SOAP note completa (sem PII)
 *   GET /api/cis/notas/:id/sintese — síntese PubMed de uma nota
 */

import { timingSafeEqual } from 'crypto'
import { Router, type Request, type Response, type NextFunction } from 'express'
import { db } from '../db.ts'
import { soapNotes, conductAlerts } from '../../drizzle/schema.ts'
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm'
import { env } from '../_core/env.ts'
import { logger } from '../_core/logger.ts'
import { getOpusBudgetStatus } from '../clinicalIntelligence.ts'

// Express 4 não propaga rejeições de async handlers automaticamente.
// Este wrapper encaminha qualquer erro ao error handler do Express via next().
function ar(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next)
}

export const cisRestRouter = Router()

// ─── Patterns para validação de query params ──────────────────────────────────

const CID10_RE    = /^[A-Z]\d{2}(\.\d{1,2})?$/
const TEMPLATE_RE = /^[a-z0-9_-]{1,60}$/

function parseQueryDate(val: unknown): Date | undefined {
  if (typeof val !== 'string') return undefined
  const d = new Date(val)
  return isNaN(d.getTime()) ? undefined : d
}

// ─── Auth middleware ──────────────────────────────────────────────────────────

function autenticar(req: Request, res: Response): number | null {
  if (!env.CIS_API_KEY || !env.CIS_MEDICO_USER_ID) {
    res.status(503).json({ erro: 'REST API do CIS não está configurada (CIS_API_KEY / CIS_MEDICO_USER_ID ausentes)' })
    return null
  }

  const chave = req.headers['x-cis-api-key']
  const chaveValida = typeof chave === 'string' &&
    chave.length === env.CIS_API_KEY!.length &&
    timingSafeEqual(Buffer.from(chave), Buffer.from(env.CIS_API_KEY!))
  if (!chaveValida) {
    logger.warn('[cisRest] Falha de autenticação', {
      ip: req.ip,
      method: req.method,
      path: req.path,
      userAgent: req.get('user-agent') ?? 'desconhecido',
    })
    res.status(401).json({ erro: 'Chave de API inválida' })
    return null
  }

  return env.CIS_MEDICO_USER_ID
}

// ─── Cache em memória para /budget (TTL: 60s) ────────────────────────────────

let budgetCache: { data: object; expiresAt: number } | null = null

// ─── GET /api/cis/budget ─────────────────────────────────────────────────────

cisRestRouter.get('/budget', ar(async (req, res) => {
  const medicoId = autenticar(req, res)
  if (!medicoId) return

  if (budgetCache && Date.now() < budgetCache.expiresAt) {
    res.json(budgetCache.data)
    return
  }

  const status = await getOpusBudgetStatus()
  budgetCache = { data: status, expiresAt: Date.now() + 60_000 }
  res.json(status)
}))

// ─── GET /api/cis/notas ───────────────────────────────────────────────────────

cisRestRouter.get('/notas', ar(async (req, res) => {
  const medicoId = autenticar(req, res)
  if (!medicoId) return

  const limit  = Math.min(Math.max(Number(req.query['limit'])  || 20, 1), 100)
  const offset = Math.max(Number(req.query['offset']) || 0, 0)
  const cid10    = typeof req.query['cid10']    === 'string' && CID10_RE.test(req.query['cid10'])    ? req.query['cid10']    : undefined
  const template = typeof req.query['template'] === 'string' && TEMPLATE_RE.test(req.query['template']) ? req.query['template'] : undefined
  const from     = parseQueryDate(req.query['from'])
  const to       = parseQueryDate(req.query['to'])

  if (from && to && from > to) {
    res.status(400).json({ erro: 'Parâmetro from deve ser anterior a to' })
    return
  }

  const conditions = [eq(soapNotes.medicoId, medicoId)]
  if (cid10)    conditions.push(eq(soapNotes.cid10, cid10))
  if (template) conditions.push(eq(soapNotes.template, template))
  if (from)     conditions.push(gte(soapNotes.createdAt, from))
  if (to)       conditions.push(lte(soapNotes.createdAt, to))

  const [notas, [{ total }]] = await Promise.all([
    db
      .select({
        id:                   soapNotes.id,
        sessionId:            soapNotes.sessionId,
        template:             soapNotes.template,
        diagnosticoPrincipal: soapNotes.diagnosticoPrincipal,
        cid10:                soapNotes.cid10,
        certeza:              soapNotes.certeza,
        pubmedQuery:          soapNotes.pubmedQuery,
        temSintese:           sql<number>`CASE WHEN ${soapNotes.sinteseEvidencias} IS NOT NULL THEN 1 ELSE 0 END`,
        createdAt:            soapNotes.createdAt,
      })
      .from(soapNotes)
      .where(and(...conditions))
      .orderBy(desc(soapNotes.createdAt))
      .limit(limit)
      .offset(offset),

    db
      .select({ total: sql<number>`COUNT(*)` })
      .from(soapNotes)
      .where(and(...conditions)),
  ])

  res.json({ notas, total: Number(total), limit, offset })
}))

// ─── GET /api/cis/notas/:id ───────────────────────────────────────────────────

cisRestRouter.get('/notas/:id', ar(async (req, res) => {
  const medicoId = autenticar(req, res)
  if (!medicoId) return

  const id = parseInt(req.params['id']!, 10)
  if (isNaN(id)) {
    res.status(400).json({ erro: 'ID inválido' })
    return
  }

  const [nota] = await db
    .select({
      id:                   soapNotes.id,
      sessionId:            soapNotes.sessionId,
      template:             soapNotes.template,
      diagnosticoPrincipal: soapNotes.diagnosticoPrincipal,
      cid10:                soapNotes.cid10,
      certeza:              soapNotes.certeza,
      soapTexto:            soapNotes.soapTexto,
      knowledgeMetadata:    soapNotes.knowledgeMetadata,
      pubmedQuery:          soapNotes.pubmedQuery,
      createdAt:            soapNotes.createdAt,
    })
    .from(soapNotes)
    .where(and(eq(soapNotes.id, id), eq(soapNotes.medicoId, medicoId)))
    .limit(1)

  if (!nota) {
    res.status(404).json({ erro: 'Nota não encontrada' })
    return
  }

  res.json(nota)
}))

// ─── GET /api/cis/notas/:id/sintese ──────────────────────────────────────────

cisRestRouter.get('/notas/:id/sintese', ar(async (req, res) => {
  const medicoId = autenticar(req, res)
  if (!medicoId) return

  const id = parseInt(req.params['id']!, 10)
  if (isNaN(id)) {
    res.status(400).json({ erro: 'ID inválido' })
    return
  }

  const [nota] = await db
    .select({
      id:                soapNotes.id,
      sinteseEvidencias: soapNotes.sinteseEvidencias,
      pubmedQuery:       soapNotes.pubmedQuery,
    })
    .from(soapNotes)
    .where(and(eq(soapNotes.id, id), eq(soapNotes.medicoId, medicoId)))
    .limit(1)

  if (!nota) {
    res.status(404).json({ erro: 'Nota não encontrada' })
    return
  }

  // Busca alertas associados à nota
  const alertas = await db
    .select({
      id:             conductAlerts.id,
      nivelUrgencia:  conductAlerts.nivelUrgencia,
      mensagemMedico: conductAlerts.mensagemMedico,
      feedbackMedico: conductAlerts.feedbackMedico,
      createdAt:      conductAlerts.createdAt,
    })
    .from(conductAlerts)
    .where(and(eq(conductAlerts.soapNoteId, id), eq(conductAlerts.medicoId, medicoId)))

  res.json({
    soapNoteId:        nota.id,
    sinteseEvidencias: nota.sinteseEvidencias ?? null,
    pubmedQuery:       nota.pubmedQuery ?? null,
    pronta:            nota.sinteseEvidencias !== null,
    alertas,
  })
}))

// ─── Error handler ────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
cisRestRouter.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('[cisRest] Erro inesperado', { error: err instanceof Error ? err.message : String(err) })
  res.status(500).json({ erro: 'Erro interno do servidor' })
})
