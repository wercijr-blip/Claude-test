import "./instrument.ts";
import express from "express";
import cookieParser from "cookie-parser";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import type { Worker } from "bullmq";
import { env } from "./env.ts";
import { logger } from "./logger.ts";
import { redis } from "./redis.ts";
import { applySecurityMiddleware } from "./security.ts";
import { appRouter } from "../routers.ts";
import { createContext } from "./context.ts";
import { authLimiter, cisLimiter, totpLimiter } from "./rateLimiters.ts";
import { db } from "../db.ts";
import { ensureSchema } from "./ensureSchema.ts";
import { Sentry } from "./instrument.ts";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.set("trust proxy", 1);

applySecurityMiddleware(app);
app.use(cookieParser());

app.use((req, res, next) => {
  req.requestId =
    (req.headers["x-request-id"] as string | undefined) ??
    randomUUID().slice(0, 8);
  res.setHeader("X-Request-ID", req.requestId);
  const start = Date.now();
  res.on("finish", () => {
    logger.info("http", {
      requestId: req.requestId,
      method: req.method,
      url: req.url,
      status: res.statusCode,
      ms: Date.now() - start,
    });
  });
  next();
});

if (env.NODE_ENV === "production") {
  const clientDist = path.resolve(__dirname, "../../dist/client");
  const clientIndex = path.join(clientDist, "index.html");

  if (!fs.existsSync(clientIndex)) {
    logger.error("[FATAL] dist/client/index.html não existe", {
      cwd: process.cwd(),
      expected: clientIndex,
    });
    process.exit(1);
  }

  app.use(
    "/assets",
    express.static(path.join(clientDist, "assets"), {
      maxAge: "1y",
      immutable: true,
    }),
  );
  app.use(
    express.static(clientDist, {
      setHeaders: (res, filePath) => {
        if (/\.(png|jpg|jpeg|svg|webp|avif|ico|woff2?|ttf)$/.test(filePath)) {
          res.setHeader("Cache-Control", "public, max-age=86400");
        }
      },
    }),
  );
}

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Ensure all JSON API responses declare charset explicitly
app.use((_req, res, next) => {
  res.charset = "utf-8";
  next();
});

app.use("/trpc/auth.callback", authLimiter);
app.use("/trpc/auth.verifyTotp", totpLimiter);
app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext: ({ req }) => createContext({ req }),
    onError: ({ error, path, type, input }) => {
      const PII_KEYS = ["nome", "email", "password", "senha", "token"];
      const sanitize = (v: unknown): unknown => {
        if (v === null || typeof v !== "object") return v;
        return Object.fromEntries(
          Object.entries(v as Record<string, unknown>).map(([k, val]) => [
            k,
            PII_KEYS.some((p) => k.toLowerCase().includes(p))
              ? "[redacted]"
              : sanitize(val),
          ]),
        );
      };
      const safeInput =
        typeof input === "object"
          ? JSON.stringify(sanitize(input))
          : "[non-object input]";
      logger.error("[trpc] error", {
        path,
        type,
        code: error.code,
        message: error.message,
        cause: error.cause ? String(error.cause) : undefined,
        stack: error.stack,
        input: safeInput,
      });
    },
  }),
);

