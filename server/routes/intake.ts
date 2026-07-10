import { z } from "zod";
import { randomUUID } from "crypto";
import { router, publicProcedure, staffProcedure } from "../_core/trpc.ts";
import { hashToken, generateToken } from "../_core/tokenUtils.ts";
import { TRPCError } from "@trpc/server";
import { db } from "../db.ts";
import {
  precadastros,
  accessTokens,
  users,
  pacientes,
} from "../../drizzle/schema.ts";
import { eq, desc, lt, inArray, isNull, and, gt } from "drizzle-orm";
import { encrypt, decrypt, hashCpf } from "../_core/encryption.ts";
import { validarCpf, normalizarCpf } from "../_core/cpfValidator.ts";
import {
  criarCobrancaIntake,
  obterPagamento,
  listarPagamentosPorReferencia,
} from "../asaas/client.ts";
import {
  enviarNotificacaoNovoPlano,
  enviarConfirmacaoPlano,
} from "../email.ts";
import { notificarStaff, staffTemplates } from "../whatsapp.staff.ts";
import { getPresignedUrl } from "../storage.ts";
import { env } from "../_core/env.ts";
import { SignJWT } from "jose";
import {
  TOKEN_EXPIRY_DAYS,
  JWT_EXPIRY_PATIENT,
} from "../../shared/security-constants.ts";
import { enqueueEnviarLinkAcesso } from "../pdfQueue.ts";
import type { PagamentoMeta } from "../email.ts";
import { ERROR_MESSAGES } from "../../shared/const.ts";
import { paginationInput, paginatedResponse } from "../_core/pagination.ts";
import { logger } from "../_core/logger.ts";
import * as Sentry from "@sentry/node";
import { okEmpty } from "../_core/response.ts";
import { sendCapiLead } from "../capi.ts";

export async function gerarEEnviarLinkAcesso(
  precadastroId: number,
  validadoPorId?: number,
  pagamento?: PagamentoMeta,
): Promise<{ raw: string }> {
  const [precad] = await db
    .select()
    .from(precadastros)
    .where(eq(precadastros.id, precadastroId))
    .limit(1);
  if (!precad) throw new Error(`Pré-cadastro ${precadastroId} não encontrado`);

  const emailDecrypted = decrypt(precad.emailEncrypted);
  const telefoneDecrypted = decrypt(precad.telefoneEncrypted);
  const nomeDecrypted = decrypt(precad.nomeEncrypted);

  let raw: string;
  let expiresAt: Date;

  // Idempotência: se já existe token vinculado ao precadastro (ex: webhook duplicado),
  // reutiliza o token existente em vez de criar outro e enviar dois e-mails.
  if (precad.accessTokenId) {
    const [existingToken] = await db
      .select({
        tokenHash: accessTokens.tokenHash,
        expiresAt: accessTokens.expiresAt,
      })
      .from(accessTokens)
      .where(eq(accessTokens.id, precad.accessTokenId))
      .limit(1);

    if (!existingToken)
      throw new Error(`Token ${precad.accessTokenId} não encontrado`);

    // Não temos o raw token — só o hash. Gera novo token e atualiza o hash existente.
    // Isso mantém idempotência funcional: um token válido por precadastro.
    raw = generateToken();
    const newHash = hashToken(raw);
    expiresAt = existingToken.expiresAt;

    await db
      .update(accessTokens)
      .set({ tokenHash: newHash })
      .where(eq(accessTokens.id, precad.accessTokenId));
  } else {
    raw = generateToken();
    const tokenHash = hashToken(raw);
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRY_DAYS);

    await db.transaction(async (tx) => {
      await tx.insert(accessTokens).values({
        tokenHash,
        patientEmail: emailDecrypted,
        tipo: precad.tipo === "plano" ? "convenio" : "privado",
        convenio: precad.plano ?? undefined,
        expiresAt,
        createdById: validadoPorId ?? 1,
      });

      const [token] = await tx
        .select({ id: accessTokens.id })
        .from(accessTokens)
        .where(eq(accessTokens.tokenHash, tokenHash))
        .limit(1);

      await tx
        .update(precadastros)
        .set({ status: "link_enviado", accessTokenId: token?.id })
        .where(eq(precadastros.id, precadastroId));
    });
  }

  if (!raw)
    throw new Error(
      `gerarEEnviarLinkAcesso: raw vazio para precadastro ${precadastroId}`,
    );

  const link = `${env.APP_URL}/acesso/${raw}`;

  logger.info("[intake] enfileirando link de acesso", {
    precadastroId,
    linkSuffix: raw.slice(-6),
  });

  await enqueueEnviarLinkAcesso(
    emailDecrypted,
    nomeDecrypted,
    telefoneDecrypted,
    link,
    expiresAt,
    raw,
    pagamento,
  );

  return { raw };
}

