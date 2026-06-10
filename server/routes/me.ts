import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc.ts";
import { db } from "../db.ts";
import {
  pacientes,
  exames,
  tcleAssinaturas,
  pdfs,
} from "../../drizzle/schema.ts";
import { eq } from "drizzle-orm";
import { decrypt } from "../_core/encryption.ts";
import { logAudit } from "../_core/audit.ts";
import { logger } from "../_core/logger.ts";

export const meRouter = router({
  // LGPD Art. 18, I — Direito de acesso: exporta todos os dados pessoais do titular
  exportData: protectedProcedure.query(async ({ ctx }) => {
    const session = ctx.session;

    if (session.type !== "patient" || session.pacienteId === null) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Endpoint disponível apenas para pacientes",
      });
    }

    const pacienteId = session.pacienteId;

    const [paciente, examesList, tcle, pdfsList] = await Promise.all([
      db.select().from(pacientes).where(eq(pacientes.id, pacienteId)).limit(1),
      db.select().from(exames).where(eq(exames.pacienteId, pacienteId)),
      db
        .select()
        .from(tcleAssinaturas)
        .where(eq(tcleAssinaturas.pacienteId, pacienteId))
        .limit(1),
      db.select().from(pdfs).where(eq(pdfs.pacienteId, pacienteId)),
    ]);

    const p = paciente[0];
    if (!p)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Dados não encontrados",
      });

    await logAudit({
      action: "paciente.export",
      resourceType: "paciente",
      resourceId: pacienteId,
      ipAddress: ctx.req.ip,
      userAgent: ctx.req.headers["user-agent"],
      detalhes: { reason: "lgpd_art18_i" },
    });

    // Descriptografa apenas os campos do próprio titular
    const safeDecrypt = (val: string | null | undefined): string | null => {
      if (!val) return null;
      try {
        return decrypt(val);
      } catch {
        return null;
      }
    };

    return {
      exportedAt: new Date().toISOString(),
      legalBasis: "LGPD Art. 18, I — Direito de acesso ao titular",
      dados: {
        cpf: safeDecrypt(p.cpfEncrypted),
        nome: safeDecrypt(p.nomeEncrypted),
        dataNascimento: safeDecrypt(p.dataNascimentoEncrypted),
        nomeMae: safeDecrypt(p.nomeMaeEncrypted),
        cns: p.cns,
        sexo: p.sexo,
        nomeSocial: p.nomeSocial,
        corRaca: p.corRaca,
        escolaridade: p.escolaridade,
        email: safeDecrypt(p.emailEncrypted),
        telefone: safeDecrypt(p.telefoneEncrypted),
        cep: p.cep,
        logradouro: p.logradouro,
        numero: p.numero,
        complemento: p.complemento,
        bairro: p.bairro,
        cidade: p.cidade,
        estado: p.estado,
        tipoAtendimento: p.tipoAtendimento,
        status: p.status,
        retentionUntil: p.retentionUntil,
        createdAt: p.createdAt,
      },
      exames: examesList.map((e) => ({
        tipoExame: e.tipoExame,
        nomeArquivo: e.nomeArquivo,
        mimeType: e.mimeType,
        createdAt: e.createdAt,
        resultadoIa: e.resultadoIa,
      })),
      tcle: tcle[0]
        ? { signedAt: tcle[0].signedAt, ipAddress: tcle[0].ipAddress }
        : null,
      pdfsGerados: pdfsList.map((pdf) => ({
        tipo: pdf.tipo,
        assinadoEm: pdf.assinadoEm,
        createdAt: pdf.createdAt,
      })),
    };
  }),

  // LGPD Art. 18, IV — Direito à anonimização: solicita remoção de dados desnecessários.
  // NÃO apaga prontuário (obrigatório por 20 anos — Lei 13.787/2018 + CFM 2.299/2021).
  // Registra a solicitação para processamento manual pelo DPO/admin.
  requestAnonymization: protectedProcedure
    .input(z.object({ motivo: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const session = ctx.session;

      if (session.type !== "patient" || session.pacienteId === null) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Endpoint disponível apenas para pacientes",
        });
      }

      const pacienteId = session.pacienteId;

      // Registra a solicitação no audit log para processamento posterior pelo DPO
      await logAudit({
        action: "paciente.anonymize_request",
        resourceType: "paciente",
        resourceId: pacienteId,
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.headers["user-agent"],
        detalhes: {
          motivo: input.motivo ?? null,
          legalBasis: "LGPD Art. 18, IV",
          retentionNote:
            "Prontuário médico retido 20 anos conforme Lei 13.787/2018 e CFM 2.299/2021",
          status: "pending_dpo_review",
        },
      });

      logger.info("[me] solicitação de anonimização registrada", {
        pacienteId,
      });

      return {
        ok: true,
        message:
          "Sua solicitação foi registrada e será analisada pelo nosso encarregado de proteção de dados (DPO) em até 15 dias úteis, conforme LGPD Art. 18.",
        dpoEmail: "dpo@facilitaprep.com.br",
      };
    }),
});
