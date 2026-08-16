import { redirect } from "next/navigation";
import { VerifyForm } from "./verify-form";

export const dynamic = "force-dynamic";

export default async function VerifyPage({
  searchParams
}: {
  searchParams: Promise<{ cid?: string; email?: string }>;
}) {
  const { cid, email } = await searchParams;

  if (!cid) {
    redirect("/console/login");
  }

  return <VerifyForm challengeId={cid} email={email ?? ""} />;
}
