import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getSessionFromCookie } from "../services/authSession.js";
import { getEffortSummary, getFrontierMap, type EffortActorClass, type EffortRole } from "../services/mapEffort.js";
import { buildMapOwnObservationClusters, listMapOwnObservations } from "../services/mapOwnObservations.js";
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
import { normalizePlaceAtlasRef, PLACE_ATLAS_PROFILE_VERSION } from "../services/placeAtlasContract.js";
import { getPlaceAtlasProfile } from "../services/placeAtlasProfile.js";
import { buildPlaceAtlasTimelineProjection } from "../services/placeAtlasTimeline.js";
import {
  buildPlaceAtlasProfileV2,
  PLACE_ATLAS_PROFILE_V2_VERSION,
} from "../services/placeAtlasV2Contract.js";
import {
  createPlaceCorrectionProposal,
  listPublicPlaceChildren,
  searchPublicPlaces,
} from "../services/placeRegistry.js";

const JMA_NOWCAST_TARGET_N1 = "https://www.jma.go.jp/bosai/jmatile/data/nowc/targetTimes_N1.json";
const JMA_NOWCAST_TARGET_N2 = "https://www.jma.go.jp/bosai/jmatile/data/nowc/targetTimes_N2.json";
const JMA_NOWCAST_ROOT = "https://www.jma.go.jp/bosai/jmatile/data/nowc";
const JMA_SHORT_RANGE_TARGET = "https://www.jma.go.jp/bosai/jmatile/data/rasrf/targetTimes.json";
const JMA_SHORT_RANGE_ROOT = "https://www.jma.go.jp/bosai/jmatile/data/rasrf";
const JMA_NOWCAST_OFFSETS = [0, 5, 15, 30, 60] as const;
const JMA_SHORT_RANGE_OFFSETS = [120, 180, 240, 300, 360] as const;
const JMA_NOWCAST_TIME_TTL_MS = 60_000;
const JMA_NOWCAST_TILE_TTL_MS = 300_000;
const JMA_NOWCAST_TILE_CACHE_MAX = 384;
const JMA_NOWCAST_FETCH_TIMEOUT_MS = 3_000;
const JMA_RAIN_TILE_MAX_ZOOM = 10;

type JmaNowcastTarget = {
  basetime: string;
  validtime: string;
  member?: string;
  elements?: string[];
};

let jmaNowcastTimesCache: { expiresAt: number; payload: JmaNowcastTimesResponse } | null = null;
const jmaNowcastTileCache = new Map<string, { expiresAt: number; bytes: Buffer }>();

type JmaNowcastTimesResponse = {
  source: "jma_precipitation_map";
  attribution: string;
  attributionUrl: string;
  generatedAt: string;
  tileUrlTemplate: string;
  times: Array<{
    offsetMinutes: number;
    basetime: string;
    validtime: string;
    product: "nowcast" | "short_range";
    member: string;
    highResolution: boolean;
  }>;
};

const ALLOWED_AREA_SOURCES: readonly AreaPolygonSource[] = [
  "user_defined", "nature_symbiosis_site", "tsunag", "protected_area", "oecm",
  "school", "osm_park", "osm_named_area", "admin_municipality", "admin_prefecture", "admin_country",
];

function parseAreaSources(raw: unknown): AreaPolygonSource[] | undefined {
  if (typeof raw !== "string") return undefined;
  const items = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const allowed = items.filter((v): v is AreaPolygonSource =>
    (ALLOWED_AREA_SOURCES as readonly string[]).includes(v));
  return allowed.length > 0 ? allowed : undefined;
}

