import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

async function start() {
  const config = loadConfig();
  const app = buildApp();

  try {
    await app.listen({
      port: config.port,
      host: "0.0.0.0",
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void start();