// Regenerates the access token hash for an existing precadastro and returns the new
// authenticated link. Does NOT send any notifications — callers handle that.
// Used after exam approval to embed a fresh authenticated link in the approval email/WA.
export async function gerarLinkDeAcesso(
  precadastroId: number,
): Promise<{ raw: string; link: string; expiresAt: Date }> {
  const [precad] = await db
    .select({ accessTokenId: precadastros.accessTokenId })
    .from(precadastros)
    .where(eq(precadastros.id, precadastroId))
    .limit(1);

  if (!precad) throw new Error(`Pré-cadastro ${precadastroId} não encontrado`);
  if (!precad.accessTokenId)
    throw new Error(
      `Pré-cadastro ${precadastroId} sem token de acesso vinculado`,
    );

  const raw = generateToken();
  if (!raw)
    throw new Error(
      `gerarLinkDeAcesso: generateToken retornou vazio para precadastro ${precadastroId}`,
    );

  // Always extend expiry from now — original token may have already expired if patient
  // registered >TOKEN_EXPIRY_DAYS ago (e.g. exam took >7 days to be reviewed).
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRY_DAYS);

  await db
    .update(accessTokens)
    .set({ tokenHash: hashToken(raw), expiresAt })
    .where(eq(accessTokens.id, precad.accessTokenId));

  const link = `${env.APP_URL}/acesso/${raw}`;
  logger.info("[intake] link de aprovação gerado", {
    precadastroId,
    linkSuffix: raw.slice(-6),
  });
  return { raw, link, expiresAt };
}

