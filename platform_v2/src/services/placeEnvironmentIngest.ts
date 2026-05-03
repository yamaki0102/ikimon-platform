import { createHash, randomUUID } from "node:crypto";
import { getPool } from "../db.js";

export type PlaceEnvironmentMetricKind =
  | "impervious_pct"
  | "forest_pct"
  | "water_pct"
  | "cropland_pct"
  | "urban_pct"
  | "ndvi_mean"
  | "ndvi_max"
  | "landuse_class"
  | "elevation_m"
  | "slope_deg";

export type PlaceEnvironmentProvider =
  | "sentinel"
  | "jaxa"
  | "mlit"
  | "planetary_computer"
  | "stac_landuse"
  | "stac_impervious"
  | "manual";

export type PlaceEnvironmentIngestRecord = {
  placeId: string;
  provider: PlaceEnvironmentProvider | string;
  sourceUrl?: string | null;
  observedOn: string;
  validFrom?: string | null;
  tile?: { z?: number | null; x?: number | null; y?: number | null } | null;
  license?: "public-domain" | "cc0" | "cc-by-4.0" | "cc-by-sa-4.0" | "cc-by-nc-4.0" | "gov-jp-open" | "unknown" | string;
  metrics: {
    ndviMean?: number | null;
    ndviMax?: number | null;
    waterPct?: number | null;
    imperviousPct?: number | null;
    forestPct?: number | null;
    croplandPct?: number | null;
    urbanPct?: number | null;
    landuseClass?: string | null;
    elevationM?: number | null;
    slopeDeg?: number | null;
  };
  metadata?: Record<string, unknown> | null;
};

export type NormalizedPlaceEnvironmentMetric = {
  placeId: string;
  metricKind: PlaceEnvironmentMetricKind;
  metricValue: number;
  metricUnit: string;
  observedOn: string;
  validFrom: string;
  tileZ: number | null;
  tileX: number | null;
  tileY: number | null;
  metadata: Record<string, unknown>;
};

export type NormalizedPlaceEnvironmentIngestRecord = {
  sourceKind: "stac_landuse" | "stac_impervious" | "mlit_landuse_mesh" | "planetary_computer" | "other";
  sourceUrl: string;
  license: "public-domain" | "cc0" | "cc-by-4.0" | "cc-by-sa-4.0" | "cc-by-nc-4.0" | "gov-jp-open" | "unknown";
  storagePath: string;
  raw: PlaceEnvironmentIngestRecord;
  metrics: NormalizedPlaceEnvironmentMetric[];
};

export type PlaceEnvironmentIngestResult = {
  sourceSnapshots: number;
  metricRows: number;
  skippedRecords: number;
  dryRun: boolean;
};

type Queryable = {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount?: number | null }>;
};

const LICENSES = new Set(["public-domain", "cc0", "cc-by-4.0", "cc-by-sa-4.0", "cc-by-nc-4.0", "gov-jp-open", "unknown"]);

