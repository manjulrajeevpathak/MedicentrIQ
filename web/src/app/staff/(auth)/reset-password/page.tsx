import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Reset password — Staff Console" };

export default async function ResetPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string; first?: string }>;
}) {
  const { token, first } = await searchParams;

  if (first === "1") {
    return <ResetForm mode="first" />;
  }

  if (token) {
    return <ResetForm mode="token" token={token} />;
  }

  // No token and not a forced first-login — nothing to do here.
  redirect("/staff/forgot-password");
}
