import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getSessionFromCookie } from "../services/authSession.js";
import { getEffortSummary, getFrontierMap, type EffortActorClass, type EffortRole } from "../services/mapEffort.js";
import { listMapVisitedPlaces } from "../services/mapVisitedPlaces.js";
import { normalizePlaceMemoryVisitSort } from "../services/placeMemory.js";
import {
  getCoverageMesh,
  getMapCells,
  getMapObservations,
  getTraceLines,
  type MarkerProfile,
  type SeasonFilter,
  type TaxonGroup,
} from "../services/mapSnapshot.js";
import { getSiteBrief, type BriefLang } from "../services/siteBrief.js";
import { listAreaPolygonsForBbox, flushAreaPolygonCache, type AreaPolygonSource } from "../services/areaPolygons.js";
import { listMapGuideSpotsForBbox } from "../services/mapGuideSpots.js";
import { assertPrivilegedWriteAccess } from "../services/writeGuards.js";

const JMA_NOWCAST_TARGET_N1 = "https://www.jma.go.jp/bosai/jmatile/data/nowc/targetTimes_N1.json";
const JMA_NOWCAST_TARGET_N2 = "https://www.jma.go.jp/bosai/jmatile/data/nowc/targetTimes_N2.json";
const JMA_NOWCAST_ROOT = "https://www.jma.go.jp/bosai/jmatile/data/nowc";
const JMA_NOWCAST_OFFSETS = [0, 5, 15, 30, 60] as const;
const JMA_NOWCAST_TIME_TTL_MS = 60_000;
const JMA_NOWCAST_TILE_TTL_MS = 300_000;
const JMA_NOWCAST_TILE_CACHE_MAX = 384;
const JMA_NOWCAST_FETCH_TIMEOUT_MS = 3_000;

type JmaNowcastTarget = {
  basetime: string;
  validtime: string;
  elements?: string[];
};

let jmaNowcastTimesCache: { expiresAt: number; payload: JmaNowcastTimesResponse } | null = null;
const jmaNowcastTileCache = new Map<string, { expiresAt: number; bytes: Buffer }>();

type JmaNowcastTimesResponse = {
  source: "jma_high_resolution_precipitation_nowcast";
  attribution: string;
  attributionUrl: string;
  generatedAt: string;
  tileUrlTemplate: string;
  times: Array<{
    offsetMinutes: number;
    basetime: string;
    validtime: string;
    highResolution: boolean;
  }>;
};

const ALLOWED_AREA_SOURCES: readonly AreaPolygonSource[] = [
  "user_defined", "nature_symbiosis_site", "tsunag", "protected_area", "oecm",
  "school", "osm_park", "admin_municipality", "admin_prefecture", "admin_country",
];

function parseAreaSources(raw: unknown): AreaPolygonSource[] | undefined {
  if (typeof raw !== "string") return undefined;
  const items = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const allowed = items.filter((v): v is AreaPolygonSource =>
    (ALLOWED_AREA_SOURCES as readonly string[]).includes(v));
  return allowed.length > 0 ? allowed : undefined;
}

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

function parseFloat64(raw: unknown): number | undefined {
  if (typeof raw !== "string" && typeof raw !== "number") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function isValidJmaTimestamp(raw: unknown): raw is string {
  return typeof raw === "string" && /^\d{14}$/.test(raw);
}

function parseJmaTimestamp(raw: string): number | null {
  if (!isValidJmaTimestamp(raw)) return null;
  const y = Number(raw.slice(0, 4));
  const mo = Number(raw.slice(4, 6));
  const d = Number(raw.slice(6, 8));
  const h = Number(raw.slice(8, 10));
  const mi = Number(raw.slice(10, 12));
  const s = Number(raw.slice(12, 14));
  const ms = Date.UTC(y, mo - 1, d, h, mi, s);
  return Number.isFinite(ms) ? ms : null;
}

async function fetchJsonWithTimeout<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JMA_NOWCAST_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error(`jma_nowcast_fetch_failed:${response.status}`);
    return await response.json() as T;
  } finally {
    clearTimeout(timer);
  }
}

function targetSupportsRain(target: JmaNowcastTarget): boolean {
  return !Array.isArray(target.elements) || target.elements.includes("hrpns");
}

