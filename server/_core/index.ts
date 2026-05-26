import express from "express";
import compression from "compression";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { env } from "./env.ts";
import { logger } from "./logger.ts";
import { redis } from "./redis.ts";
import { applySecurityMiddleware } from "./security.ts";
import { appRouter } from "../routers.ts";
import { createContext } from "./context.ts";
import {
  authLimiter,
  tokenValidateLimiter,
  uploadLimiter,
  totpLimiter,
  dataRightsLimiter,
  globalLimiter,
} from "./rateLimiters.ts";
import { db, pool } from "../db.ts";
import { ensureSchema } from "./ensureSchema.ts";
import { Sentry } from "./instrument.ts";
import { openApiSpec } from "./openapi.ts";
import {
  metricsRegistry,
  queueWaiting,
  queueFailed,
  dlqTotal,
} from "./metrics.ts";
import type { Worker } from "bullmq";

// Keeps references so graceful shutdown can close BullMQ workers cleanly.
let _activeWorkers: Worker[] = [];

// Protects ops-only endpoints. No-op when OPS_TOKEN is not configured (dev).
function requireOpsToken(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  if (!env.OPS_TOKEN) {
    next();
    return;
  }
  if (req.headers["x-ops-token"] !== env.OPS_TOKEN) {
    res.status(401).json({ error: "Não autorizado" });
    return;
  }
  next();
}

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Trust Railway's reverse proxy so X-Forwarded-For is recognized
app.set("trust proxy", 1);

applySecurityMiddleware(app);
app.use(compression());
app.use(cookieParser());
app.use(globalLimiter);

// Request ID — assigns a short UUID per request, logs method/url/status/duration
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

