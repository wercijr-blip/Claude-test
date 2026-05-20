import type { Request } from "express";
import { jwtVerify } from "jose";
import { env } from "./env.ts";
import { db } from "../db.ts";
import { users } from "../../drizzle/cis-schema.ts";
import { eq, isNull, and } from "drizzle-orm";
import { isTokenBlocked } from "./jwtBlocklist.ts";
import type { AuthUser } from "../../shared/types.ts";

export type SessionUser = AuthUser & { jti?: string; exp?: number };

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

    if (payload["type"] === "staff" && payload.sub) {
      const jti = typeof payload.jti === "string" ? payload.jti : undefined;
      if (jti && (await isTokenBlocked(jti))) return { req, session: null };

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
          jti,
          exp: typeof payload.exp === "number" ? payload.exp : undefined,
        },
      };
    }
  } catch {
    // token inválido ou expirado
  }

  return { req, session: null };
}

function extractToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  const cookie = req.cookies?.cis_session as string | undefined;
  return cookie ?? null;
}
