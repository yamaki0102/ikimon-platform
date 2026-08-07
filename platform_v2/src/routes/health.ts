import type { FastifyInstance } from "fastify";
import { loadConfig } from "../config.js";
import { checkDatabase } from "../db.js";
import { registerGlobalRecordSourceChoiceHtmlPatch } from "../services/globalRecordSourceChoiceHtmlPatch.js";
import { registerLightPostingHtmlPatch } from "../services/lightPostingHtmlPatch.js";
import { registerRecordRecoveryHtmlPatch } from "../services/recordRecoveryHtmlPatch.js";
import { getRuntimeVersionSnapshot } from "../services/runtimeVersion.js";

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  // Registered before read routes so materialized HTML and live HTML share the same lightweight posting contract.
  registerLightPostingHtmlPatch(app);
  registerGlobalRecordSourceChoiceHtmlPatch(app);
  registerRecordRecoveryHtmlPatch(app);

  app.get("/healthz", async () => {
    const config = loadConfig();
    return {
      ok: true,
      service: "ikimon-platform",
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

  app.get("/api/v1/runtime/version", async () => {
    return getRuntimeVersionSnapshot();
  });
}