// Assets estáticos DEPOIS dos middlewares de segurança (Helmet, CORS, rate limit)
if (env.NODE_ENV === "production") {
  const clientDist = path.resolve(__dirname, "../../dist/client");
  const webOut = path.resolve(__dirname, "../../web/out");
  const clientIndex = path.join(clientDist, "index.html");

  // Bundle smoke check — exit early with clear diagnostic if the Vite build is missing
  if (!fs.existsSync(clientIndex)) {
    logger.error("[FATAL] dist/client/index.html não existe", {
      cwd: process.cwd(),
      expected: clientIndex,
      cwdContents: fs.readdirSync(process.cwd()).join(", "),
      distContents: fs.existsSync(path.dirname(clientDist))
        ? fs.readdirSync(path.dirname(clientDist)).join(", ")
        : "(dist/ não encontrada)",
    });
    process.exit(1);
  }

  {
    const indexContent = fs.readFileSync(clientIndex, "utf8");
    const bundleMatch = indexContent.match(
      /\/assets\/(index-[A-Za-z0-9_-]+\.js)/,
    );
    const assetsDir = path.join(clientDist, "assets");
    const chunkCount = fs.existsSync(assetsDir)
      ? fs.readdirSync(assetsDir).filter((f: string) => f.endsWith(".js"))
          .length
      : 0;
    logger.info("[startup] dist/client OK", {
      bundle: bundleMatch?.[1] ?? "NÃO ENCONTRADO no index.html",
      chunks: chunkCount,
    });
  }

  // Verifica se o build do Next.js está disponível
  const webOutExists = fs.existsSync(path.join(webOut, "index.html"));
  if (!webOutExists) {
    logger.warn(
      "[server] web/out/index.html não encontrado — marketing routes vão usar o Vite SPA como fallback",
    );
  }

  // Next.js static assets — _next/static has hashed names, safe to cache immutably
  app.use(
    "/_next/static",
    express.static(path.join(webOut, "_next", "static"), {
      maxAge: "1y",
      immutable: true,
    }),
  );
  app.use("/_next", express.static(path.join(webOut, "_next")));

  // Rotas de marketing: Next.js SSG quando disponível, Vite SPA como fallback
  const marketingRoutes = [
    "/",
    "/lp/google",
    "/lp/meta",
    "/lp/retargeting",
    "/privacidade",
    "/termos",
    "/robots.txt",
    "/sitemap.xml",
  ];
  for (const route of marketingRoutes) {
    if (route === "/robots.txt" || route === "/sitemap.xml") {
      app.get(route, (_req, res) => {
        const webFilePath = path.join(webOut, route);
        const clientFilePath = path.join(clientDist, route.slice(1));
        if (fs.existsSync(webFilePath)) {
          res.sendFile(webFilePath);
        } else if (fs.existsSync(clientFilePath)) {
          res.sendFile(clientFilePath);
        } else {
          res.status(404).end();
        }
      });
    } else {
      const htmlPath =
        route === "/"
          ? path.join(webOut, "index.html")
          : path.join(webOut, route, "index.html");
      app.get(route, (_req, res) => {
        res.set("Cache-Control", "no-cache, must-revalidate");
        // Fallback para Vite SPA se o build do Next.js não estiver disponível
        const target = fs.existsSync(htmlPath) ? htmlPath : clientIndex;
        res.sendFile(target);
      });
    }
  }

  // Vite /assets → hashed bundles (JS, CSS) — content-addressable, safe to cache immutably
  app.use(
    "/assets",
    express.static(path.join(clientDist, "assets"), {
      maxAge: "1y",
      immutable: true,
    }),
  );
  // Other Vite statics (favicon, og-image, manifest) — moderate cache for images/fonts
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

// Body parsers globais
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Asaas webhook (JSON body — no raw body needed; Asaas uses token auth, not HMAC)
app.post("/api/asaas/webhook", async (req, res) => {
  const { handleAsaasWebhook } = await import("../asaas/webhook.ts");
  await handleAsaasWebhook(req, res);
});

// tRPC — com rate limiters por rota
app.use("/trpc/auth.callback", authLimiter);
app.use("/trpc/token.validar", tokenValidateLimiter);
app.use("/trpc/intake.solicitarReenvioLink", tokenValidateLimiter);
app.use("/trpc/twoFactor.verify", totpLimiter);
app.use("/trpc/me.exportData", dataRightsLimiter);
app.use("/trpc/me.requestAnonymization", dataRightsLimiter);
app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext: ({ req }) => createContext({ req }),
    onError: ({ error, path, type, input }) => {
      const PII_KEYS = [
        "cpf",
        "nome",
        "email",
        "telefone",
        "password",
        "senha",
        "token",
      ];
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

// Deep healthcheck — verifica DB, Redis e S3
app.get("/api/health/deep", async (_req, res) => {
  const { S3Client, HeadBucketCommand } = await import("@aws-sdk/client-s3");
  const checks = await Promise.allSettled([
    db
      .execute("SELECT 1")
      .then(() => ({ name: "db", ok: true }))
      .catch((e: Error) => ({ name: "db", ok: false, error: e.message })),
    redis
      .ping()
      .then((r) => ({ name: "redis", ok: r === "PONG" }))
      .catch((e: Error) => ({ name: "redis", ok: false, error: e.message })),
    new S3Client({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
    })
      .send(new HeadBucketCommand({ Bucket: env.AWS_S3_BUCKET }))
      .then(() => ({ name: "s3", ok: true }))
      .catch((e: Error) => ({ name: "s3", ok: false, error: e.message })),
  ]);
  const results = checks.map((c) =>
    c.status === "fulfilled" ? c.value : { name: "unknown", ok: false },
  );
  const allOk = results.every((r) => r.ok);
  res.status(allOk ? 200 : 503).json({
    status: allOk ? "ok" : "degraded",
    checks: results,
    timestamp: new Date().toISOString(),
  });
});

// Healthcheck com verificação do banco e Redis
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

  const allOk = dbOk && redisOk;
  res.status(allOk ? 200 : 503).json({
    status: allOk ? "ok" : "degraded",
    uptime: Math.floor(process.uptime()),
    version: "1.0.0",
    db: dbOk ? "ok" : "error",
    redis: redisOk ? "ok" : "error",
    timestamp: new Date().toISOString(),
  });
});

