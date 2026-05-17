import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, medicoProcedure } from '../_core/trpc.ts'
import { db } from '../db.ts'
import {
  clinicalSessions,
  soapNotes,
  conductAlerts,
  clinicalDigests,
} from '../../drizzle/schema.ts'
import { eq, and, isNull, desc, isNotNull } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { encrypt } from '../_core/encryption.ts'
import { getPresignedUploadUrl } from '../storage.ts'
import {
  abrirSessao,
  encerrarSessao,
  processarConsulta,
  transcribeWithChunking,
} from '../scriba.ts'
import { getPresignedUrl } from '../storage.ts'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function assertSessaoDoMedico(sessao: { medicoId: number } | undefined, medicoId: number) {
  if (!sessao) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sessão não encontrada' })
  if (sessao.medicoId !== medicoId) throw new TRPCError({ code: 'FORBIDDEN' })
}

function assertSoapDoMedico(nota: { medicoId: number } | undefined, medicoId: number) {
  if (!nota) throw new TRPCError({ code: 'NOT_FOUND', message: 'Nota não encontrada' })
  if (nota.medicoId !== medicoId) throw new TRPCError({ code: 'FORBIDDEN' })
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const scribaRouter = router({

  // ── Sessão ─────────────────────────────────────────────────────────────────

  /** Abre ou retorna a sessão clínica do dia para o médico autenticado. */
  abrirSessao: medicoProcedure
    .mutation(async ({ ctx }) => {
      const medicoId = ctx.session.id
      return abrirSessao(medicoId)
    }),

  /** Encerra a sessão e enfileira o digest diário. */
  encerrarSessao: medicoProcedure
    .input(z.object({ sessionId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const medicoId = ctx.session.id

      const [sessao] = await db
        .select({ id: clinicalSessions.id, medicoId: clinicalSessions.medicoId })
        .from(clinicalSessions)
        .where(eq(clinicalSessions.id, input.sessionId))
        .limit(1)

      assertSessaoDoMedico(sessao, medicoId)

      await encerrarSessao(input.sessionId, medicoId)
      return { ok: true }
    }),

  // ── Áudio ──────────────────────────────────────────────────────────────────

  /**
   * Retorna uma URL presignada (PUT) para o cliente enviar o áudio
   * diretamente ao S3 sem passar pelo servidor.
   * Content-type aceito: audio/webm | audio/mp4 | audio/ogg
   */
  getAudioUploadUrl: medicoProcedure
    .input(z.object({
      contentType: z.enum(['audio/webm', 'audio/mp4', 'audio/ogg']),
    }))
    .mutation(async ({ input, ctx }) => {
      const ext = input.contentType.split('/')[1]
      const s3Key = `audio-scriba/${ctx.session.id}/${randomUUID()}.${ext}`
      const uploadUrl = await getPresignedUploadUrl(s3Key, input.contentType, 300)
      return { uploadUrl, s3Key }
    }),

  /**
   * Transcreve o áudio já enviado ao S3 via Whisper.
   * Divide arquivos > 10 MB em chunks automaticamente.
   */
  transcreverAudio: medicoProcedure
    .input(z.object({
      s3Key: z.string().regex(/^audio-scriba\/\d+\/[0-9a-f-]+\.(webm|mp4|ogg)$/, 'Chave de áudio inválida'),
    }))
    .mutation(async ({ input, ctx }) => {
      // Garante que a chave pertence ao médico autenticado
      const prefixo = `audio-scriba/${ctx.session.id}/`
      if (!input.s3Key.startsWith(prefixo)) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }

      const audioUrl = await getPresignedUrl(input.s3Key, 600)
      const transcricao = await transcribeWithChunking(audioUrl)
      return { transcricao }
    }),

  // ── Consulta ───────────────────────────────────────────────────────────────

  /**
   * Processa uma consulta: gera SOAP + knowledge_metadata (Claude — Prompt 02)
   * e opcionalmente detecta divergência de conduta (Prompt 06).
   */
  processarConsulta: medicoProcedure
    .input(z.object({
      sessionId: z.number().int().positive(),
      pacienteNome: z.string().min(2).max(255),
      transcricao: z.string().min(10),
      template: z.enum([
        'infectologia_geral', 'prep_ist', 'opat',
        'pos_transplante', 'neutropenia_febril', 'hiv_cronico', 'tb',
      ]).default('infectologia_geral'),
      sinteseEvidencias: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const medicoId = ctx.session.id

      const [sessao] = await db
        .select({ id: clinicalSessions.id, medicoId: clinicalSessions.medicoId, encerradaEm: clinicalSessions.encerradaEm })
        .from(clinicalSessions)
        .where(eq(clinicalSessions.id, input.sessionId))
        .limit(1)

      assertSessaoDoMedico(sessao, medicoId)

      if (sessao.encerradaEm) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Sessão já encerrada. Abra uma nova sessão.' })
      }

      const pacienteNomeEncrypted = encrypt(input.pacienteNome)

      const resultado = await processarConsulta({
        sessionId: input.sessionId,
        medicoId,
        pacienteNomeEncrypted,
        transcricao: input.transcricao,
        template: input.template,
        sinteseEvidencias: input.sinteseEvidencias,
      })

      return resultado
    }),

  // ── SOAP Notes ─────────────────────────────────────────────────────────────

  /** Lista as notas SOAP do médico autenticado (versão leve, sem texto completo). */
  listarSoapNotes: medicoProcedure
    .input(z.object({
      sessionId: z.number().int().positive().optional(),
      limit: z.number().int().min(1).max(100).default(20),
    }).optional())
    .query(async ({ input, ctx }) => {
      const medicoId = ctx.session.id
      const limit = input?.limit ?? 20

      const conditions = [eq(soapNotes.medicoId, medicoId)]
      if (input?.sessionId) {
        conditions.push(eq(soapNotes.sessionId, input.sessionId))
      }

      return db
        .select({
          id: soapNotes.id,
          sessionId: soapNotes.sessionId,
          template: soapNotes.template,
          diagnosticoPrincipal: soapNotes.diagnosticoPrincipal,
          cid10: soapNotes.cid10,
          certeza: soapNotes.certeza,
          createdAt: soapNotes.createdAt,
        })
        .from(soapNotes)
        .where(and(...conditions))
        .orderBy(desc(soapNotes.createdAt))
        .limit(limit)
    }),

  /** Retorna uma nota SOAP completa (texto + knowledge_metadata). */
  getSoapNote: medicoProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const medicoId = ctx.session.id

      const [nota] = await db
        .select()
        .from(soapNotes)
        .where(eq(soapNotes.id, input.id))
        .limit(1)

      assertSoapDoMedico(nota, medicoId)

      // Não retorna pacienteNomeEncrypted — nome descriptografado só em endpoint específico
      const { pacienteNomeEncrypted: _, ...notaSemPii } = nota
      return notaSemPii
    }),

  // ── Alertas de Conduta ─────────────────────────────────────────────────────

  /** Lista alertas de conduta do médico. Por padrão retorna apenas os não vistos. */
  listarAlertas: medicoProcedure
    .input(z.object({
      incluirVistos: z.boolean().default(false),
      limit: z.number().int().min(1).max(50).default(20),
    }).optional())
    .query(async ({ input, ctx }) => {
      const medicoId = ctx.session.id
      const incluirVistos = input?.incluirVistos ?? false

      const conditions = [eq(conductAlerts.medicoId, medicoId)]
      if (!incluirVistos) conditions.push(isNull(conductAlerts.vistoEm))

      return db
        .select({
          id: conductAlerts.id,
          soapNoteId: conductAlerts.soapNoteId,
          diagnostico: conductAlerts.diagnostico,
          cid10: conductAlerts.cid10,
          nivelUrgencia: conductAlerts.nivelUrgencia,
          mensagemMedico: conductAlerts.mensagemMedico,
          alertaJson: conductAlerts.alertaJson,
          vistoEm: conductAlerts.vistoEm,
          createdAt: conductAlerts.createdAt,
        })
        .from(conductAlerts)
        .where(and(...conditions))
        .orderBy(desc(conductAlerts.createdAt))
        .limit(input?.limit ?? 20)
    }),

  /** Marca um alerta de conduta como visto pelo médico autenticado. */
  marcarAlertaVisto: medicoProcedure
    .input(z.object({ alertaId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const medicoId = ctx.session.id

      const [alerta] = await db
        .select({ id: conductAlerts.id, medicoId: conductAlerts.medicoId })
        .from(conductAlerts)
        .where(eq(conductAlerts.id, input.alertaId))
        .limit(1)

      if (!alerta) throw new TRPCError({ code: 'NOT_FOUND' })
      if (alerta.medicoId !== medicoId) throw new TRPCError({ code: 'FORBIDDEN' })

      await db
        .update(conductAlerts)
        .set({ vistoPorId: medicoId, vistoEm: new Date() })
        .where(eq(conductAlerts.id, input.alertaId))

      return { ok: true }
    }),

  // ── Digests ────────────────────────────────────────────────────────────────

  /** Lista os digests clínicos do médico. */
  listarDigests: medicoProcedure
    .input(z.object({
      tipo: z.enum(['diario', 'semanal', 'mensal']).optional(),
      limit: z.number().int().min(1).max(30).default(10),
    }).optional())
    .query(async ({ input, ctx }) => {
      const medicoId = ctx.session.id

      const conditions = [eq(clinicalDigests.medicoId, medicoId)]
      if (input?.tipo) conditions.push(eq(clinicalDigests.tipo, input.tipo))

      return db
        .select()
        .from(clinicalDigests)
        .where(and(...conditions))
        .orderBy(desc(clinicalDigests.geradoEm))
        .limit(input?.limit ?? 10)
    }),
})
