/**
 * Seed de dados para desenvolvimento local.
 * Uso: tsx server/seed.ts
 */
import { db } from './db.ts'
import { users } from '../drizzle/schema.ts'

async function seed() {
  console.log('Seeding dados de desenvolvimento...')

  await db
    .insert(users)
    .values({
      openId: 'dev-admin-google-sub',
      nome: 'Dev Admin',
      email: 'admin@dev.local',
      role: 'admin',
      ativo: true,
    })
    .onDuplicateKeyUpdate({ set: { ativo: true } })

  await db
    .insert(users)
    .values({
      openId: 'dev-medico-google-sub',
      nome: 'Dr. Dev Médico',
      email: 'medico@dev.local',
      role: 'medico',
      ativo: true,
    })
    .onDuplicateKeyUpdate({ set: { ativo: true } })

  await db
    .insert(users)
    .values({
      openId: 'dev-secretaria-google-sub',
      nome: 'Dev Secretaria',
      email: 'secretaria@dev.local',
      role: 'secretaria',
      ativo: true,
    })
    .onDuplicateKeyUpdate({ set: { ativo: true } })

  console.log('✓ Seed concluído.')
  console.log('  admin@dev.local    (role: admin)')
  console.log('  medico@dev.local   (role: medico)')
  console.log('  secretaria@dev.local (role: secretaria)')
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed falhou:', err)
  process.exit(1)
})
