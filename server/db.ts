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
  // Time to establish a new TCP connection to TiDB.
  connectTimeout: 10_000,
  // TCP keep-alive: detects dead/stale connections before the pool
  // tries to reuse them, avoiding silent ECONNRESET errors under low traffic.
  enableKeepAlive: true,
  keepAliveInitialDelay: 30_000,
  // Close idle connections after 5 minutes so TiDB Cloud doesn't hit its
  // concurrent-connection limit on the free tier (max 25 connections).
  idleTimeout: 300_000,
})

export const db = drizzle(pool, { schema: { ...schema, ...relations }, mode: 'default' })

export type Db = typeof db
