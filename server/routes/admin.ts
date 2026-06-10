/**
 * adminRouter — Painel administrativo
 * Seções: equipe | pacientes | documentos | auditoria | certificado | intake | dlq
 * Cada procedure usa adminProcedure (role: admin).
 *
 * Sub-modules:
 *   admin/users.ts — gestão de equipe (listarUsuarios, cadastrarUsuario, …)
 *   admin/dlq.ts   — dead letter queue (listarDlq, reprocessarDlqJob)
 */
import { z } from "zod";
import { router, adminProcedure } from "../_core/trpc.ts";
import { TRPCError } from "@trpc/server";
import { db } from "../db.ts";
import {
  securityEvents,
  pacientes,
  exames,
  pdfs,
  consultasInicio,
} from "../../drizzle/schema.ts";
import { eq, desc, inArray, count, and } from "drizzle-orm";
import { decrypt, safeDecrypt } from "../_core/encryption.ts";
import { filtrarExamePorStatus } from "../examUtils.ts";
import { inspecionarCertificado, assinarPdf } from "../pdfSigner.ts";
import { gerarEEnviarLinkAcesso } from "./intake.ts";
import { env } from "../_core/env.ts";
import { linkAcessoQueue } from "../pdfQueue.ts";
import { logAudit } from "../_core/audit.ts";
import { uploadBuffer, deleteObject, getPresignedUrl } from "../storage.ts";
import {
  preencherFichaAtendimento,
  buildConfigClinica,
  mapPrepAdesaoLabel,
} from "../sus/preencherFichaAtendimento.ts";
import { okEmpty } from "../_core/response.ts";
import { userProcedures } from "./admin/users.ts";
import { dlqProcedures } from "./admin/dlq.ts";
import type { ResultadoIa } from "../../shared/types.ts";

