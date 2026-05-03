/**
 * Sensitive (red list) species masking for area-snapshot.
 *
 * Loads the active set of scientific names whose `risk_status_versions` entry
 * is in {CR, EN, VU, NT, EW, EX} (configurable, NT included by default for
 * conservative public display) and exposes simple decision helpers.
 *
 * Usage flow on the area-snapshot path:
 *   1. `loadSensitiveSpeciesIndex()` is called lazily and cached for 24h.
 *   2. `decidePublicCoord(occurrence, viewer)` → mode + reason; aggregator
 *      coarsens lat/lng accordingly and counts how many occurrences were
 *      hidden / coarsened so the sidesheet can show a transparency banner.
 *
 * Per-occurrence overrides via `civic_observation_contexts.public_precision`
 * still take precedence — this module only enforces the *species-level*
 * floor for public-facing surfaces.
 */
import { getPool } from "../db.js";

export type ViewerContext = {
  isAdminOrAnalyst: boolean;
  fieldRole: "owner" | "steward" | "viewer_exact" | null;
};

export type CoordMode = "exact" | "mesh_1km" | "municipality" | "hidden";

export type CoordDecision = {
  mode: CoordMode;
  reason: "context_private" | "context_hidden" | "context_explicit" | "rare_redlist" | "viewer_authorized" | "default_public";
};

export type OccurrenceForMasking = {
  scientificName: string | null;
  vernacularName: string | null;
  contextPrecision: "exact_private" | "site" | "mesh" | "municipality" | "hidden" | null;
  riskLane?: string | null;
};

const SENSITIVE_CATEGORIES_DEFAULT = new Set(["CR", "EN", "VU", "NT", "EW", "EX"]);
const TTL_MS = 24 * 60 * 60 * 1000;

interface IndexState {
  expires: number;
  names: Set<string>;
}

let cached: IndexState | null = null;
let inflight: Promise<IndexState> | null = null;

function shouldUseNT(): boolean {
  // Allow ops to opt out of NT via env without redeploying.
  // Default: include NT (aligns with iNaturalist regional defaults rather
  // than eBird's stricter VU+ baseline).
  return (process.env.IKIMON_SENSITIVE_INCLUDE_NT ?? "1") !== "0";
}

function categoryFilter(): Set<string> {
  if (shouldUseNT()) return SENSITIVE_CATEGORIES_DEFAULT;
  return new Set(["CR", "EN", "VU", "EW", "EX"]);
}

async function fetchSensitiveNames(): Promise<Set<string>> {
  const cats = categoryFilter();
  const pool = getPool();
  const result = await pool.query<{ scientific_name: string }>(
    `SELECT DISTINCT lower(scientific_name) AS scientific_name
       FROM risk_status_versions
      WHERE valid_to IS NULL
        AND redlist_category = ANY($1)`,
    [Array.from(cats)],
  );
  const set = new Set<string>();
  for (const row of result.rows) {
    if (row.scientific_name) set.add(row.scientific_name);
  }
  return set;
}

export async function loadSensitiveSpeciesIndex(): Promise<Set<string>> {
  const now = Date.now();
  if (cached && cached.expires > now) return cached.names;
  if (inflight) return (await inflight).names;
  inflight = (async () => {
    try {
      const names = await fetchSensitiveNames();
      const state: IndexState = { expires: Date.now() + TTL_MS, names };
      cached = state;
      return state;
    } catch (err) {
      console.warn("[sensitiveSpeciesMasking] failed to load index", err);
      const fallback: IndexState = { expires: Date.now() + 60_000, names: cached?.names ?? new Set() };
      cached = fallback;
      return fallback;
    } finally {
      inflight = null;
    }
  })();
  return (await inflight).names;
}

export function isSensitive(scientificName: string | null | undefined, index: Set<string>): boolean {
  if (!scientificName) return false;
  return index.has(scientificName.trim().toLowerCase());
}

export function viewerCanSeeExact(viewer: ViewerContext): boolean {
  if (viewer.isAdminOrAnalyst) return true;
  if (viewer.fieldRole === "owner" || viewer.fieldRole === "steward" || viewer.fieldRole === "viewer_exact") return true;
  return false;
}

export function decidePublicCoord(
  occurrence: OccurrenceForMasking,
  viewer: ViewerContext,
  index: Set<string>,
): CoordDecision {
  // 1) Per-occurrence override is strongest.
  if (occurrence.contextPrecision === "exact_private") return { mode: "hidden", reason: "context_private" };
  if (occurrence.contextPrecision === "hidden") return { mode: "hidden", reason: "context_hidden" };
  if (occurrence.contextPrecision === "mesh") return { mode: "mesh_1km", reason: "context_explicit" };
  if (occurrence.contextPrecision === "municipality") return { mode: "municipality", reason: "context_explicit" };

  // 2) Risk-lane "rare_sensitive" already forces hidden in civicNatureContext;
  //    enforce again here in case caller bypasses that path.
  if (occurrence.riskLane === "rare_sensitive") {
    return viewerCanSeeExact(viewer)
      ? { mode: "exact", reason: "viewer_authorized" }
      : { mode: "hidden", reason: "context_private" };
  }

  // 3) Species-level red list floor.
  if (isSensitive(occurrence.scientificName, index)) {
    return viewerCanSeeExact(viewer)
      ? { mode: "exact", reason: "viewer_authorized" }
      : { mode: "mesh_1km", reason: "rare_redlist" };
  }

  return { mode: "exact", reason: "default_public" };
}

/** Round to ~1.1km (0.01 degrees ≈ 1.11km at the equator). No jitter — the
 *  flat mesh is easier to read as "this got coarsened on purpose". */
export function coarsenLatLng(lat: number, lng: number, mode: CoordMode): { lat: number | null; lng: number | null } {
  if (mode === "exact") return { lat, lng };
  if (mode === "hidden") return { lat: null, lng: null };
  if (mode === "mesh_1km") return { lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100 };
  // municipality: caller should substitute centroid; here we just zero out.
  return { lat: null, lng: null };
}

export function __resetCacheForTests(): void {
  cached = null;
  inflight = null;
}
