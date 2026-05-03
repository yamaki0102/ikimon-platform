/**
 * Nightly Sentinel-2 environment worker (Phase 3-1 骨組み).
 *
 * Iterates over `places` rows that have a centre lat/lng, asks MPC for the most
 * recent low-cloud Sentinel-2 scene, and records the artifact + (placeholder)
 * NDVI metric into `source_snapshots` + `place_environment_snapshots`. The
 * scene-level metric values themselves are stored as null until the raster
 * reduce step (Phase 3-1b) lands; the data lineage record is what unblocks the
 * downstream area-snapshot environmentChange field today.
 *
 * Usage:
 *   DATABASE_URL=… node --max-old-space-size=2048 \
 *     ./node_modules/.bin/tsx src/scripts/runSentinelEnvironmentWorker.ts \
 *     [--limit 200] [--prefecture 静岡県] [--days-back 30] [--dry-run]
 *
 * Disable entirely (e.g. dev box without internet): MPC_DISABLED=1
 */
import { getPool } from "../db.js";
import { fetchSentinelSceneForPoint } from "../services/sentinelStatistics.js";
import { writePlaceEnvironmentSnapshot } from "../services/environmentSnapshotWriter.js";

interface Options {
  limit: number;
  prefecture: string | null;
  daysBack: number;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = { limit: 200, prefecture: null, daysBack: 30, dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--limit" && argv[i + 1]) { opts.limit = Number(argv[i + 1]) || opts.limit; i += 1; }
    else if (a === "--prefecture" && argv[i + 1]) { opts.prefecture = argv[i + 1] ?? null; i += 1; }
    else if (a === "--days-back" && argv[i + 1]) { opts.daysBack = Number(argv[i + 1]) || opts.daysBack; i += 1; }
    else if (a === "--dry-run") { opts.dryRun = true; }
  }
  return opts;
}

async function listTargetPlaces(opts: Options): Promise<Array<{ placeId: string; lat: number; lng: number; radiusM: number }>> {
  const pool = getPool();
  const params: unknown[] = [];
  let where = "p.center_latitude IS NOT NULL AND p.center_longitude IS NOT NULL";
  if (opts.prefecture) {
    params.push(opts.prefecture);
    where += ` AND COALESCE(p.prefecture, '') = $${params.length}`;
  }
  params.push(opts.limit);
  const result = await pool.query<{
    place_id: string;
    center_latitude: string;
    center_longitude: string;
  }>(
    `SELECT place_id,
            center_latitude::text AS center_latitude,
            center_longitude::text AS center_longitude
       FROM places p
      WHERE ${where}
      ORDER BY p.updated_at DESC NULLS LAST
      LIMIT $${params.length}`,
    params,
  );
  return result.rows.map((row) => ({
    placeId: row.place_id,
    lat: Number(row.center_latitude),
    lng: Number(row.center_longitude),
    // Default search radius — small enough to land on a single Sentinel scene,
    // large enough to ensure the bbox isn't degenerate.
    radiusM: 500,
  }));
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv);
  if (process.env.MPC_DISABLED === "1") {
    console.log("[sentinelWorker] MPC_DISABLED=1 → no-op");
    return;
  }
  const targets = await listTargetPlaces(opts);
  console.log(`[sentinelWorker] candidates=${targets.length} dryRun=${opts.dryRun} daysBack=${opts.daysBack}`);
  if (opts.dryRun) {
    for (const t of targets.slice(0, 5)) console.log(`  ${t.placeId} ${t.lat},${t.lng}`);
    return;
  }

  let ok = 0, miss = 0, errs = 0;
  for (const t of targets) {
    try {
      const scene = await fetchSentinelSceneForPoint(t.lat, t.lng, t.radiusM, { daysBack: opts.daysBack });
      if (!scene) { miss += 1; continue; }
      // Build the metric set out of whatever Statistics API returned. NDVI
      // typically lands in [-1, +1]; NDWI same. Skip metrics whose stats came
      // back null (e.g. all-cloud window) so we don't pollute the timeline.
      const metrics: Array<{ kind: "ndvi_mean" | "ndvi_max" | "water_pct"; value: number; unit: string; metadata: Record<string, unknown> }> = [];
      if (typeof scene.ndviMean === "number") {
        metrics.push({ kind: "ndvi_mean", value: scene.ndviMean, unit: "index", metadata: { item_id: scene.itemId, cloud_pct: scene.cloudPct } });
      }
      if (typeof scene.ndviMax === "number") {
        metrics.push({ kind: "ndvi_max", value: scene.ndviMax, unit: "index", metadata: { item_id: scene.itemId, cloud_pct: scene.cloudPct } });
      }
      // NDWI > 0 ≈ water; map mean to a coarse water_pct proxy.
      if (typeof scene.ndwiMean === "number") {
        const waterPct = Math.max(0, Math.min(100, Math.round(((scene.ndwiMean + 1) / 2) * 100)));
        metrics.push({ kind: "water_pct", value: waterPct, unit: "%", metadata: { ndwi_mean: scene.ndwiMean, item_id: scene.itemId } });
      }
      if (metrics.length === 0) {
        // Lineage row only — keep an ndvi_mean=0 placeholder marked pending so the
        // year-bucket timeline still shows the scene was attempted.
        metrics.push({ kind: "ndvi_mean", value: 0, unit: "index", metadata: { pending_stats: true, item_id: scene.itemId } });
      }
      await writePlaceEnvironmentSnapshot({
        placeId: t.placeId,
        observedOn: scene.observedOn,
        artifact: {
          sourceKind: "planetary_computer",
          sourceUrl: scene.sourceUrl,
          contentBytes: Math.max(1, scene.rawAssetHref.length),
          license: "CC-BY-4.0 (Sentinel-2 / Copernicus)",
          notes: { item_id: scene.itemId, asset_href: scene.rawAssetHref, cloud_pct: scene.cloudPct },
        },
        metrics,
      });
      ok += 1;
    } catch (err) {
      errs += 1;
      console.warn(`[sentinelWorker] place ${t.placeId} failed`, (err as Error)?.message ?? err);
    }
    // Be polite — MPC publishes no rate limit but we throttle anyway.
    await new Promise((r) => setTimeout(r, 250));
  }
  console.log(`[sentinelWorker] done ok=${ok} miss=${miss} errs=${errs}`);
  await getPool().end();
}

main().catch((err) => {
  console.error("[sentinelWorker] fatal", err);
  process.exit(1);
});
