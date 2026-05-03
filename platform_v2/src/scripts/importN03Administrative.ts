/**
 * Import KSJ N03 (国土数値情報 行政区域) GeoJSON into observation_fields.
 *
 * - 都道府県境界 → source='user_defined', admin_level='admin_prefecture'
 * - 市町村境界   → source='user_defined', admin_level='admin_municipality'
 * - 国 (JP)     → source='user_defined', admin_level='admin_country' は別途 1 件挿入 (--include-country)
 *
 * 100年スパン耐性:
 *   - entity_key = `n03:<行政区域コード5桁>`
 *   - 現行版 (valid_to IS NULL) があれば、publish_date の前日で valid_to を閉じ、
 *     新版を valid_from = publish_date で挿入 → 平成大合併・市町村再編にも追従。
 *
 * Usage:
 *   npx tsx src/scripts/importN03Administrative.ts \
 *     --geojson ./data/N03-2025.geojson \
 *     --publish-date 2025-04-01 \
 *     [--include-country] [--dry-run] [--limit 200]
 */

import { readFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createRequire } from "node:module";
import { getPool } from "../db.js";
import { computeBbox } from "../services/geoJsonBbox.js";

// stream-json is CJS. For the GeoJSON shape we want
// `chain([parser, pick({filter:'features'}), streamArray()])` to emit one
// feature at a time. Use createRequire for runtime + cast to keep tsc quiet.
const require_ = createRequire(import.meta.url);
const { chain } = require_("stream-chain") as { chain: (links: unknown[]) => NodeJS.ReadWriteStream };
const { parser } = require_("stream-json") as { parser: () => unknown };
const { streamArray } = require_("stream-json/streamers/stream-array") as { streamArray: () => unknown };
const { pick } = require_("stream-json/filters/pick") as { pick: (opts: { filter: string }) => unknown };

type Options = {
  geojsonPath: string;
  publishDate: string;
  includeCountry: boolean;
  dryRun: boolean;
  limit: number | null;
  /** Stream the GeoJSON instead of JSON.parse() — required for the 531MB
   *  nationwide N03 file. */
  stream: boolean;
  /** When streaming, commit every N upserts to keep transactions short. */
  batchSize: number;
};

type N03Feature = {
  type: "Feature";
  properties: {
    N03_001?: string; // 都道府県名
    N03_003?: string; // 郡・政令市名
    N03_004?: string; // 市区町村名
    N03_007?: string; // 行政区域コード
  };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: unknown;
  } | null;
};

type N03Collection = {
  type: "FeatureCollection";
  features: N03Feature[];
};

function parseArgs(argv: string[]): Options {
  const options: Options = {
    geojsonPath: "",
    publishDate: new Date().toISOString().slice(0, 10),
    includeCountry: false,
    dryRun: false,
    limit: null,
    stream: false,
    batchSize: 500,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--geojson" && argv[i + 1]) { options.geojsonPath = argv[i + 1]!; i += 1; }
    else if (arg === "--publish-date" && argv[i + 1]) { options.publishDate = argv[i + 1]!; i += 1; }
    else if (arg === "--include-country") { options.includeCountry = true; }
    else if (arg === "--dry-run") { options.dryRun = true; }
    else if (arg === "--stream") { options.stream = true; }
    else if (arg === "--batch-size" && argv[i + 1]) {
      const n = Number.parseInt(argv[i + 1] ?? "", 10);
      if (Number.isFinite(n) && n > 0) options.batchSize = n;
      i += 1;
    }
    else if (arg === "--limit" && argv[i + 1]) {
      const n = Number.parseInt(argv[i + 1] ?? "", 10);
      if (Number.isFinite(n) && n > 0) options.limit = n;
      i += 1;
    }
  }
  if (!options.geojsonPath) {
    throw new Error("Required: --geojson <path>");
  }
  return options;
}

function safeStr(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function centroidOfBbox(bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number }) {
  return {
    lat: (bbox.minLat + bbox.maxLat) / 2,
    lng: (bbox.minLng + bbox.maxLng) / 2,
  };
}

interface UpsertJob {
  entityKey: string;
  source: "admin_municipality" | "admin_prefecture" | "admin_country";
  adminLevel: "admin_municipality" | "admin_prefecture" | "admin_country";
  name: string;
  prefecture: string;
  city: string;
  certificationId: string;
  polygon: Record<string, unknown>;
  centerLat: number;
  centerLng: number;
  bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number };
}

