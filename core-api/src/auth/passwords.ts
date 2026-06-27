import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Password hashing with Node's built-in scrypt (no external dependency).
 * Each password gets a unique random salt; verification is constant-time.
 *
 * scrypt params: N=2^14 (cost), r=8, p=1, 64-byte derived key — a reasonable
 * interactive-login cost. Tunable via SCRYPT_COST if needed.
 */
const KEY_LEN = 64;
const SCRYPT_COST = Number.parseInt(process.env.SCRYPT_COST ?? "16384", 10);
const scryptOptions = { N: SCRYPT_COST, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export type PasswordCredential = { hash: string; salt: string };

export const hashPassword = (plain: string): PasswordCredential => {
  if (typeof plain !== "string" || plain.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(plain, salt, KEY_LEN, scryptOptions).toString("hex");
  return { hash, salt };
};

export const verifyPassword = (plain: string, credential: PasswordCredential | undefined): boolean => {
  if (!credential?.hash || !credential.salt || typeof plain !== "string") {
    return false;
  }
  let derived: Buffer;
  try {
    derived = scryptSync(plain, credential.salt, KEY_LEN, scryptOptions);
  } catch {
    return false;
  }
  const stored = Buffer.from(credential.hash, "hex");
  return stored.length === derived.length && timingSafeEqual(stored, derived);
};

/** Generate a human-typable temporary/default password for onboarding handoff. */
export const generateTempPassword = (): string => {
  // 4 bytes -> 8 hex chars, prefixed for clarity; avoids ambiguous chars.
  return `Hc-${randomBytes(4).toString("hex")}`;
};

/** Generate a numeric one-time code (email OTP). */
export const generateNumericCode = (digits = 6): string => {
  const max = 10 ** digits;
  // rejection-free: take a 4-byte int, modulo into range, pad.
  const n = randomBytes(4).readUInt32BE(0) % max;
  return n.toString().padStart(digits, "0");
};
