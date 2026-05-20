import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import {
  generateTotpSecret,
  verifyTotpCode,
  getTotpUri,
} from "./_core/totp.ts";

// Helpers that mirror the internal TOTP logic to produce expected codes in tests.
function base32Decode(str: string): Buffer {
  const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = str.toUpperCase().replace(/=+$/, "");
  let bits = 0;
  let value = 0;
  const buf: number[] = [];
  for (const char of cleaned) {
    const idx = alpha.indexOf(char);
    if (idx === -1) throw new Error("invalid base32 char");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      buf.push((value >> bits) & 0xff);
    }
  }
  return Buffer.from(buf);
}

function hotp(secretBuf: Buffer, counter: bigint): string {
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigInt64BE(counter);
  const hmac = createHmac("sha1", secretBuf).update(counterBuf).digest();
  const offset = hmac[19]! & 0xf;
  const code =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

function currentCode(secret: string, delta = 0n): string {
  const counter = BigInt(Math.floor(Date.now() / 30_000)) + delta;
  return hotp(base32Decode(secret), counter);
}

describe("generateTotpSecret", () => {
  it("returns a base32 string of the expected length", () => {
    const secret = generateTotpSecret();
    expect(typeof secret).toBe("string");
    // 20 random bytes → 32 base32 characters
    expect(secret.length).toBe(32);
    expect(/^[A-Z2-7]+$/.test(secret)).toBe(true);
  });

  it("produces unique secrets on each call", () => {
    const secrets = new Set(Array.from({ length: 20 }, generateTotpSecret));
    expect(secrets.size).toBe(20);
  });
});

describe("verifyTotpCode", () => {
  it("rejects a code with wrong length", () => {
    const secret = generateTotpSecret();
    expect(verifyTotpCode(secret, "12345")).toBe(false);
    expect(verifyTotpCode(secret, "1234567")).toBe(false);
  });

  it("rejects non-digit input", () => {
    const secret = generateTotpSecret();
    expect(verifyTotpCode(secret, "abc123")).toBe(false);
  });

  it("rejects an invalid base32 secret", () => {
    expect(verifyTotpCode("!!!INVALID!!!", "123456")).toBe(false);
  });

  it("accepts a valid code for the current time window", () => {
    const secret = generateTotpSecret();
    expect(verifyTotpCode(secret, currentCode(secret))).toBe(true);
  });

  it("accepts codes from adjacent time windows (clock skew tolerance)", () => {
    const secret = generateTotpSecret();
    expect(verifyTotpCode(secret, currentCode(secret, -1n))).toBe(true);
    expect(verifyTotpCode(secret, currentCode(secret, 1n))).toBe(true);
  });

  it("ignores whitespace in user-supplied codes", () => {
    const secret = generateTotpSecret();
    const code = currentCode(secret);
    const withSpaces = `${code.slice(0, 3)} ${code.slice(3)}`;
    expect(verifyTotpCode(secret, withSpaces)).toBe(true);
  });
});

describe("getTotpUri", () => {
  it("returns a valid otpauth URI", () => {
    const secret = generateTotpSecret();
    const uri = getTotpUri(secret, "medico@example.com");
    expect(uri).toMatch(/^otpauth:\/\/totp\/CIS:/);
    expect(uri).toContain(`secret=${secret}`);
    expect(uri).toContain("issuer=CIS");
    expect(uri).toContain("digits=6");
    expect(uri).toContain("period=30");
  });

  it("percent-encodes special characters in the email", () => {
    const secret = generateTotpSecret();
    const uri = getTotpUri(secret, "user+tag@example.com");
    expect(uri).not.toContain("+");
  });
});
