/**
 * Versioned writer for `place_environment_snapshots` (migration 0054).
 *
 * Every nightly worker run creates an immutable `source_snapshots` row first
 * (with the STAC item URL + sha256 + license), then opens a new
 * `place_environment_snapshots` version per metric_kind, closing the previous
 * current row by setting valid_to = today and pointing superseded_by → new row.
 *
 * Conservative defaults:
 *   - DB transactions wrap each (source_snapshot + N metric versions) tuple
 *   - On any constraint failure the worker logs and continues with the next place
 *   - Same-day re-runs are no-ops (skipped via valid_from match)
 */
import { createHash } from "node:crypto";
import { getPool } from "../db.js";
import type { PoolClient } from "pg";

export type EnvironmentMetricKind =
  | "ndvi_mean"
  | "ndvi_max"
  | "water_pct"
  | "forest_pct"
  | "impervious_pct"
  | "urban_pct"
  | "cropland_pct"
  | "landuse_class";

export interface EnvironmentMetric {
  kind: EnvironmentMetricKind;
  value: number;
  unit?: string;
  metadata?: Record<string, unknown>;
}

export interface SourceArtifact {
  sourceKind: string;            // 'planetary_computer' / 'mlit_landuse_mesh' / etc.
  sourceUrl: string;             // STAC item self link
  contentBytes: number;
  license: string;
  storagePath?: string;          // where the raw artifact lives on disk / S3
  notes?: Record<string, unknown>;
}

export interface SnapshotWriteInput {
  placeId: string;
  observedOn: string;             // YYYY-MM-DD of the satellite scene
  artifact: SourceArtifact;
  metrics: EnvironmentMetric[];
  tile?: { z: number; x: number; y: number } | null;
}

function shaForArtifact(art: SourceArtifact): string {
  return createHash("sha256")
    .update(art.sourceKind)
    .update("\0")
    .update(art.sourceUrl)
    .update("\0")
    .update(String(art.contentBytes))
    .digest("hex");
}

async function upsertSourceSnapshot(client: PoolClient, art: SourceArtifact): Promise<string> {
  const sha = shaForArtifact(art);
  // (source_kind, content_sha256) is unique — re-using existing snapshot rows
  // when the same scene appears twice in one run keeps the table append-only
  // without producing N duplicate rows.
  const existing = await client.query<{ snapshot_id: string }>(
    `SELECT snapshot_id FROM source_snapshots
      WHERE source_kind = $1 AND content_sha256 = $2 LIMIT 1`,
    [art.sourceKind, sha],
  );
  if (existing.rows[0]) return existing.rows[0].snapshot_id;
  const inserted = await client.query<{ snapshot_id: string }>(
    `INSERT INTO source_snapshots (
        source_kind, source_url, content_sha256, content_bytes,
        storage_backend, storage_path, license, notes
     ) VALUES ($1, $2, $3, $4, 'local_disk', $5, $6, $7::jsonb)
     RETURNING snapshot_id`,
    [
      art.sourceKind,
      art.sourceUrl,
      sha,
      art.contentBytes,
      art.storagePath ?? `inline://stac/${sha.slice(0, 12)}`,
      art.license,
      JSON.stringify(art.notes ?? {}),
    ],
  );
  return inserted.rows[0]!.snapshot_id;
}

async function closeCurrentVersion(
  client: PoolClient,
  placeId: string,
  metricKind: EnvironmentMetricKind,
  closeOn: string,
): Promise<string | null> {
  const cur = await client.query<{ snapshot_id: string; valid_from: string }>(
    `SELECT snapshot_id, valid_from::text AS valid_from
       FROM place_environment_snapshots
      WHERE place_id = $1 AND metric_kind = $2 AND valid_to IS NULL
      LIMIT 1`,
    [placeId, metricKind],
  );
  const row = cur.rows[0];
  if (!row) return null;
  // Same-day re-run is a no-op; caller should bail out before rewriting.
  if (row.valid_from === closeOn) return "__same_day__";
  await client.query(
    `UPDATE place_environment_snapshots
        SET valid_to = $2
      WHERE snapshot_id = $1`,
    [row.snapshot_id, closeOn],
  );
  return row.snapshot_id;
}

export async function writePlaceEnvironmentSnapshot(input: SnapshotWriteInput): Promise<{
  inserted: number;
  superseded: number;
  skipped: number;
}> {
  let inserted = 0, superseded = 0, skipped = 0;
  if (!input.placeId || !input.metrics.length) return { inserted, superseded, skipped };
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const sourceSnapshotId = await upsertSourceSnapshot(client, input.artifact);

    for (const metric of input.metrics) {
      const closed = await closeCurrentVersion(client, input.placeId, metric.kind, input.observedOn);
      if (closed === "__same_day__") {
        skipped += 1;
        continue;
      }
      const insRes = await client.query<{ snapshot_id: string }>(
        `INSERT INTO place_environment_snapshots (
            place_id, metric_kind, metric_value, metric_unit,
            tile_z, tile_x, tile_y, observed_on,
            source_snapshot_id, valid_from, metadata
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
         RETURNING snapshot_id`,
        [
          input.placeId,
          metric.kind,
          metric.value,
          metric.unit ?? "",
          input.tile?.z ?? null,
          input.tile?.x ?? null,
          input.tile?.y ?? null,
          input.observedOn,
          sourceSnapshotId,
          input.observedOn,
          JSON.stringify(metric.metadata ?? {}),
        ],
      );
      if (closed) {
        superseded += 1;
        await client.query(
          `UPDATE place_environment_snapshots
              SET superseded_by = $2
            WHERE snapshot_id = $1`,
          [closed, insRes.rows[0]!.snapshot_id],
        );
      } else {
        inserted += 1;
      }
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  return { inserted, superseded, skipped };
}

export const __test__ = { shaForArtifact };
