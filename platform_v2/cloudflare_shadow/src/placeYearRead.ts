import { PLACE_ATLAS_DEFAULT_MIN_PUBLIC_RECORDS } from "../../src/services/placeAtlasContract";
import { json } from "./core/http";
import { D1_PUBLIC_PLACE_DETAIL_PREFILTER_SQL, matchD1PublicPlaceDetail } from "./placeRegistryD1";
import { normalizeSafePublicAreaLabelCandidate } from "./publicAreaLabel";

type D1Value = string | number | null;
export interface PlaceYearStatement {
  bind(...values: D1Value[]): PlaceYearStatement;
  all<T = unknown>(): Promise<{ results: T[] }>;
}
export interface PlaceYearDatabase {
  prepare(query: string): PlaceYearStatement;
}

export const PLACE_YEAR_CARD_LIMIT = 12;
export const PLACE_YEAR_INDEX_LIMIT = 200;
export const PLACE_YEAR_DEFAULT_CANDIDATE_LIMIT = 5;
export const PLACE_YEAR_MIN_PUBLIC_RECORDS = PLACE_ATLAS_DEFAULT_MIN_PUBLIC_RECORDS;
export const PLACE_YEAR_PLACE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{1,159}$/u;
const MIN_YEAR = 1900;

export type RecordCategory = "community" | "heritage" | "nature";
export interface PlaceYearCard {
  visitId: string;
  observedAt: string;
  year: number;
  displayName: string;
  taxonRank: string | null;
  publicCell: string | null;
  areaLabel: string | null;
  category: RecordCategory | null;
}

// Effective-now test mirrors runScheduledObservationEventQuests: julianday on full timestamps, no day truncation.
export const PLACE_POLICY_EFFECTIVE_NOW_SQL = `julianday(COALESCE(pp2.valid_from, pp2.created_at)) <= julianday('now')
                       AND (pp2.valid_to IS NULL OR julianday(pp2.valid_to) > julianday('now'))`;

const PUBLIC_PLACE_GATE = `EXISTS (
          SELECT 1 FROM places p
           WHERE p.place_id = m.place_id
             AND p.public_profile_status = 'published'
             AND p.valid_to IS NULL
             AND p.superseded_by_place_id IS NULL
             AND EXISTS (
               SELECT 1 FROM place_policies pp
                WHERE pp.place_policy_id = (
                    SELECT pp2.place_policy_id FROM place_policies pp2
                     WHERE pp2.place_id = p.place_id
                       AND ${PLACE_POLICY_EFFECTIVE_NOW_SQL}
                     ORDER BY julianday(COALESCE(pp2.valid_from, pp2.created_at)) DESC, pp2.place_policy_id DESC
                     LIMIT 1
                  )
                  AND pp.place_visibility = 'public'
                  AND COALESCE(pp.public_location_mode, 'place') = 'place'
             )
        )`;

const PUBLIC_MEMBER_VISITS = `SELECT m.record_id
              FROM record_place_memberships m
             WHERE m.place_id = ?
               AND m.public_precision = 'place'
               AND m.membership_state = 'confirmed'
               AND m.removed_at IS NULL
               AND ${PUBLIC_PLACE_GATE}`;

const PUBLIC_VISIT_GATE = `COALESCE(v.public_visibility, 'private') = 'public'
          AND EXISTS (
            SELECT 1 FROM observation_data_rights rights
             WHERE rights.visit_id = v.visit_id
               AND rights.withdrawal_status = 'active'
               AND rights.record_consent IN ('public_summary', 'external_export')
          )
          AND NOT EXISTS (
            SELECT 1 FROM observations ho
             WHERE (ho.observation_id = v.visit_id OR ho.observation_id = v.legacy_observation_id)
               AND (ho.emergency_hidden <> 0 OR ho.visibility <> 'public')
          )
          AND substr(COALESCE(v.observed_at, v.created_at, ''), 1, 4) GLOB '[12][0-9][0-9][0-9]'
          AND CAST(substr(COALESCE(v.observed_at, v.created_at, ''), 1, 4) AS INTEGER)
              BETWEEN ${MIN_YEAR} AND CAST(strftime('%Y', 'now') AS INTEGER)`;

export const PLACE_YEAR_INDEX_SQL = `SELECT CAST(substr(COALESCE(v.observed_at, v.created_at), 1, 4) AS INTEGER) AS year,
       COUNT(*) AS record_count
  FROM production_import_visits v
 WHERE v.visit_id IN (${PUBLIC_MEMBER_VISITS})
   AND ${PUBLIC_VISIT_GATE}
 GROUP BY year
 ORDER BY year ASC
 LIMIT ${PLACE_YEAR_INDEX_LIMIT}`;

