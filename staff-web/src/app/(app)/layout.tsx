import { AppShell } from "@/components/shell/app-shell";
import { AppProvider } from "@/lib/store";
import { getDashboard } from "@/lib/data";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const data = await getDashboard();

  return (
    <AppProvider initial={data}>
      <AppShell>{children}</AppShell>
    </AppProvider>
  );
}
