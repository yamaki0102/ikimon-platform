import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { startQuestScheduler, stopQuestScheduler } from "./services/observationEventQuestEngine.js";

async function start() {
  const config = loadConfig();
  const app = buildApp();
  let shuttingDown = false;

  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    stopQuestScheduler();
    try {
      await app.close();
    } catch (error) {
      app.log.error(error);
    } finally {
      process.exit(0);
    }
  };

  process.once("SIGINT", () => { void shutdown(); });
  process.once("SIGTERM", () => { void shutdown(); });

  try {
    await app.listen({
      port: config.port,
      host: "0.0.0.0",
    });
    startQuestScheduler();
  } catch (error) {
    stopQuestScheduler();
    app.log.error(error);
    process.exit(1);
  }
}

void start();