function buildJobsForFeature(feature: N03Feature): UpsertJob[] {
  if (!feature.geometry) return [];
  const polygon = { type: feature.geometry.type, coordinates: feature.geometry.coordinates };
  const bbox = computeBbox(polygon);
  if (!bbox) return [];
  const center = centroidOfBbox(bbox);
  const code = safeStr(feature.properties?.N03_007);
  const pref = safeStr(feature.properties?.N03_001);
  const city = safeStr(feature.properties?.N03_004) || safeStr(feature.properties?.N03_003);

  const jobs: UpsertJob[] = [];
  if (code && city) {
    jobs.push({
      entityKey: `n03:${code}`,
      source: "admin_municipality",
      adminLevel: "admin_municipality",
      name: `${pref} ${city}`.trim(),
      prefecture: pref,
      city,
      certificationId: `n03:${code}`,
      polygon,
      centerLat: center.lat,
      centerLng: center.lng,
      bbox,
    });
  }
  return jobs;
}

async function applyJob(client: Awaited<ReturnType<ReturnType<typeof getPool>["connect"]>>, job: UpsertJob, publishDate: string): Promise<"inserted" | "superseded" | "skipped_same"> {
  // Look up the current version for this entity_key.
  const cur = await client.query<{ field_id: string; valid_from: string; polygon: Record<string, unknown> | null }>(
    `SELECT field_id, valid_from::text AS valid_from, polygon
       FROM observation_fields
      WHERE entity_key = $1 AND valid_to IS NULL
      LIMIT 1`,
    [job.entityKey],
  );
  const existing = cur.rows[0];
  if (existing) {
    // Same publish_date → re-import is a no-op.
    if (existing.valid_from === publishDate) return "skipped_same";
    // Otherwise close the old version and start a new one.
    const closedAt = new Date(publishDate);
    closedAt.setUTCDate(closedAt.getUTCDate() - 1);
    const closeDate = closedAt.toISOString().slice(0, 10);
    await client.query(
      `UPDATE observation_fields SET valid_to = $2, updated_at = NOW() WHERE field_id = $1`,
      [existing.field_id, closeDate],
    );
  }
  await client.query(
    `INSERT INTO observation_fields (
        source, name, prefecture, city, lat, lng, radius_m,
        polygon, area_ha,
        certification_id, payload,
        bbox_min_lat, bbox_max_lat, bbox_min_lng, bbox_max_lng,
        admin_level, entity_key, valid_from
     ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8::jsonb, NULL,
        $9, '{}'::jsonb,
        $10, $11, $12, $13,
        $14, $15, $16
     )
     ON CONFLICT (source, certification_id) WHERE certification_id <> ''
     DO UPDATE SET updated_at = NOW()`,
    [
      "user_defined",
      job.name,
      job.prefecture,
      job.city,
      job.centerLat,
      job.centerLng,
      Math.round(Math.max(50, Math.min(200000, distanceKm(job.bbox) * 1000))),
      JSON.stringify(job.polygon),
      job.certificationId,
      job.bbox.minLat,
      job.bbox.maxLat,
      job.bbox.minLng,
      job.bbox.maxLng,
      job.adminLevel,
      job.entityKey,
      publishDate,
    ],
  );
  // If we superseded an old version, link it forward.
  if (existing) {
    await client.query(
      `UPDATE observation_fields SET superseded_by = (
          SELECT field_id FROM observation_fields
           WHERE entity_key = $1 AND valid_to IS NULL
           LIMIT 1
        )
       WHERE field_id = $2`,
      [job.entityKey, existing.field_id],
    );
  }
  return existing ? "superseded" : "inserted";
}

