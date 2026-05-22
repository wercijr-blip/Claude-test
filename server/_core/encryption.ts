import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto'
import { env } from './env.ts'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16
const VERSION_PREFIX = 'v1:'
const MIN_BUFFER_LENGTH = IV_LENGTH + TAG_LENGTH

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH)
  const key = Buffer.from(env.ENCRYPTION_KEY, 'hex')
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return VERSION_PREFIX + Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decrypt(ciphertext: string): string {
  try {
    // Strip version prefix if present — allows rolling migration from unversioned data
    const raw = ciphertext.startsWith(VERSION_PREFIX)
      ? ciphertext.slice(VERSION_PREFIX.length)
      : ciphertext
    const buffer = Buffer.from(raw, 'base64')
    if (buffer.length < MIN_BUFFER_LENGTH) {
      throw new Error('buffer too short')
    }
    const iv = buffer.subarray(0, IV_LENGTH)
    const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
    const encrypted = buffer.subarray(IV_LENGTH + TAG_LENGTH)
    const key = Buffer.from(env.ENCRYPTION_KEY, 'hex')
    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
  } catch {
    throw new Error('Falha na descriptografia: dado corrompido ou adulterado')
  }
}

export function safeDecrypt(ciphertext: string | null | undefined, fallback = '—'): string {
  if (!ciphertext) return fallback
  try {
    return decrypt(ciphertext)
  } catch {
    return fallback
  }
}

export function hashCpf(cpf: string): string {
  const normalized = cpf.replace(/\D/g, '')
  return createHash('sha256')
    .update(normalized + env.CPF_HASH_SALT)
    .digest('hex')
}
