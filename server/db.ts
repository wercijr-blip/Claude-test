import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import { env } from './_core/env.ts'
import * as schema from '../drizzle/schema.ts'
import * as relations from '../drizzle/relations.ts'

const pool = mysql.createPool({
  uri: env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 100,
  connectTimeout: 10000,
})

export const db = drizzle(pool, { schema: { ...schema, ...relations }, mode: 'default' })

export type Db = typeof db
