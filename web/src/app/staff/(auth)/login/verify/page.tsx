import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VerifyForm } from "./verify-form";

export const metadata: Metadata = { title: "Verify — Staff Console" };

export default async function VerifyPage({
  searchParams
}: {
  searchParams: Promise<{ cid?: string; email?: string }>;
}) {
  const { cid, email } = await searchParams;
  if (!cid) redirect("/staff/login");

  return <VerifyForm challengeId={cid} email={email ?? ""} />;
}
