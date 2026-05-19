import { createHmac, randomBytes } from "crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf: Buffer): string {
  let result = "";
  let bits = 0;
  let value = 0;
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i]!;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += BASE32_ALPHABET[(value >> bits) & 0x1f]!;
    }
  }
  if (bits > 0) {
    result += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f]!;
  }
  return result;
}

function base32Decode(str: string): Buffer {
  const cleaned = str.toUpperCase().replace(/=+$/, "");
  let bits = 0;
  let value = 0;
  const buf: number[] = [];
  for (const char of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) throw new Error("Caractere base32 inválido");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      buf.push((value >> bits) & 0xff);
    }
  }
  return Buffer.from(buf);
}

function hotp(secret: Buffer, counter: bigint): string {
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigInt64BE(counter);
  const hmac = createHmac("sha1", secret).update(counterBuf).digest();
  const offset = hmac[19]! & 0xf;
  const code =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function verifyTotpCode(secretBase32: string, code: string): boolean {
  let secret: Buffer;
  try {
    secret = base32Decode(secretBase32);
  } catch {
    return false;
  }
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  const counter = BigInt(Math.floor(Date.now() / 30_000));
  for (let delta = -1n; delta <= 1n; delta++) {
    if (hotp(secret, counter + delta) === normalized) return true;
  }
  return false;
}

export function getTotpUri(secret: string, email: string): string {
  return `otpauth://totp/CIS:${encodeURIComponent(email)}?secret=${secret}&issuer=CIS&algorithm=SHA1&digits=6&period=30`;
}