// Version info — confirms deploy reached production and which bundle is being served
app.get("/api/health/version", (_req, res) => {
  let bundle = "unknown";
  let chunks = 0;
  try {
    const distClient = path.resolve(__dirname, "../../dist/client");
    const indexHtml = fs.readFileSync(
      path.join(distClient, "index.html"),
      "utf8",
    );
    const m = indexHtml.match(/\/assets\/(index-[A-Za-z0-9_-]+\.js)/);
    bundle = m?.[1] ?? "no-match";
    const assetsDir = path.join(distClient, "assets");
    chunks = fs.existsSync(assetsDir)
      ? fs.readdirSync(assetsDir).filter((f: string) => f.endsWith(".js"))
          .length
      : 0;
  } catch (e) {
    bundle = `error: ${(e as Error).message}`;
  }
  res.json({
    commit: (process.env.RAILWAY_GIT_COMMIT_SHA ?? "dev").slice(0, 7),
    branch: process.env.RAILWAY_GIT_BRANCH ?? "local",
    bundle,
    chunks,
    builtAt: process.env.BUILD_TIMESTAMP ?? "unknown",
    nodeVersion: process.version,
    env: process.env.NODE_ENV,
  });
});

// Protect ops endpoints — require x-ops-token header or ?ops_token query param.
// OPS_TOKEN must be set in production; warn fires on boot if missing (env.ts).
app.use(
  [
    "/api/metrics",
    "/api/health/observability",
    "/api/admin/usage",
    "/api/health/queues",
  ],
  (req, res, next) => {
    if (!env.OPS_TOKEN) {
      res.status(503).json({ error: "OPS_TOKEN não configurado no servidor" });
      return;
    }
    const token = req.headers["x-ops-token"] as string | undefined;
    if (token !== env.OPS_TOKEN) {
      res.status(401).json({ error: "Token inválido" });
      return;
    }
    next();
  },
);

// Metrics — queue depth, memory, circuit breaker state
app.get("/api/metrics", async (_req, res) => {
  const { getCircuitStatus } = await import("./circuitBreaker.ts");
  let pdfWaiting = -1;
  let linkWaiting = -1;
  let pesquisaWaiting = -1;
  let lembreteWaiting = -1;
  let nutricaoWaiting = -1;
  let examWaiting = -1;
  try {
    const { pdfQueue, linkAcessoQueue, pesquisaQueue, lembreteQueue } =
      await import("../pdfQueue.ts");
    const { nutricaoQueue } = await import("../workers/queues.ts");
    const { examQueue } = await import("../examQueue.ts");
    [
      pdfWaiting,
      linkWaiting,
      pesquisaWaiting,
      lembreteWaiting,
      nutricaoWaiting,
      examWaiting,
    ] = await Promise.all([
      pdfQueue.getWaitingCount(),
      linkAcessoQueue.getWaitingCount(),
      pesquisaQueue.getWaitingCount(),
      lembreteQueue.getWaitingCount(),
      nutricaoQueue.getWaitingCount(),
      examQueue.getWaitingCount(),
    ]);
  } catch {
    /* workers may not be started */
  }

  let staffWhatsappActiveDebounces = -1;
  try {
    const keys = await redis.keys("wpp:staff:*");
    staffWhatsappActiveDebounces = keys.length;
  } catch {
    /* Redis may be unavailable */
  }

  res.json({
    uptime: Math.floor(process.uptime()),
    memory: {
      heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    },
    queues: {
      pdf: pdfWaiting,
      linkAcesso: linkWaiting,
      pesquisa: pesquisaWaiting,
      lembrete: lembreteWaiting,
      nutricao: nutricaoWaiting,
      exam: examWaiting,
    },
    circuits: { asaas: getCircuitStatus("asaas") },
    staffWhatsappActiveDebounces,
    timestamp: new Date().toISOString(),
  });
});

