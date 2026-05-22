import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";
import { env } from "./env.ts";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const key = Buffer.from(env.ENCRYPTION_KEY, "hex");
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decrypt(ciphertext: string): string {
  try {
    const buffer = Buffer.from(ciphertext, "base64");
    const iv = buffer.subarray(0, IV_LENGTH);
    const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = buffer.subarray(IV_LENGTH + TAG_LENGTH);
    const key = Buffer.from(env.ENCRYPTION_KEY, "hex");
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Falha na descriptografia: dado corrompido ou adulterado");
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
  const normalized = cpf.replace(/\D/g, "");
  return scryptSync(normalized, env.CPF_HASH_SALT, 32, {
    N: 16384,
    r: 8,
    p: 1,
  }).toString("hex");
}
