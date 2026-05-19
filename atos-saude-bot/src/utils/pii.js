import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGO = 'aes-256-gcm'
const PREFIX = 'enc:'

let _cachedKey = undefined

function getKey() {
  if (_cachedKey !== undefined) return _cachedKey
  const hex = process.env.PII_ENCRYPTION_KEY
  if (!hex) return (_cachedKey = null)
  const buf = Buffer.from(hex, 'hex')
  if (buf.length !== 32) throw new Error('PII_ENCRYPTION_KEY deve ter 64 hex chars (32 bytes)')
  return (_cachedKey = buf)
}

export function resetKeyCache() {
  _cachedKey = undefined
}

export function encryptPII(text) {
  const key = getKey()
  if (!key || text == null) return text
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return PREFIX + Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decryptPII(value) {
  if (!value || !String(value).startsWith(PREFIX)) return value
  const key = getKey()
  if (!key) return value
  try {
    const buf = Buffer.from(String(value).slice(PREFIX.length), 'base64')
    const iv  = buf.subarray(0, 12)
    const tag = buf.subarray(12, 28)
    const enc = buf.subarray(28)
    const dec = createDecipheriv(ALGO, key, iv)
    dec.setAuthTag(tag)
    return Buffer.concat([dec.update(enc), dec.final()]).toString('utf8')
  } catch {
    return value
  }
}
