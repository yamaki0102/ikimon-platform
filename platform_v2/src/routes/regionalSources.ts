import type { FastifyInstance } from "fastify";
import {
  REGIONAL_PUBLISHERS,
  REGIONAL_SOURCE_ASSETS,
  buildRegionalSourceRegistrySummary,
  findRegionalSourceAsset,
} from "../services/regionalSourceRegistry.js";

export async function registerRegionalSourceRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/regional-sources", async (_request, reply) => {
    reply
      .type("application/json; charset=utf-8")
      .header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");

    return {
      schema: "zukan.regional-source-registry/v1",
      generatedAt: "2026-07-28",
      summary: buildRegionalSourceRegistrySummary(),
      publishers: REGIONAL_PUBLISHERS,
      sources: REGIONAL_SOURCE_ASSETS,
    };
  });

  app.get<{ Params: { sourceAssetId: string } }>("/api/regional-sources/:sourceAssetId", async (request, reply) => {
    const source = findRegionalSourceAsset(request.params.sourceAssetId);
    if (!source) {
      reply.code(404);
      return {
        schema: "zukan.regional-source-registry-error/v1",
        error: "source_not_found",
      };
    }

    const publishers = REGIONAL_PUBLISHERS.filter((publisher) => source.publisherIds.includes(publisher.publisherId));
    return {
      schema: "zukan.regional-source-registry-item/v1",
      source,
      publishers,
    };
  });
}
