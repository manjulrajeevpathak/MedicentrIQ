import { NotificationsPanel } from "@/components/admin/notifications-panel";
import { fetchAppointmentNotifications } from "@/lib/users-api";
import type { AppointmentNotifications } from "@/lib/users-types";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const notificationsResult = await fetchAppointmentNotifications();

  const emptyRule = { enabled: false, body: "" };
  const notifications: AppointmentNotifications = notificationsResult.ok
    ? notificationsResult.data
    : { booked: emptyRule, reminder24h: emptyRule, reminder3h: emptyRule, cancelled: emptyRule, rescheduled: emptyRule };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Templates</h1>
        <p className="text-sm text-ink-muted">
          Appointment message templates &amp; timing.
        </p>
      </div>
      <NotificationsPanel notifications={notifications} />
    </div>
  );
}