export const adminRouter = router({
  // ── Gestão de equipe — ver admin/users.ts ─────────────────────
  ...userProcedures,

  // ── Pacientes ─────────────────────────────────────────────────

  // Listar todos os pacientes do sistema
  listarTodosPacientes: adminProcedure
    .input(
      z
        .object({
          busca: z.string().optional(),
          page: z.number().int().min(1).default(1),
          limit: z.number().int().min(1).max(200).default(50),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 50;
      const offset = (page - 1) * limit;

      const [rows, [totalRow]] = await Promise.all([
        db
          .select()
          .from(pacientes)
          .orderBy(desc(pacientes.createdAt))
          .limit(limit)
          .offset(offset),
        db.select({ total: count() }).from(pacientes),
      ]);

      const decrypted = rows.map((p) => ({
        id: p.id,
        nome: safeDecrypt(p.nomeEncrypted),
        cpfHash: p.cpfHash,
        status: p.status,
        tipoAtendimento: p.tipoAtendimento,
        convenio: p.convenio,
        currentStep: p.currentStep,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }));

      const total = totalRow?.total ?? 0;

      if (input?.busca) {
        const termo = input.busca.toLowerCase();
        const filtered = decrypted.filter(
          (p) =>
            p.nome.toLowerCase().includes(termo) || p.cpfHash.includes(termo),
        );
        return { data: filtered, total: filtered.length, page: 1, pages: 1 };
      }

      return { data: decrypted, total, page, pages: Math.ceil(total / limit) };
    }),

  // ── Documentos / Exames ───────────────────────────────────────

  // Listar todos os documentos enviados por pacientes (poder de secretaria)
  listarDocumentos: adminProcedure
    .input(
      z
        .object({
          status: z
            .enum(["todos", "pendente", "validado", "rejeitado", "liberado"])
            .default("todos"),
        })
        .optional(),
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
        .limit(500);

      const statusFiltro = input?.status ?? "todos";

      return rows
        .filter((r) =>
          filtrarExamePorStatus(
            r.resultadoIa as { status?: string } | null,
            statusFiltro,
          ),
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
            nome: r.pacienteNomeEncrypted
              ? safeDecrypt(r.pacienteNomeEncrypted)
              : null,
            email: r.pacienteEmailEncrypted
              ? safeDecrypt(r.pacienteEmailEncrypted)
              : null,
            status: r.pacienteStatus,
            tipoAtendimento: r.pacienteTipoAtendimento,
          },
        }));
    }),

  // Liberar exame rejeitado pela IA (poder de médico)
  liberarExameSemValidacao: adminProcedure
    .input(
      z.object({
        exameId: z.number(),
        observacoes: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [exame] = await db
        .select()
        .from(exames)
        .where(eq(exames.id, input.exameId))
        .limit(1);
      if (!exame)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Exame não encontrado.",
        });

      const resultadoAtual = exame.resultadoIa;
      if (
        !resultadoAtual ||
        (resultadoAtual.status !== "rejeitado_ia" &&
          resultadoAtual.status !== "rejeitado")
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Apenas exames rejeitados pela IA podem ser liberados manualmente.",
        });
      }

      const novoResultado: ResultadoIa = {
        ...resultadoAtual,
        status: "liberado_manualmente",
        observacoesMedico: input.observacoes ?? null,
        liberadoEm: new Date().toISOString(),
      };

      await db
        .update(exames)
        .set({
          resultadoIa: novoResultado,
          liberadoPorMedicoId: ctx.session.id,
          liberadoEm: new Date(),
          revisadoPorId: ctx.session.id,
          revisadoEm: new Date(),
        })
        .where(eq(exames.id, input.exameId));

      return okEmpty();
    }),

  // Listar pacientes pendentes de revisão médica (poder de médico)
  listarPendentes: adminProcedure.query(async () => {
    const rows = await db
      .select()
      .from(pacientes)
      .where(inArray(pacientes.status, ["pendente", "em_revisao"]))
      .orderBy(pacientes.createdAt)
      .limit(500);

    return rows.map((p) => ({
      id: p.id,
      nome: safeDecrypt(p.nomeEncrypted),
      status: p.status,
      currentStep: p.currentStep,
      tipoAtendimento: p.tipoAtendimento,
      createdAt: p.createdAt,
    }));
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
        .limit(input.limit);
    }),

  // ── Saúde do certificado ICP-Brasil ─────────────────────────
  // Mostra status, titular, emissor, serial e dias até expirar do .pfx
  // configurado (via ICP_PFX_BASE64 ou server/certs/werciley.pfx).
  saudeCertificado: adminProcedure.query(async () => {
    return inspecionarCertificado();
  }),

  // Reenviar link de acesso para um pré-cadastro específico (recuperação manual)
  recuperarPagamento: adminProcedure
    .input(z.object({ precadastroId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await gerarEEnviarLinkAcesso(input.precadastroId);
      return { ok: true, precadastroId: input.precadastroId };
    }),

  // Exportar auditoria como CSV (retorna string CSV)
  exportarAuditoria: adminProcedure.query(async () => {
    const eventos = await db
      .select()
      .from(securityEvents)
      .orderBy(desc(securityEvents.createdAt))
      .limit(5000);

    const header = "id,tipoEvento,userId,ipAddress,createdAt,detalhes";
    const linhas = eventos.map((e) => {
      const detalhes = e.detalhes
        ? JSON.stringify(e.detalhes).replace(/"/g, '""')
        : "";
      return [
        e.id,
        e.tipoEvento,
        e.userId ?? "",
        e.ipAddress ?? "",
        e.createdAt.toISOString(),
        `"${detalhes}"`,
      ].join(",");
    });

    return { csv: [header, ...linhas].join("\n") };
  }),

  // ── Saúde do fluxo de intake ──────────────────────────────────
  // Verifica env vars críticas e conectividade com Redis/BullMQ.
  // Bater nesse endpoint antes de testar fluxos de pagamento confirma
  // que todos os recursos estão disponíveis.
  regenerarFichaAtendimento: adminProcedure
    .input(z.object({ pacienteId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const { pacienteId } = input;

      const [p] = await db
        .select()
        .from(pacientes)
        .where(eq(pacientes.id, pacienteId))
        .limit(1);
      if (!p)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Paciente não encontrado",
        });

      const [consulta] = await db
        .select({
          tipoConsulta: consultasInicio.tipoConsulta,
          dataExameValidado: consultasInicio.dataExameValidado,
        })
        .from(consultasInicio)
        .where(eq(consultasInicio.tokenId, p.tokenId))
        .limit(1);

      // Delete corrupted ficha(s) from S3 (parallel) + DB (batch)
      const fichasExistentes = await db
        .select({ id: pdfs.id, s3Key: pdfs.s3Key })
        .from(pdfs)
        .where(
          and(
            eq(pdfs.pacienteId, pacienteId),
            eq(pdfs.tipo, "ficha_atendimento"),
          ),
        );
      if (fichasExistentes.length > 0) {
        await Promise.all(
          fichasExistentes.map((f) => deleteObject(f.s3Key).catch(() => {})),
        );
        await db.delete(pdfs).where(
          inArray(
            pdfs.id,
            fichasExistentes.map((f) => f.id),
          ),
        );
      }

      const nome = decrypt(p.nomeEncrypted);
      const cpf = decrypt(p.cpfEncrypted);
      const dataNascimento = p.dataNascimentoEncrypted
        ? decrypt(p.dataNascimentoEncrypted)
        : "";
      const nomeMae = p.nomeMaeEncrypted ? decrypt(p.nomeMaeEncrypted) : "";

      const cond = (p.condutaJson ?? {}) as {
        temSintomasDst?: boolean;
        usoDrogas?: boolean;
        prepAdesao?: "diaria" | "sob_demanda";
      };
      const prepAdesaoLabel = mapPrepAdesaoLabel(cond.prepAdesao);
      const configClinica = buildConfigClinica();

      const fichaBuf = Buffer.from(
        await preencherFichaAtendimento(
          {
            pacienteId,
            cpf,
            nome,
            nomeMae,
            dataNascimento,
            dataExameHiv: consulta?.dataExameValidado ?? null,
            prepModalidade:
              (p.prepModalidade as "PrEP diária" | "PrEP sob demanda" | null) ??
              "PrEP diária",
            tipoConsulta:
              (consulta?.tipoConsulta as
                | "primeiro_atendimento"
                | "ja_faco_prep") ?? "primeiro_atendimento",
            prepAdesao: prepAdesaoLabel ?? null,
            temSintomasDst: cond.temSintomasDst ?? null,
            usoDrogas: cond.usoDrogas ?? null,
          },
          configClinica,
        ),
      );

      const {
        buffer: signedFicha,
        certificadoSerial,
        assinadoEm,
      } = await assinarPdf(
        fichaBuf,
        "Ficha de Atendimento PrEP — Facilita PrEP",
      );
      const fichaKey = `pdfs/${pacienteId}/${Date.now()}-ficha-atendimento.pdf`;
      await uploadBuffer(fichaKey, signedFicha, "application/pdf");
      await db.insert(pdfs).values({
        pacienteId,
        s3Key: fichaKey,
        tipo: "ficha_atendimento",
        certificadoSerial,
        assinadoEm,
      });

      const [url] = await Promise.all([
        getPresignedUrl(fichaKey, 3600),
        logAudit({
          actorId: ctx.session.id,
          actorRole: ctx.session.role,
          action: "pdf.generate",
          resourceType: "ficha_atendimento",
          resourceId: pacienteId,
          detalhes: { fichasRemovidas: fichasExistentes.length },
        }),
      ]);
      return { ok: true, url, fichasRemovidas: fichasExistentes.length };
    }),

  // ── Dead Letter Queue — ver admin/dlq.ts ─────────────────────
  ...dlqProcedures,

  saudeIntake: adminProcedure.query(async () => {
    let redisOk = false;
    let linkAcessoQueueSize: number | null = null;
    try {
      linkAcessoQueueSize = await linkAcessoQueue.count();
      redisOk = true;
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
    };
  }),
});
