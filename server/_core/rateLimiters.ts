import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redisFailFast } from "./redis.ts";
import { RATE_LIMITS } from "../../shared/security-constants.ts";
import type { SendCommandFn } from "rate-limit-redis";

// Todos os limiters usam o client fail-fast + passOnStoreError (fail-open):
// se o Redis cair, a requisição passa sem rate limit em vez de pendurar ou
// retornar 500 — disponibilidade da plataforma de saúde vem primeiro.
// O erro de store é logado pelo handler em redis.ts (throttled).
function makeStore(prefix: string) {
  const store = new RedisStore({
    sendCommand: ((...args: string[]) =>
      redisFailFast.call(
        args[0]!,
        ...args.slice(1),
      )) as unknown as SendCommandFn,
    prefix: `rl:${prefix}:`,
  });
  // O construtor do RedisStore guarda promises flutuantes (SCRIPT LOAD dos
  // scripts lua). Com Redis indisponível no boot elas rejeitam sem handler —
  // unhandledRejection derruba o processo em produção. allSettled marca as
  // rejeições como tratadas; os awaits internos da lib seguem recebendo o
  // erro e o limiter faz fail-open via passOnStoreError.
  void Promise.allSettled([store.incrementScriptSha, store.getScriptSha]);
  return store;
}

// Global IP limiter — blanket protection against floods across all endpoints
export const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 300,
  message: { error: "Muitas requisições. Tente novamente em 1 minuto." },
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("global"),
  passOnStoreError: true,
});

export const authLimiter = rateLimit({
  windowMs: RATE_LIMITS.AUTH.windowMs,
  max: RATE_LIMITS.AUTH.max,
  message: { error: "Muitas tentativas de login. Aguarde 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("auth"),
  passOnStoreError: true,
});

export const tokenValidateLimiter = rateLimit({
  windowMs: RATE_LIMITS.TOKEN_VALIDATE.windowMs,
  max: RATE_LIMITS.TOKEN_VALIDATE.max,
  message: { error: "Muitas tentativas. Aguarde alguns minutos." },
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("token"),
  passOnStoreError: true,
});

export const uploadLimiter = rateLimit({
  windowMs: RATE_LIMITS.UPLOAD.windowMs,
  max: RATE_LIMITS.UPLOAD.max,
  message: { error: "Limite de uploads atingido. Aguarde 1 minuto." },
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("upload"),
  passOnStoreError: true,
});

export const apiLimiter = rateLimit({
  windowMs: RATE_LIMITS.API_GERAL.windowMs,
  max: RATE_LIMITS.API_GERAL.max,
  message: { error: "Muitas requisições. Aguarde." },
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("api"),
  passOnStoreError: true,
});

export const pdfLimiter = rateLimit({
  windowMs: RATE_LIMITS.PDF_GENERATE.windowMs,
  max: RATE_LIMITS.PDF_GENERATE.max,
  message: { error: "Limite de geração de PDFs atingido." },
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("pdf"),
  passOnStoreError: true,
});

export const dataRightsLimiter = rateLimit({
  windowMs: RATE_LIMITS.DATA_RIGHTS.windowMs,
  max: RATE_LIMITS.DATA_RIGHTS.max,
  message: {
    error: "Limite de solicitações LGPD atingido. Tente novamente em 1 hora.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("data-rights"),
  passOnStoreError: true,
});

export const totpLimiter = rateLimit({
  windowMs: RATE_LIMITS.TOTP.windowMs,
  max: RATE_LIMITS.TOTP.max,
  message: {
    error: "Muitas tentativas de verificação 2FA. Aguarde 15 minutos.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("totp"),
  passOnStoreError: true,
});

export const checkoutLimiter = rateLimit({
  windowMs: RATE_LIMITS.CHECKOUT.windowMs,
  max: RATE_LIMITS.CHECKOUT.max,
  message: { error: "Muitas tentativas. Aguarde alguns minutos." },
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("checkout"),
  passOnStoreError: true,
});
