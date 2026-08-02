import type { FastifyInstance } from "fastify";
import { buildLlmoFaqMarkdown, buildLlmoGuideMarkdown, buildLlmoResearcherMarkdown, buildLlmoTermsMarkdown, buildLlmsTxt } from "../llmo.js";
import { resolveTrustedPublicOrigin, STAGING_PUBLIC_ORIGIN } from "../services/trustedPublicOrigin.js";

function requestOrigin(request: { headers: Record<string, unknown>; protocol?: string }): string {
  // Unknown origin identity is treated as staging so discovery links and the
  // global presentation hook stay non-indexable instead of defaulting to prod.
  return resolveTrustedPublicOrigin(request) ?? STAGING_PUBLIC_ORIGIN;
}

export async function registerLlmoRoutes(app: FastifyInstance): Promise<void> {
  app.get("/llms.txt", async (request, reply) => {
    reply.type("text/plain; charset=utf-8").header("Cache-Control", "public, max-age=3600");
    return buildLlmsTxt(requestOrigin(request as unknown as { headers: Record<string, unknown>; protocol?: string }));
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

  app.get("/llms/terms.md", async (_request, reply) => {
    reply.type("text/markdown; charset=utf-8").header("Cache-Control", "public, max-age=3600");
    return buildLlmoTermsMarkdown();
  });
}
