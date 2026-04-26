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

  GMAIL_USER: z.string().optional(),
  GMAIL_APP_PASSWORD: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Facilita PrEP <onboarding@resend.dev>'),

  FOCUSNFE_TOKEN_HOMOLOGACAO: z.string().optional(),
  FOCUSNFE_TOKEN_PRODUCAO: z.string().optional(),
  FOCUSNFE_ENVIRONMENT: z.enum(['homologacao', 'producao']).default('homologacao'),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  BUILT_IN_FORGE_API_URL: z.string().url().default('https://api.anthropic.com'),
  BUILT_IN_FORGE_API_KEY: z.string().optional(),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Certificado ICP-Brasil (Railway: base64 do .pfx; dev: arquivo em server/certs/)
  ICP_PFX_BASE64: z.string().optional(),
  ICP_PFX_PASSWORD: z.string().optional(),

  ZAPI_INSTANCE_ID: z.string().optional(),
  ZAPI_TOKEN: z.string().optional(),

  APP_URL: z.string().url().default('https://claude-test-production-8672.up.railway.app'),
  ALLOWED_ORIGINS: z.string().optional(),

  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Variáveis de ambiente inválidas:')
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2))
  process.exit(1)
}

export const env = parsed.data
