import { createApiServer } from "./http/router.js";
import { createCoreService } from "./services/core-service.js";

const port = Number.parseInt(process.env.PORT ?? "4100", 10);
const host = process.env.HOST ?? "127.0.0.1";
const service = await createCoreService();
const server = createApiServer(service);

server.listen(port, host, () => {
  console.log(`core-api listening on http://${host}:${port}`);
});

// Time-based appointment reminders: scan all tenants and fire due 24h/3h reminders.
// Guarded so a failure logs and never crashes the process. Runs ~15s after boot,
// then every 10 minutes.
const runReminders = async () => {
  try {
    const tally = await service.runAppointmentReminders();
    if (tally.sent > 0) {
      console.log(`[reminders] sent=${tally.sent}`, tally.byEvent);
    }
  } catch (error) {
    console.error("[reminders] run failed", error);
  }
};
setTimeout(runReminders, 15_000);
setInterval(runReminders, 10 * 60_000);