function shouldLogHighZoomEmptyAreaViewport(
  bbox: [number, number, number, number],
  zoom: number | undefined,
  sources: AreaPolygonSource[] | undefined,
  featureCount: number,
): boolean {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const liveSourceRequested = sources == null || sources.some((source) =>
    source === "osm_park" || source === "school" || source === "osm_named_area"
  );
  return featureCount === 0
    && (zoom ?? 0) >= 13
    && liveSourceRequested
    && (maxLng - minLng) <= 0.02
    && (maxLat - minLat) <= 0.02;
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

function targetSupportsShortRangeRain(target: JmaNowcastTarget): boolean {
  return !Array.isArray(target.elements) || target.elements.includes("rasrf");
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

function chooseShortRangeTarget(targets: JmaNowcastTarget[], offsetMinutes: number): JmaNowcastTarget | null {
  const candidates = targets
    .filter((target) => isValidJmaTimestamp(target.basetime) && isValidJmaTimestamp(target.validtime) && targetSupportsShortRangeRain(target))
    .map((target) => ({ target, offset: minutesBetween(target.basetime, target.validtime) }))
    .filter((item): item is { target: JmaNowcastTarget; offset: number } => item.offset !== null);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const da = Math.abs(a.offset - offsetMinutes);
    const db = Math.abs(b.offset - offsetMinutes);
    if (da !== db) return da - db;
    const memberRank = (value: string | undefined) => value === "immed" ? 0 : 1;
    const mr = memberRank(a.target.member) - memberRank(b.target.member);
    if (mr !== 0) return mr;
    return b.target.validtime.localeCompare(a.target.validtime);
  });
  return candidates[0]?.target ?? null;
}

