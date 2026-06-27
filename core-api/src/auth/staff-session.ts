import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export type SessionScope = "staff" | "platform";

export type StaffSessionPayload = {
  version: 1;
  sessionId: string;
  /** "staff" → tenantId is the hospital; "platform" → tenantId is the platform sentinel. */
  scope: SessionScope;
  tenantId: string;
  userId: string;
  /**
   * Snapshot of the principal's credentialVersion at issue time. authenticate()
   * rejects the token if the principal's current version is higher — so a
   * password reset / suspend / 2FA change instantly invalidates live tokens.
   */
  credentialVersion: number;
  /** True until the user completes a forced first-login password reset. */
  mustResetPassword?: boolean;
  issuedAt: string;
  expiresAt: string;
};

const tokenPrefix = "hcos_staff_v1";

const encode = (value: unknown): string => Buffer.from(JSON.stringify(value), "utf8").toString("base64url");

const decode = (value: string): unknown => JSON.parse(Buffer.from(value, "base64url").toString("utf8"));

const sign = (payloadSegment: string, secret: string): string =>
  createHmac("sha256", secret).update(`${tokenPrefix}.${payloadSegment}`).digest("base64url");

export const createStaffSessionToken = (
  input: {
    tenantId: string;
    userId: string;
    scope?: SessionScope;
    credentialVersion?: number;
    mustResetPassword?: boolean;
    expiresInSeconds?: number;
  },
  secret: string
): { token: string; payload: StaffSessionPayload } => {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + (input.expiresInSeconds ?? 8 * 60 * 60) * 1000);
  const payload: StaffSessionPayload = {
    version: 1,
    sessionId: randomUUID(),
    scope: input.scope ?? "staff",
    tenantId: input.tenantId,
    userId: input.userId,
    credentialVersion: input.credentialVersion ?? 0,
    ...(input.mustResetPassword ? { mustResetPassword: true } : {}),
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString()
  };
  const payloadSegment = encode(payload);
  const signature = sign(payloadSegment, secret);

  return {
    token: `${tokenPrefix}.${payloadSegment}.${signature}`,
    payload
  };
};

export const verifyStaffSessionToken = (token: string, secret: string): StaffSessionPayload => {
  const [prefix, payloadSegment, signature] = token.split(".");
  if (prefix !== tokenPrefix || !payloadSegment || !signature) {
    throw new Error("Malformed staff session token");
  }

  const expectedSignature = sign(payloadSegment, secret);
  const actual = Buffer.from(signature, "base64url");
  const expected = Buffer.from(expectedSignature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error("Invalid staff session signature");
  }

  const payload = decode(payloadSegment) as Partial<StaffSessionPayload>;
  if (
    payload.version !== 1 ||
    typeof payload.sessionId !== "string" ||
    (payload.scope !== "staff" && payload.scope !== "platform") ||
    typeof payload.tenantId !== "string" ||
    typeof payload.userId !== "string" ||
    typeof payload.credentialVersion !== "number" ||
    typeof payload.issuedAt !== "string" ||
    typeof payload.expiresAt !== "string"
  ) {
    throw new Error("Invalid staff session payload");
  }

  if (Number.isNaN(Date.parse(payload.expiresAt)) || new Date(payload.expiresAt).getTime() <= Date.now()) {
    throw new Error("Expired staff session token");
  }

  return payload as StaffSessionPayload;
};

export const bearerTokenFromAuthorization = (authorizationHeader: string | undefined): string | undefined => {
  if (!authorizationHeader) {
    return undefined;
  }

  const [scheme, token] = authorizationHeader.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return undefined;
  }

  return token;
};
