import { z } from 'zod'
import { router, adminProcedure } from '../_core/trpc.ts'
import { TRPCError } from '@trpc/server'
import { db } from '../db.ts'
import { users, securityEvents, pacientes, exames, pdfs, consultasInicio } from '../../drizzle/schema.ts'
import { eq, desc, inArray, count, isNull, and } from 'drizzle-orm'
import type { Role } from '../../shared/types.ts'
import { decrypt } from '../_core/encryption.ts'
import { filtrarExamePorStatus } from '../examUtils.ts'
import { inspecionarCertificado, assinarPdf } from '../pdfSigner.ts'
import { gerarEEnviarLinkAcesso } from './intake.ts'
import { env } from '../_core/env.ts'
import { linkAcessoQueue } from '../pdfQueue.ts'
import { logAudit } from '../_core/audit.ts'
import { uploadBuffer, deleteObject, getPresignedUrl } from '../storage.ts'
import { preencherFichaAtendimento, buildConfigClinica, mapPrepAdesaoLabel } from '../sus/preencherFichaAtendimento.ts'

type ResultadoIaJson = {
  status?: string
  [key: string]: unknown
}

export const adminRouter = router({
  // ── Gestão de equipe ──────────────────────────────────────────

  // Listar equipe (excluindo soft-deleted)
  listarUsuarios: adminProcedure.query(async () => {
    return db.select().from(users).where(isNull(users.deletedAt)).orderBy(users.createdAt)
  }),

  // Cadastrar novo usuário da equipe
  cadastrarUsuario: adminProcedure
    .input(z.object({
      email: z.string().email(),
      nome: z.string().min(2),
      role: z.enum(['secretaria', 'medico', 'admin']),
    }))
    .mutation(async ({ input }) => {
      // Verificar se já existe usuário com esse e-mail
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1)

      if (existing.length > 0) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Já existe um usuário com esse e-mail.' })
      }

      // openId será preenchido no primeiro login via SSO; usamos e-mail como placeholder
      await db.insert(users).values({
        openId: `pending:${input.email}`,
        email: input.email,
        nome: input.nome,
        role: input.role as Role,
        ativo: true,
      })

      return { ok: true }
    }),

  // Alterar role de usuário
  alterarRole: adminProcedure
    .input(z.object({ userId: z.number(), role: z.enum(['secretaria', 'medico', 'admin']) }))
    .mutation(async ({ input }) => {
      const [user] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1)
      if (!user) throw new TRPCError({ code: 'NOT_FOUND' })

      await db
        .update(users)
        .set({ role: input.role as Role, updatedAt: new Date() })
        .where(eq(users.id, input.userId))

      return { ok: true }
    }),

  // Ativar/desativar usuário
  toggleAtivo: adminProcedure
    .input(z.object({ userId: z.number(), ativo: z.boolean() }))
    .mutation(async ({ input }) => {
      await db
        .update(users)
        .set({ ativo: input.ativo, updatedAt: new Date() })
        .where(eq(users.id, input.userId))
      return { ok: true }
    }),

  // Soft-delete: marca deletedAt/deletedBy, desativa acesso. Nunca hard-delete.
  deletarStaff: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (input.userId === ctx.session.id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Você não pode deletar sua própria conta.' })
      }

      const [target] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1)
      if (!target) throw new TRPCError({ code: 'NOT_FOUND' })
      if (target.deletedAt) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Usuário já foi deletado.' })

      // Prevent deleting the last active admin
      if (target.role === 'admin') {
        const [{ activeTotal }] = await db
          .select({ activeTotal: count() })
          .from(users)
          .where(and(eq(users.role, 'admin'), isNull(users.deletedAt)))
        if (activeTotal <= 1) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Não é possível deletar o último administrador ativo.' })
        }
      }

      await db
        .update(users)
        .set({ deletedAt: new Date(), deletedBy: ctx.session.id, ativo: false, updatedAt: new Date() })
        .where(eq(users.id, input.userId))

      await logAudit({
        actorId: ctx.session.id,
        actorRole: ctx.session.role,
        action: 'admin.user_delete',
        resourceType: 'user',
        resourceId: input.userId,
        detalhes: { targetEmail: target.email, targetRole: target.role },
      })

      return { ok: true }
    }),

  // Reativar usuário soft-deleted
  reativarStaff: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const [target] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1)
      if (!target) throw new TRPCError({ code: 'NOT_FOUND' })
      if (!target.deletedAt) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Usuário não está deletado.' })

      await db
        .update(users)
        .set({ deletedAt: null, deletedBy: null, ativo: true, updatedAt: new Date() })
        .where(eq(users.id, input.userId))

      await logAudit({
        actorId: ctx.session.id,
        actorRole: ctx.session.role,
        action: 'admin.user_restore',
        resourceType: 'user',
        resourceId: input.userId,
        detalhes: { targetEmail: target.email, targetRole: target.role },
      })

      return { ok: true }
    }),

  // ── Pacientes ─────────────────────────────────────────────────

  // Listar todos os pacientes do sistema
  listarTodosPacientes: adminProcedure
    .input(z.object({
      busca: z.string().optional(),
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(200).default(50),
    }).optional())
    .query(async ({ input }) => {
      const page = input?.page ?? 1
      const limit = input?.limit ?? 50
      const offset = (page - 1) * limit

      const [rows, [totalRow]] = await Promise.all([
        db.select().from(pacientes).orderBy(desc(pacientes.createdAt)).limit(limit).offset(offset),
        db.select({ total: count() }).from(pacientes),
      ])

      const decrypted = rows.map((p) => ({
        id: p.id,
        nome: decrypt(p.nomeEncrypted),
        cpfHash: p.cpfHash,
        status: p.status,
        tipoAtendimento: p.tipoAtendimento,
        convenio: p.convenio,
        currentStep: p.currentStep,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }))

      const total = totalRow?.total ?? 0

      if (input?.busca) {
        const termo = input.busca.toLowerCase()
        const filtered = decrypted.filter(
          (p) => p.nome.toLowerCase().includes(termo) || p.cpfHash.includes(termo),
        )
        return { data: filtered, total: filtered.length, page: 1, pages: 1 }
      }

      return { data: decrypted, total, page, pages: Math.ceil(total / limit) }
    }),

  // ── Documentos / Exames ───────────────────────────────────────

  // Listar todos os documentos enviados por pacientes (poder de secretaria)
  listarDocumentos: adminProcedure
    .input(
      z.object({
        status: z.enum(['todos', 'pendente', 'validado', 'rejeitado', 'liberado']).default('todos'),
      }).optional(),
    )
    .query(async ({ input }) => {
      const rows = await db
        .select({
          id: exames.id,
          pacienteId: exames.pacienteId,
          nomeArquivo: exames.nomeArquivo,
          tipoExame: exames.tipoExame,
          mimeType: exames.mimeType,
          resultadoIa: exames.resultadoIa,
          revisadoEm: exames.revisadoEm,
          liberadoEm: exames.liberadoEm,
          createdAt: exames.createdAt,
          pacienteNomeEncrypted: pacientes.nomeEncrypted,
          pacienteEmailEncrypted: pacientes.emailEncrypted,
          pacienteStatus: pacientes.status,
          pacienteTipoAtendimento: pacientes.tipoAtendimento,
        })
        .from(exames)
        .leftJoin(pacientes, eq(pacientes.id, exames.pacienteId))
        .orderBy(desc(exames.createdAt))

      const statusFiltro = input?.status ?? 'todos'

      return rows
        .filter((r) =>
          filtrarExamePorStatus(r.resultadoIa as { status?: string } | null, statusFiltro),
        )
        .map((r) => ({
          id: r.id,
          pacienteId: r.pacienteId,
          nomeArquivo: r.nomeArquivo,
          tipoExame: r.tipoExame,
          mimeType: r.mimeType,
          resultadoIa: r.resultadoIa,
          revisadoEm: r.revisadoEm,
          liberadoEm: r.liberadoEm,
          createdAt: r.createdAt,
          paciente: {
            nome: r.pacienteNomeEncrypted ? decrypt(r.pacienteNomeEncrypted) : null,
            email: r.pacienteEmailEncrypted ? decrypt(r.pacienteEmailEncrypted) : null,
            status: r.pacienteStatus,
            tipoAtendimento: r.pacienteTipoAtendimento,
          },
        }))
    }),

  // Liberar exame rejeitado pela IA (poder de médico)
  liberarExameSemValidacao: adminProcedure
    .input(z.object({
      exameId: z.number(),
      observacoes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const [exame] = await db.select().from(exames).where(eq(exames.id, input.exameId)).limit(1)
      if (!exame) throw new TRPCError({ code: 'NOT_FOUND', message: 'Exame não encontrado.' })

      const resultadoAtual = exame.resultadoIa as ResultadoIaJson | null
      if (
        resultadoAtual?.status !== 'rejeitado_ia' &&
        resultadoAtual?.status !== 'rejeitado'
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Apenas exames rejeitados pela IA podem ser liberados manualmente.',
        })
      }

      const novoResultado: ResultadoIaJson = {
        ...resultadoAtual,
        status: 'liberado_manualmente',
        observacoesMedico: input.observacoes ?? null,
        liberadoEm: new Date().toISOString(),
      }

      await db
        .update(exames)
        .set({
          resultadoIa: novoResultado,
          liberadoPorMedicoId: ctx.session.id,
          liberadoEm: new Date(),
          revisadoPorId: ctx.session.id,
          revisadoEm: new Date(),
        })
        .where(eq(exames.id, input.exameId))

      return { ok: true }
    }),

  // Listar pacientes pendentes de revisão médica (poder de médico)
  listarPendentes: adminProcedure.query(async () => {
    const rows = await db
      .select()
      .from(pacientes)
      .where(inArray(pacientes.status, ['pendente', 'em_revisao']))
      .orderBy(pacientes.createdAt)
      .limit(500)

    return rows.map((p) => ({
      id: p.id,
      nome: decrypt(p.nomeEncrypted),
      status: p.status,
      currentStep: p.currentStep,
      tipoAtendimento: p.tipoAtendimento,
      createdAt: p.createdAt,
    }))
  }),

  // ── Auditoria ─────────────────────────────────────────────────

  // Log de eventos de segurança
  listarEventos: adminProcedure
    .input(z.object({ limit: z.number().max(200).default(50) }))
    .query(async ({ input }) => {
      return db
        .select()
        .from(securityEvents)
        .orderBy(desc(securityEvents.createdAt))
        .limit(input.limit)
    }),

  // ── Saúde do certificado ICP-Brasil ─────────────────────────
  // Mostra status, titular, emissor, serial e dias até expirar do .pfx
  // configurado (via ICP_PFX_BASE64 ou server/certs/werciley.pfx).
  saudeCertificado: adminProcedure.query(async () => {
    return inspecionarCertificado()
  }),

  // Reenviar link de acesso para um pré-cadastro específico (recuperação manual)
  recuperarPagamento: adminProcedure
    .input(z.object({ precadastroId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await gerarEEnviarLinkAcesso(input.precadastroId)
      return { ok: true, precadastroId: input.precadastroId }
    }),

  // Exportar auditoria como CSV (retorna string CSV)
  exportarAuditoria: adminProcedure.query(async () => {
    const eventos = await db
      .select()
      .from(securityEvents)
      .orderBy(desc(securityEvents.createdAt))
      .limit(5000)

    const header = 'id,tipoEvento,userId,ipAddress,createdAt,detalhes'
    const linhas = eventos.map((e) => {
      const detalhes = e.detalhes ? JSON.stringify(e.detalhes).replace(/"/g, '""') : ''
      return [
        e.id,
        e.tipoEvento,
        e.userId ?? '',
        e.ipAddress ?? '',
        e.createdAt.toISOString(),
        `"${detalhes}"`,
      ].join(',')
    })

    return { csv: [header, ...linhas].join('\n') }
  }),

  // ── Saúde do fluxo de intake ──────────────────────────────────
  // Verifica env vars críticas e conectividade com Redis/BullMQ.
  // Bater nesse endpoint antes de testar fluxos de pagamento confirma
  // que todos os recursos estão disponíveis.
  regenerarFichaAtendimento: adminProcedure
    .input(z.object({ pacienteId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const { pacienteId } = input

      const [p] = await db.select().from(pacientes).where(eq(pacientes.id, pacienteId)).limit(1)
      if (!p) throw new TRPCError({ code: 'NOT_FOUND', message: 'Paciente não encontrado' })

      const [consulta] = await db
        .select({ tipoConsulta: consultasInicio.tipoConsulta, dataExameValidado: consultasInicio.dataExameValidado })
        .from(consultasInicio)
        .where(eq(consultasInicio.tokenId, p.tokenId))
        .limit(1)

      // Delete corrupted ficha(s) from S3 + DB
      const fichasExistentes = await db
        .select({ id: pdfs.id, s3Key: pdfs.s3Key })
        .from(pdfs)
        .where(and(eq(pdfs.pacienteId, pacienteId), eq(pdfs.tipo, 'ficha_atendimento')))
      for (const f of fichasExistentes) {
        await deleteObject(f.s3Key).catch(() => {})
        await db.delete(pdfs).where(eq(pdfs.id, f.id))
      }

      const nome = decrypt(p.nomeEncrypted)
      const cpf = decrypt(p.cpfEncrypted)
      const dataNascimento = p.dataNascimentoEncrypted ? decrypt(p.dataNascimentoEncrypted) : ''
      const nomeMae = p.nomeMaeEncrypted ? decrypt(p.nomeMaeEncrypted) : ''

      const cond = (p.condutaJson ?? {}) as {
        temSintomasDst?: boolean
        usoDrogas?: boolean
        prepAdesao?: 'diaria' | 'sob_demanda'
      }
      const prepAdesaoLabel = mapPrepAdesaoLabel(cond.prepAdesao)
      const configClinica = buildConfigClinica()

      const fichaBuf = Buffer.from(await preencherFichaAtendimento({
        pacienteId,
        cpf, nome, nomeMae, dataNascimento,
        dataExameHiv: consulta?.dataExameValidado ?? null,
        prepModalidade: (p.prepModalidade as 'PrEP diária' | 'PrEP sob demanda' | null) ?? 'PrEP diária',
        tipoConsulta: (consulta?.tipoConsulta as 'primeiro_atendimento' | 'ja_faco_prep') ?? 'primeiro_atendimento',
        prepAdesao: prepAdesaoLabel ?? null,
        temSintomasDst: cond.temSintomasDst ?? null,
        usoDrogas: cond.usoDrogas ?? null,
      }, configClinica))

      const { buffer: signedFicha, certificadoSerial, assinadoEm } =
        await assinarPdf(fichaBuf, 'Ficha de Atendimento PrEP — Facilita PrEP')
      const fichaKey = `pdfs/${pacienteId}/${Date.now()}-ficha-atendimento.pdf`
      await uploadBuffer(fichaKey, signedFicha, 'application/pdf')
      await db.insert(pdfs).values({ pacienteId, s3Key: fichaKey, tipo: 'ficha_atendimento', certificadoSerial, assinadoEm })

      const [url] = await Promise.all([
        getPresignedUrl(fichaKey, 3600),
        logAudit({ actorId: ctx.session.id, actorRole: ctx.session.role, action: 'pdf.generate', resourceType: 'ficha_atendimento', resourceId: pacienteId, detalhes: { fichasRemovidas: fichasExistentes.length } }),
      ])
      return { ok: true, url, fichasRemovidas: fichasExistentes.length }
    }),

  saudeIntake: adminProcedure.query(async () => {
    let redisOk = false
    let linkAcessoQueueSize: number | null = null
    try {
      linkAcessoQueueSize = await linkAcessoQueue.count()
      redisOk = true
    } catch {
      // Redis inacessível
    }

    return {
      appUrl: env.APP_URL,
      appUrlOk: !!env.APP_URL,
      resendKey: !!env.RESEND_API_KEY,
      zapiInstanceId: !!env.ZAPI_INSTANCE_ID,
      zapiToken: !!env.ZAPI_TOKEN,
      asaasKey: !!env.ASAAS_API_KEY,
      asaasEnv: env.ASAAS_ENV,
      redisOk,
      linkAcessoQueueSize,
    }
  }),
})