export const PLACE_YEAR_CARDS_SQL = `WITH gated AS (
  SELECT v.visit_id,
         COALESCE(v.observed_at, v.created_at) AS observed_at,
         COUNT(*) OVER () AS public_total
    FROM production_import_visits v
   WHERE v.visit_id IN (${PUBLIC_MEMBER_VISITS})
     AND ${PUBLIC_VISIT_GATE}
)
SELECT g.visit_id,
       g.observed_at,
       COALESCE(NULLIF(o.vernacular_name, ''), NULLIF(o.scientific_name, ''), '') AS display_name,
       o.taxon_rank,
       pr.public_cell,
       r.public_area_label
  FROM gated g
  LEFT JOIN production_import_occurrences o
    ON o.occurrence_id = (
      SELECT o2.occurrence_id FROM production_import_occurrences o2
       WHERE o2.visit_id = g.visit_id ORDER BY o2.occurrence_id LIMIT 1
    )
  LEFT JOIN production_import_public_readmodel pr ON pr.visit_id = g.visit_id
  LEFT JOIN readmodel_public_observations r ON r.observation_id = g.visit_id
 WHERE g.public_total >= ?
   AND CAST(substr(g.observed_at, 1, 4) AS INTEGER) <= ?
   AND (? IS NULL OR g.visit_id <> ?)
 ORDER BY g.observed_at DESC, g.visit_id ASC
 LIMIT ?`;

export const PLACE_YEAR_DEFAULT_PLACE_SQL = `SELECT m.place_id,
       (SELECT p.canonical_name FROM places p WHERE p.place_id = m.place_id) AS label,
       MAX(COALESCE(v.observed_at, v.created_at)) AS latest
  FROM record_place_memberships m
  JOIN production_import_visits v ON v.visit_id = m.record_id
 WHERE m.public_precision = 'place'
   AND m.membership_state = 'confirmed'
   AND m.removed_at IS NULL
   AND ${PUBLIC_PLACE_GATE}
   AND EXISTS (SELECT 1 FROM places p WHERE p.place_id = m.place_id AND ${D1_PUBLIC_PLACE_DETAIL_PREFILTER_SQL})
   AND ${PUBLIC_VISIT_GATE}
 GROUP BY m.place_id
HAVING COUNT(DISTINCT v.visit_id) >= ?
 ORDER BY latest DESC, m.place_id ASC
 LIMIT ${PLACE_YEAR_DEFAULT_CANDIDATE_LIMIT}`;

function isMissingSchema(error: unknown): boolean {
  return /no such table|no such column/i.test(error instanceof Error ? error.message : String(error));
}

export function currentYear(now = new Date()): number {
  return now.getUTCFullYear();
}

// Same eligibility as the public place detail page (getGlobalPlaceDetailPage): one shared matcher.
export async function isPlaceDetailPublic(db: PlaceYearDatabase, placeId: string): Promise<boolean> {
  if (!PLACE_YEAR_PLACE_ID_PATTERN.test(placeId)) return false;
  try {
    return (await matchD1PublicPlaceDetail(db, placeId)).state === "eligible";
  } catch (error) {
    if (isMissingSchema(error)) return false;
    throw error;
  }
}

export async function loadPlaceYearIndex(
  db: PlaceYearDatabase,
  placeId: string,
): Promise<{ years: Array<{ year: number; count: number }> }> {
  if (!(await isPlaceDetailPublic(db, placeId))) return { years: [] };
  try {
    const { results } = await db.prepare(PLACE_YEAR_INDEX_SQL).bind(placeId)
      .all<{ year: number; record_count: number }>();
    const max = currentYear();
    const years = results
      .filter((row) => Number.isInteger(row.year) && row.year >= MIN_YEAR && row.year <= max)
      .map((row) => ({ year: row.year, count: Number(row.record_count) || 0 }))
      .sort((a, b) => a.year - b.year);
    const total = years.reduce((sum, row) => sum + row.count, 0);
    return { years: total < PLACE_YEAR_MIN_PUBLIC_RECORDS ? [] : years };
  } catch (error) {
    if (isMissingSchema(error)) return { years: [] };
    throw error;
  }
}

