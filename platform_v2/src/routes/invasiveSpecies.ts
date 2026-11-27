import type { FastifyInstance } from "fastify";
import { getPool } from "../db.js";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { detectLangFromUrl } from "../i18n.js";
import { listInvasiveReportingVisibility } from "../services/invasiveReporting.js";
import { findInvasiveSpeciesBySlug, INVASIVE_SPECIES_LIST_PATH } from "../services/invasiveSpeciesCatalog.js";
import { renderInvasiveDetailDocument, renderInvasiveListDocument, renderInvasiveNotFoundDocument } from "../ui/invasiveSpeciesPages.js";

type InvasiveReportingRecipientsQuery = {
  scientificName?: string;
  vernacularName?: string;
  invasiveStatus?: string;
  prefecture?: string;
  municipality?: string;
};

function requestBasePath(request: { headers: Record<string, unknown> }): string {
  return getForwardedBasePath(request.headers);
}

function requestUrl(request: { url?: string; raw?: { url?: string; originalUrl?: string } }): string {
  return String(request.raw?.originalUrl ?? request.raw?.url ?? request.url ?? "");
}

function requestCurrentPath(request: { headers: Record<string, unknown>; url?: string; raw?: { url?: string; originalUrl?: string } }): string {
  return withBasePath(requestBasePath(request), requestUrl(request));
}

export async function registerInvasiveSpeciesRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: InvasiveReportingRecipientsQuery }>("/api/v1/invasive-reporting/recipients", async (request, reply) => {
    const query = request.query;
    reply.type("application/json; charset=utf-8");
    if (!query.invasiveStatus || (!query.scientificName && !query.vernacularName)) {
      reply.status(400);
      return {
        available: true,
        reason: "bad_request",
        matchedRules: 0,
        autoDeliveryCount: 0,
        contacts: [],
      };
    }
    try {
      const visibility = await listInvasiveReportingVisibility(getPool(), {
        invasiveStatus: query.invasiveStatus,
        scientificName: query.scientificName ?? null,
        vernacularName: query.vernacularName ?? null,
        prefecture: query.prefecture ?? null,
        municipality: query.municipality ?? null,
      });
      return visibility;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/DATABASE_URL is required/u.test(message)) {
        return {
          available: false,
          reason: "unavailable",
          matchedRules: 0,
          autoDeliveryCount: 0,
          contacts: [],
        };
      }
      throw error;
    }
  });

  app.get(INVASIVE_SPECIES_LIST_PATH, async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    return renderInvasiveListDocument({
      basePath,
      lang,
      currentPath: requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string; originalUrl?: string } }),
    });
  });

  app.get<{ Params: { slug: string } }>(`${INVASIVE_SPECIES_LIST_PATH}/:slug`, async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    const item = findInvasiveSpeciesBySlug(request.params.slug);
    const currentPath = requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string; originalUrl?: string } });
    reply.type("text/html; charset=utf-8");
    if (!item) {
      reply.status(404);
      return renderInvasiveNotFoundDocument({ basePath, lang, currentPath });
    }
    return renderInvasiveDetailDocument({ basePath, lang, item, currentPath });
  });
}
