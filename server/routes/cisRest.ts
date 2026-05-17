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

import { Router, type Request, type Response } from 'express'
import { db } from '../db.ts'
import { soapNotes, conductAlerts } from '../../drizzle/schema.ts'
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm'
import { env } from '../_core/env.ts'
import { logger } from '../_core/logger.ts'

export const cisRestRouter = Router()

// ─── Auth middleware ──────────────────────────────────────────────────────────

function autenticar(req: Request, res: Response): number | null {
  if (!env.CIS_API_KEY || !env.CIS_MEDICO_USER_ID) {
    res.status(503).json({ erro: 'REST API do CIS não está configurada (CIS_API_KEY / CIS_MEDICO_USER_ID ausentes)' })
    return null
  }

  const chave = req.headers['x-cis-api-key']
  if (typeof chave !== 'string' || chave !== env.CIS_API_KEY) {
    logger.warn('[cisRest] Tentativa com chave inválida', { ip: req.ip })
    res.status(401).json({ erro: 'Chave de API inválida' })
    return null
  }

  return env.CIS_MEDICO_USER_ID
}

// ─── GET /api/cis/notas ───────────────────────────────────────────────────────

cisRestRouter.get('/notas', async (req, res) => {
  const medicoId = autenticar(req, res)
  if (!medicoId) return

  const limit  = Math.min(Number(req.query['limit'])  || 20, 100)
  const offset = Math.max(Number(req.query['offset']) || 0,  0)
  const cid10    = typeof req.query['cid10']    === 'string' ? req.query['cid10'] : undefined
  const template = typeof req.query['template'] === 'string' ? req.query['template'] : undefined
  const from     = typeof req.query['from']     === 'string' ? new Date(req.query['from']) : undefined
  const to       = typeof req.query['to']       === 'string' ? new Date(req.query['to'])   : undefined

  const conditions = [eq(soapNotes.medicoId, medicoId)]
  if (cid10)    conditions.push(eq(soapNotes.cid10, cid10))
  if (template) conditions.push(eq(soapNotes.template, template))
  if (from && !isNaN(from.getTime())) conditions.push(gte(soapNotes.createdAt, from))
  if (to   && !isNaN(to.getTime()))   conditions.push(lte(soapNotes.createdAt, to))

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
})

// ─── GET /api/cis/notas/:id ───────────────────────────────────────────────────

cisRestRouter.get('/notas/:id', async (req, res) => {
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
})

// ─── GET /api/cis/notas/:id/sintese ──────────────────────────────────────────

cisRestRouter.get('/notas/:id/sintese', async (req, res) => {
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
    .where(eq(conductAlerts.soapNoteId, id))

  res.json({
    soapNoteId:        nota.id,
    sinteseEvidencias: nota.sinteseEvidencias ?? null,
    pubmedQuery:       nota.pubmedQuery ?? null,
    pronta:            nota.sinteseEvidencias !== null,
    alertas,
  })
})
