import { SignJWT, jwtVerify } from "jose";
import { scryptSync, timingSafeEqual } from "crypto";

export type StaffRole = "org_admin" | "care_coordinator" | "front_desk" | "call_center" | "nurse" | "doctor";

export type StaffSession = {
  userId: string;
  email: string;
  name: string;
  role: StaffRole;
  tenantId: string;
};

// Pre-hashed with scrypt (salt:hash) — see .env.local for plaintext passwords.
// Admin@2026 / Care@2026 / Desk@2026
export const SEED_USERS: Array<StaffSession & { passwordHash: string }> = [
  {
    userId: "user_demo_admin",
    email: "admin@healthcareos.in",
    name: "Dr. Kavita Menon",
    role: "org_admin",
    tenantId: "org_demo_healthcare",
    passwordHash: "e546f354c5b06fc05a6443500060c7a1:579b2a7f4940a68977396ab7e8cb01093f9067d32025e652cbeb8df9ac6be294d485fbd4145cd440cede966b82629f6c69cfe6509c15969d5a896c555101ad62"
  },
  {
    userId: "user_demo_care",
    email: "priya@healthcareos.in",
    name: "Priya Nair",
    role: "care_coordinator",
    tenantId: "org_demo_healthcare",
    passwordHash: "e40d579b0ec1dae5fc1db6da69521352:5c3c8ab347fd285339b0ed6caaeba71bbf56ef56743cdb1defdcefb8c552d986e0058736ac3065b3ccc3d30d81682f1ba4b7e3c9928fb7640f0f4e19dd970c41"
  },
  {
    userId: "user_demo_frontdesk",
    email: "reception@healthcareos.in",
    name: "Aman Verma",
    role: "front_desk",
    tenantId: "org_demo_healthcare",
    passwordHash: "4c55b64367da7f070b55c1f5fb5d9a51:4d4b0eb10180549ab41e336fc1fb28eb60e1bb947264861ad912f6aab9f36c0e2dc3602aefae57184201c937f4c59493770a9c978824d74d73bc3f06dbbad7e8"
  }
];

export function verifyPassword(password: string, storedHash: string): boolean {
  const colonIdx = storedHash.indexOf(":");
  if (colonIdx === -1) return false;
  const salt = storedHash.slice(0, colonIdx);
  const hash = storedHash.slice(colonIdx + 1);
  try {
    const hashBuffer = Buffer.from(hash, "hex");
    const newHash = scryptSync(password, salt, 64);
    return hashBuffer.length === newHash.length && timingSafeEqual(hashBuffer, newHash);
  } catch {
    return false;
  }
}

const SESSION_COOKIE_NAME = "hcos_session";
const SESSION_EXPIRY_SECONDS = 8 * 60 * 60; // 8 hours

function getSecret(): Uint8Array {
  const secret = process.env.STAFF_JWT_SECRET;
  if (!secret) throw new Error("STAFF_JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signSession(session: StaffSession): Promise<string> {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${SESSION_EXPIRY_SECONDS}s`)
    .setIssuedAt()
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<StaffSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as StaffSession;
  } catch {
    return null;
  }
}

export { SESSION_COOKIE_NAME, SESSION_EXPIRY_SECONDS };
