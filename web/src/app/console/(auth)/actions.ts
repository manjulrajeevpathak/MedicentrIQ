"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  changePassword,
  login,
  verifyLoginOtp,
  SESSION_COOKIE
} from "@console/lib/platform-api";

const isProd = process.env.NODE_ENV === "production";

async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isProd
  });
}

async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export interface LoginState {
  error?: string;
}

export interface VerifyState {
  error?: string;
}

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

export async function loginAction(
  _prev: LoginState,
  form: FormData
): Promise<LoginState> {
  const email = str(form, "email");
  const password = str(form, "password");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  let result: Awaited<ReturnType<typeof login>>;
  try {
    result = await login(email, password);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Login failed." };
  }

  if ("mfaRequired" in result && result.mfaRequired) {
    redirect(
      `/login/verify?cid=${encodeURIComponent(result.challengeId)}&email=${encodeURIComponent(result.email)}`
    );
  }

  if ("mustResetPassword" in result && result.mustResetPassword) {
    await setSessionCookie(result.token);
    redirect("/console/reset-password?first=1");
  }

  // Plain success.
  await setSessionCookie(result.token);
  redirect("/console");
}

export async function verifyOtpAction(
  _prev: VerifyState,
  form: FormData
): Promise<VerifyState> {
  const challengeId = str(form, "challengeId");
  const code = str(form, "code");

  if (!challengeId || !code) {
    return { error: "Verification code is required." };
  }

  let result: Awaited<ReturnType<typeof verifyLoginOtp>>;
  try {
    result = await verifyLoginOtp(challengeId, code);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Verification failed."
    };
  }

  await setSessionCookie(result.token);
  redirect("/console");
}

export async function completeFirstLoginAction(
  _prev: LoginState,
  form: FormData
): Promise<LoginState> {
  const newPassword = str(form, "newPassword");
  const confirm = str(form, "confirmPassword");

  if (newPassword.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (newPassword !== confirm) {
    return { error: "Passwords do not match." };
  }

  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) {
    redirect("/console/login");
  }

  let result: Awaited<ReturnType<typeof changePassword>>;
  try {
    result = await changePassword(token, newPassword);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not set password."
    };
  }

  await setSessionCookie(result.token);
  redirect("/console");
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/console/login");
}
