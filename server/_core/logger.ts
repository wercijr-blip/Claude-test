import pino from "pino";
import { env } from "./env.ts";

const REDACT_PATHS = [
  "password",
  "token",
  "cpf",
  "access_code",
  "authorization",
  "cookie",
  "*.password",
  "*.token",
  "*.cpf",
  "*.access_code",
  "*.authorization",
  "req.headers.authorization",
  "req.headers.cookie",
];

const pinoOpts: pino.LoggerOptions = {
  level: env.NODE_ENV === "production" ? "info" : "debug",
  redact: { paths: REDACT_PATHS, censor: "[redacted]" },
};

const _p =
  env.NODE_ENV !== "production"
    ? pino(
        pinoOpts,
        pino.transport({
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss",
            ignore: "pid,hostname",
          },
        }),
      )
    : pino(pinoOpts);

// Preserve the existing (msg, ctx?) call convention used throughout the codebase
// while internally routing to pino's (ctx, msg) signature for structured output.
function mkFn(level: "debug" | "info" | "warn" | "error") {
  return (msg: string, ctx?: unknown) =>
    ctx !== undefined ? _p[level](ctx, msg) : _p[level](msg);
}

export const logger = {
  debug: mkFn("debug"),
  info: mkFn("info"),
  warn: mkFn("warn"),
  error: mkFn("error"),
};

export function requestLogger(req: { requestId?: string }) {
  const child = _p.child({ requestId: req.requestId ?? "unknown" });
  return {
    debug: (msg: string, ctx?: unknown) =>
      ctx !== undefined ? child.debug(ctx, msg) : child.debug(msg),
    info: (msg: string, ctx?: unknown) =>
      ctx !== undefined ? child.info(ctx, msg) : child.info(msg),
    warn: (msg: string, ctx?: unknown) =>
      ctx !== undefined ? child.warn(ctx, msg) : child.warn(msg),
    error: (msg: string, ctx?: unknown) =>
      ctx !== undefined ? child.error(ctx, msg) : child.error(msg),
  };
}
