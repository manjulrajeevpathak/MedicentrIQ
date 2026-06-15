import { LeakageRecovery } from "@/components/leakage/leakage-recovery";
import { getAnalytics } from "@/lib/analytics";
import { getDashboard } from "@/lib/data";

export default async function LeakagePage() {
  const [data, dashboard] = await Promise.all([getAnalytics(), getDashboard()]);
  const user = dashboard.authContext.activeUser;
  return <LeakageRecovery data={data} userId={user.id} canRecover={user.permissions.includes("followup:manage")} />;
}
