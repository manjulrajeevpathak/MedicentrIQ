import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <>
      <LoginForm />
      <p className="mt-4 text-center text-xs text-[var(--color-ink-muted)]">
        Sign in with your platform-admin credentials.
      </p>
    </>
  );
}
