import type { FastifyInstance } from "fastify";
import { loadConfig } from "../config.js";
import { checkDatabase } from "../db.js";

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/healthz", async () => {
    const config = loadConfig();
    return {
      ok: true,
      service: "ikimon-platform-v2",
      env: config.nodeEnv,
    };
  });

  app.get("/readyz", async (_request, reply) => {
    const config = loadConfig();
    if (!config.databaseUrl) {
      reply.code(503);
      return {
        ok: false,
        reason: "missing_database_url",
      };
    }

    const db = await checkDatabase();
    if (!db.ok) {
      reply.code(503);
      return db;
    }

    return db;
  });
}
