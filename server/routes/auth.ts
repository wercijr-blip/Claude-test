import { z } from "zod";
import { SignJWT, jwtVerify } from "jose";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc.ts";
import { env } from "../_core/env.ts";
import { Sentry } from "../_core/instrument.ts";
import { logger } from "../_core/logger.ts";
import { db } from "../db.ts";
import { users } from "../../drizzle/cis-schema.ts";
import { eq, isNull, and } from "drizzle-orm";
import { JWT_EXPIRY_STAFF } from "../../shared/security-constants.ts";
import { isAllowedRedirectUri } from "../_core/originValidator.ts";
import { logAudit } from "../_core/audit.ts";
import { blockToken } from "../_core/jwtBlocklist.ts";
import {
  generateTotpSecret,
  verifyTotpCode,
  getTotpUri,
} from "../_core/totp.ts";
import type { Role } from "../../shared/types.ts";
import type { ResultSetHeader } from "mysql2";

export const authRouter = router({
  // Callback OAuth — troca code por JWT interno
  callback: publicProcedure
    .input(
      z.object({
        code: z.string(),
        state: z.string().optional(),
        redirectUri: z.string().url().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      logger.info("[auth.callback] iniciado", {
        hasCode: !!input.code,
        codeLength: input.code?.length,
        hasRedirectUri: !!input.redirectUri,
        redirectUri: input.redirectUri,
        appUrl: env.APP_URL,
        googleClientIdSet: !!env.GOOGLE_CLIENT_ID,
        googleClientSecretSet: !!env.GOOGLE_CLIENT_SECRET,
      });

      try {
        // Usa o redirectUri enviado pelo cliente (mesmo que Google usou no início do fluxo).
        // Valida contra origens permitidas para evitar open redirect.
        const redirectUri =
          input.redirectUri && isAllowedRedirectUri(input.redirectUri)
            ? input.redirectUri
            : `${env.APP_URL}/auth/callback`;

        logger.info("[auth.callback] redirectUri resolvido", {
          redirectUri,
          validated: input.redirectUri === redirectUri,
        });

        const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: input.code,
            client_id: env.GOOGLE_CLIENT_ID,
            client_secret: env.GOOGLE_CLIENT_SECRET,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (!tokenResp.ok) {
          const errBody = await tokenResp.text().catch(() => "(unreadable)");
          logger.error("[auth.callback] falha token exchange", {
            status: tokenResp.status,
            body: errBody,
          });
          throw new Error(
            `Falha ao obter token OAuth do Google (${tokenResp.status}): ${errBody}`,
          );
        }

        const tokenData = (await tokenResp.json()) as { access_token: string };

        // Buscar dados do usuário com o access_token
        const userResp = await fetch(
          "https://www.googleapis.com/oauth2/v3/userinfo",
          {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
            signal: AbortSignal.timeout(10000),
          },
        );

        if (!userResp.ok) {
          logger.error("[auth.callback] falha userinfo", {
            status: userResp.status,
          });
          throw new Error(
            `Falha ao obter dados do usuário Google (${userResp.status})`,
          );
        }

        const googleUser = (await userResp.json()) as {
          sub: string;
          email: string;
          name: string;
          picture?: string;
        };

        const data = {
          openId: googleUser.sub,
          email: googleUser.email,
          name: googleUser.name,
        };

        // Upsert do usuário
        const [existing] = await db
          .select()
          .from(users)
          .where(and(eq(users.openId, data.openId), isNull(users.deletedAt)))
          .limit(1);

        // When openId is not found, fall back to email lookup for pre-registered staff
        // whose openId was set to 'pending:email' by admin before their first SSO login.
        // Without this, first login would create a duplicate user record ignoring the pre-assigned role.
        let preRegistered: typeof existing | undefined;
        if (!existing) {
          const [candidate] = await db
            .select()
            .from(users)
            .where(and(eq(users.email, data.email), isNull(users.deletedAt)))
            .limit(1);
          if (candidate?.openId.startsWith("pending:"))
            preRegistered = candidate;
        }

        const resolvedUser = existing ?? preRegistered;
        const isOwner = data.openId === env.OWNER_OPEN_ID;

        // Sistema fechado — só admin (OWNER_OPEN_ID) e médicos pré-cadastrados têm acesso.
        // Qualquer conta Google não cadastrada é recusada explicitamente.
        if (!resolvedUser && !isOwner) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "Acesso não autorizado. Solicite ao administrador que cadastre seu e-mail.",
          });
        }

        let userId: number;
        let role: Role;

        if (resolvedUser) {
          userId = resolvedUser.id;
          role = isOwner ? "admin" : (resolvedUser.role as Role);
          await db
            .update(users)
            .set({
              email: data.email,
              nome: data.name,
              openId: data.openId,
              role,
              updatedAt: new Date(),
            })
            .where(eq(users.id, resolvedUser.id));
        } else {
          // isOwner sem registro prévio — cria entrada admin na primeira vez
          role = "admin";
          const [result] = await db.insert(users).values({
            openId: data.openId,
            email: data.email,
            nome: data.name,
            role,
          });
          userId = (result as ResultSetHeader).insertId;
        }

        // Fetch full user record to check 2FA status
        const [freshUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
        const requires2fa =
          freshUser?.totpEnabled && ["admin", "medico"].includes(role);

        const secret = new TextEncoder().encode(env.JWT_SECRET);

        if (requires2fa) {
          // Issue a short-lived pending token — frontend must complete TOTP verification
          const pendingToken = await new SignJWT({
            type: "pending_2fa",
            userId,
            role,
          })
            .setProtectedHeader({ alg: "HS256" })
            .setSubject(data.openId)
            .setIssuedAt()
            .setJti(randomUUID())
            .setExpirationTime("5m")
            .sign(secret);
          return { token: pendingToken, role, requiresTwoFactor: true };
        }

        const token = await new SignJWT({ type: "staff", userId, role })
          .setProtectedHeader({ alg: "HS256" })
          .setSubject(data.openId)
          .setIssuedAt()
          .setJti(randomUUID())
          .setExpirationTime(JWT_EXPIRY_STAFF)
          .sign(secret);

        logAudit({
          actorId: userId,
          actorRole: role,
          action: "user.login",
          resourceType: "user",
          resourceId: userId,
        });
        logger.info("[auth.callback] sucesso", {
          userId,
          role,
          openId: data.openId,
          requires2fa,
        });
        return { token, role, requiresTwoFactor: false };
      } catch (err) {
        logger.error("[auth.callback] erro", {
          message: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          codeLength: input.code?.length,
          redirectUri: input.redirectUri,
        });
        Sentry.captureException(err, {
          tags: { route: "auth.callback" },
          extra: {
            codeLength: input.code?.length,
            redirectUri: input.redirectUri,
          },
        });
        throw err;
      }
    }),

  // Login mock para desenvolvimento local. Responde NOT_FOUND em produção
  // para ser indistinguível de um endpoint inexistente.
  devLogin: publicProcedure
    .input(z.object({ role: z.enum(["admin", "medico"]) }))
    .mutation(async ({ input }) => {
      if (env.NODE_ENV !== "development") {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const openId = `dev-${input.role}`;
      const email = `${input.role}@dev.local`;
      const nome = `Dev ${input.role.charAt(0).toUpperCase()}${input.role.slice(1)}`;

      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.openId, openId))
        .limit(1);

      let userId: number;
      if (existing) {
        userId = existing.id;
        await db
          .update(users)
          .set({ role: input.role, email, nome, updatedAt: new Date() })
          .where(eq(users.id, existing.id));
      } else {
        const [result] = await db
          .insert(users)
          .values({ openId, email, nome, role: input.role });
        userId = (result as ResultSetHeader).insertId;
      }

      const secret = new TextEncoder().encode(env.JWT_SECRET);
      const token = await new SignJWT({
        type: "staff",
        userId,
        role: input.role,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(openId)
        .setIssuedAt()
        .setJti(randomUUID())
        .setExpirationTime(JWT_EXPIRY_STAFF)
        .sign(secret);

      return { token, role: input.role };
    }),

  verifyTotp: publicProcedure
    .input(z.object({ pendingToken: z.string(), code: z.string() }))
    .mutation(async ({ input }) => {
      const secret = new TextEncoder().encode(env.JWT_SECRET);
      let payload: { type?: string; userId?: number; role?: string };
      try {
        const { payload: p } = await jwtVerify(input.pendingToken, secret);
        payload = p as typeof payload;
      } catch {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Token de 2FA inválido ou expirado",
        });
      }

      if (payload.type !== "pending_2fa" || !payload.userId || !payload.role) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Token de 2FA inválido",
        });
      }

      const [user] = await db
        .select({
          id: users.id,
          totpSecret: users.totpSecret,
          openId: users.openId,
        })
        .from(users)
        .where(and(eq(users.id, payload.userId), isNull(users.deletedAt)))
        .limit(1);

      if (!user?.totpSecret) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Configuração 2FA ausente",
        });
      }

      if (!verifyTotpCode(user.totpSecret, input.code)) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Código TOTP inválido",
        });
      }

      const role = payload.role as Role;
      const token = await new SignJWT({ type: "staff", userId: user.id, role })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(user.openId)
        .setIssuedAt()
        .setJti(randomUUID())
        .setExpirationTime(JWT_EXPIRY_STAFF)
        .sign(secret);

      logAudit({
        actorId: user.id,
        actorRole: role,
        action: "user.login",
        resourceType: "user",
        resourceId: user.id,
        detalhes: { via: "totp" },
      });

      return { token, role };
    }),

  enrollTotp: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.session.type !== "staff") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const totpSecret = generateTotpSecret();
    await db
      .update(users)
      .set({ totpSecret })
      .where(eq(users.id, ctx.session.id));

    const [user] = await db
      .select({ email: users.email, nome: users.nome })
      .from(users)
      .where(eq(users.id, ctx.session.id))
      .limit(1);

    const identifier = user?.email ?? user?.nome ?? `user-${ctx.session.id}`;
    return {
      secret: totpSecret,
      uri: getTotpUri(totpSecret, identifier),
    };
  }),

  // Confirms the TOTP enrollment by verifying the first code and flipping totpEnabled.
  // Must be called after enrollTotp — otherwise 2FA is stored but never triggered at login.
  ativarTotp: protectedProcedure
    .input(z.object({ code: z.string() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.session.type !== "staff") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const [user] = await db
        .select({ totpSecret: users.totpSecret })
        .from(users)
        .where(and(eq(users.id, ctx.session.id), isNull(users.deletedAt)))
        .limit(1);

      if (!user?.totpSecret) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "TOTP não configurado. Execute enrollTotp primeiro.",
        });
      }

      if (!verifyTotpCode(user.totpSecret, input.code)) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Código TOTP inválido",
        });
      }

      await db
        .update(users)
        .set({ totpEnabled: true, updatedAt: new Date() })
        .where(eq(users.id, ctx.session.id));

      const role =
        ctx.session.type === "staff" ? ctx.session.role : ("medico" as Role);
      logAudit({
        actorId: ctx.session.id,
        actorRole: role,
        action: "user.totp_activated",
        resourceType: "user",
        resourceId: ctx.session.id,
      });

      return { ok: true };
    }),

  me: protectedProcedure.query(({ ctx }) => {
    return ctx.session;
  }),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    const { jti, exp } = ctx.session ?? {};
    if (jti && exp) await blockToken(jti, exp);
    return { ok: true };
  }),
});
