import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET:   z.string().min(32),

  // OpenAI (substitui Forge API)
  OPENAI_API_KEY: z.string().optional(),

  // Anthropic (Claude — para chat de evidências e insights)
  ANTHROPIC_API_KEY: z.string().optional(),

  // Legacy Forge/Manus API (mantido para compatibilidade)
  BUILT_IN_FORGE_API_URL: z.string().url().default('https://api.openai.com'),
  BUILT_IN_FORGE_API_KEY: z.string().optional(),

  // App
  VITE_APP_ID:     z.string().default('medscribe'),
  NODE_ENV:        z.enum(['development', 'production', 'test']).default('development'),
  PORT:            z.coerce.number().default(3000),

  // MedScribe
  MEDSCRIBE_URL:         z.string().url().default('http://localhost:5173'),
  MEDSCRIBE_CLINIC_NAME: z.string().default('MedScribe Clínica'),

  // Email (SendGrid)
  SENDGRID_API_KEY:    z.string().optional(),
  BULLETIN_FROM_EMAIL: z.string().email().default('noreply@medscribe.com.br'),
  BULLETIN_FROM_NAME:  z.string().default('MedScribe — Meu Conhecimento'),

  // AWS S3
  AWS_ACCESS_KEY_ID:     z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION:            z.string().default('us-east-1'),
  AWS_S3_BUCKET:         z.string().optional(),
  S3_BUCKET_NAME:        z.string().optional(),

  // Legacy — OAuth (mantido para não quebrar código existente)
  OAUTH_SERVER_URL: z.string().url().optional().catch(undefined),
  OWNER_OPEN_ID:    z.string().optional(),

  // Encryption (legado Facilita PrEP)
  ENCRYPTION_KEY: z.string().length(64).optional(),
  CPF_HASH_SALT:  z.string().min(32).optional(),

  // Email legado (Gmail)
  GMAIL_USER:         z.string().optional(),
  GMAIL_APP_PASSWORD: z.string().optional(),

  // FocusNFe
  FOCUSNFE_TOKEN_HOMOLOGACAO: z.string().optional(),
  FOCUSNFE_TOKEN_PRODUCAO:    z.string().optional(),
  FOCUSNFE_ENVIRONMENT:       z.enum(['homologacao', 'producao']).default('homologacao'),

  // Stripe
  STRIPE_SECRET_KEY:    z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // ZApi (WhatsApp legado)
  ZAPI_INSTANCE_ID: z.string().optional(),
  ZAPI_TOKEN:       z.string().optional(),

  // App URL legado
  APP_URL: z.string().url().default('http://localhost:5173'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Variáveis de ambiente inválidas:')
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2))
  process.exit(1)
}

export const env = parsed.data
