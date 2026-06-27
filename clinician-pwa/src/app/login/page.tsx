import { Stethoscope } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in — HealthOS Clinician" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col justify-center px-5 py-10">
      <div className="mb-8 flex flex-col items-center text-center">
        <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lift">
          <Stethoscope className="h-7 w-7" />
        </span>
        <h1 className="text-xl font-semibold text-ink">HealthOS Clinician</h1>
        <p className="mt-1 text-sm text-ink-muted">Sign in to find patients and record visits.</p>
      </div>
      <LoginForm />
    </main>
  );
}