function minutesBetween(base: string, valid: string): number | null {
  const baseMs = parseJmaTimestamp(base);
  const validMs = parseJmaTimestamp(valid);
  if (baseMs === null || validMs === null) return null;
  return Math.round((validMs - baseMs) / 60_000);
}

function chooseNowcastTarget(targets: JmaNowcastTarget[], offsetMinutes: number): JmaNowcastTarget | null {
  const candidates = targets
    .filter((target) => isValidJmaTimestamp(target.basetime) && isValidJmaTimestamp(target.validtime) && targetSupportsRain(target))
    .map((target) => ({ target, offset: minutesBetween(target.basetime, target.validtime) }))
    .filter((item): item is { target: JmaNowcastTarget; offset: number } => item.offset !== null);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const da = Math.abs(a.offset - offsetMinutes);
    const db = Math.abs(b.offset - offsetMinutes);
    if (da !== db) return da - db;
    return b.target.validtime.localeCompare(a.target.validtime);
  });
  return candidates[0]?.target ?? null;
}

async function getJmaNowcastTimes(): Promise<JmaNowcastTimesResponse> {
  const now = Date.now();
  if (jmaNowcastTimesCache && jmaNowcastTimesCache.expiresAt > now) return jmaNowcastTimesCache.payload;
  const [currentTargets, forecastTargets] = await Promise.all([
    fetchJsonWithTimeout<JmaNowcastTarget[]>(JMA_NOWCAST_TARGET_N1),
    fetchJsonWithTimeout<JmaNowcastTarget[]>(JMA_NOWCAST_TARGET_N2),
  ]);
  const times: JmaNowcastTimesResponse["times"] = [];
  for (const offsetMinutes of JMA_NOWCAST_OFFSETS) {
    const source = offsetMinutes === 0 ? currentTargets : forecastTargets;
    const target = chooseNowcastTarget(source, offsetMinutes);
    if (!target) continue;
    times.push({
      offsetMinutes,
      basetime: target.basetime,
      validtime: target.validtime,
      highResolution: offsetMinutes <= 30,
    });
  }
  const payload: JmaNowcastTimesResponse = {
    source: "jma_high_resolution_precipitation_nowcast",
    attribution: "Source: JMA High-resolution Precipitation Nowcast",
    attributionUrl: "https://www.jma.go.jp/jma/kishou/know/kurashi/highres_nowcast.html",
    generatedAt: new Date().toISOString(),
    tileUrlTemplate: "/api/v1/weather/jma-nowcast/tile?basetime={basetime}&validtime={validtime}&z={z}&x={x}&y={y}",
    times,
  };
  jmaNowcastTimesCache = { expiresAt: now + JMA_NOWCAST_TIME_TTL_MS, payload };
  return payload;
}

function parseTileNumber(raw: unknown, max: number): number | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > max) return null;
  return n;
}

function getCachedJmaTile(cacheKey: string): Buffer | null {
  const cached = jmaNowcastTileCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    jmaNowcastTileCache.delete(cacheKey);
    return null;
  }
  jmaNowcastTileCache.delete(cacheKey);
  jmaNowcastTileCache.set(cacheKey, cached);
  return cached.bytes;
}

function setCachedJmaTile(cacheKey: string, bytes: Buffer): void {
  jmaNowcastTileCache.set(cacheKey, { expiresAt: Date.now() + JMA_NOWCAST_TILE_TTL_MS, bytes });
  while (jmaNowcastTileCache.size > JMA_NOWCAST_TILE_CACHE_MAX) {
    const oldestKey = jmaNowcastTileCache.keys().next().value;
    if (!oldestKey) break;
    jmaNowcastTileCache.delete(oldestKey);
  }
}

function parseRole(raw: unknown): EffortRole | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  return value === "note" || value === "guide" || value === "scan" || value === "mixed"
    ? value
    : undefined;
}

function parseActorClass(raw: unknown): EffortActorClass | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  return value === "all" || value === "local_steward" || value === "traveler" || value === "casual"
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

function parseSeason(raw: unknown): SeasonFilter | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  return value === "spring" || value === "summer" || value === "autumn" || value === "winter"
    ? value
    : undefined;
}