app.get("/api/health", async (_req, res) => {
  const [dbOk, redisOk] = await Promise.all([
    db
      .execute("SELECT 1")
      .then(() => true)
      .catch(() => false),
    redis
      .ping()
      .then((r) => r === "PONG")
      .catch(() => false),
  ]);

  // BullMQ queue depths (non-blocking — best-effort)
  let queues: Record<string, unknown> = {};
  try {
    const { pubmedQueue } = await import("../pubmedQueue.ts");
    const { digestQueue } = await import("../digestQueue.ts");
    const { caseSeriesQueue } = await import("../caseSeriesQueue.ts");
    const [pubmed, digest, caseSeries] = await Promise.all([
      Promise.all([
        pubmedQueue.getWaitingCount(),
        pubmedQueue.getActiveCount(),
        pubmedQueue.getFailedCount(),
      ]),
      Promise.all([
        digestQueue.getWaitingCount(),
        digestQueue.getActiveCount(),
        digestQueue.getFailedCount(),
      ]),
      Promise.all([
        caseSeriesQueue.getWaitingCount(),
        caseSeriesQueue.getActiveCount(),
        caseSeriesQueue.getFailedCount(),
      ]),
    ]);
    queues = {
      pubmed: { waiting: pubmed[0], active: pubmed[1], failed: pubmed[2] },
      digest: { waiting: digest[0], active: digest[1], failed: digest[2] },
      caseSeries: {
        waiting: caseSeries[0],
        active: caseSeries[1],
        failed: caseSeries[2],
      },
    };
  } catch {
    queues = { error: "unavailable" };
  }

  const allOk = dbOk && redisOk;
  res.status(allOk ? 200 : 503).json({
    status: allOk ? "ok" : "degraded",
    uptime: Math.floor(process.uptime()),
    version: "1.0.0",
    db: dbOk ? "ok" : "error",
    redis: redisOk ? "ok" : "error",
    queues,
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/health/metrics", async (_req, res) => {
  try {
    const { getDlqCount } = await import("./dlq.ts");
    const { getOpusBudgetStatus } = await import("../clinicalIntelligence.ts");
    const [dlqCount, budget] = await Promise.all([
      getDlqCount(),
      getOpusBudgetStatus(),
    ]);
    res.json({
      dlq: { count: dlqCount },
      opus: budget,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({ error: "metrics unavailable", detail: String(err) });
  }
});

app.get("/api/health/version", (_req, res) => {
  res.json({
    commit: (process.env.RAILWAY_GIT_COMMIT_SHA ?? "dev").slice(0, 7),
    branch: process.env.RAILWAY_GIT_BRANCH ?? "local",
    builtAt: process.env.BUILD_TIMESTAMP ?? "unknown",
    nodeVersion: process.version,
    env: process.env.NODE_ENV,
  });
});

// CIS REST API — external integrations authenticated by API key
const { cisRestRouter } = await import("../routes/cisRest.ts");
app.use("/api/cis", cisLimiter, cisRestRouter);

if (env.NODE_ENV === "production") {
  const clientDist = path.resolve(__dirname, "../../dist/client");
  app.get("*", (req, res) => {
    if (/\.[a-zA-Z0-9]+$/.test(req.path)) {
      res.status(404).end();
      return;
    }
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.join(clientDist, "index.html"), (err) => {
      if (err) {
        logger.error("[server] sendFile index.html falhou", {
          path: req.path,
          error: String(err),
        });
        res.status(503).send("Serviço temporariamente indisponível");
      }
    });
  });
}

Sentry.setupExpressErrorHandler(app);

await ensureSchema().catch((err) => {
  logger.error("[server] ensureSchema falhou", { error: String(err) });
  if (env.NODE_ENV === "production") process.exit(1);
});

const inProcessWorkers: Worker[] = [];

const server = app.listen(env.PORT, async () => {
  logger.info(`CIS rodando na porta ${env.PORT}`, { env: env.NODE_ENV });

  if (env.WORKERS_ENABLED !== false) {
    const { startPubmedWorker } = await import("../pubmedQueue.ts");
    const { startDigestWorker, agendarDigestCrons } =
      await import("../digestQueue.ts");
    const { startCaseSeriesWorker } = await import("../caseSeriesQueue.ts");
    inProcessWorkers.push(
      startPubmedWorker(),
      startDigestWorker(),
      startCaseSeriesWorker(),
    );
    await agendarDigestCrons();
    logger.info("[server] Workers BullMQ iniciados em-processo.");
  } else {
    logger.info(
      "[server] WORKERS_ENABLED=false — aguardando worker service separado.",
    );
  }
});

async function shutdown(signal: string) {
  logger.info(`[server] ${signal} recebido — encerrando graciosamente...`);
  // Close workers first so in-flight jobs can complete/unlock before Redis disconnects
  await Promise.allSettled(inProcessWorkers.map((w) => w.close()));
  server.close(async () => {
    const { redis } = await import("./redis.ts");
    await redis.quit().catch(() => undefined);
    logger.info("[server] Conexões encerradas. Saindo.");
    process.exit(0);
  });

  setTimeout(() => {
    logger.error("[server] Graceful shutdown excedeu 15s — forçando saída");
    process.exit(1);
  }, 15_000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error("[server] unhandledRejection", { reason: String(reason) });
});
process.on("uncaughtException", (err) => {
  logger.error("[server] uncaughtException", {
    error: (err as Error).message,
    stack: (err as Error).stack,
  });
  process.exit(1);
});

export default app;
