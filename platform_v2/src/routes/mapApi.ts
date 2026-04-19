import type { FastifyInstance } from "fastify";
import { getSessionFromCookie } from "../services/authSession.js";
import { getEffortSummary, getFrontierMap, type EffortRole } from "../services/mapEffort.js";
import { getCoverageMesh, getMapObservations, getTraceLines, type MarkerProfile, type TaxonGroup } from "../services/mapSnapshot.js";
import { getSiteBrief, type BriefLang } from "../services/siteBrief.js";

const ALLOWED_GROUPS: readonly TaxonGroup[] = [
  "insect",
  "bird",
  "plant",
  "amphibian_reptile",
  "mammal",
  "fungi",
  "other",
];

function parseBbox(raw: unknown): [number, number, number, number] | undefined {
  if (typeof raw !== "string") return undefined;
  const parts = raw.split(",").map((s) => Number(s.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return undefined;
  const minLng = parts[0] as number;
  const minLat = parts[1] as number;
  const maxLng = parts[2] as number;
  const maxLat = parts[3] as number;
  if (minLng > maxLng || minLat > maxLat) return undefined;
  return [minLng, minLat, maxLng, maxLat];
}

function parseInt32(raw: unknown): number | undefined {
  if (typeof raw !== "string" && typeof raw !== "number") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

function parseRole(raw: unknown): EffortRole | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  return value === "note" || value === "guide" || value === "scan" || value === "mixed"
    ? value
    : undefined;
}

function parseMarkerProfile(raw: unknown): MarkerProfile | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  return value === "manual_only" || value === "trusted_only" || value === "all_research_artifacts"
    ? value
    : undefined;
}

export async function registerMapApiRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/map/observations", async (request, reply) => {
    const q = (request.query ?? {}) as Record<string, unknown>;
    const rawGroup = typeof q.taxon_group === "string" ? q.taxon_group.trim() : "";
    const taxonGroup = (ALLOWED_GROUPS as readonly string[]).includes(rawGroup)
      ? (rawGroup as TaxonGroup)
      : undefined;
    const year = parseInt32(q.year);
    const bbox = parseBbox(q.bbox);
    const limit = parseInt32(q.limit);
    const markerProfile = parseMarkerProfile(q.marker_profile);

    const collection = await getMapObservations({
      taxonGroup,
      year,
      bbox,
      limit,
      markerProfile,
    });

    reply
      .type("application/json; charset=utf-8")
      .header("Cache-Control", "no-store");
    return collection;
  });

  app.get("/api/v1/map/coverage", async (request, reply) => {
    const q = (request.query ?? {}) as Record<string, unknown>;
    const year = parseInt32(q.year);
    const collection = await getCoverageMesh({ year });
    reply
      .type("application/json; charset=utf-8")
      .header("Cache-Control", "no-store");
    return collection;
  });

  app.get("/api/v1/map/traces", async (request, reply) => {
    const q = (request.query ?? {}) as Record<string, unknown>;
    const year = parseInt32(q.year);
    const limit = parseInt32(q.limit);
    const collection = await getTraceLines({ year, limit: limit ?? 200 });
    reply
      .type("application/json; charset=utf-8")
      .header("Cache-Control", "no-store");
    return collection;
  });

  app.get("/api/v1/map/site-brief", async (request, reply) => {
    const q = (request.query ?? {}) as Record<string, unknown>;
    const lat = Number(q.lat);
    const lng = Number(q.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      reply.code(400).type("application/json; charset=utf-8");
      return { error: "invalid_coords" };
    }
    const rawLang = typeof q.lang === "string" ? q.lang : "ja";
    const lang: BriefLang = rawLang === "en" ? "en" : "ja";
    const brief = await getSiteBrief(lat, lng, lang);
    reply
      .type("application/json; charset=utf-8")
      .header("Cache-Control", "no-store");
    return brief;
  });

  app.get("/api/v1/map/frontier", async (request, reply) => {
    const q = (request.query ?? {}) as Record<string, unknown>;
    const bbox = parseBbox(q.bbox);
    const year = parseInt32(q.year);
    const collection = await getFrontierMap({ bbox, year });
    reply
      .type("application/json; charset=utf-8")
      .header("Cache-Control", "no-store");
    return collection;
  });

  app.get("/api/v1/map/effort-summary", async (request, reply) => {
    const q = (request.query ?? {}) as Record<string, unknown>;
    const bbox = parseBbox(q.bbox);
    const year = parseInt32(q.year);
    const role = parseRole(q.role);
    const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    const summary = await getEffortSummary({
      bbox,
      year,
      userId: session?.userId ?? null,
      role,
    });
    reply
      .type("application/json; charset=utf-8")
      .header("Cache-Control", "no-store");
    return summary;
  });
}
