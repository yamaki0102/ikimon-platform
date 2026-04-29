import type { FastifyInstance } from "fastify";
import { buildLlmoFaqMarkdown, buildLlmoGuideMarkdown, buildLlmoResearcherMarkdown, buildLlmsTxt } from "../llmo.js";

function requestOrigin(request: { headers: Record<string, unknown> }): string {
  const host = String(request.headers["x-forwarded-host"] ?? request.headers.host ?? "ikimon.life");
  const proto = String(request.headers["x-forwarded-proto"] ?? "https").split(",")[0]?.trim() || "https";
  return `${proto}://${host}`;
}

export async function registerLlmoRoutes(app: FastifyInstance): Promise<void> {
  app.get("/llms.txt", async (request, reply) => {
    reply.type("text/plain; charset=utf-8").header("Cache-Control", "public, max-age=3600");
    return buildLlmsTxt(requestOrigin(request as unknown as { headers: Record<string, unknown> }));
  });

  app.get("/llms/guide.md", async (_request, reply) => {
    reply.type("text/markdown; charset=utf-8").header("Cache-Control", "public, max-age=3600");
    return buildLlmoGuideMarkdown();
  });

  app.get("/llms/faq.md", async (_request, reply) => {
    reply.type("text/markdown; charset=utf-8").header("Cache-Control", "public, max-age=3600");
    return buildLlmoFaqMarkdown();
  });

  app.get("/llms/researcher.md", async (_request, reply) => {
    reply.type("text/markdown; charset=utf-8").header("Cache-Control", "public, max-age=3600");
    return buildLlmoResearcherMarkdown();
  });
}