export function deriveRecordCategory(row: {
  eventId?: string | null;
  scenePlaceType?: string | null;
  taxonRank?: string | null;
  displayName?: string | null;
}): RecordCategory | null {
  if (row.eventId) return "community";
  const scene = (row.scenePlaceType ?? "").trim().toLowerCase();
  if (/^(heritage|shrine|temple|building|historic|monument)/.test(scene)) return "heritage";
  if (/^(nature|park|forest|river|coast|garden|field|wetland|mountain)/.test(scene)) return "nature";
  const rank = (row.taxonRank ?? "").trim().toLowerCase();
  if (rank && rank !== "other" && (row.displayName ?? "").trim()) return "nature";
  return null;
}

export async function loadPlaceYearCards(
  db: PlaceYearDatabase,
  placeId: string,
  options: { untilYear?: number | null; limit?: number; excludeId?: string | null } = {},
): Promise<PlaceYearCard[]> {
  if (!(await isPlaceDetailPublic(db, placeId))) return [];
  const requested = Math.trunc(options.limit ?? PLACE_YEAR_CARD_LIMIT);
  const limit = Math.max(1, Math.min(PLACE_YEAR_CARD_LIMIT, Number.isFinite(requested) ? requested : PLACE_YEAR_CARD_LIMIT));
  const untilYear = options.untilYear;
  const until = typeof untilYear === "number" && Number.isInteger(untilYear) && untilYear >= MIN_YEAR
    ? Math.min(untilYear, currentYear())
    : currentYear();
  const exclude = options.excludeId?.trim() || null;
  try {
    const { results } = await db.prepare(PLACE_YEAR_CARDS_SQL)
      .bind(placeId, PLACE_YEAR_MIN_PUBLIC_RECORDS, until, exclude, exclude, limit)
      .all<{
        visit_id: string;
        observed_at: string;
        display_name: string;
        taxon_rank: string | null;
        public_cell: string | null;
        public_area_label: string | null;
      }>();
    return results.slice(0, limit).map((row) => ({
      visitId: row.visit_id,
      observedAt: row.observed_at,
      year: Number(String(row.observed_at).slice(0, 4)),
      displayName: row.display_name,
      taxonRank: row.taxon_rank,
      publicCell: row.public_cell || null,
      areaLabel: normalizeSafePublicAreaLabelCandidate(row.public_area_label),
      category: deriveRecordCategory({ taxonRank: row.taxon_rank, displayName: row.display_name }),
    }));
  } catch (error) {
    if (isMissingSchema(error)) return [];
    throw error;
  }
}

export async function resolveDefaultPublicPlace(
  db: PlaceYearDatabase,
): Promise<{ placeId: string; label: string } | null> {
  let rows: Array<{ place_id: string; label: string | null }>;
  try {
    rows = (await db.prepare(PLACE_YEAR_DEFAULT_PLACE_SQL).bind(PLACE_YEAR_MIN_PUBLIC_RECORDS)
      .all<{ place_id: string; label: string | null }>()).results;
  } catch (error) {
    if (isMissingSchema(error)) return null;
    throw error;
  }
  for (const row of rows.slice(0, PLACE_YEAR_DEFAULT_CANDIDATE_LIMIT)) {
    if (!PLACE_YEAR_PLACE_ID_PATTERN.test(row.place_id)) continue;
    if (await isPlaceDetailPublic(db, row.place_id)) {
      return { placeId: row.place_id, label: (row.label ?? "").trim() };
    }
  }
  return null;
}

export async function handlePlaceYearReadRequest(
  request: Request,
  db: PlaceYearDatabase,
  pathname: string,
): Promise<Response | null> {
  const match = /^\/api\/v1\/places\/([^/]+)\/(years|records)$/u.exec(pathname);
  if (!match) return null;
  let placeId: string;
  try {
    placeId = decodeURIComponent(match[1] ?? "");
  } catch {
    placeId = "";
  }
  if (!PLACE_YEAR_PLACE_ID_PATTERN.test(placeId)) {
    return json({ error: "invalid_place_id" }, 400, { "cache-control": "no-store" });
  }
  const headers = {
    vary: "Cookie, Authorization",
    "cache-control": request.headers.has("cookie") || request.headers.has("authorization")
      ? "private, no-store"
      : "public, max-age=60",
  };
  if (match[2] === "years") {
    return json({ placeId, ...(await loadPlaceYearIndex(db, placeId)) }, 200, headers);
  }
  const untilParam = new URL(request.url).searchParams.get("until") ?? "";
  const until = /^\d{4}$/u.test(untilParam) ? Number(untilParam) : null;
  return json({ placeId, cards: await loadPlaceYearCards(db, placeId, { untilYear: until }) }, 200, headers);
}
