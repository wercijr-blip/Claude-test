import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  OWNER_OPEN_ID: z.string().min(1),

  ENCRYPTION_KEY: z.string().length(64),
  CPF_HASH_SALT: z.string().min(32),

  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  AWS_REGION: z.string().default('sa-east-1'),
  AWS_S3_BUCKET: z.string().min(1),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Facilita PrEP <noreply@facilitaprep.com.br>'),

  ASAAS_API_KEY: z.string().optional(),
  ASAAS_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
  ASAAS_WEBHOOK_TOKEN: z.string().optional(),

  // Valor da consulta em reais (ex: 150). Alterável via Railway sem deploy de código.
  CONSULTA_VALOR: z.coerce.number().positive().default(150),

  BUILT_IN_FORGE_API_URL: z.string().url().default('https://api.anthropic.com'),
  BUILT_IN_FORGE_API_KEY: z.string().optional(),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Certificado ICP-Brasil (Railway: base64 do .pfx; dev: arquivo em server/certs/)
  ICP_PFX_BASE64: z.string().optional(),
  ICP_PFX_PASSWORD: z.string().optional(),

  ZAPI_INSTANCE_ID: z.string().optional(),
  ZAPI_TOKEN: z.string().optional(),

  MEDICO_NOME: z.string().default('Werciley Saraiva Vieira Junior'),
  MEDICO_CRM: z.string().default('16381'),
  MEDICO_CRM_UF: z.string().default('DF'),
  MEDICO_CRM_TIPO: z.string().default('CRM'),
  MEDICO_RQE: z.string().default('RQE 14486'),

  CLINICA_NOME: z.string().default('ATOS Saúde Integrada Hospital Dia e Vacinas'),
  SUS_CNES: z.string().default('9843744'),

  APP_URL: z.string().url().default('https://www.facilitaprep.com.br'),
  ALLOWED_ORIGINS: z.string().optional(),

  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // Set to false when running a dedicated worker service (server/workers.ts).
  // Defaults to true so single-service deploys work without extra config.
  WORKERS_ENABLED: z.coerce.boolean().default(true),

  // Sentry — optional, wired up in a separate PR once DSNs are available
  SENTRY_DSN_SERVER: z.string().url().optional(),
  SENTRY_DSN_WEB: z.string().url().optional(),
  SENTRY_ENVIRONMENT: z.string().default('production'),

  // TOTP 2FA — chave AES separada para encriptar segredos TOTP
  // Gerar com: openssl rand -hex 32
  TOTP_ENC_KEY: z.string().length(64).optional(),

  // Payment methods — toggle via Railway without code deploy.
  // Set ENABLE_DEBIT_CARD=true once Asaas account enables DEBIT_CARD billing.
  ENABLE_DEBIT_CARD: z.coerce.boolean().default(false),

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
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Variáveis de ambiente inválidas:')
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2))
  process.exit(1)
}

export const env = parsed.data

// Fail-fast if someone accidentally runs with NODE_ENV=development in production.
// Railway sets NODE_ENV automatically; this catches misconfigurations.
if (env.NODE_ENV === 'development' && process.env['RAILWAY_ENVIRONMENT']) {
  console.error('❌ NODE_ENV=development detectado em ambiente Railway. Defina NODE_ENV=production.')
  process.exit(1)
}
