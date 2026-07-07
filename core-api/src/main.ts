import { createApiServer } from "./http/router.js";
import { createCoreService } from "./services/core-service.js";

const port = Number.parseInt(process.env.PORT ?? "4100", 10);
const host = process.env.HOST ?? "127.0.0.1";
const service = await createCoreService();
const server = createApiServer(service);

// Under `node --watch`, restarts race the old process for the port: the new
// child can hit EADDRINUSE before the old listener closes, die, and leave the
// watcher idling with NO server until the next file change. Retry instead of
// dying — the port frees within a moment.
const LISTEN_RETRIES = 20;
let listenAttempts = 0;
server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE" && listenAttempts < LISTEN_RETRIES) {
    listenAttempts += 1;
    console.warn(`[boot] port ${port} still in use — retry ${listenAttempts}/${LISTEN_RETRIES} in 500ms`);
    setTimeout(() => server.listen(port, host), 500);
    return;
  }
  throw error;
});

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

// Lead-sheet ingest poll (CRM Phase 3): pull NEW rows from each tenant's connected
// Google-Sheet published CSV. Best-effort and non-blocking — failures are recorded
// per-tenant and never crash the process. Runs ~30s after boot, then every 15 min.
const runLeadSheetPoll = async () => {
  try {
    const tally = await service.runLeadSheetPoll();
    if (tally.imported > 0) {
      console.log(`[lead-sheet] tenants=${tally.tenants} imported=${tally.imported}`);
    }
  } catch (error) {
    console.error("[lead-sheet] poll failed", error);
  }
};
setTimeout(runLeadSheetPoll, 30_000);
setInterval(runLeadSheetPoll, 15 * 60_000);

// Recurring-campaign scheduler (Campaigns Phase 4b): run every campaign whose
// schedule is enabled and due, honouring the contact-once ledger so each repeat
// reaches only newly-qualifying recipients. Best-effort; failures never crash the
// process. Runs ~45s after boot, then every 10 minutes.
const runCampaignScheduler = async () => {
  try {
    const tally = await service.runCampaignScheduler();
    if (tally.ran > 0) {
      console.log(`[campaigns] ran=${tally.ran} sent=${tally.sent} failed=${tally.failed}`);
    }
  } catch (error) {
    console.error("[campaigns] scheduler run failed", error);
  }
};
setTimeout(runCampaignScheduler, 45_000);
setInterval(runCampaignScheduler, 10 * 60_000);
