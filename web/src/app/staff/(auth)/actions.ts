"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/constants";

/**
 * Auth Server Actions. Each form-bound action returns a small `{ error }`
 * state for `useActionState`; redirect-on-success throws Next's redirect
 * signal, so callers never see a "success" state object for those paths.
 */

const API_BASE = (process.env.NEXT_PUBLIC_CORE_API_URL ?? "http://localhost:4100").replace(/\/$/, "");

export type AuthState = { error?: string };

type Principal = {
  id: string;
  type: string;
  email: string;
  displayName: string;
  roles: string[];
  tenantId: string;
  mustResetPassword?: boolean;
};

type LoginData =
  | { token: string; expiresAt?: string; principal: Principal; mustResetPassword?: boolean }
  | { mfaRequired: true; challengeId: string; email: string };

async function postJson<T>(
  path: string,
  body: Record<string, unknown>,
  authToken?: string
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        ...(authToken ? { authorization: `Bearer ${authToken}` } : {})
      },
      body: JSON.stringify(body)
    });
    const envelope = (await res.json().catch(() => ({}))) as {
      data?: T;
      error?: { message?: string };
    };
    if (!res.ok) {
      return { ok: false, status: res.status, error: envelope.error?.message };
    }
    return { ok: true, status: res.status, data: envelope.data };
  } catch {
    return { ok: false, status: 0, error: "Unable to reach the server. Try again." };
  }
}

async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
}

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const result = await postJson<LoginData>("/auth/login", { email, password });

  if (!result.ok) {
    if (result.status === 401 || result.status === 400) {
      return { error: "Invalid email or password." };
    }
    return { error: result.error ?? "Sign-in failed. Try again." };
  }

  const data = result.data;
  if (!data) {
    return { error: "Sign-in failed. Try again." };
  }

  if ("mfaRequired" in data && data.mfaRequired) {
    redirect(`/login/verify?cid=${encodeURIComponent(data.challengeId)}&email=${encodeURIComponent(data.email)}`);
  }

  if ("token" in data && data.token) {
    await setSessionCookie(data.token);
    if (data.mustResetPassword) {
      redirect("/reset-password?first=1");
    }
    redirect("/today");
  }

  return { error: "Unexpected sign-in response." };
}

export async function verifyOtpAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const challengeId = String(formData.get("challengeId") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();

  if (!challengeId) return { error: "Missing challenge. Start sign-in again." };
  if (!/^\d{4,8}$/.test(code)) return { error: "Enter the numeric code sent to you." };

  const result = await postJson<{ token: string; principal: Principal }>("/auth/login/verify-otp", {
    challengeId,
    code
  });

  if (!result.ok || !result.data?.token) {
    if (result.status === 400 || result.status === 401) {
      return { error: "That code is incorrect or expired." };
    }
    return { error: result.error ?? "Verification failed. Try again." };
  }

  await setSessionCookie(result.data.token);
  redirect("/today");
}

export async function forgotAction(_prev: AuthState, formData: FormData): Promise<AuthState & { ok?: boolean }> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter your email." };

  // Fire-and-forget semantics: always report the same neutral confirmation so
  // we never leak whether an account exists.
  await postJson<{ ok: boolean; message: string }>("/auth/password/forgot", { email });
  return { ok: true };
}

export async function resetPasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const token = String(formData.get("token") ?? "").trim();
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!token) return { error: "This reset link is missing or invalid." };
  const policyError = passwordPolicyError(newPassword, confirm);
  if (policyError) return { error: policyError };

  const result = await postJson<{ ok: boolean }>("/auth/password/reset", { token, newPassword });
  if (!result.ok) {
    if (result.status === 400 || result.status === 401) {
      return { error: "This reset link has expired. Request a new one." };
    }
    return { error: result.error ?? "Could not reset password. Try again." };
  }

  redirect("/login");
}

export async function completeFirstLoginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const policyError = passwordPolicyError(newPassword, confirm);
  if (policyError) return { error: policyError };

  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) {
    redirect("/login");
  }

  const result = await postJson<{ ok: boolean; token: string; expiresAt?: string }>(
    "/auth/password/change",
    { newPassword },
    token
  );

  if (!result.ok || !result.data?.token) {
    if (result.status === 401) {
      redirect("/login");
    }
    return { error: result.error ?? "Could not set your new password. Try again." };
  }

  // Store the fresh, rotated token returned after the forced change.
  await setSessionCookie(result.data.token);
  redirect("/today");
}

export async function logoutAction() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}

function passwordPolicyError(newPassword: string, confirm: string): string | null {
  if (newPassword.length < 8) return "Use at least 8 characters.";
  if (newPassword !== confirm) return "Passwords do not match.";
  return null;
}
