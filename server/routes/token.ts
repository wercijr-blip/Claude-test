import { z } from "zod";
import { SignJWT } from "jose";
import { router, publicProcedure, staffProcedure } from "../_core/trpc.ts";
import { hashToken, generateToken } from "../_core/tokenUtils.ts";
import { TRPCError } from "@trpc/server";
import { db } from "../db.ts";
import {
  accessTokens,
  pacientes,
  consultasInicio,
} from "../../drizzle/schema.ts";
import { eq, and, gt, isNull } from "drizzle-orm";
import { env } from "../_core/env.ts";
import {
  JWT_EXPIRY_PATIENT,
  TOKEN_EXPIRY_DAYS,
} from "../../shared/security-constants.ts";
import { ERROR_MESSAGES } from "../../shared/const.ts";

export const tokenRouter = router({
  // Secretaria gera token para paciente
  criar: staffProcedure
    .input(
      z.object({
        patientEmail: z.string().email().optional(),
        tipo: z.enum(["privado", "convenio"]).default("privado"),
        convenio: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const raw = generateToken();
      const hash = hashToken(raw);

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRY_DAYS);

      await db.transaction(async (tx) => {
        // Revoke any prior active tokens for the same email before issuing a new one
        if (input.patientEmail) {
          await tx
            .update(accessTokens)
            .set({ revokedAt: new Date() })
            .where(
              and(
                eq(accessTokens.patientEmail, input.patientEmail),
                isNull(accessTokens.revokedAt),
                gt(accessTokens.expiresAt, new Date()),
              ),
            );
        }

        await tx.insert(accessTokens).values({
          tokenHash: hash,
          patientEmail: input.patientEmail,
          tipo: input.tipo,
          convenio: input.convenio,
          expiresAt,
          createdById: ctx.session.id,
        });
      });

      return { token: raw, expiresAt };
    }),

  // Paciente valida o token e recebe JWT de sessão
  validar: publicProcedure
    .input(z.object({ token: z.string().length(64) }))
    .mutation(async ({ input }) => {
      const hash = hashToken(input.token);

      // Query without expiry filter first so we can give a distinct LINK_EXPIRED error
      const [candidate] = await db
        .select()
        .from(accessTokens)
        .where(
          and(eq(accessTokens.tokenHash, hash), isNull(accessTokens.revokedAt)),
        )
        .limit(1);

      if (!candidate) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: ERROR_MESSAGES.TOKEN_INVALID,
        });
      }

      if (candidate.expiresAt <= new Date()) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: ERROR_MESSAGES.TOKEN_EXPIRED,
        });
      }

      const record = candidate;

      // Buscar paciente existente para esse token
      const [existingPaciente] = await db
        .select({ id: pacientes.id, currentStep: pacientes.currentStep })
        .from(pacientes)
        .where(eq(pacientes.tokenId, record.id))
        .limit(1);

      // Marcar token como usado na primeira vez — UPDATE atômico evita double-write em requests paralelos
      await db
        .update(accessTokens)
        .set({ usedAt: new Date() })
        .where(
          and(eq(accessTokens.id, record.id), isNull(accessTokens.usedAt)),
        );

      const secret = new TextEncoder().encode(env.JWT_SECRET);
      const sessionToken = await new SignJWT({
        type: "patient",
        tokenId: record.id,
        pacienteId: existingPaciente?.id ?? null,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(JWT_EXPIRY_PATIENT)
        .sign(secret);

      return {
        sessionToken,
        pacienteId: existingPaciente?.id ?? null,
        currentStep: existingPaciente?.currentStep ?? 1,
      };
    }),

  // Secretaria lista tokens gerados
  listar: staffProcedure.query(async ({ ctx }) => {
    return db
      .select()
      .from(accessTokens)
      .where(eq(accessTokens.createdById, ctx.session.id))
      .orderBy(accessTokens.createdAt);
  }),

  // Secretaria revoga token
  revogar: staffProcedure
    .input(z.object({ tokenId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const [token] = await db
        .select()
        .from(accessTokens)
        .where(
          and(
            eq(accessTokens.id, input.tokenId),
            eq(accessTokens.createdById, ctx.session.id),
          ),
        )
        .limit(1);

      if (!token) throw new TRPCError({ code: "NOT_FOUND" });

      await db
        .update(accessTokens)
        .set({ revokedAt: new Date() })
        .where(eq(accessTokens.id, input.tokenId));

      return { ok: true };
    }),

  // Valida token e detecta a fase atual do paciente para roteamento inteligente.
  // Usa o mesmo token para todos os emails — ao clicar em qualquer link, o
  // paciente sempre cai na próxima etapa pendente, não na etapa do email original.
  validarEDecidirFase: publicProcedure
    .input(z.object({ token: z.string().length(64) }))
    .mutation(async ({ input }) => {
      const hash = hashToken(input.token);

      const [candidate] = await db
        .select()
        .from(accessTokens)
        .where(
          and(eq(accessTokens.tokenHash, hash), isNull(accessTokens.revokedAt)),
        )
        .limit(1);

      if (!candidate) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: ERROR_MESSAGES.TOKEN_INVALID,
        });
      }

      if (candidate.expiresAt <= new Date()) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: ERROR_MESSAGES.TOKEN_EXPIRED,
        });
      }

      const [existingPaciente] = await db
        .select({
          id: pacientes.id,
          currentStep: pacientes.currentStep,
          status: pacientes.status,
        })
        .from(pacientes)
        .where(eq(pacientes.tokenId, candidate.id))
        .limit(1);

      await db
        .update(accessTokens)
        .set({ usedAt: new Date() })
        .where(
          and(eq(accessTokens.id, candidate.id), isNull(accessTokens.usedAt)),
        );

      const secret = new TextEncoder().encode(env.JWT_SECRET);
      const sessionToken = await new SignJWT({
        type: "patient",
        tokenId: candidate.id,
        pacienteId: existingPaciente?.id ?? null,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(JWT_EXPIRY_PATIENT)
        .sign(secret);

      const proximaFase = await detectarProximaFase(
        candidate.id,
        existingPaciente ?? null,
      );

      return {
        sessionToken,
        pacienteId: existingPaciente?.id ?? null,
        currentStep: existingPaciente?.currentStep ?? 1,
        proximaFase,
      };
    }),
});

async function detectarProximaFase(
  tokenId: number,
  paciente: { id: number; currentStep: number; status: string } | null,
): Promise<string> {
  const [consulta] = await db
    .select({ status: consultasInicio.status })
    .from(consultasInicio)
    .where(eq(consultasInicio.tokenId, tokenId))
    .limit(1);

  const exameAprovado =
    consulta?.status === "aprovado_ia" || consulta?.status === "aprovado";

  if (!exameAprovado) return "/inicio";

  if (!paciente) return "/formulario";

  const statusFinal = ["pendente", "em_revisao", "aprovado"];
  if (statusFinal.includes(paciente.status)) return "/inicio";

  if (paciente.currentStep >= 1) return `/formulario/${paciente.id}`;

  return "/formulario";
}
