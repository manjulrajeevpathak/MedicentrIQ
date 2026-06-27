import type { Metadata } from "next";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Forgot password — Staff Console" };

export default function ForgotPasswordPage() {
  return <ForgotForm />;
}