export async function registerMapApiRoutes(app: FastifyInstance): Promise<void> {
  const nowcastTimesHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const payload = await getJmaNowcastTimes();
      reply
        .type("application/json; charset=utf-8")
        .header("Cache-Control", "public, max-age=60");
      return payload;
    } catch (error) {
      request.log.warn({ err: error }, "jma_nowcast_times_failed");
      reply.code(502).type("application/json; charset=utf-8").header("Cache-Control", "no-store");
      return { error: "jma_nowcast_unavailable" };
    }
  };

  const nowcastTileHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const q = (request.query ?? {}) as Record<string, unknown>;
    const basetime = typeof q.basetime === "string" ? q.basetime : "";
    const validtime = typeof q.validtime === "string" ? q.validtime : "";
    const z = parseTileNumber(q.z, 14);
    const maxTile = z === null ? 0 : Math.pow(2, z) - 1;
    const x = parseTileNumber(q.x, maxTile);
    const y = parseTileNumber(q.y, maxTile);
    if (!isValidJmaTimestamp(basetime) || !isValidJmaTimestamp(validtime) || z === null || x === null || y === null) {
      reply.code(400).type("application/json; charset=utf-8").header("Cache-Control", "no-store");
      return { error: "invalid_jma_nowcast_tile" };
    }

    const url = `${JMA_NOWCAST_ROOT}/${basetime}/none/${validtime}/surf/hrpns/${z}/${x}/${y}.png`;
    const cacheKey = `${basetime}:${validtime}:${z}:${x}:${y}`;
    const cached = getCachedJmaTile(cacheKey);
    if (cached) {
      reply
        .type("image/png")
        .header("Cache-Control", "public, max-age=300")
        .header("X-Content-Type-Options", "nosniff")
        .header("X-Ikimon-Weather-Cache", "hit");
      return cached;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), JMA_NOWCAST_FETCH_TIMEOUT_MS);
    try {
      const upstream = await fetch(url, { signal: controller.signal, headers: { accept: "image/png" } });
      if (!upstream.ok) {
        reply.code(upstream.status === 404 ? 404 : 502).type("application/json; charset=utf-8").header("Cache-Control", "no-store");
        return { error: "jma_nowcast_tile_unavailable" };
      }
      const bytes = Buffer.from(await upstream.arrayBuffer());
      setCachedJmaTile(cacheKey, bytes);
      reply
        .type("image/png")
        .header("Cache-Control", "public, max-age=300")
        .header("X-Content-Type-Options", "nosniff")
        .header("X-Ikimon-Weather-Cache", "miss");
      return bytes;
    } catch (error) {
      request.log.warn({ err: error }, "jma_nowcast_tile_failed");
      reply.code(502).type("application/json; charset=utf-8").header("Cache-Control", "no-store");
      return { error: "jma_nowcast_tile_unavailable" };
    } finally {
      clearTimeout(timer);
    }
  };

  app.get("/api/v1/weather/jma-nowcast/times", nowcastTimesHandler);
  app.get("/api/v1/weather/jma-nowcast/tile", nowcastTileHandler);
  app.get("/api/v1/map/weather/jma-nowcast/times", nowcastTimesHandler);
  app.get("/api/v1/map/weather/jma-nowcast/tile", nowcastTileHandler);

  app.get("/api/v1/map/cells", async (request, reply) => {
    const q = (request.query ?? {}) as Record<string, unknown>;
    const rawGroup = typeof q.taxon_group === "string" ? q.taxon_group.trim() : "";
    const taxonGroup = (ALLOWED_GROUPS as readonly string[]).includes(rawGroup)
      ? (rawGroup as TaxonGroup)
      : undefined;
    const year = parseInt32(q.year);
    const bbox = parseBbox(q.bbox);
    const zoom = parseFloat64(q.zoom);
    const markerProfile = parseMarkerProfile(q.marker_profile);
    const season = parseSeason(q.season);

    const collection = await getMapCells({
      taxonGroup,
      year,
      bbox,
      zoom,
      markerProfile,
      season,
    });

    reply
      .type("application/json; charset=utf-8")
      .header("Cache-Control", "no-store");
    return collection;
  });

  app.get("/api/v1/map/observations", async (request, reply) => {
    const q = (request.query ?? {}) as Record<string, unknown>;
    const rawGroup = typeof q.taxon_group === "string" ? q.taxon_group.trim() : "";
    const taxonGroup = (ALLOWED_GROUPS as readonly string[]).includes(rawGroup)
      ? (rawGroup as TaxonGroup)
      : undefined;
    const year = parseInt32(q.year);
    const bbox = parseBbox(q.bbox);
    const limit = parseInt32(q.limit);
    const zoom = parseFloat64(q.zoom);
    const markerProfile = parseMarkerProfile(q.marker_profile);
    const season = parseSeason(q.season);
    const cellId = typeof q.cell_id === "string" ? q.cell_id.trim() : "";

    if (!cellId && !bbox) {
      reply.code(400).type("application/json; charset=utf-8");
      return { error: "missing_scope" };
    }

    const collection = cellId
      ? await getMapObservations({
          taxonGroup,
          year,
          limit,
          markerProfile,
          season,
          cellId,
        })
      : await getMapObservations({
          taxonGroup,
          year,
          bbox,
          limit,
          zoom,
          markerProfile,
          season,
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
    const actorClass = parseActorClass(q.actor_class);
    const collection = await getFrontierMap({ bbox, year, actorClass });
    reply
      .type("application/json; charset=utf-8")
      .header("Cache-Control", "no-store");
    return collection;
  });

  app.get("/api/v1/map/area-polygons", async (request, reply) => {
    const q = (request.query ?? {}) as Record<string, unknown>;
    const bbox = parseBbox(q.bbox);
    if (!bbox) {
      reply.code(400).type("application/json; charset=utf-8");
      return { error: "missing_or_invalid_bbox" };
    }
    const zoom = parseFloat64(q.zoom);
    const sources = parseAreaSources(q.sources);
    const limit = parseInt32(q.limit);
    const collection = await listAreaPolygonsForBbox({
      bbox,
      zoom,
      sources,
      limit: limit ?? undefined,
    });
    reply
      .type("application/json; charset=utf-8")
      .header("Cache-Control", "public, max-age=60");
    return collection;
  });

  app.get("/api/v1/map/guide-spots", async (request, reply) => {
    const q = (request.query ?? {}) as Record<string, unknown>;
    const bbox = parseBbox(q.bbox);
    if (!bbox) {
      reply.code(400).type("application/json; charset=utf-8");
      return { error: "missing_or_invalid_bbox" };
    }
    const limit = parseInt32(q.limit);
    const collection = listMapGuideSpotsForBbox({
      bbox,
      limit: limit ?? undefined,
    });
    reply
      .type("application/json; charset=utf-8")
      .header("Cache-Control", "public, max-age=300");
    return collection;
  });

  // Internal: clear the in-memory area-polygons cache so freshly imported
  // OSM / N03 polygons surface immediately. Guarded by the privileged
  // write API key (same secret the importer scripts already need).
  app.post("/api/v1/internal/flush-area-cache", async (request, reply) => {
    try {
      assertPrivilegedWriteAccess(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : "forbidden_privileged_write";
      const status = message === "privileged_write_api_key_not_configured" ? 503 : 403;
      return reply.code(status).send({ error: message });
    }
    const cleared = flushAreaPolygonCache();
    return reply.send({ flushed_entries: cleared });
  });

  app.get("/api/v1/map/effort-summary", async (request, reply) => {
    const q = (request.query ?? {}) as Record<string, unknown>;
    const bbox = parseBbox(q.bbox);
    const year = parseInt32(q.year);
    const role = parseRole(q.role);
    const actorClass = parseActorClass(q.actor_class);
    const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    const summary = await getEffortSummary({
      bbox,
      year,
      userId: session?.userId ?? null,
      role,
      actorClass,
    });
    reply
      .type("application/json; charset=utf-8")
      .header("Cache-Control", "no-store");
    return summary;
  });

  app.get("/api/v1/map/my-places", async (request, reply) => {
    const q = (request.query ?? {}) as Record<string, unknown>;
    const limit = parseInt32(q.limit);
    const sort = normalizePlaceMemoryVisitSort(q.sort);
    const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    reply
      .type("application/json; charset=utf-8")
      .header("Cache-Control", "no-store");
    if (!session?.userId || session.banned) {
      return { signedIn: false, items: [] };
    }
    const items = await listMapVisitedPlaces(session.userId, { limit: limit ?? 12, sort });
    return { signedIn: true, sort, items };
  });
}