export const intakeRouter = router({
  // Valor da consulta lido de env var CONSULTA_VALOR (default R$ 150,00)
  consultarValor: publicProcedure.query(() => {
    const valor = env.CONSULTA_VALOR;
    return {
      valor,
      valorCentavos: Math.round(valor * 100),
      valorFormatado: valor.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      }),
      debitCardEnabled: env.ENABLE_DEBIT_CARD,
    };
  }),

  // Paciente cria pré-cadastro (público, sem autenticação)
  criar: publicProcedure
    .input(
      z.object({
        nome: z.string().min(2).max(255),
        telefone: z
          .string()
          .regex(/^\+\d{8,15}$/, "Use formato internacional: +5561999998888"),
        cpf: z.string(),
        email: z.string().email(),
        tipo: z.enum(["particular", "plano"]),
        plano: z.string().optional(),
        carteirinhaS3Key: z.string().optional(),
        documentoS3Key: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!validarCpf(input.cpf)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: ERROR_MESSAGES.CPF_INVALID,
        });
      }

      if (input.tipo === "plano") {
        if (!input.plano) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Selecione o plano de saúde.",
          });
        }
        if (!input.carteirinhaS3Key || !input.documentoS3Key) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Envie a carteirinha e o documento de identidade.",
          });
        }
      }

      const cpfNorm = normalizarCpf(input.cpf);

      await db.insert(precadastros).values({
        nomeEncrypted: encrypt(input.nome),
        telefoneEncrypted: encrypt(input.telefone),
        cpfEncrypted: encrypt(cpfNorm),
        cpfHash: hashCpf(cpfNorm),
        emailEncrypted: encrypt(input.email),
        tipo: input.tipo,
        plano: input.plano,
        carteirinhaS3Key: input.carteirinhaS3Key,
        documentoS3Key: input.documentoS3Key,
        status:
          input.tipo === "particular"
            ? "aguardando_pagamento"
            : "aguardando_validacao",
      });

      const [inserted] = await db
        .select({ id: precadastros.id })
        .from(precadastros)
        .where(eq(precadastros.cpfHash, hashCpf(cpfNorm)))
        .orderBy(desc(precadastros.createdAt))
        .limit(1);

      // Notify all secretárias/admins when a plano patient registers
      if (input.tipo === "plano") {
        const staffUsers = await db
          .select({ email: users.email })
          .from(users)
          .where(
            and(
              inArray(users.role, ["secretaria", "admin"]),
              isNull(users.deletedAt),
            ),
          );

        const emails = staffUsers
          .map((u) => u.email)
          .filter(Boolean) as string[];
        const dashboardUrl = `${env.APP_URL}/secretaria`;

        await enviarNotificacaoNovoPlano(
          emails,
          input.nome,
          input.plano!,
          dashboardUrl,
        ).catch((e: unknown) =>
          logger.warn("[intake] notificação falhou", { error: String(e) }),
        );
        await notificarStaff(
          "secretaria",
          "plano-pendente",
          staffTemplates.secretariaPlanoSaudePendente,
        ).catch((e: unknown) =>
          logger.warn("[intake] staff WhatsApp falhou", { error: String(e) }),
        );
        await enviarConfirmacaoPlano(input.email, input.nome).catch(
          (e: unknown) =>
            logger.warn("[intake] notificação falhou", { error: String(e) }),
        );
      }

      const [firstName, ...restName] = input.nome.trim().split(" ");
      const clientIp =
        (ctx.req.headers["x-forwarded-for"] as string | undefined)
          ?.split(",")[0]
          ?.trim() ??
        ctx.req.ip ??
        "";
      sendCapiLead({
        eventId: randomUUID(),
        email: input.email,
        phone: input.telefone,
        firstName,
        lastName:
          restName.length > 0 ? restName[restName.length - 1] : undefined,
        clientIp,
        clientUserAgent: ctx.req.headers["user-agent"] ?? "",
      }).catch(() => {});

      return { precadastroId: inserted.id };
    }),

  // Após o pagamento ser confirmado pelo Asaas, o cliente troca o paymentId
  // pelo raw access token. O webhook PAYMENT_RECEIVED/CONFIRMED também processa
  // em paralelo — idempotência via precad.status === 'link_enviado'.
  acessoPosPagamento: publicProcedure
    .input(
      z.union([
        z.object({ paymentId: z.string().min(1) }),
        z.object({ precadastroId: z.number().int().positive() }),
      ]),
    )
    .mutation(async ({ input }) => {
      let precadastroId: number;

      if ("paymentId" in input) {
        let payment;
        try {
          payment = await obterPagamento(input.paymentId);
        } catch {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Pagamento não encontrado no Asaas.",
          });
        }
        if (payment.status !== "RECEIVED" && payment.status !== "CONFIRMED") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Pagamento ainda não confirmado. Tente novamente em instantes.",
          });
        }
        const precadMatch = (payment.externalReference ?? "").match(
          /^precad-(\d+)$/,
        );
        if (!precadMatch) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Referência de pagamento inválida.",
          });
        }
        precadastroId = parseInt(precadMatch[1]!, 10);
      } else {
        // Card autoRedirect path: verify payment is confirmed via Asaas before issuing JWT
        const payments = await listarPagamentosPorReferencia(
          `precad-${input.precadastroId}`,
        );
        const confirmed = payments.find(
          (p) => p.status === "RECEIVED" || p.status === "CONFIRMED",
        );
        if (!confirmed) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Pagamento ainda não confirmado. Tente novamente em instantes.",
          });
        }
        precadastroId = input.precadastroId;
      }

      const { raw } = await gerarEEnviarLinkAcesso(precadastroId);

      // Issue the JWT here — avoids a second round-trip where the Asaas webhook
      // could race and rotate the token hash before the client calls token.validar.
      const tokenHash = hashToken(raw);
      const [candidate] = await db
        .select({ id: accessTokens.id })
        .from(accessTokens)
        .where(eq(accessTokens.tokenHash, tokenHash))
        .limit(1);

      const tokenId = candidate?.id ?? null;
      const [existingPaciente] = tokenId
        ? await db
            .select({ id: pacientes.id })
            .from(pacientes)
            .where(eq(pacientes.tokenId, tokenId))
            .limit(1)
        : [];

      const secret = new TextEncoder().encode(env.JWT_SECRET);
      const sessionToken = await new SignJWT({
        type: "patient",
        tokenId,
        pacienteId: existingPaciente?.id ?? null,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(JWT_EXPIRY_PATIENT)
        .sign(secret);

      return { sessionToken };
    }),

  // Iniciar pagamento via Asaas (particular) — PIX, cartão crédito ou débito
  iniciarPagamento: publicProcedure
    .input(
      z.object({
        precadastroId: z.number(),
        metodo: z.enum(["PIX", "CREDIT_CARD", "DEBIT_CARD"]).default("PIX"),
      }),
    )
    .mutation(async ({ input }) => {
      const [precad] = await db
        .select()
        .from(precadastros)
        .where(eq(precadastros.id, input.precadastroId))
        .limit(1);
      if (!precad || precad.tipo !== "particular") {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (precad.status === "link_enviado") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Link já enviado para este cadastro.",
        });
      }

      if (input.metodo === "DEBIT_CARD" && !env.ENABLE_DEBIT_CARD) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Cartão de Débito temporariamente indisponível. Use PIX ou Cartão de Crédito.",
        });
      }

      const nomeDecrypted = decrypt(precad.nomeEncrypted);
      const cpfDecrypted = decrypt(precad.cpfEncrypted);
      const emailDecrypted = decrypt(precad.emailEncrypted);

      try {
        return await criarCobrancaIntake(
          precad.id,
          nomeDecrypted,
          cpfDecrypted,
          emailDecrypted,
          input.metodo,
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error("[intake] falha ao criar cobrança Asaas", {
          error: msg,
          precadastroId: precad.id,
        });
        Sentry.captureException(err, {
          tags: { route: "intake.iniciarPagamento" },
          extra: { precadastroId: precad.id },
        });

        // Extract Asaas error descriptions for a useful client-facing message
        const asaasDescriptions = (() => {
          const match = msg.match(/→ \d+: (.+)$/);
          if (!match) return null;
          try {
            const body = JSON.parse(match[1]!) as {
              errors?: Array<{ description?: string }>;
            };
            const descs = (body.errors ?? [])
              .map((e) => e.description)
              .filter(Boolean);
            return descs.length ? descs.join("; ") : null;
          } catch {
            return null;
          }
        })();

        if (msg.includes("cpfCnpj") || msg.toLowerCase().includes("cpf")) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "CPF inválido. Verifique e tente novamente.",
          });
        }
        if (
          msg.includes("→ 401") ||
          msg.toLowerCase().includes("unauthorized") ||
          msg.includes("access_token")
        ) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Erro de configuração do gateway. Suporte foi avisado.",
          });
        }
        if (asaasDescriptions) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Erro Asaas: ${asaasDescriptions}`,
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Erro ao gerar pagamento. Tente novamente em alguns instantes.",
        });
      }
    }),

  // Consultar status do pagamento PIX (usado para polling no frontend)
  consultarStatusPagamento: publicProcedure
    .input(z.object({ paymentId: z.string().min(1) }))
    .query(async ({ input }) => {
      const payment = await obterPagamento(input.paymentId);
      return { status: payment.status };
    }),

  // Polls Asaas live for the payment status given a precadastroId.
  // Used by /sucesso when the card checkout autoRedirect carries precadastroId instead of paymentId.
  consultarStatusPorPrecadastro: publicProcedure
    .input(z.object({ precadastroId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const payments = await listarPagamentosPorReferencia(
        `precad-${input.precadastroId}`,
      );
      const confirmed = payments.find(
        (p) => p.status === "RECEIVED" || p.status === "CONFIRMED",
      );
      const latest = confirmed ?? payments[0] ?? null;
      return {
        confirmado: !!confirmed,
        status: latest?.status ?? "NOT_FOUND",
      };
    }),

  // Secretaria: listar planos aguardando validação
  listarPendentes: staffProcedure
    .input(paginationInput)
    .query(async ({ input }) => {
      const { limit, cursor } = input;
      const rows = await db
        .select()
        .from(precadastros)
        .where(
          cursor
            ? and(
                eq(precadastros.status, "aguardando_validacao"),
                lt(precadastros.id, cursor),
              )
            : eq(precadastros.status, "aguardando_validacao"),
        )
        .orderBy(desc(precadastros.id))
        .limit(limit + 1);

      const mapped = rows.map((r) => ({
        id: r.id,
        nome: decrypt(r.nomeEncrypted),
        telefone: decrypt(r.telefoneEncrypted),
        email: decrypt(r.emailEncrypted),
        plano: r.plano,
        carteirinhaS3Key: r.carteirinhaS3Key,
        documentoS3Key: r.documentoS3Key,
        createdAt: r.createdAt,
      }));

      return paginatedResponse(mapped, limit);
    }),

  // Gerar URL pré-assinada para visualizar documento de intake (secretaria)
  urlDocumento: staffProcedure
    .input(z.object({ s3Key: z.string().min(1) }))
    .mutation(async ({ input }) => {
      if (!input.s3Key.startsWith("intake/")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado." });
      }
      const url = await getPresignedUrl(input.s3Key, 900);
      return { url };
    }),

  // Secretaria: aprovar plano e enviar link
  aprovar: staffProcedure
    .input(z.object({ precadastroId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const [precad] = await db
        .select()
        .from(precadastros)
        .where(eq(precadastros.id, input.precadastroId))
        .limit(1);
      if (!precad) throw new TRPCError({ code: "NOT_FOUND" });
      if (precad.status !== "aguardando_validacao") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Pré-cadastro não está aguardando validação.",
        });
      }

      await db
        .update(precadastros)
        .set({ validadoPorId: ctx.session.id, validadoEm: new Date() })
        .where(eq(precadastros.id, input.precadastroId));

      await gerarEEnviarLinkAcesso(input.precadastroId, ctx.session.id);

      return okEmpty();
    }),

  // Secretaria: rejeitar plano
  rejeitar: staffProcedure
    .input(
      z.object({
        precadastroId: z.number(),
        observacoes: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [precad] = await db
        .select()
        .from(precadastros)
        .where(eq(precadastros.id, input.precadastroId))
        .limit(1);
      if (!precad) throw new TRPCError({ code: "NOT_FOUND" });

      await db
        .update(precadastros)
        .set({
          status: "rejeitado",
          validadoPorId: ctx.session.id,
          validadoEm: new Date(),
          observacoes: input.observacoes,
        })
        .where(eq(precadastros.id, input.precadastroId));

      return okEmpty();
    }),

  // Auto-atendimento: paciente solicita reenvio do link de acesso pelo CPF
  solicitarReenvioLink: publicProcedure
    .input(
      z.object({
        cpf: z.string().min(11),
      }),
    )
    .mutation(async ({ input }) => {
      const GENERIC_OK = { ok: true };

      let cpfNorm: string;
      try {
        cpfNorm = normalizarCpf(input.cpf);
        if (!validarCpf(cpfNorm)) return GENERIC_OK;
      } catch {
        return GENERIC_OK;
      }

      const cpfHash = hashCpf(cpfNorm);

      const [precad] = await db
        .select({
          id: precadastros.id,
          accessTokenId: precadastros.accessTokenId,
        })
        .from(precadastros)
        .where(eq(precadastros.cpfHash, cpfHash))
        .orderBy(desc(precadastros.createdAt))
        .limit(1);

      if (!precad?.accessTokenId) return GENERIC_OK;

      const [token] = await db
        .select({ id: accessTokens.id })
        .from(accessTokens)
        .where(
          and(
            eq(accessTokens.id, precad.accessTokenId),
            isNull(accessTokens.revokedAt),
            gt(accessTokens.expiresAt, new Date()),
          ),
        )
        .limit(1);

      if (!token) return GENERIC_OK;

      try {
        await gerarEEnviarLinkAcesso(precad.id);
      } catch (err) {
        logger.warn("[intake] solicitarReenvioLink falhou", {
          error: String(err),
        });
      }

      return GENERIC_OK;
    }),
});
