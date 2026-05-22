import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1)
    .transform((url) => {
      // Ensure TiDB/MySQL returns DATETIME values in BRT (São Paulo) not UTC.
      // This prevents off-by-3h bugs in period calculations (digests, retention).
      if (url.includes("timezone=")) return url;
      const sep = url.includes("?") ? "&" : "?";
      return `${url}${sep}timezone=America%2FSao_Paulo`;
    }),
  JWT_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  OWNER_OPEN_ID: z.string().min(1),

  ENCRYPTION_KEY: z.string().length(64),
  CPF_HASH_SALT: z.string().min(32),

  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  AWS_REGION: z.string().default("sa-east-1"),
  AWS_S3_BUCKET: z.string().min(1),

  BUILT_IN_FORGE_API_URL: z.string().url().default("https://api.anthropic.com"),
  BUILT_IN_FORGE_API_KEY: z.string().optional(),
  LLM_DAILY_LIMIT: z.coerce.number().int().positive().default(200),

  REDIS_URL: z.string().default("redis://localhost:6379"),

  ZAPI_INSTANCE_ID: z.string().optional(),
  ZAPI_TOKEN: z.string().optional(),
  ZAPI_CLIENT_TOKEN: z.string().optional(),

  // WhatsApp pra staff — número compartilhado por papel, formato E.164 (ex: +556198432878)
  STAFF_WHATSAPP_MEDICOS: z.string().optional(),
  STAFF_WHATSAPP_SECRETARIAS: z.string().optional(),

  MEDICO_NOME: z.string().default(""),
  MEDICO_CRM: z.string().default(""),
  MEDICO_CRM_UF: z.string().default(""),
  MEDICO_CRM_TIPO: z.string().default("CRM"),
  MEDICO_RQE: z.string().default(""),

  CLINICA_NOME: z.string().default(""),
  SUS_CNES: z.string().default(""),

  APP_URL: z.string().url().default("http://localhost:3000"),
  ALLOWED_ORIGINS: z.string().optional(),

  PORT: z.coerce.number().default(3000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),
  // Set to false when running a dedicated worker service (server/workers.ts).
  // Defaults to true so single-service deploys work without extra config.
  // z.coerce.boolean() uses Boolean() which converts string "false" → true (non-empty string bug).
  // z.preprocess handles string env var values correctly.
  WORKERS_ENABLED: z.preprocess(
    (v) =>
      v === "false" || v === "0" ? false : v === undefined ? true : Boolean(v),
    z.boolean(),
  ),

  // Sentry — optional, wired up in a separate PR once DSNs are available
  SENTRY_DSN_SERVER: z.string().url().optional(),
  SENTRY_DSN_WEB: z.string().url().optional(),
  SENTRY_ENVIRONMENT: z.string().default("production"),

  // PubMed E-utilities — opcional; sem chave: 3 req/s, com chave: 10 req/s
  // Obter em: https://www.ncbi.nlm.nih.gov/account/
  NCBI_API_KEY: z.string().optional(),

  // Zotero — biblioteca pessoal de referências do médico
  // Obter em: zotero.org/settings/keys
  ZOTERO_API_KEY: z.string().optional(),
  ZOTERO_USER_ID: z.string().optional(),

  // Unpaywall — texto completo open access de artigos por DOI
  // Gratuito; e-mail usado apenas para identificação na API (sem cadastro)
  UNPAYWALL_EMAIL: z.string().email().optional(),

  // Obsidian — publicação de notas no vault via repositório GitHub privado
  // OBSIDIAN_GITHUB_REPO: formato "usuario/nome-do-repo" (ex: "werciley/obsidian-vault-cis")
  // OBSIDIAN_GITHUB_TOKEN: Personal Access Token com escopo "repo"
  OBSIDIAN_GITHUB_TOKEN: z.string().optional(),
  OBSIDIAN_GITHUB_REPO: z.string().optional(),

  // n8n — orquestrador de automações (notificações, fluxos cross-system)
  // N8N_WEBHOOK_URL: URL base do n8n, ex: "http://localhost:5678" ou "http://IP:5678"
  N8N_WEBHOOK_URL: z.string().url().optional(),
  N8N_WEBHOOK_SECRET: z.string().optional(),

  // REST API do CIS — autenticação por API key para integrações externas (n8n, scripts)
  // CIS_API_KEY: secret string de pelo menos 32 chars
  // CIS_MEDICO_USER_ID: ID numérico do médico no banco (usuário dono do CIS)
  CIS_API_KEY: z.string().min(32).optional(),
  CIS_MEDICO_USER_ID: z.coerce.number().int().positive().optional(),

  // Limite diário de tokens Claude Opus (CIS-10 e CIS-11).
  // Opus é ~15x mais caro que Sonnet; sem limite, uma série de casos longa pode
  // consumir dezenas de reais. Quando atingido, as chamadas fazem downgrade para Sonnet.
  // Padrão sugerido para uso diário moderado: 100_000 tokens (~10 chamadas completas).
  // Defina 0 ou omita para desabilitar o limite.
  OPUS_DAILY_TOKEN_BUDGET: z.coerce.number().int().min(0).default(100_000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Variáveis de ambiente inválidas:");
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const env = parsed.data;

// Fail-fast if someone accidentally runs with NODE_ENV=development in production.
// Railway sets NODE_ENV automatically; this catches misconfigurations.
if (env.NODE_ENV === "development" && process.env["RAILWAY_ENVIRONMENT"]) {
  console.error(
    "❌ NODE_ENV=development detectado em ambiente Railway. Defina NODE_ENV=production.",
  );
  process.exit(1);
}

// Warn when CIS API is partially configured — avoids silent runtime failures.
if (env.CIS_API_KEY && !env.CIS_MEDICO_USER_ID) {
  console.warn(
    "⚠️  CIS_API_KEY definida mas CIS_MEDICO_USER_ID ausente — REST API do CIS retornará 503.",
  );
}
if (
  (env.CIS_API_KEY || env.CIS_MEDICO_USER_ID) &&
  !env.BUILT_IN_FORGE_API_KEY
) {
  console.warn(
    "⚠️  CIS configurado mas BUILT_IN_FORGE_API_KEY ausente — todos os prompts CIS falharão com 401.",
  );
}

// Warn if ops endpoints are unprotected in production.
if (env.NODE_ENV === 'production' && !env.OPS_TOKEN) {
  console.warn('⚠️  OPS_TOKEN não configurado — /api/metrics e /api/admin/usage estão sem autenticação.')
}