// Prometheus metrics — for Grafana/Alertmanager integration
app.get("/api/metrics/prometheus", requireOpsToken, async (_req, res) => {
  try {
    // Update queue gauges
    const { examQueue } = await import("../examQueue.ts");
    const { pdfQueue } = await import("../workers/queues.ts");
    const { db: dbInst } = await import("../db.ts");
    const { dlqJobs } = await import("../../drizzle/schema.ts");
    const { count } = await import("drizzle-orm");

    const [examWaiting, examFailed, pdfWaiting, pdfFailed] =
      await Promise.allSettled([
        examQueue.getWaitingCount(),
        examQueue.getFailedCount(),
        pdfQueue.getWaitingCount(),
        pdfQueue.getFailedCount(),
      ]);

    if (examWaiting.status === "fulfilled")
      queueWaiting.set({ queue: "exam-analysis" }, examWaiting.value);
    if (examFailed.status === "fulfilled")
      queueFailed.set({ queue: "exam-analysis" }, examFailed.value);
    if (pdfWaiting.status === "fulfilled")
      queueWaiting.set({ queue: "pdf-generation" }, pdfWaiting.value);
    if (pdfFailed.status === "fulfilled")
      queueFailed.set({ queue: "pdf-generation" }, pdfFailed.value);

    const [dlqCount] = await dbInst
      .select({ total: count(dlqJobs.id) })
      .from(dlqJobs)
      .catch(() => [{ total: 0 }]);
    dlqTotal.set(dlqCount?.total ?? 0);

    res.setHeader("Content-Type", metricsRegistry.contentType);
    res.end(await metricsRegistry.metrics());
  } catch {
    res.status(500).json({ error: "metrics unavailable" });
  }
});

