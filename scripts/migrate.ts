/**
 * Applies pending Drizzle migrations from drizzle/migrations/ to the database.
 * Usage: pnpm db:migrate
 *
 * Always run this before pnpm start in production deployments.
 * Migrations are idempotent — already-applied migrations are skipped.
 */
import { migrate } from 'drizzle-orm/mysql2/migrator'
import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import { logger } from '../server/_core/logger.ts'

const migrationsFolder = new URL('../drizzle/migrations', import.meta.url).pathname

const connection = await mysql.createConnection({
  uri: process.env.DATABASE_URL,
})

const db = drizzle(connection)

logger.info('[migrate] Aplicando migrations pendentes...', { folder: migrationsFolder })

try {
  await migrate(db, { migrationsFolder })
  logger.info('[migrate] Migrations concluídas.')
} catch (err) {
  logger.error('[migrate] Falha ao aplicar migrations', { error: String(err) })
  process.exit(1)
} finally {
  await connection.end()
}