function dateOnly(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function finiteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pctValue(value: unknown): number | null {
  const n = finiteNumber(value);
  if (n == null) return null;
  return Math.max(0, Math.min(100, n <= 1 ? n * 100 : n));
}

function providerToSourceKind(provider: string, metricKinds: PlaceEnvironmentMetricKind[]): NormalizedPlaceEnvironmentIngestRecord["sourceKind"] {
  const normalized = provider.trim().toLowerCase();
  if (normalized === "mlit") return "mlit_landuse_mesh";
  if (normalized === "jaxa") return "stac_landuse";
  if (normalized === "sentinel" || normalized === "planetary_computer") return "planetary_computer";
  if (normalized === "stac_impervious") return "stac_impervious";
  if (normalized === "stac_landuse") return "stac_landuse";
  if (metricKinds.includes("impervious_pct")) return "stac_impervious";
  if (metricKinds.includes("landuse_class") || metricKinds.includes("forest_pct") || metricKinds.includes("cropland_pct")) return "stac_landuse";
  return "other";
}

function normalizeLicense(value: unknown): NormalizedPlaceEnvironmentIngestRecord["license"] {
  return typeof value === "string" && LICENSES.has(value) ? value as NormalizedPlaceEnvironmentIngestRecord["license"] : "unknown";
}

function pushMetric(
  out: NormalizedPlaceEnvironmentMetric[],
  record: PlaceEnvironmentIngestRecord,
  kind: PlaceEnvironmentMetricKind,
  value: number | null,
  unit: string,
  metadata: Record<string, unknown>,
): void {
  if (value == null) return;
  const observedOn = dateOnly(record.observedOn);
  if (!observedOn) return;
  out.push({
    placeId: record.placeId.trim(),
    metricKind: kind,
    metricValue: value,
    metricUnit: unit,
    observedOn,
    validFrom: dateOnly(record.validFrom) ?? observedOn,
    tileZ: finiteNumber(record.tile?.z) == null ? null : Math.trunc(Number(record.tile?.z)),
    tileX: finiteNumber(record.tile?.x) == null ? null : Math.trunc(Number(record.tile?.x)),
    tileY: finiteNumber(record.tile?.y) == null ? null : Math.trunc(Number(record.tile?.y)),
    metadata,
  });
}

export function normalizePlaceEnvironmentIngestRecord(input: PlaceEnvironmentIngestRecord): NormalizedPlaceEnvironmentIngestRecord | null {
  const placeId = typeof input.placeId === "string" ? input.placeId.trim() : "";
  const observedOn = dateOnly(input.observedOn);
  if (!placeId || !observedOn || !input.metrics || typeof input.metrics !== "object") return null;

  const metrics: NormalizedPlaceEnvironmentMetric[] = [];
  const baseMetadata = input.metadata && typeof input.metadata === "object" ? input.metadata : {};
  pushMetric(metrics, input, "ndvi_mean", finiteNumber(input.metrics.ndviMean), "", baseMetadata);
  pushMetric(metrics, input, "ndvi_max", finiteNumber(input.metrics.ndviMax), "", baseMetadata);
  pushMetric(metrics, input, "water_pct", pctValue(input.metrics.waterPct), "%", baseMetadata);
  pushMetric(metrics, input, "impervious_pct", pctValue(input.metrics.imperviousPct), "%", baseMetadata);
  pushMetric(metrics, input, "forest_pct", pctValue(input.metrics.forestPct), "%", baseMetadata);
  pushMetric(metrics, input, "cropland_pct", pctValue(input.metrics.croplandPct), "%", baseMetadata);
  pushMetric(metrics, input, "urban_pct", pctValue(input.metrics.urbanPct), "%", baseMetadata);
  pushMetric(metrics, input, "elevation_m", finiteNumber(input.metrics.elevationM), "m", baseMetadata);
  pushMetric(metrics, input, "slope_deg", finiteNumber(input.metrics.slopeDeg), "deg", baseMetadata);
  const landuseClass = typeof input.metrics.landuseClass === "string" ? input.metrics.landuseClass.trim() : "";
  if (landuseClass) {
    pushMetric(metrics, input, "landuse_class", 1, "", { ...baseMetadata, class: landuseClass });
  }
  if (metrics.length === 0) return null;
  const sourceKind = providerToSourceKind(String(input.provider ?? ""), metrics.map((item) => item.metricKind));
  const sourceUrl = typeof input.sourceUrl === "string" && input.sourceUrl.trim()
    ? input.sourceUrl.trim()
    : `ikimon://place-environment/${sourceKind}/${placeId}/${observedOn}`;
  return {
    sourceKind,
    sourceUrl,
    license: normalizeLicense(input.license),
    storagePath: `place_environment/${sourceKind}/${createHash("sha256").update(`${sourceUrl}:${observedOn}`).digest("hex")}.json`,
    raw: input,
    metrics,
  };
}

async function upsertSourceSnapshot(queryable: Queryable, normalized: NormalizedPlaceEnvironmentIngestRecord, curatorRunId: string | null): Promise<string> {
  const raw = JSON.stringify(normalized.raw);
  const hash = createHash("sha256").update(raw).digest("hex");
  const result = await queryable.query<{ snapshot_id: string }>(
    `with inserted as (
       insert into source_snapshots (
         snapshot_id, source_kind, source_url, fetched_at, content_sha256, content_bytes,
         storage_backend, storage_path, license, curator_run_id, notes
       ) values (
         $1::uuid, $2, $3, now(), $4, $5,
         'local_disk', $6, $7, $8::uuid, $9::jsonb
       )
       on conflict (source_kind, content_sha256) do nothing
       returning snapshot_id
     )
     select snapshot_id from inserted
     union all
     select snapshot_id from source_snapshots where source_kind = $2 and content_sha256 = $4
     limit 1`,
    [
      randomUUID(),
      normalized.sourceKind,
      normalized.sourceUrl,
      hash,
      Buffer.byteLength(raw, "utf8"),
      normalized.storagePath,
      normalized.license,
      curatorRunId,
      JSON.stringify({ provider: normalized.raw.provider, place_id: normalized.raw.placeId }),
    ],
  );
  const snapshotId = result.rows[0]?.snapshot_id;
  if (!snapshotId) throw new Error("source_snapshot_insert_failed");
  return snapshotId;
}

async function insertMetric(queryable: Queryable, metric: NormalizedPlaceEnvironmentMetric, sourceSnapshotId: string, curatorRunId: string | null): Promise<boolean> {
  const existing = await queryable.query<{ snapshot_id: string }>(
    `select snapshot_id
       from place_environment_snapshots
      where place_id = $1
        and metric_kind = $2
        and observed_on = $3::date
        and source_snapshot_id = $4::uuid
      limit 1`,
    [metric.placeId, metric.metricKind, metric.observedOn, sourceSnapshotId],
  );
  if (existing.rows[0]) return false;
  await queryable.query(
    `update place_environment_snapshots
        set valid_to = $3::date
      where place_id = $1
        and metric_kind = $2
        and valid_to is null
        and valid_from < $3::date`,
    [metric.placeId, metric.metricKind, metric.validFrom],
  );
  await queryable.query(
    `insert into place_environment_snapshots (
       snapshot_id, place_id, metric_kind, metric_value, metric_unit,
       tile_z, tile_x, tile_y, observed_on, source_snapshot_id,
       valid_from, valid_to, curator_run_id, metadata, created_at
     ) values (
       $1::uuid, $2, $3, $4, $5,
       $6, $7, $8, $9::date, $10::uuid,
       $11::date, null, $12::uuid, $13::jsonb, now()
     )`,
    [
      randomUUID(),
      metric.placeId,
      metric.metricKind,
      metric.metricValue,
      metric.metricUnit,
      metric.tileZ,
      metric.tileX,
      metric.tileY,
      metric.observedOn,
      sourceSnapshotId,
      metric.validFrom,
      curatorRunId,
      JSON.stringify(metric.metadata),
    ],
  );
  return true;
}

export async function ingestPlaceEnvironmentRecords(
  records: PlaceEnvironmentIngestRecord[],
  options: { dryRun?: boolean; curatorRunId?: string | null; queryable?: Queryable } = {},
): Promise<PlaceEnvironmentIngestResult> {
  const queryable: Queryable | null = options.dryRun ? null : (options.queryable ?? getPool() as unknown as Queryable);
  let sourceSnapshots = 0;
  let metricRows = 0;
  let skippedRecords = 0;
  for (const record of records) {
    const normalized = normalizePlaceEnvironmentIngestRecord(record);
    if (!normalized) {
      skippedRecords += 1;
      continue;
    }
    if (options.dryRun) {
      sourceSnapshots += 1;
      metricRows += normalized.metrics.length;
      continue;
    }
    const sourceSnapshotId = await upsertSourceSnapshot(queryable!, normalized, options.curatorRunId ?? null);
    sourceSnapshots += 1;
    for (const metric of normalized.metrics) {
      if (await insertMetric(queryable!, metric, sourceSnapshotId, options.curatorRunId ?? null)) {
        metricRows += 1;
      }
    }
  }
  return { sourceSnapshots, metricRows, skippedRecords, dryRun: Boolean(options.dryRun) };
}
