import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, medicoProcedure } from '../_core/trpc.ts'
import { db } from '../db.ts'
import {
  clinicalSessions,
  soapNotes,
  conductAlerts,
  clinicalDigests,
  publicationDrafts,
} from '../../drizzle/schema.ts'
import { eq, and, isNull, desc, isNotNull, sql } from 'drizzle-orm'
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
      /** Texto bruto do laudo laboratorial — extraído via Prompt 01 antes do SOAP */
      examesTexto: z.string().max(8000).optional(),
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
        examesTexto: input.examesTexto,
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

  /**
   * Retorna a síntese de evidências PubMed de uma nota SOAP.
   * Null se o worker ainda não completou (processamento assíncrono).
   */
  getSinteseEvidencias: medicoProcedure
    .input(z.object({ soapNoteId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const medicoId = ctx.session.id

      const [nota] = await db
        .select({
          id: soapNotes.id,
          medicoId: soapNotes.medicoId,
          sinteseEvidencias: soapNotes.sinteseEvidencias,
          pubmedQuery: soapNotes.pubmedQuery,
          evidenceMetadata: soapNotes.evidenceMetadata,
        })
        .from(soapNotes)
        .where(eq(soapNotes.id, input.soapNoteId))
        .limit(1)

      assertSoapDoMedico(nota, medicoId)

      return {
        soapNoteId: nota.id,
        sinteseEvidencias: nota.sinteseEvidencias ?? null,
        pubmedQuery: nota.pubmedQuery ?? null,
        evidenceMetadata: nota.evidenceMetadata ?? null,
        pronta: nota.sinteseEvidencias !== null,
      }
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
          feedbackMedico: conductAlerts.feedbackMedico,
          feedbackEm: conductAlerts.feedbackEm,
          createdAt: conductAlerts.createdAt,
        })
        .from(conductAlerts)
        .where(and(...conditions))
        .orderBy(desc(conductAlerts.createdAt))
        .limit(input?.limit ?? 20)
    }),

  /**
   * Registra o feedback do médico sobre um alerta de conduta.
   * O feedback é armazenado e alimenta o histórico do Prompt 06 em chamadas futuras,
   * reduzindo falsos positivos para o mesmo CID-10.
   */
  registrarFeedbackAlerta: medicoProcedure
    .input(z.object({
      alertaId: z.number().int().positive(),
      feedback: z.enum(['concordo', 'discordo', 'inaplicavel']),
      motivo: z.string().max(500).optional(),
    }))
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
        .set({
          feedbackMedico: input.feedback,
          feedbackMotivo: input.motivo ?? null,
          feedbackEm: new Date(),
          // Se médico deu feedback, considera o alerta visto automaticamente
          vistoPorId: medicoId,
          vistoEm: new Date(),
        })
        .where(eq(conductAlerts.id, input.alertaId))

      return { ok: true }
    }),

  /**
   * Suprime um tipo de alerta por N dias (baseado em supressao_sugerida_dias do Prompt 06).
   * Alertas futuros para o mesmo CID-10 não serão gerados até supressaoAte.
   */
  suprimirAlerta: medicoProcedure
    .input(z.object({
      alertaId: z.number().int().positive(),
      dias: z.number().int().min(1).max(365).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const medicoId = ctx.session.id

      const [alerta] = await db
        .select({
          id: conductAlerts.id,
          medicoId: conductAlerts.medicoId,
          alertaJson: conductAlerts.alertaJson,
        })
        .from(conductAlerts)
        .where(eq(conductAlerts.id, input.alertaId))
        .limit(1)

      if (!alerta) throw new TRPCError({ code: 'NOT_FOUND' })
      if (alerta.medicoId !== medicoId) throw new TRPCError({ code: 'FORBIDDEN' })

      const json = alerta.alertaJson as { supressao_sugerida_dias?: number } | null
      const dias = input.dias ?? json?.supressao_sugerida_dias ?? 30
      const supressaoAte = new Date()
      supressaoAte.setDate(supressaoAte.getDate() + dias)

      await db
        .update(conductAlerts)
        .set({ supressaoAte, vistoPorId: medicoId, vistoEm: new Date() })
        .where(eq(conductAlerts.id, input.alertaId))

      return { ok: true, supressaoAte, dias }
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

  // ── Publicações (CIS-10 e CIS-11) ─────────────────────────────────────────

  /** Lista rascunhos e publicações do médico. */
  listarPublicacoes: medicoProcedure
    .input(z.object({
      tipo: z.enum(['serie_casos', 'revisao_literatura']).optional(),
      status: z.enum(['rascunho', 'em_revisao', 'submetido', 'aceito', 'publicado']).optional(),
      limit: z.number().int().min(1).max(50).default(20),
    }).optional())
    .query(async ({ input, ctx }) => {
      const medicoId = ctx.session.id
      const conditions = [eq(publicationDrafts.medicoId, medicoId)]
      if (input?.tipo)   conditions.push(eq(publicationDrafts.tipo, input.tipo))
      if (input?.status) conditions.push(eq(publicationDrafts.status, input.status))

      return db
        .select({
          id:            publicationDrafts.id,
          tipo:          publicationDrafts.tipo,
          status:        publicationDrafts.status,
          titulo:        publicationDrafts.titulo,
          diagnostico:   publicationDrafts.diagnostico,
          cid10:         publicationDrafts.cid10,
          tema:          publicationDrafts.tema,
          nCasos:        publicationDrafts.nCasos,
          nArtigos:      publicationDrafts.nArtigos,
          jornal:        publicationDrafts.jornal,
          doi:           publicationDrafts.doi,
          dataSubmissao: publicationDrafts.dataSubmissao,
          createdAt:     publicationDrafts.createdAt,
          atualizadoEm:  publicationDrafts.atualizadoEm,
        })
        .from(publicationDrafts)
        .where(and(...conditions))
        .orderBy(desc(publicationDrafts.createdAt))
        .limit(input?.limit ?? 20)
    }),

  /**
   * Disparo manual de geração de série de casos (CIS-10).
   * Alternativa ao disparo automático por acumulação.
   * Requer ao menos 3 soapNoteIds do mesmo CID-10.
   */
  gerarSerie: medicoProcedure
    .input(z.object({
      cid10: z.string().min(2).max(10),
      diagnostico: z.string().min(2).max(255),
      soapNoteIds: z.array(z.number().int().positive()).min(3).max(20),
    }))
    .mutation(async ({ input, ctx }) => {
      const medicoId = ctx.session.id

      // Valida que todas as notas pertencem ao médico autenticado
      const notas = await db
        .select({ id: soapNotes.id })
        .from(soapNotes)
        .where(and(
          eq(soapNotes.medicoId, medicoId),
          sql`${soapNotes.id} IN ${input.soapNoteIds}`,
        ))

      if (notas.length < 3) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Mínimo 3 notas válidas necessárias.' })
      }

      const { enqueueCaseSeries } = await import('../caseSeriesQueue.ts')
      const enfileirado = await enqueueCaseSeries({
        medicoId,
        cid10: input.cid10,
        diagnostico: input.diagnostico,
        soapNoteIds: notas.map(n => n.id),
        disparadoPor: 'manual',
      })

      if (!enfileirado) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Já existe um rascunho ativo para este CID-10. Consulte listarPublicacoes.',
        })
      }

      return { ok: true, nCasos: notas.length }
    }),

  /**
   * Solicita revisão narrativa de literatura (CIS-11).
   * Se soapNoteId for fornecido, extrai lacunas da síntese (seção 4a do Prompt 03)
   * e usa-as para enriquecer a query PubMed e contextualizar o Prompt 11.
   */
  solicitarRevisaoLiteratura: medicoProcedure
    .input(z.object({
      tema: z.string().min(5).max(255),
      contextoClinicos: z.string().max(2000).optional(),
      /** Se informado, extrai lacunas da síntese dessa nota para guiar a revisão */
      soapNoteId: z.number().int().positive().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const medicoId = ctx.session.id

      const { gerarRevisaoLiteratura } = await import('../clinicalIntelligence.ts')
      const { buscarArtigosDual } = await import('../pubmed.ts')
      const { publicarRevisaoLiteratura } = await import('../obsidian.ts')
      const { extrairGradeMetadata } = await import('../pubmedQueue.ts')

      // C3 — Extrai lacunas da síntese quando soapNoteId é fornecido
      let lacunasContexto = ''
      let queryEnriquecida = input.tema
      if (input.soapNoteId) {
        const [nota] = await db
          .select({ sinteseEvidencias: soapNotes.sinteseEvidencias, medicoId: soapNotes.medicoId })
          .from(soapNotes)
          .where(eq(soapNotes.id, input.soapNoteId))
          .limit(1)

        if (!nota) throw new TRPCError({ code: 'NOT_FOUND', message: 'SOAP note não encontrada.' })
        if (nota.medicoId !== medicoId) throw new TRPCError({ code: 'FORBIDDEN' })

        if (nota.sinteseEvidencias) {
          const gradeData = extrairGradeMetadata(nota.sinteseEvidencias)
          if (gradeData.lacunas.length > 0) {
            lacunasContexto = `\n\nLacunas identificadas na síntese anterior (seção 4a):\n${gradeData.lacunas.map((l, i) => `${i + 1}. ${l}`).join('\n')}\n\nFoco prioritário: endereçar essas lacunas com evidências atualizadas.`
            // Enriquece a query PubMed com termos das lacunas
            const termoLacuna = gradeData.lacunas[0]?.split(/\s+/).slice(0, 5).join(' ') ?? ''
            if (termoLacuna) queryEnriquecida = `${input.tema} ${termoLacuna}`
          }
        }
      }

      // Busca artigos com query enriquecida pelas lacunas
      const artigos = await buscarArtigosDual(queryEnriquecida, [], 15)
      if (artigos.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Nenhum artigo encontrado para este tema no PubMed.' })
      }

      const contextoClinico = (input.contextoClinicos ?? '') + lacunasContexto

      // Gera revisão (Prompt 11 — Opus)
      const revisao = await gerarRevisaoLiteratura({
        tema: input.tema,
        nArtigos: artigos.length,
        artigosJson: JSON.stringify(artigos),
        contextoClinico,
      })

      // Persiste
      await db.insert(publicationDrafts).values({
        medicoId,
        tipo: 'revisao_literatura',
        status: 'rascunho',
        tema: input.tema,
        nArtigos: artigos.length,
        textoGerado: revisao.texto,
      })

      const [draft] = await db
        .select({ id: publicationDrafts.id })
        .from(publicationDrafts)
        .where(and(
          eq(publicationDrafts.medicoId, medicoId),
          eq(publicationDrafts.tipo, 'revisao_literatura'),
        ))
        .orderBy(desc(publicationDrafts.createdAt))
        .limit(1)

      // Publica no Obsidian (best-effort)
      publicarRevisaoLiteratura({ tema: input.tema, nArtigos: artigos.length, texto: revisao.texto }).catch(() => null)

      return { ok: true, draftId: draft?.id, nArtigos: artigos.length }
    }),

  /** Atualiza status de publicação (rascunho → submetido → publicado). */
  atualizarStatusPublicacao: medicoProcedure
    .input(z.object({
      draftId:       z.number().int().positive(),
      status:        z.enum(['rascunho', 'em_revisao', 'submetido', 'aceito', 'publicado']),
      jornal:        z.string().max(255).optional(),
      doi:           z.string().max(255).optional(),
      dataSubmissao: z.string().datetime().optional(),
      dataPublicacao: z.string().datetime().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const medicoId = ctx.session.id

      const [draft] = await db
        .select({ id: publicationDrafts.id, medicoId: publicationDrafts.medicoId })
        .from(publicationDrafts)
        .where(eq(publicationDrafts.id, input.draftId))
        .limit(1)

      if (!draft) throw new TRPCError({ code: 'NOT_FOUND' })
      if (draft.medicoId !== medicoId) throw new TRPCError({ code: 'FORBIDDEN' })

      await db
        .update(publicationDrafts)
        .set({
          status:         input.status,
          jornal:         input.jornal,
          doi:            input.doi,
          dataSubmissao:  input.dataSubmissao ? new Date(input.dataSubmissao) : undefined,
          dataPublicacao: input.dataPublicacao ? new Date(input.dataPublicacao) : undefined,
          atualizadoEm:   new Date(),
        })
        .where(eq(publicationDrafts.id, input.draftId))

      return { ok: true }
    }),
})
