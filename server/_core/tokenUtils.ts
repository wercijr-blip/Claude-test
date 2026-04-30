import { createHash, randomBytes } from 'crypto'

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

export function generateToken(): string {
  return randomBytes(32).toString('hex')
}
