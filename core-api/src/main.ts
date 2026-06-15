import { createApiServer } from "./http/router.js";
import { createCoreService } from "./services/core-service.js";

const port = Number.parseInt(process.env.PORT ?? "4100", 10);
const host = process.env.HOST ?? "127.0.0.1";
const service = await createCoreService();
const server = createApiServer(service);

server.listen(port, host, () => {
  console.log(`core-api listening on http://${host}:${port}`);
});
