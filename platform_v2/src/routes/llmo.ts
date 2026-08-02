import type { FastifyInstance } from "fastify";
import { buildLlmoFaqMarkdown, buildLlmoGuideMarkdown, buildLlmoResearcherMarkdown, buildLlmoTermsMarkdown, buildLlmsTxt } from "../llmo.js";
import { canonicalPublicOriginFromHeaders } from "../publicOrigin.js";

export async function registerLlmoRoutes(app: FastifyInstance): Promise<void> {
  app.get("/llms.txt", async (request, reply) => {
    reply.type("text/plain; charset=utf-8").header("Cache-Control", "public, max-age=3600");
    return buildLlmsTxt(canonicalPublicOriginFromHeaders(request.headers as unknown as Record<string, unknown>));
  });

  app.get("/llms/guide.md", async (request, reply) => {
    reply.type("text/markdown; charset=utf-8").header("Cache-Control", "public, max-age=3600");
    return buildLlmoGuideMarkdown(canonicalPublicOriginFromHeaders(request.headers as unknown as Record<string, unknown>));
  });

  app.get("/llms/faq.md", async (request, reply) => {
    reply.type("text/markdown; charset=utf-8").header("Cache-Control", "public, max-age=3600");
    return buildLlmoFaqMarkdown(canonicalPublicOriginFromHeaders(request.headers as unknown as Record<string, unknown>));
  });

  app.get("/llms/researcher.md", async (request, reply) => {
    reply.type("text/markdown; charset=utf-8").header("Cache-Control", "public, max-age=3600");
    return buildLlmoResearcherMarkdown(canonicalPublicOriginFromHeaders(request.headers as unknown as Record<string, unknown>));
  });

  app.get("/llms/terms.md", async (request, reply) => {
    reply.type("text/markdown; charset=utf-8").header("Cache-Control", "public, max-age=3600");
    return buildLlmoTermsMarkdown(canonicalPublicOriginFromHeaders(request.headers as unknown as Record<string, unknown>));
  });
}
