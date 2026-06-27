/**
 * Telephony adapter — STUB. This is a deliberate seam: per-tenant telephony
 * config + a call-log + this adapter. Real provider dialing (Twilio/Exotel/etc.)
 * and AI-voice are FUTURE work; this stub makes NO network call. When configured
 * it returns a synthetic "queued" result; when not, it fails fast with a 400 so
 * callers can record the call as a manual log instead.
 *
 * Per-tenant credentials are passed in (never read from global env). Zero deps.
 */
import { ApiError } from "../../services/core-service.js";

export type TelephonyCreds = { provider?: string; apiKey?: string; callerId?: string; enabled: boolean };
export type PlaceCallResult = { providerId: string; status: "queued" };

/**
 * "Place" an outbound call. Throws ApiError(400) when telephony is not
 * configured/enabled; otherwise returns a stub queued result. NO real provider
 * call is made here — wiring a provider SDK + AI-voice is future work.
 */
export const placeCall = (input: { creds?: TelephonyCreds; to: string; from?: string }): PlaceCallResult => {
  const { creds, to } = input;
  if (!creds?.apiKey || !creds.enabled) {
    throw new ApiError(400, "Telephony not configured");
  }
  // Derive a deterministic-enough id from the destination so logs are traceable
  // without leaking the apiKey. Real provider would return its own call SID.
  const derived = `${Date.now().toString(36)}${to.replace(/[^0-9a-z]/gi, "").slice(-6)}`;
  return { providerId: `stub-${derived}`, status: "queued" };
};
