import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET:   z.string().min(32),

  // OpenAI (transcrição + SOAP + extração clínica)
  OPENAI_API_KEY: z.string().optional(),

  // Anthropic (chat de evidências + insights admin)
  ANTHROPIC_API_KEY: z.string().optional(),

  // App
  VITE_APP_ID:     z.string().default('medscrita'),
  NODE_ENV:        z.enum(['development', 'production', 'test']).default('development'),
  PORT:            z.coerce.number().default(3000),

  // MedScrita
  MEDSCRIBE_URL:         z.string().url().default('http://localhost:5173'),
  MEDSCRIBE_CLINIC_NAME: z.string().default('MedScrita Clínica'),

  // Email (SendGrid)
  SENDGRID_API_KEY:    z.string().optional(),
  BULLETIN_FROM_EMAIL: z.string().email().default('noreply@medscrita.com.br'),
  BULLETIN_FROM_NAME:  z.string().default('MedScrita — Meu Conhecimento'),

  // AWS S3 (áudios)
  AWS_ACCESS_KEY_ID:     z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION:            z.string().default('us-east-1'),
  AWS_S3_BUCKET:         z.string().optional(),

})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Variáveis de ambiente inválidas:')
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2))
  process.exit(1)
}

export const env = parsed.data