// Queue health — full state breakdown per queue (waiting/active/delayed/failed/completed)
app.get("/api/health/queues", async (_req, res) => {
  type QueueStats = {
    waiting: number;
    active: number;
    delayed: number;
    failed: number;
    completed: number;
  };
  async function queueStats(q: {
    getWaitingCount(): Promise<number>;
    getActiveCount(): Promise<number>;
    getDelayedCount(): Promise<number>;
    getFailedCount(): Promise<number>;
    getCompletedCount(): Promise<number>;
  }): Promise<QueueStats> {
    const [waiting, active, delayed, failed, completed] = await Promise.all([
      q.getWaitingCount(),
      q.getActiveCount(),
      q.getDelayedCount(),
      q.getFailedCount(),
      q.getCompletedCount(),
    ]);
    return { waiting, active, delayed, failed, completed };
  }

  const queues: Record<string, QueueStats | { error: string }> = {};
  try {
    const { pdfQueue, linkAcessoQueue, pesquisaQueue, lembreteQueue } =
      await import("../pdfQueue.ts");
    const { nutricaoQueue } = await import("../workers/queues.ts");
    const { examQueue } = await import("../examQueue.ts");
    const [pdf, linkAcesso, pesquisa, lembrete, nutricao, exam] =
      await Promise.allSettled([
        queueStats(pdfQueue),
        queueStats(linkAcessoQueue),
        queueStats(pesquisaQueue),
        queueStats(lembreteQueue),
        queueStats(nutricaoQueue),
        queueStats(examQueue),
      ]);
    queues.pdf =
      pdf.status === "fulfilled"
        ? pdf.value
        : { error: String((pdf as PromiseRejectedResult).reason) };
    queues.linkAcesso =
      linkAcesso.status === "fulfilled"
        ? linkAcesso.value
        : { error: String((linkAcesso as PromiseRejectedResult).reason) };
    queues.pesquisa =
      pesquisa.status === "fulfilled"
        ? pesquisa.value
        : { error: String((pesquisa as PromiseRejectedResult).reason) };
    queues.lembrete =
      lembrete.status === "fulfilled"
        ? lembrete.value
        : { error: String((lembrete as PromiseRejectedResult).reason) };
    queues.nutricao =
      nutricao.status === "fulfilled"
        ? nutricao.value
        : { error: String((nutricao as PromiseRejectedResult).reason) };
    queues.exam =
      exam.status === "fulfilled"
        ? exam.value
        : { error: String((exam as PromiseRejectedResult).reason) };
  } catch (err) {
    res.status(503).json({
      error: "Falha ao consultar filas BullMQ",
      detail: String(err),
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const hasFailures = Object.values(queues).some(
    (q) => "failed" in q && q.failed > 0,
  );
  res.status(200).json({
    status: hasFailures ? "degraded" : "ok",
    queues,
    timestamp: new Date().toISOString(),
  });
});

// LLM usage — consumo diário vs limite
app.get("/api/admin/usage", async (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const key = `llm:daily:${today}`;
  let llmToday = 0;
  try {
    const val = await redis.get(key);
    llmToday = val ? parseInt(val, 10) : 0;
  } catch {
    /* Redis may be unavailable */
  }

  const limit = env.LLM_DAILY_LIMIT ?? 200;
  const percentUsed = Math.round((llmToday / limit) * 100);
  res.json({
    llm: { today: llmToday, limit, percentUsed, alert: percentUsed >= 80 },
    timestamp: new Date().toISOString(),
  });
});

// Observability — confirma que Sentry está configurado no servidor
app.get("/api/health/observability", (_req, res) => {
  res.json({
    sentry_server_configured: !!process.env.SENTRY_DSN_SERVER,
    sentry_server_dsn_prefix:
      process.env.SENTRY_DSN_SERVER?.slice(0, 25) ?? null,
    node_env: process.env.NODE_ENV,
    release: process.env.RAILWAY_GIT_COMMIT_SHA ?? "unknown",
    timestamp: new Date().toISOString(),
  });
});

// API Docs — Swagger UI (serves openapi.json + interactive explorer)
// Uses a relaxed CSP for this route only (swagger-ui needs unsafe-inline for its UI).
app.get("/api/docs/openapi.json", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.json(openApiSpec);
});
app.use(
  "/api/docs",
  (
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:",
    );
    next();
  },
  swaggerUi.serve,
  swaggerUi.setup(openApiSpec, {
    customSiteTitle: "Facilita PrEP API Docs",
    swaggerOptions: { persistAuthorization: true, tryItOutEnabled: true },
  }),
);

// Upload de exames (lazy import para evitar carregar S3 client no boot)
app.post("/api/upload", uploadLimiter, async (req, res) => {
  const { uploadExame } = await import("../storage.ts");
  await uploadExame(req, res);
});

// Catch-all: servir index.html para rotas do SPA em produção.
// Importante: NÃO servir index.html para assets ausentes (.css, .js, etc) —
// um navegador com tab antiga referenciando hash de build velho receberia
// HTML com Content-Type text/html, levando o browser a recusar com erro de
// MIME. Para qualquer arquivo com extensão, retornamos 404.
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

// Sentry error handler — must come after all routes, before listen
Sentry.setupExpressErrorHandler(app);

await ensureSchema().catch((err) => {
  logger.error("[server] ensureSchema falhou (continuando)", {
    error: String(err),
  });
});

// Cert expiry alert — warn and email if ICP-Brasil certificate expires in < 60 days
if (env.NODE_ENV === "production") {
  const { inspecionarCertificado } = await import("../pdfSigner.ts");
  inspecionarCertificado()
    .then(async (info) => {
      if (
        info.status === "configurado" &&
        typeof info.diasRestantes === "number" &&
        info.diasRestantes < 60
      ) {
        logger.warn("[cert] Certificado ICP-Brasil expira em breve", {
          diasRestantes: info.diasRestantes,
          validoAte: info.validoAte,
        });
        // Send email alert once per day to avoid spam
        const alertKey = `cert:alert:${new Date().toISOString().slice(0, 10)}`;
        const alreadyAlerted = await redis.get(alertKey).catch(() => null);
        if (!alreadyAlerted) {
          await redis.set(alertKey, "1", "EX", 86_400).catch(() => {});
          const { enviarAlertaCertificado } = await import("../email.ts");
          void enviarAlertaCertificado(info.diasRestantes);
        }
      }
    })
    .catch(() => {
      /* non-critical */
    });
}

// Configura a regra de lifecycle do S3 (exames-inicio/ expira em 30 dias)
const { ensureS3Lifecycle } = await import("../storage.ts");
await ensureS3Lifecycle().catch((err) => {
  logger.error("[server] ensureS3Lifecycle falhou (continuando)", {
    error: String(err),
  });
});

const server = app.listen(env.PORT, async () => {
  logger.info(`Facilita PrEP rodando na porta ${env.PORT}`, {
    env: env.NODE_ENV,
  });

  // Workers run in-process by default (single-service deploy).
  // Set WORKERS_ENABLED=false when running a dedicated worker service via server/workers.ts.
  if (env.WORKERS_ENABLED !== false) {
    const {
      startPdfWorker,
      startLembreteWorker,
      startPesquisaWorker,
      startLinkAcessoWorker,
      agendarLembreteDiario,
      agendarDrMensal,
    } = await import("../pdfQueue.ts");
    const { startExamWorker } = await import("../examQueue.ts");
    const { startNutricaoWorker, agendarNutricaoDiaria } =
      await import("../workers/nutricaoWorker.ts");
    const { startRetentionWorker, agendarRetencaoDiaria } =
      await import("../workers/retentionWorker.ts");
    _activeWorkers = [
      startPdfWorker(),
      startLembreteWorker(),
      startPesquisaWorker(),
      startLinkAcessoWorker(),
      startExamWorker(),
      startNutricaoWorker(),
      startRetentionWorker(),
    ];
    await agendarLembreteDiario();
    await agendarDrMensal();
    await agendarNutricaoDiaria();
    await agendarRetencaoDiaria();
    logger.info("[server] Workers BullMQ iniciados em-processo.");
  } else {
    logger.info(
      "[server] WORKERS_ENABLED=false — aguardando worker service separado.",
    );
  }
});

// Graceful shutdown — Railway sends SIGTERM before stopping the container.
// Stop accepting new connections, wait for in-flight requests, then exit.
async function shutdown(signal: string) {
  logger.info(`[server] ${signal} recebido — encerrando graciosamente...`);
  // Force-close keep-alive connections after 10s so server.close() callback fires
  setTimeout(() => server.closeAllConnections?.(), 10_000);

  server.close(async () => {
    if (_activeWorkers.length > 0) {
      await Promise.allSettled(_activeWorkers.map((w) => w.close()));
      logger.info("[server] Workers BullMQ encerrados.");
    }
    const { redis } = await import("./redis.ts");
    await redis.quit().catch(() => undefined);
    await pool.end().catch(() => undefined);
    logger.info("[server] Conexões encerradas. Saindo.");
    process.exit(0);
  });

  // Force exit if graceful shutdown hangs beyond 15s
  setTimeout(() => {
    logger.error("[server] Graceful shutdown excedeu 15s — forçando saída");
    process.exit(1);
  }, 15_000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Catch any unhandled promise rejections or thrown exceptions so they appear
// in Railway logs with full context instead of crashing silently.
process.on("unhandledRejection", (reason) => {
  logger.error("[server] unhandledRejection", { reason: String(reason) });
});
process.on("uncaughtException", (err) => {
  logger.error("[server] uncaughtException", {
    error: err.message,
    stack: err.stack,
  });
  // Exit after uncaughtException — process state is undefined, Railway restarts it.
  process.exit(1);
});

export default app;
