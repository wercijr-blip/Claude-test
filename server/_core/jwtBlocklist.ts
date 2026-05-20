import { redis } from "./redis.ts";

/** Adds a token to the Redis blocklist with TTL matching its expiry. */
export async function blockToken(jti: string, exp: number): Promise<void> {
  const ttl = Math.max(1, exp - Math.floor(Date.now() / 1000));
  await redis.setex(`blocked:jwt:${jti}`, ttl, "1").catch(() => undefined);
}

export async function isTokenBlocked(jti: string): Promise<boolean> {
  return (await redis.exists(`blocked:jwt:${jti}`).catch(() => 0)) === 1;
}
