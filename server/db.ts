import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { env } from "./_core/env.ts";
import * as cisSchema from "../drizzle/cis-schema.ts";

export const pool = mysql.createPool({
  uri: env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: env.NODE_ENV === "production" ? 10 : 3,
  queueLimit: 50,
  connectTimeout: 10_000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 30_000,
  idleTimeout: 300_000,
});

export const db = drizzle(pool, { schema: cisSchema, mode: "default" });

export type Db = typeof db;
