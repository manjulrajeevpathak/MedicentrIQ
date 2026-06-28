import { createApiServer } from "./http/router.js";
import { createCoreService } from "./services/core-service.js";

const port = Number.parseInt(process.env.PORT ?? "4100", 10);
const host = process.env.HOST ?? "127.0.0.1";
const service = await createCoreService();
const server = createApiServer(service);

server.listen(port, host, () => {
  console.log(`core-api listening on http://${host}:${port}`);
});

// Time-based communication-workflow scheduler: scan all tenants' active runs and
// fire due `relative` stages (e.g. 24h/3h reminders). Guarded so a failure logs and
// never crashes the process. Runs ~15s after boot, then every 10 minutes.
const runScheduler = async () => {
  try {
    const tally = await service.runWorkflowScheduler();
    if (tally.fired > 0) {
      console.log(`[workflows] fired=${tally.fired}`, tally.byStage);
    }
  } catch (error) {
    console.error("[workflows] scheduler run failed", error);
  }
};
setTimeout(runScheduler, 15_000);
setInterval(runScheduler, 10 * 60_000);
