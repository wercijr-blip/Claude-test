import { z } from 'zod'
import { router, protectedProcedure, medicoProcedure } from '../_core/trpc.ts'
import { TRPCError } from '@trpc/server'
import { db } from '../db.ts'
import { consultasInicio, accessTokens, precadastros } from '../../drizzle/schema.ts'
import { eq, desc } from 'drizzle-orm'
import { decrypt } from '../_core/encryption.ts'
import { validarExameHiv } from '../examValidation.ts'
import { gerarPedidosExames } from '../pdfExameRequest.ts'
import { assinarPdf } from '../pdfSigner.ts'
import { uploadBuffer } from '../storage.ts'
import { DIAS_VALIDADE_LINK_UPLOAD } from '../../shared/const.ts'

function assertPatient(session: unknown): asserts session is { type: 'patient'; tokenId: number; pacienteId: number | null } {
  if (!session || (session as { type: string }).type !== 'patient') {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
}

async function getNomeEsperado(tokenId: number): Promise<string | undefined> {
  const [precad] = await db
    .select({ nomeEncrypted: precadastros.nomeEncrypted })
    .from(precadastros)
    .where(eq(precadastros.accessTokenId, tokenId))
    .limit(1)
  if (!precad) return undefined
  return decrypt(precad.nomeEncrypted).split(' ')[0]
}

export const consultaRouter = router({
  // Paciente escolhe tipo de consulta e responde se tem exame recente
  iniciar: protectedProcedure
    .input(z.object({
      tipoConsulta: z.enum(['primeiro_atendimento', 'ja_faco_prep']),
      temExameRecente: z.boolean(),
    }))
    .mutation(async ({ input, ctx }) => {
      assertPatient(ctx.session)

      const [existing] = await db
        .select()
        .from(consultasInicio)
        .where(eq(consultasInicio.tokenId, ctx.session.tokenId))
        .limit(1)

      if (existing && existing.status !== 'aguardando_escolha') {
        return { consultaId: existing.id, status: existing.status }
      }

      const linkExpiresAt = new Date()
      linkExpiresAt.setDate(linkExpiresAt.getDate() + DIAS_VALIDADE_LINK_UPLOAD)

      const data = {
        tipoConsulta: input.tipoConsulta,
        temExameRecente: input.temExameRecente,
        status: 'aguardando_upload',
        linkExpiresAt,
        updatedAt: new Date(),
      }

      if (existing) {
        await db.update(consultasInicio).set(data).where(eq(consultasInicio.id, existing.id))
        return { consultaId: existing.id, status: 'aguardando_upload' }
      }

      await db.insert(consultasInicio).values({ tokenId: ctx.session.tokenId, ...data })

      const [inserted] = await db
        .select({ id: consultasInicio.id })
        .from(consultasInicio)
        .where(eq(consultasInicio.tokenId, ctx.session.tokenId))
        .orderBy(desc(consultasInicio.createdAt))
        .limit(1)

      return { consultaId: inserted.id, status: 'aguardando_upload' }
    }),

  // Gerar e retornar PDFs dos pedidos de exame (para quem não tem exame recente)
  gerarPedidos: protectedProcedure
    .mutation(async ({ ctx }) => {
      assertPatient(ctx.session)

      const [consulta] = await db
        .select()
        .from(consultasInicio)
        .where(eq(consultasInicio.tokenId, ctx.session.tokenId))
        .limit(1)

      if (!consulta?.tipoConsulta) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Inicie o atendimento primeiro.' })

      // Se já gerou, retornar os links existentes
      if (consulta.pedidoCompletoS3Key && consulta.pedidoHivS3Key) {
        const { getPresignedUrl } = await import('../storage.ts')
        return {
          urlCompleto: await getPresignedUrl(consulta.pedidoCompletoS3Key, 3600),
          urlHiv: await getPresignedUrl(consulta.pedidoHivS3Key, 3600),
        }
      }

      const nomeEsperado = await getNomeEsperado(ctx.session.tokenId)
      const nomePaciente = nomeEsperado ?? 'Paciente'

      const { completo, hiv } = await gerarPedidosExames(
        consulta.tipoConsulta as 'primeiro_atendimento' | 'ja_faco_prep',
        nomePaciente,
      )

      // Assinar ambos os pedidos com ICP-Brasil
      const [{ buffer: completoAssinado }, { buffer: hivAssinado }] = await Promise.all([
        assinarPdf(completo, 'Pedido de Exames PrEP — Facilita PrEP'),
        assinarPdf(hiv, 'Pedido de Exame Anti-HIV — Facilita PrEP'),
      ])

      const ts = Date.now()
      const keyCompleto = `pedidos/${ctx.session.tokenId}/${ts}-completo.pdf`
      const keyHiv = `pedidos/${ctx.session.tokenId}/${ts}-hiv.pdf`

      await Promise.all([
        uploadBuffer(keyCompleto, completoAssinado, 'application/pdf'),
        uploadBuffer(keyHiv, hivAssinado, 'application/pdf'),
      ])

      await db.update(consultasInicio)
        .set({ pedidoCompletoS3Key: keyCompleto, pedidoHivS3Key: keyHiv, updatedAt: new Date() })
        .where(eq(consultasInicio.id, consulta.id))

      const { getPresignedUrl } = await import('../storage.ts')
      return {
        urlCompleto: await getPresignedUrl(keyCompleto, 3600),
        urlHiv: await getPresignedUrl(keyHiv, 3600),
      }
    }),

  // Paciente faz upload do exame e dispara validação por IA
  uploadExame: protectedProcedure
    .input(z.object({ s3Key: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      assertPatient(ctx.session)

      const [consulta] = await db
        .select()
        .from(consultasInicio)
        .where(eq(consultasInicio.tokenId, ctx.session.tokenId))
        .limit(1)

      if (!consulta) throw new TRPCError({ code: 'NOT_FOUND' })
      if (consulta.status === 'aprovado') return { status: 'aprovado' }

      // Verificar validade do link
      if (consulta.linkExpiresAt && consulta.linkExpiresAt < new Date()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'O prazo para envio do exame expirou. Entre em contato com a clínica.' })
      }

      await db.update(consultasInicio)
        .set({ exameS3Key: input.s3Key, status: 'em_validacao_ia', updatedAt: new Date() })
        .where(eq(consultasInicio.id, consulta.id))

      const nomeEsperado = await getNomeEsperado(ctx.session.tokenId)

      let resultado
      try {
        resultado = await validarExameHiv(input.s3Key, nomeEsperado)
      } catch {
        // Erro na IA → encaminhar para médico
        await db.update(consultasInicio)
          .set({ status: 'em_validacao_medica', motivoRejeicao: 'Erro na análise automática', updatedAt: new Date() })
          .where(eq(consultasInicio.id, consulta.id))
        return { status: 'em_validacao_medica' }
      }

      const novoStatus = resultado.aprovado ? 'aprovado' : 'em_validacao_medica'

      await db.update(consultasInicio)
        .set({
          status: novoStatus,
          resultadoIa: resultado,
          motivoRejeicao: resultado.motivo ?? undefined,
          updatedAt: new Date(),
        })
        .where(eq(consultasInicio.id, consulta.id))

      return { status: novoStatus, aprovado: resultado.aprovado, motivo: resultado.motivo }
    }),

  // Paciente consulta status atual
  status: protectedProcedure
    .query(async ({ ctx }) => {
      assertPatient(ctx.session)

      const [consulta] = await db
        .select()
        .from(consultasInicio)
        .where(eq(consultasInicio.tokenId, ctx.session.tokenId))
        .limit(1)

      if (!consulta) return { status: 'aguardando_escolha' as const, tipoConsulta: null }

      const resultadoIa = consulta.resultadoIa as { dataExame?: string; resultadoHiv?: string } | null

      return {
        status: consulta.status,
        tipoConsulta: consulta.tipoConsulta,
        temExameRecente: consulta.temExameRecente,
        motivoRejeicao: consulta.motivoRejeicao,
        linkExpiresAt: consulta.linkExpiresAt,
        dataExame: consulta.dataExameValidado ?? resultadoIa?.dataExame ?? null,
        resultadoHiv: consulta.resultadoHivValidado ?? resultadoIa?.resultadoHiv ?? null,
      }
    }),

  // Médico: listar exames aguardando revisão manual
  medico: router({
    listarRevisoes: medicoProcedure
      .query(async () => {
        const rows = await db
          .select({
            id: consultasInicio.id,
            tipoConsulta: consultasInicio.tipoConsulta,
            resultadoIa: consultasInicio.resultadoIa,
            motivoRejeicao: consultasInicio.motivoRejeicao,
            exameS3Key: consultasInicio.exameS3Key,
            createdAt: consultasInicio.createdAt,
            // email do paciente via accessTokens
            patientEmail: accessTokens.patientEmail,
          })
          .from(consultasInicio)
          .leftJoin(accessTokens, eq(accessTokens.id, consultasInicio.tokenId))
          .where(eq(consultasInicio.status, 'em_validacao_medica'))
          .orderBy(desc(consultasInicio.createdAt))

        const { getPresignedUrl } = await import('../storage.ts')
        return Promise.all(
          rows.map(async (r) => ({
            ...r,
            urlExame: r.exameS3Key ? await getPresignedUrl(r.exameS3Key, 600) : null,
          })),
        )
      }),

    validar: medicoProcedure
      .input(z.object({
        consultaId: z.number(),
        aprovado: z.boolean(),
        resultadoHiv: z.enum(['reagente', 'nao_reagente']).optional(),
        dataExame: z.string().optional(),
        observacoes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.update(consultasInicio)
          .set({
            status: input.aprovado ? 'aprovado' : 'rejeitado',
            validadoPorId: ctx.session.id,
            validadoEm: new Date(),
            resultadoHivValidado: input.resultadoHiv,
            dataExameValidado: input.dataExame,
            observacoesMedico: input.observacoes,
            updatedAt: new Date(),
          })
          .where(eq(consultasInicio.id, input.consultaId))

        return { ok: true }
      }),
  }),
})
