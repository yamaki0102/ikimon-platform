import { pathToFileURL } from "node:url";
import { getPool } from "../db.js";
import { pointInGeoJsonPolygon } from "../services/pointInPolygon.js";

type Options = {
  apply: boolean;
  limit: number | null;
};

type WardField = {
  field_id: string;
  city: string | null;
  name: string | null;
  polygon: Record<string, unknown> | null;
  label: string;
};

type CandidateRow = {
  id: string;
  lat: string | number | null;
  lng: string | number | null;
  current: string | null;
  canonical_name?: string | null;
};

type RepairPlan = {
  id: string;
  current: string | null;
  next: string;
  lat: number;
  lng: number;
};

type RepairSummary = {
  mode: "dry-run" | "apply";
  repair: "hamamatsu_ward_labels";
  wardFields: number;
  visits: {
    candidates: number;
    planned: number;
    updated: number;
    samples: RepairPlan[];
  };
  places: {
    candidates: number;
    planned: number;
    updated: number;
    samples: RepairPlan[];
  };
};

const HAMAMATSU_BBOX = {
  minLat: 34.55,
  maxLat: 35.32,
  minLng: 137.45,
  maxLng: 138.08,
};

function parseOptions(argv: string[]): Options {
  const limitArg = argv.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? Number.parseInt(limitArg.slice("--limit=".length), 10) : null;
  return {
    apply: argv.includes("--apply"),
    limit: Number.isFinite(limit) && limit !== null && limit > 0 ? limit : null,
  };
}

