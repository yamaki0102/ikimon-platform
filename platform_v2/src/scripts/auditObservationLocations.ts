import { getPool } from "../db.js";
import { pathToFileURL } from "node:url";

export type LocationAuditRow = {
  visit_id: string;
  observed_at: string;
  latitude: string | number | null;
  longitude: string | number | null;
  point_latitude: string | number | null;
  point_longitude: string | number | null;
  prefecture: string | null;
  municipality: string | null;
  place_name: string | null;
  public_visibility: string | null;
  quality_review_status: string | null;
  source_kind: string | null;
  source_payload: unknown;
};

export type LocationAuditAnomaly = {
  visitId: string;
  observedAt: string;
  reasons: string[];
  latitude: number | null;
  longitude: number | null;
  prefecture: string | null;
  municipality: string | null;
  placeName: string | null;
};

type AuditOptions = {
  sinceDays: number;
  limit: number;
  notify: boolean;
  failOnAnomaly: boolean;
};

const DEFAULT_SINCE_DAYS = 14;
const DEFAULT_LIMIT = 2000;

function toNumber(value: string | number | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function inJapan(lat: number, lng: number): boolean {
  return lat >= 20 && lat <= 46 && lng >= 122 && lng <= 154;
}

function inHamamatsu(lat: number, lng: number): boolean {
  return lat >= 34.55 && lat <= 35.32 && lng >= 137.35 && lng <= 138.08;
}

function inShizuokaCity(lat: number, lng: number): boolean {
  return lat >= 34.82 && lat <= 35.36 && lng >= 138.15 && lng <= 138.72;
}

function englishLocality(value: string | null): boolean {
  return /\b(shizuoka|hamamatsu|hamamatsu city|shizuoka prefecture|hamamatsu \/ shizuoka)\b/i.test(value ?? "");
}

function sourcePayloadSource(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const source = (value as Record<string, unknown>).source;
  return typeof source === "string" ? source : "";
}

export function detectLocationAnomalies(rows: LocationAuditRow[]): LocationAuditAnomaly[] {
  const anomalies: LocationAuditAnomaly[] = [];
  for (const row of rows) {
    const lat = toNumber(row.latitude);
    const lng = toNumber(row.longitude);
    const pointLat = toNumber(row.point_latitude);
    const pointLng = toNumber(row.point_longitude);
    const reasons: string[] = [];
    const joinedLabel = [row.prefecture, row.municipality, row.place_name].filter(Boolean).join(" / ");

    if (lat === null || lng === null) {
      reasons.push("missing_effective_coordinates");
    } else {
      if ((lat === 0 && lng === 0) || (pointLat === 0 && pointLng === 0)) reasons.push("zero_zero_coordinates");
      if (!inJapan(lat, lng)) reasons.push("coordinates_outside_japan");
      if (englishLocality(joinedLabel)) reasons.push("english_locality_label");
      if (inHamamatsu(lat, lng) && (row.prefecture !== "静岡県" || row.municipality !== "浜松市")) {
        reasons.push("hamamatsu_coordinate_label_mismatch");
      }
      if (inShizuokaCity(lat, lng) && (row.prefecture !== "静岡県" || row.municipality !== "静岡市")) {
        reasons.push("shizuoka_city_coordinate_label_mismatch");
      }
    }

    if (row.visit_id.startsWith("prod-media-smoke-") || sourcePayloadSource(row.source_payload) === "prod_media_smoke") {
      reasons.push("production_smoke_record_visible");
    }

    if (reasons.length > 0) {
      anomalies.push({
        visitId: row.visit_id,
        observedAt: row.observed_at,
        reasons,
        latitude: lat,
        longitude: lng,
        prefecture: row.prefecture,
        municipality: row.municipality,
        placeName: row.place_name,
      });
    }
  }
  return anomalies;
}

function parseOptions(argv: string[]): AuditOptions {
  const sinceArg = argv.find((arg) => arg.startsWith("--since-days="));
  const limitArg = argv.find((arg) => arg.startsWith("--limit="));
  return {
    sinceDays: Math.max(1, Math.min(365, Number(sinceArg?.slice("--since-days=".length) ?? DEFAULT_SINCE_DAYS))),
    limit: Math.max(1, Math.min(10000, Number(limitArg?.slice("--limit=".length) ?? DEFAULT_LIMIT))),
    notify: argv.includes("--notify"),
    failOnAnomaly: argv.includes("--fail-on-anomaly"),
  };
}

async function fetchAuditRows(options: AuditOptions): Promise<LocationAuditRow[]> {
  const pool = getPool();
  const result = await pool.query<LocationAuditRow>(
    `select
       v.visit_id,
       v.observed_at::text,
       coalesce(v.point_latitude, p.center_latitude)::text as latitude,
       coalesce(v.point_longitude, p.center_longitude)::text as longitude,
       v.point_latitude::text,
       v.point_longitude::text,
       coalesce(v.observed_prefecture, p.prefecture) as prefecture,
       coalesce(v.observed_municipality, p.municipality) as municipality,
       p.canonical_name as place_name,
       coalesce(v.public_visibility, 'public') as public_visibility,
       coalesce(v.quality_review_status, 'accepted') as quality_review_status,
       v.source_kind,
       v.source_payload
     from visits v
     left join places p on p.place_id = v.place_id
     where v.observed_at >= now() - ($1::text || ' days')::interval
       and coalesce(v.public_visibility, 'public') <> 'hidden'
     order by v.observed_at desc
     limit $2`,
    [String(options.sinceDays), options.limit],
  );
  return result.rows;
}

async function notifyWebhook(payload: Record<string, unknown>): Promise<void> {
  const url = process.env.LOCATION_AUDIT_WEBHOOK_URL?.trim();
  if (!url) return;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`location_audit_webhook_failed:${response.status}`);
  }
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const rows = await fetchAuditRows(options);
  const anomalies = detectLocationAnomalies(rows);
  const summary = {
    ok: anomalies.length === 0,
    checked: rows.length,
    anomalyCount: anomalies.length,
    sinceDays: options.sinceDays,
    generatedAt: new Date().toISOString(),
    anomalies,
  };

  console.log(JSON.stringify(summary, null, 2));
  if (anomalies.length > 0 && options.notify) {
    await notifyWebhook({
      source: "ikimon.location_audit",
      severity: "warning",
      text: `ikimon.location_audit detected ${anomalies.length} anomalous observation locations`,
      summary,
    });
  }
  await getPool().end();
  if (anomalies.length > 0 && options.failOnAnomaly) {
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await getPool().end().catch(() => undefined);
    process.exitCode = 1;
  });
}