async function flushAreaCacheRemote(): Promise<void> {
  const key = process.env.V2_PRIVILEGED_WRITE_API_KEY;
  if (!key) return;
  const ports = (process.env.V2_FLUSH_PORTS ?? "3201,3202,3200").split(",").map((p) => p.trim()).filter(Boolean);
  for (const port of ports) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/v1/internal/flush-area-cache`, {
        method: "POST",
        headers: { "X-V2-Privileged-Write-Api-Key": key },
      });
      if (r.ok) console.log(`[importN03] flushed cache on :${port}`);
    } catch { /* best-effort */ }
  }
}

function distanceKm(bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number }): number {
  // Rough diagonal in km — used only as a `radius_m` placeholder for legacy
  // nearest-neighbour queries (the polygon is the source of truth).
  const dLat = (bbox.maxLat - bbox.minLat) * 111;
  const dLng = (bbox.maxLng - bbox.minLng) * 111 * Math.cos((bbox.minLat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng) / 2;
}

async function collectJobsBuffered(options: Options): Promise<UpsertJob[]> {
  const text = await readFile(options.geojsonPath, "utf-8");
  const collection = JSON.parse(text) as N03Collection;
  if (!collection || collection.type !== "FeatureCollection" || !Array.isArray(collection.features)) {
    throw new Error("Not a GeoJSON FeatureCollection");
  }
  const out: UpsertJob[] = [];
  for (const feature of collection.features) {
    out.push(...buildJobsForFeature(feature));
    if (options.limit && out.length >= options.limit) break;
  }
  return out;
}

async function streamFeatures(geojsonPath: string, onFeature: (f: N03Feature) => Promise<void>): Promise<void> {
  // GeoJSON FeatureCollection root is { type, features: [...] }; pick filter
  // narrows the parse stream to just the features array, StreamArray emits one
  // feature at a time so the heap stays bounded even for the 531MB file.
  await new Promise<void>((resolve, reject) => {
    const pipeline = chain([
      createReadStream(geojsonPath, { highWaterMark: 1 << 20 }),
      parser(),
      pick({ filter: "features" }),
      streamArray(),
    ]) as unknown as NodeJS.ReadableStream & { pause: () => void; resume: () => void; destroy: (err?: Error) => void };
    pipeline.on("data", (data: { key: number; value: N03Feature }) => {
      pipeline.pause();
      onFeature(data.value).then(() => pipeline.resume(), (err: unknown) => {
        pipeline.destroy(err as Error);
      });
    });
    pipeline.on("end", () => resolve());
    pipeline.on("error", (err: unknown) => reject(err));
  });
}

async function runStreamingImport(options: Options): Promise<{ inserted: number; superseded: number; skipped: number }> {
  const pool = getPool();
  let inserted = 0, superseded = 0, skipped = 0, processed = 0;
  let client = await pool.connect();
  await client.query("BEGIN");
  try {
    await streamFeatures(options.geojsonPath, async (feature) => {
      if (options.limit && processed >= options.limit) return;
      const jobs = buildJobsForFeature(feature);
      for (const job of jobs) {
        const result = await applyJob(client, job, options.publishDate);
        if (result === "inserted") inserted += 1;
        else if (result === "superseded") superseded += 1;
        else skipped += 1;
        processed += 1;
        // Cycle the transaction every batchSize so one fault doesn't lose
        // hours of work and Postgres doesn't accumulate long-running tx.
        if (processed % options.batchSize === 0) {
          await client.query("COMMIT");
          client.release();
          client = await pool.connect();
          await client.query("BEGIN");
          if (processed % (options.batchSize * 4) === 0) {
            console.log(`[importN03/stream] processed=${processed} inserted=${inserted} superseded=${superseded}`);
          }
        }
      }
    });
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  return { inserted, superseded, skipped };
}

async function main() {
  const options = parseArgs(process.argv);
  console.log(`[importN03] reading ${options.geojsonPath} stream=${options.stream} dryRun=${options.dryRun}`);

  if (options.stream && !options.dryRun) {
    const out = await runStreamingImport(options);
    console.log(`[importN03/stream] done inserted=${out.inserted} superseded=${out.superseded} skipped=${out.skipped}`);
    await flushAreaCacheRemote();
    await getPool().end();
    return;
  }

  const allJobs = await collectJobsBuffered(options);
  // Add the country-level placeholder once if asked.
  if (options.includeCountry && allJobs.length > 0) {
    const overall = allJobs.reduce(
      (acc, j) => ({
        minLat: Math.min(acc.minLat, j.bbox.minLat),
        maxLat: Math.max(acc.maxLat, j.bbox.maxLat),
        minLng: Math.min(acc.minLng, j.bbox.minLng),
        maxLng: Math.max(acc.maxLng, j.bbox.maxLng),
      }),
      { minLat: 90, maxLat: -90, minLng: 180, maxLng: -180 },
    );
    const center = centroidOfBbox(overall);
    allJobs.push({
      entityKey: "n03:JP",
      source: "admin_country",
      adminLevel: "admin_country",
      name: "日本",
      prefecture: "",
      city: "",
      certificationId: "n03:JP",
      polygon: {
        type: "Polygon",
        coordinates: [[
          [overall.minLng, overall.minLat],
          [overall.maxLng, overall.minLat],
          [overall.maxLng, overall.maxLat],
          [overall.minLng, overall.maxLat],
          [overall.minLng, overall.minLat],
        ]],
      },
      centerLat: center.lat,
      centerLng: center.lng,
      bbox: overall,
    });
  }

  console.log(`[importN03] candidate jobs=${allJobs.length} dryRun=${options.dryRun} publishDate=${options.publishDate}`);

  if (options.dryRun) {
    for (const j of allJobs.slice(0, 5)) console.log(`  ${j.entityKey} ${j.name}`);
    console.log(`  ... (showing first 5 only)`);
    return;
  }

  const pool = getPool();
  const client = await pool.connect();
  let inserted = 0, superseded = 0, skipped = 0;
  try {
    await client.query("BEGIN");
    for (const job of allJobs) {
      const result = await applyJob(client, job, options.publishDate);
      if (result === "inserted") inserted += 1;
      else if (result === "superseded") superseded += 1;
      else skipped += 1;
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  console.log(`[importN03] done inserted=${inserted} superseded=${superseded} skipped=${skipped}`);
  await pool.end();
}

main().catch((err) => {
  console.error("[importN03] failed", err);
  process.exit(1);
});
