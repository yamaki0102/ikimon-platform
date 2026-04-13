import type { FastifyInstance } from "fastify";
import { getReadinessSnapshot } from "../services/readiness.js";

export async function registerOpsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/ops/readiness", async () => {
    return getReadinessSnapshot();
  });
}
