import { createHash } from "node:crypto";
import type { Request } from "express";
import { jwtVerify } from "jose";
import { env } from "./env.ts";
import { logger } from "./logger.ts";
import { redis } from "./redis.ts";
import { db } from "../db.ts";
import { users } from "../../drizzle/schema.ts";
import { eq, isNull, and } from "drizzle-orm";
import type { AuthUser, PatientSession } from "../../shared/types.ts";

export type SessionUser = AuthUser | PatientSession;

export interface Context {
  req: Request;
  session: SessionUser | null;
}

export async function createContext({
  req,
}: {
  req: Request;
}): Promise<Context> {
  const token = extractToken(req);
  if (!token) return { req, session: null };

  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    // Check JWT blocklist (populated on logout)
    const tokenHash = createHash("sha256").update(token).digest("hex");
    let revoked: string | null;
    try {
      revoked = await redis.get(`jwt:revoked:${tokenHash}`);
    } catch {
      logger.warn("[auth] Redis unavailable — rejecting request", {
        path: req.path,
      });
      return { req, session: null };
    }
    if (revoked) return { req, session: null };

    if (payload["type"] === "patient") {
      return {
        req,
        session: {
          type: "patient",
          tokenId: payload["tokenId"] as number,
          pacienteId: (payload["pacienteId"] as number | null) ?? null,
        },
      };
    }

    if (payload["type"] === "staff" && payload.sub) {
      const user = await db
        .select()
        .from(users)
        .where(and(eq(users.openId, payload.sub), isNull(users.deletedAt)))
        .limit(1)
        .then((rows) => rows[0] ?? null);

      if (!user || !user.ativo) return { req, session: null };

      return {
        req,
        session: {
          type: "staff",
          id: user.id,
          openId: user.openId,
          nome: user.nome,
          email: user.email,
          role: user.role as AuthUser["role"],
          totpEnabled: user.totpEnabled,
        },
      };
    }
  } catch {
    logger.warn("[auth] JWT inválido ou expirado", {
      path: req.path,
      method: req.method,
    });
  }

  return { req, session: null };
}

export function extractToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  const cookie = req.cookies?.fp_session as string | undefined;
  return cookie ?? null;
}