async function getJmaNowcastTimes(): Promise<JmaNowcastTimesResponse> {
  const now = Date.now();
  if (jmaNowcastTimesCache && jmaNowcastTimesCache.expiresAt > now) return jmaNowcastTimesCache.payload;
  const [currentTargets, forecastTargets, shortRangeTargets] = await Promise.all([
    fetchJsonWithTimeout<JmaNowcastTarget[]>(JMA_NOWCAST_TARGET_N1),
    fetchJsonWithTimeout<JmaNowcastTarget[]>(JMA_NOWCAST_TARGET_N2),
    fetchJsonWithTimeout<JmaNowcastTarget[]>(JMA_SHORT_RANGE_TARGET),
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
      product: "nowcast",
      member: "none",
      highResolution: offsetMinutes <= 30,
    });
  }
  for (const offsetMinutes of JMA_SHORT_RANGE_OFFSETS) {
    const target = chooseShortRangeTarget(shortRangeTargets, offsetMinutes);
    if (!target) continue;
    times.push({
      offsetMinutes,
      basetime: target.basetime,
      validtime: target.validtime,
      product: "short_range",
      member: target.member || "none",
      highResolution: false,
    });
  }
  const payload: JmaNowcastTimesResponse = {
    source: "jma_precipitation_map",
    attribution: "Source: JMA High-resolution Precipitation Nowcast / Very Short-range Forecasts of Precipitation",
    attributionUrl: "https://www.jma.go.jp/jma/en/Activities/forecast.html",
    generatedAt: new Date().toISOString(),
    tileUrlTemplate: "/api/v1/weather/jma-nowcast/tile?product={product}&member={member}&basetime={basetime}&validtime={validtime}&z={z}&x={x}&y={y}",
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
    const product = q.product === "short_range" ? "short_range" : "nowcast";
    const member = typeof q.member === "string" && /^[a-z0-9_-]{1,24}$/i.test(q.member) ? q.member : "none";
    const basetime = typeof q.basetime === "string" ? q.basetime : "";
    const validtime = typeof q.validtime === "string" ? q.validtime : "";
    const z = parseTileNumber(q.z, JMA_RAIN_TILE_MAX_ZOOM);
    const maxTile = z === null ? 0 : Math.pow(2, z) - 1;
    const x = parseTileNumber(q.x, maxTile);
    const y = parseTileNumber(q.y, maxTile);
    if (!isValidJmaTimestamp(basetime) || !isValidJmaTimestamp(validtime) || z === null || x === null || y === null) {
      reply.code(400).type("application/json; charset=utf-8").header("Cache-Control", "no-store");
      return { error: "invalid_jma_nowcast_tile" };
    }

    const url = product === "short_range"
      ? `${JMA_SHORT_RANGE_ROOT}/${basetime}/${member}/${validtime}/surf/rasrf/${z}/${x}/${y}.png`
      : `${JMA_NOWCAST_ROOT}/${basetime}/none/${validtime}/surf/hrpns/${z}/${x}/${y}.png`;
    const cacheKey = `${product}:${member}:${basetime}:${validtime}:${z}:${x}:${y}`;
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
    const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    const viewerUserId = session?.userId && !session.banned ? session.userId : null;

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
          viewerUserId,
        })
      : await getMapObservations({
          taxonGroup,
          year,
          bbox,
          limit,
          zoom,
          markerProfile,
          season,
          viewerUserId,
        });

    reply
      .type("application/json; charset=utf-8")
      .header("Cache-Control", "no-store");
    return collection;
  });

  app.get("/api/v1/map/place-profile", async (request, reply) => {
    const startedAt = performance.now();
    const setTimingHeaders = () => {
      const durationMs = Math.max(0, performance.now() - startedAt);
      reply
        .header("Server-Timing", `place_profile;dur=${durationMs.toFixed(1)}`)
        .header("X-Ikimon-Latency-Ms", durationMs.toFixed(1));
    };
    const q = (request.query ?? {}) as Record<string, unknown>;
    const placeRef = normalizePlaceAtlasRef(q);
    const wantsV2 = q.version === "2" || q.profile_version === "2";
    if (!placeRef) {
      setTimingHeaders();
      reply
        .code(400)
        .type("application/json; charset=utf-8")
        .header("Cache-Control", "no-store");
      return { error: "invalid_place_ref" };
    }
    const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    const viewerUserId = session?.userId && !session.banned ? session.userId : null;
    try {
      const profile = await getPlaceAtlasProfile(placeRef, { viewerUserId });
      if (!profile) {
        setTimingHeaders();
        reply
          .code(404)
          .type("application/json; charset=utf-8")
          .header("Cache-Control", "no-store");
        return { error: "place_not_found" };
      }
      reply
        .type("application/json; charset=utf-8")
        .header("Cache-Control", viewerUserId
          ? "private, no-store"
          : "public, max-age=60, stale-while-revalidate=300")
        .header("Vary", "Cookie")
        .header("X-Ikimon-Profile-Version", wantsV2
          ? PLACE_ATLAS_PROFILE_V2_VERSION
          : PLACE_ATLAS_PROFILE_VERSION);
      setTimingHeaders();
      const timelineProjection = buildPlaceAtlasTimelineProjection(profile);
      return {
        profile: wantsV2
          ? { ...buildPlaceAtlasProfileV2(profile), timelineProjection }
          : { ...profile, timelineProjection },
      };
    } catch (error) {
      request.log.warn({
        err: error,
        placeKind: placeRef.kind,
      }, "place_atlas_profile_failed");
      setTimingHeaders();
      reply
        .code(503)
        .type("application/json; charset=utf-8")
        .header("Cache-Control", "no-store");
      return {
        error: "place_profile_unavailable",
        retryable: true,
      };
    }
  });

  app.get("/api/v1/map/place-search", async (request, reply) => {
    const startedAt = performance.now();
    const setTimingHeaders = () => {
      const durationMs = Math.max(0, performance.now() - startedAt);
      reply
        .header("Server-Timing", `place_search;dur=${durationMs.toFixed(1)}`)
        .header("X-Ikimon-Latency-Ms", durationMs.toFixed(1));
    };
    const q = (request.query ?? {}) as Record<string, unknown>;
    try {
      const response = await searchPublicPlaces(q.q, parseInt32(q.limit) ?? 8);
      setTimingHeaders();
      reply
        .type("application/json; charset=utf-8")
        .header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
      return response;
    } catch (error) {
      request.log.warn({ err: error }, "place_search_failed");
      setTimingHeaders();
      reply
        .code(503)
        .type("application/json; charset=utf-8")
        .header("Cache-Control", "no-store");
      return { error: "place_search_unavailable", retryable: true };
    }
  });

  app.get("/api/v1/map/place-resolve", async (request, reply) => {
    const q = (request.query ?? {}) as Record<string, unknown>;
    try {
      const response = await searchPublicPlaces(q.place_id ?? q.q, 1);
      const place = response.results[0] ?? null;
      if (!place) {
        reply.code(404).header("Cache-Control", "public, max-age=60");
        return { error: "place_not_found" };
      }
      reply.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
      return { version: response.version, place, privacy: response.privacy };
    } catch (error) {
      request.log.warn({ err: error }, "place_resolve_failed");
      reply.code(503).header("Cache-Control", "no-store");
      return { error: "place_resolve_unavailable", retryable: true };
    }
  });

  app.get("/api/v1/map/place-children", async (request, reply) => {
    const q = (request.query ?? {}) as Record<string, unknown>;
    const placeId = typeof q.place_id === "string" ? q.place_id.trim() : "";
    if (!placeId) {
      reply.code(400).header("Cache-Control", "no-store");
      return { error: "invalid_place_id" };
    }
    try {
      const results = await listPublicPlaceChildren(placeId);
      reply.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
      return {
        version: "place_children/v1",
        parentPlaceId: placeId,
        results,
        state: results.length > 0 ? "complete" : "empty",
        privacy: "boundary_bbox_only",
      };
    } catch (error) {
      request.log.warn({ err: error }, "place_children_failed");
      reply.code(503).header("Cache-Control", "no-store");
      return { error: "place_children_unavailable", retryable: true };
    }
  });

  app.post<{
    Body: {
      placeId?: string | null;
      proposalType?: string;
      proposedPayload?: unknown;
    };
  }>("/api/v1/map/place-correction-proposals", async (request, reply) => {
    const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    if (!session || session.banned) {
      reply.code(401).header("Cache-Control", "no-store");
      return { error: "authentication_required" };
    }
    try {
      const proposal = await createPlaceCorrectionProposal({
        placeId: request.body?.placeId ?? null,
        proposerUserId: session.userId,
        proposalType: String(request.body?.proposalType ?? ""),
        proposedPayload: request.body?.proposedPayload,
      });
      reply.code(202).header("Cache-Control", "no-store");
      return { proposal, directMutation: false };
    } catch (error) {
      reply.code(400).header("Cache-Control", "no-store");
      return {
        error: error instanceof Error ? error.message : "invalid_correction_proposal",
      };
    }
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
    const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    const viewerUserId = session?.userId && !session.banned ? session.userId : null;
    const collection = await getTraceLines({ year, limit: limit ?? 200, viewerUserId });
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
    if (shouldLogHighZoomEmptyAreaViewport(bbox, zoom, sources, collection.features.length)) {
      request.log.warn({
        bbox,
        zoom,
        sources: sources ?? "default",
        limit: limit ?? null,
      }, "area_polygons_high_zoom_empty_viewport");
    }
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

  const ownObservationsHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const q = (request.query ?? {}) as Record<string, unknown>;
    const limit = parseInt32(q.limit);
    const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    reply
      .type("application/json; charset=utf-8")
      .header("Cache-Control", "private, no-store");
    if (!session?.userId || session.banned) {
      return { signedIn: false, items: [], clusters: [] };
    }
    const items = await listMapOwnObservations(session.userId, { limit: limit ?? 120 });
    const clusters = buildMapOwnObservationClusters(items, { limit: 3 });
    return { signedIn: true, items, clusters };
  };
  app.get("/api/v1/me/map-observations", ownObservationsHandler);
  app.get("/api/v1/map/my-observations", ownObservationsHandler);
}
