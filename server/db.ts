import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import { env } from './_core/env.ts'
import * as schema from '../drizzle/schema.ts'
import * as relations from '../drizzle/relations.ts'

const pool = mysql.createPool({
  uri: env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: env.NODE_ENV === 'production' ? 10 : 3,
  queueLimit: 50,
  connectTimeout: 10_000,
  // Close idle connections after 5 minutes so TiDB Cloud doesn't hit its
  // concurrent-connection limit on the free tier (max 25 connections).
  idleTimeout: 300_000,
})

// Cancel any query running longer than 30s — prevents slow queries from holding
// the connection pool and cascading into a full outage under load.
pool.on('connection', (conn) => {
  conn.query('SET SESSION MAX_EXECUTION_TIME = 30000').catch((err: Error) => {
    console.warn('[db] SET MAX_EXECUTION_TIME falhou (TiDB pode ignorar):', err.message)
  })
})

export const db = drizzle(pool, { schema: { ...schema, ...relations }, mode: 'default' })

export type Db = typeof db
