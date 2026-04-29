/**
 * Cria o primeiro usuário admin.
 * Uso: npx tsx seed.ts --email=admin@clinica.com --nome="Dr. Werciley" --crm=16381 --especialidade=Infectologia [--senha=MinhaSenh@123]
 */
import 'dotenv/config'
import { randomBytes } from 'crypto'
import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import { nanoid } from 'nanoid'
import bcrypt from 'bcryptjs'
import * as schema from './drizzle/schema.ts'
import { eq } from 'drizzle-orm'

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=')
    return [k, v.join('=')]
  }),
)

async function seed() {
  if (!args.email) {
    console.error('❌ Informe --email=admin@clinica.com')
    process.exit(1)
  }

  const pool = mysql.createPool({ uri: process.env.DATABASE_URL!, connectionLimit: 1 })
  const db   = drizzle(pool, { schema, mode: 'default' })

  // Verificar se já existe
  const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, args.email)).limit(1)
  if (existing) {
    console.log(`ℹ️  Usuário ${args.email} já existe (id=${existing.id}, role=${existing.role})`)
    await pool.end()
    return
  }

  const clinicId = nanoid()
  const senha    = args.senha ?? randomBytes(10).toString('base64url')
  const hash     = await bcrypt.hash(senha, 10)

  await db.insert(schema.users).values({
    email:              args.email,
    passwordHash:       hash,
    name:               args.nome ?? args.email,
    role:               'admin',
    clinicId,
    specialty:          args.especialidade ?? null,
    crm:                args.crm ?? null,
    active:             1,
    mustChangePassword: 0,
  })

  console.log(`✅ Admin criado!`)
  console.log(`   Email:    ${args.email}`)
  console.log(`   Senha:    ${senha}`)
  console.log(`   clinicId: ${clinicId}`)
  console.log(`   Acesse:   ${process.env.MEDSCRIBE_URL ?? 'http://localhost:5173'}/login`)

  await pool.end()
  process.exit(0)
}

seed().catch((e) => { console.error(e); process.exit(1) })