function toNumber(value: string | number | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function inHamamatsuBbox(lat: number, lng: number): boolean {
  return lat >= HAMAMATSU_BBOX.minLat
    && lat <= HAMAMATSU_BBOX.maxLat
    && lng >= HAMAMATSU_BBOX.minLng
    && lng <= HAMAMATSU_BBOX.maxLng;
}

function text(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function isCoarseHamamatsuLabel(value: string | null | undefined): boolean {
  const raw = text(value);
  const key = raw.toLowerCase().replace(/[‐‑‒–—―ー−]/g, "-").replace(/\s+/g, " ");
  return raw === ""
    || raw === "浜松"
    || raw === "浜松市"
    || key === "hamamatsu"
    || key === "hamamatsu city"
    || key === "hamamatsu-shi"
    || key === "hamamatsu / shizuoka";
}

function wardLabelFromField(row: Pick<WardField, "city" | "name">): string | null {
  const city = text(row.city);
  const name = text(row.name);
  const fromCity = city.startsWith("浜松市") && city.endsWith("区")
    ? city
    : city.endsWith("区")
      ? `浜松市${city}`
      : "";
  if (fromCity) return fromCity;
  const match = name.match(/浜松市[^\s/]+区/);
  return match?.[0] ?? null;
}

function resolveWardLabel(lat: number, lng: number, wardFields: WardField[]): string | null {
  if (!inHamamatsuBbox(lat, lng)) return null;
  for (const field of wardFields) {
    if (field.polygon && pointInGeoJsonPolygon(lng, lat, field.polygon)) {
      return field.label;
    }
  }
  return null;
}

function buildPlans(rows: CandidateRow[], wardFields: WardField[]): RepairPlan[] {
  const plans: RepairPlan[] = [];
  for (const row of rows) {
    if (!isCoarseHamamatsuLabel(row.current)) continue;
    const lat = toNumber(row.lat);
    const lng = toNumber(row.lng);
    if (lat === null || lng === null) continue;
    const next = resolveWardLabel(lat, lng, wardFields);
    if (!next || next === row.current) continue;
    plans.push({ id: row.id, current: row.current, next, lat, lng });
  }
  return plans;
}

async function loadWardFields(client: Awaited<ReturnType<ReturnType<typeof getPool>["connect"]>>): Promise<WardField[]> {
  const result = await client.query<{
    field_id: string;
    city: string | null;
    name: string | null;
    polygon: Record<string, unknown> | null;
  }>(
    `SELECT field_id::text, city, name, polygon
       FROM observation_fields
      WHERE polygon IS NOT NULL
        AND valid_to IS NULL
        AND coalesce(admin_level, source) = 'admin_municipality'
        AND prefecture = '静岡県'
        AND bbox_min_lat <= $1
        AND bbox_max_lat >= $2
        AND bbox_min_lng <= $3
        AND bbox_max_lng >= $4
        AND (city LIKE '%区' OR name LIKE '%区%')
      ORDER BY coalesce(area_ha, 999999999) ASC, city ASC, name ASC`,
    [HAMAMATSU_BBOX.maxLat, HAMAMATSU_BBOX.minLat, HAMAMATSU_BBOX.maxLng, HAMAMATSU_BBOX.minLng],
  );

  return result.rows
    .map((row) => ({ ...row, label: wardLabelFromField(row) }))
    .filter((row): row is WardField => Boolean(row.label));
}

async function loadVisitCandidates(
  client: Awaited<ReturnType<ReturnType<typeof getPool>["connect"]>>,
  limit: number | null,
): Promise<CandidateRow[]> {
  const limitSql = limit ? "LIMIT $5" : "";
  const params: unknown[] = [
    HAMAMATSU_BBOX.minLat,
    HAMAMATSU_BBOX.maxLat,
    HAMAMATSU_BBOX.minLng,
    HAMAMATSU_BBOX.maxLng,
  ];
  if (limit) params.push(limit);
  const result = await client.query<CandidateRow>(
    `SELECT visit_id::text AS id,
            point_latitude::text AS lat,
            point_longitude::text AS lng,
            observed_municipality AS current
       FROM visits
      WHERE point_latitude BETWEEN $1 AND $2
        AND point_longitude BETWEEN $3 AND $4
        AND (
          observed_municipality IS NULL
          OR observed_municipality = ''
          OR observed_municipality IN ('浜松', '浜松市')
          OR lower(observed_municipality) IN ('hamamatsu', 'hamamatsu city', 'hamamatsu-shi', 'hamamatsu / shizuoka')
        )
      ORDER BY observed_at DESC, visit_id DESC
      ${limitSql}`,
    params,
  );
  return result.rows;
}

async function loadPlaceCandidates(
  client: Awaited<ReturnType<ReturnType<typeof getPool>["connect"]>>,
  limit: number | null,
): Promise<CandidateRow[]> {
  const limitSql = limit ? "LIMIT $5" : "";
  const params: unknown[] = [
    HAMAMATSU_BBOX.minLat,
    HAMAMATSU_BBOX.maxLat,
    HAMAMATSU_BBOX.minLng,
    HAMAMATSU_BBOX.maxLng,
  ];
  if (limit) params.push(limit);
  const result = await client.query<CandidateRow>(
    `SELECT place_id::text AS id,
            center_latitude::text AS lat,
            center_longitude::text AS lng,
            municipality AS current,
            canonical_name
       FROM places
      WHERE center_latitude BETWEEN $1 AND $2
        AND center_longitude BETWEEN $3 AND $4
        AND (
          municipality IS NULL
          OR municipality = ''
          OR municipality IN ('浜松', '浜松市')
          OR lower(municipality) IN ('hamamatsu', 'hamamatsu city', 'hamamatsu-shi', 'hamamatsu / shizuoka')
        )
      ORDER BY updated_at DESC, place_id DESC
      ${limitSql}`,
    params,
  );
  return result.rows;
}

async function applyVisitPlans(
  client: Awaited<ReturnType<ReturnType<typeof getPool>["connect"]>>,
  plans: RepairPlan[],
): Promise<number> {
  let updated = 0;
  for (const plan of plans) {
    const result = await client.query(
      `UPDATE visits
          SET observed_prefecture = '静岡県',
              observed_municipality = $2,
              updated_at = now()
        WHERE visit_id = $1
          AND (
            observed_municipality IS NULL
            OR observed_municipality = ''
            OR observed_municipality IN ('浜松', '浜松市')
            OR lower(observed_municipality) IN ('hamamatsu', 'hamamatsu city', 'hamamatsu-shi', 'hamamatsu / shizuoka')
          )
        RETURNING 1`,
      [plan.id, plan.next],
    );
    updated += result.rows.length;
  }
  return updated;
}

async function applyPlacePlans(
  client: Awaited<ReturnType<ReturnType<typeof getPool>["connect"]>>,
  plans: RepairPlan[],
): Promise<number> {
  let updated = 0;
  for (const plan of plans) {
    const result = await client.query(
      `UPDATE places
          SET prefecture = '静岡県',
              municipality = $2,
              canonical_name = CASE
                WHEN canonical_name IS NULL
                  OR canonical_name = ''
                  OR canonical_name IN ('浜松', '浜松市')
                  OR lower(canonical_name) IN ('hamamatsu', 'hamamatsu city', 'hamamatsu-shi', 'hamamatsu / shizuoka', 'v2 place')
                THEN $2
                ELSE canonical_name
              END,
              updated_at = now()
        WHERE place_id = $1
          AND (
            municipality IS NULL
            OR municipality = ''
            OR municipality IN ('浜松', '浜松市')
            OR lower(municipality) IN ('hamamatsu', 'hamamatsu city', 'hamamatsu-shi', 'hamamatsu / shizuoka')
          )
        RETURNING 1`,
      [plan.id, plan.next],
    );
    updated += result.rows.length;
  }
  return updated;
}

export async function repairHamamatsuWardLabels(options: Options): Promise<RepairSummary> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const wardFields = await loadWardFields(client);
    if (wardFields.length === 0) {
      throw new Error("hamamatsu_ward_admin_polygons_missing");
    }

    const visitRows = await loadVisitCandidates(client, options.limit);
    const placeRows = await loadPlaceCandidates(client, options.limit);
    const visitPlans = buildPlans(visitRows, wardFields);
    const placePlans = buildPlans(placeRows, wardFields);

    let visitsUpdated = 0;
    let placesUpdated = 0;
    if (options.apply) {
      visitsUpdated = await applyVisitPlans(client, visitPlans);
      placesUpdated = await applyPlacePlans(client, placePlans);
      await client.query("commit");
    } else {
      await client.query("rollback");
    }

    return {
      mode: options.apply ? "apply" : "dry-run",
      repair: "hamamatsu_ward_labels",
      wardFields: wardFields.length,
      visits: {
        candidates: visitRows.length,
        planned: visitPlans.length,
        updated: visitsUpdated,
        samples: visitPlans.slice(0, 10),
      },
      places: {
        candidates: placeRows.length,
        planned: placePlans.length,
        updated: placesUpdated,
        samples: placePlans.slice(0, 10),
      },
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main(): Promise<void> {
  const summary = await repairHamamatsuWardLabels(parseOptions(process.argv));
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}

export const __test__ = {
  buildPlans,
  isCoarseHamamatsuLabel,
  resolveWardLabel,
  wardLabelFromField,
};
