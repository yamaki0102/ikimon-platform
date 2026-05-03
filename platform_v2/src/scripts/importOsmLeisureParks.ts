/**
 * Import local parks from OpenStreetMap (Overpass API) into observation_fields.
 *
 * Targets the small / municipal park layer that KSJ does NOT cover (e.g. 西伊場第1公園).
 *
 *   leisure=park
 *   leisure=nature_reserve
 *   boundary=national_park    ← national parks too, KSJ has them but OSM is more current
 *
 * 100年スパン耐性:
 *   - entity_key = `osm:way:<id>` / `osm:relation:<id>`
 *   - 公園が廃止 (= OSM から消えた) ことを検出するには、import 時に存在しなかった
 *     entity_key の現行版を valid_to で閉じる sweep モード (--sweep) を併用する。
 *   - 公園が工場に変わった場合: OSM 側で `leisure=park` が消えれば import 対象外になる
 *     → 次回 sweep で valid_to が立つ。
 *
 * Usage:
 *   npx tsx src/scripts/importOsmLeisureParks.ts \
 *     --bbox 34.6,137.6,34.85,137.91 \
 *     [--source-url https://overpass-api.de/api/interpreter] \
 *     [--delay-ms 1500] [--dry-run] [--sweep] [--limit 1000]
 *
 *   --bbox は south,west,north,east 順 (Overpass の流儀)。
 *   --sweep は import で見つからなかった既存 osm:way:* の現行版を valid_to で閉じる。
 */

import { getPool } from "../db.js";
import { computeBbox } from "../services/geoJsonBbox.js";

type Options = {
  bbox: [number, number, number, number];
  sourceUrl: string;
  delayMs: number;
  dryRun: boolean;
  sweep: boolean;
  limit: number | null;
};

type OverpassElement = {
  type: "way" | "relation" | "node";
  id: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
  members?: Array<{ type: string; ref: number; role: string; geometry?: Array<{ lat: number; lon: number }> }>;
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
};

type OverpassResponse = {
  elements: OverpassElement[];
};

function parseArgs(argv: string[]): Options {
  const options: Options = {
    bbox: [0, 0, 0, 0],
    sourceUrl: process.env.OVERPASS_API_URL ?? "https://overpass-api.de/api/interpreter",
    delayMs: 1500,
    dryRun: false,
    sweep: false,
    limit: null,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--bbox" && argv[i + 1]) {
      const parts = argv[i + 1]!.split(",").map((s) => Number(s.trim()));
      if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
        options.bbox = parts as [number, number, number, number];
      }
      i += 1;
    } else if (arg === "--source-url" && argv[i + 1]) { options.sourceUrl = argv[i + 1]!; i += 1; }
    else if (arg === "--delay-ms" && argv[i + 1]) { options.delayMs = Number(argv[i + 1]); i += 1; }
    else if (arg === "--dry-run") { options.dryRun = true; }
    else if (arg === "--sweep") { options.sweep = true; }
    else if (arg === "--limit" && argv[i + 1]) {
      const n = Number.parseInt(argv[i + 1] ?? "", 10);
      if (Number.isFinite(n) && n > 0) options.limit = n;
      i += 1;
    }
  }
  if (options.bbox[0] === 0 && options.bbox[1] === 0 && options.bbox[2] === 0 && options.bbox[3] === 0) {
    throw new Error("Required: --bbox south,west,north,east");
  }
  return options;
}

function buildQuery(bbox: [number, number, number, number]): string {
  const [s, w, n, e] = bbox;
  const bb = `${s},${w},${n},${e}`;
  return `
    [out:json][timeout:60];
    (
      way["leisure"="park"](${bb});
      way["leisure"="nature_reserve"](${bb});
      relation["leisure"="park"](${bb});
      relation["leisure"="nature_reserve"](${bb});
      relation["boundary"="national_park"](${bb});
    );
    out geom;
  `;
}

const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

/**
 * After a successful import, hit each blue/green API port to clear the
 * in-memory area-polygons cache so the next /ja/map render shows the new
 * polygons without waiting on the 60s TTL. Skips silently if no key set.
 */
async function flushAreaPolygonCacheRemote(): Promise<void> {
  const key = process.env.V2_PRIVILEGED_WRITE_API_KEY;
  if (!key) return;
  const ports = (process.env.V2_FLUSH_PORTS ?? "3201,3202,3200").split(",").map((p) => p.trim()).filter(Boolean);
  for (const port of ports) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/v1/internal/flush-area-cache`, {
        method: "POST",
        headers: { "X-V2-Privileged-Write-Api-Key": key },
      });
      if (r.ok) console.log(`[importOsmParks] flushed cache on :${port}`);
    } catch {
      // Best-effort; the cache will expire on its own.
    }
  }
}

async function fetchOverpassOnce(url: string, query: string): Promise<OverpassResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
      "User-Agent": "ikimon.life-importer (https://ikimon.life - contact: yamaki0102@gmail.com)",
    },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Overpass HTTP ${response.status}: ${body.slice(0, 240)}`);
  }
  return (await response.json()) as OverpassResponse;
}

/**
 * Try each mirror in turn with exponential backoff. overpass-api.de gives
 * intermittent 504/429 under load; falling through to kumi/openstreetmap.ru
 * recovers without manual intervention.
 */
async function fetchOverpass(primaryUrl: string, query: string): Promise<OverpassResponse> {
  // Build mirror list: explicit primaryUrl first, then the well-known mirrors
  // (deduped). This keeps `--source-url` intact when callers pass one.
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const u of [primaryUrl, ...OVERPASS_MIRRORS]) {
    if (!seen.has(u)) { candidates.push(u); seen.add(u); }
  }
  let lastErr: unknown = null;
  for (let i = 0; i < candidates.length; i += 1) {
    const url = candidates[i]!;
    try {
      return await fetchOverpassOnce(url, query);
    } catch (err) {
      lastErr = err;
      console.warn(`[importOsmParks] mirror ${i + 1}/${candidates.length} failed (${url}): ${(err as Error).message}`);
      if (i + 1 < candidates.length) {
        const backoffMs = 2_000 * (i + 1);
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }
  }
  throw new Error(`All Overpass mirrors failed; last: ${(lastErr as Error)?.message ?? lastErr}`);
}

function elementToPolygon(element: OverpassElement): Record<string, unknown> | null {
  if (element.type === "way" && Array.isArray(element.geometry) && element.geometry.length >= 3) {
    const ring = element.geometry.map((p) => [p.lon, p.lat]);
    // Close ring if not already.
    const first = ring[0]!;
    const last = ring[ring.length - 1]!;
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0]!, first[1]!]);
    return { type: "Polygon", coordinates: [ring] };
  }
  if (element.type === "relation" && Array.isArray(element.members)) {
    const polygons: number[][][][] = [];
    for (const member of element.members) {
      if (member.type !== "way" || !Array.isArray(member.geometry) || member.geometry.length < 3) continue;
      const ring = member.geometry.map((p) => [p.lon, p.lat]);
      const first = ring[0]!;
      const last = ring[ring.length - 1]!;
      if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0]!, first[1]!]);
      // outer / inner はとりあえず分離せず、それぞれ独立 Polygon として扱う (粗い近似)。
      polygons.push([ring]);
    }
    if (polygons.length === 0) return null;
    if (polygons.length === 1) return { type: "Polygon", coordinates: polygons[0]! };
    return { type: "MultiPolygon", coordinates: polygons };
  }
  return null;
}

function nameFromTags(tags: Record<string, string> | undefined): string {
  if (!tags) return "";
  return tags["name:ja"] ?? tags["name"] ?? tags["alt_name"] ?? "";
}

interface UpsertJob {
  entityKey: string;
  name: string;
  polygon: Record<string, unknown>;
  bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  payload: Record<string, unknown>;
  officialUrl: string;
}

function buildJob(element: OverpassElement): UpsertJob | null {
  const polygon = elementToPolygon(element);
  if (!polygon) return null;
  const bbox = computeBbox(polygon);
  if (!bbox) return null;
  const name = nameFromTags(element.tags);
  if (!name) return null;
  const entityKey = `osm:${element.type}:${element.id}`;
  const payload: Record<string, unknown> = {
    osm_type: element.type,
    osm_id: element.id,
    tags: element.tags ?? {},
  };
  const officialUrl = element.tags?.["website"] ?? element.tags?.["contact:website"] ?? "";
  return { entityKey, name, polygon, bbox, payload, officialUrl };
}

async function applyJob(client: any, job: UpsertJob, publishDate: string): Promise<"inserted" | "skipped_same"> {
  const cur = await client.query(
    `SELECT field_id, valid_from::text AS valid_from
       FROM observation_fields
      WHERE entity_key = $1 AND valid_to IS NULL
      LIMIT 1`,
    [job.entityKey],
  );
  const existing = cur.rows[0];
  const center = { lat: (job.bbox.minLat + job.bbox.maxLat) / 2, lng: (job.bbox.minLng + job.bbox.maxLng) / 2 };
  const dLat = (job.bbox.maxLat - job.bbox.minLat) * 111;
  const dLng = (job.bbox.maxLng - job.bbox.minLng) * 111 * Math.cos((job.bbox.minLat * Math.PI) / 180);
  const radiusM = Math.max(50, Math.min(200000, Math.round(Math.sqrt(dLat * dLat + dLng * dLng) * 500)));

  if (existing) {
    if (existing.valid_from === publishDate) return "skipped_same";
    // Refresh polygon + payload in place rather than version-bump for OSM
    // (OSM is volatile; a daily import would otherwise produce a long chain
    // of meaningless versions). Versioning is reserved for KSJ-style annual
    // releases.
    await client.query(
      `UPDATE observation_fields SET
          polygon = $2::jsonb,
          payload = $3::jsonb,
          official_url = $4,
          name = $5,
          bbox_min_lat = $6,
          bbox_max_lat = $7,
          bbox_min_lng = $8,
          bbox_max_lng = $9,
          updated_at = NOW()
        WHERE field_id = $1`,
      [existing.field_id, JSON.stringify(job.polygon), JSON.stringify(job.payload), job.officialUrl, job.name,
       job.bbox.minLat, job.bbox.maxLat, job.bbox.minLng, job.bbox.maxLng],
    );
    return "skipped_same";
  }
  await client.query(
    `INSERT INTO observation_fields (
        source, name, prefecture, city, lat, lng, radius_m,
        polygon, area_ha,
        certification_id, official_url, payload,
        bbox_min_lat, bbox_max_lat, bbox_min_lng, bbox_max_lng,
        admin_level, entity_key, valid_from
     ) VALUES (
        'user_defined', $1, '', '', $2, $3, $4,
        $5::jsonb, NULL,
        $6, $7, $8::jsonb,
        $9, $10, $11, $12,
        'osm_park', $13, $14
     )`,
    [
      job.name, center.lat, center.lng, radiusM,
      JSON.stringify(job.polygon), job.entityKey, job.officialUrl,
      JSON.stringify(job.payload),
      job.bbox.minLat, job.bbox.maxLat, job.bbox.minLng, job.bbox.maxLng,
      job.entityKey, publishDate,
    ],
  );
  return "inserted";
}

async function sweep(client: any, foundEntityKeys: Set<string>, bbox: [number, number, number, number], publishDate: string): Promise<number> {
  // Close any current OSM park version inside the imported bbox that wasn't
  // touched in this run (= disappeared from OSM, possibly because the area is
  // no longer a park — could now be a factory, housing, etc.).
  const result = await client.query(
    `SELECT field_id, entity_key
       FROM observation_fields
      WHERE admin_level = 'osm_park'
        AND valid_to IS NULL
        AND lat BETWEEN $1 AND $2
        AND lng BETWEEN $3 AND $4`,
    [bbox[0], bbox[2], bbox[1], bbox[3]],
  );
  let closed = 0;
  for (const row of result.rows) {
    if (foundEntityKeys.has(row.entity_key)) continue;
    await client.query(
      `UPDATE observation_fields SET valid_to = $2, updated_at = NOW() WHERE field_id = $1`,
      [row.field_id, publishDate],
    );
    closed += 1;
  }
  return closed;
}

async function main() {
  const options = parseArgs(process.argv);
  const publishDate = new Date().toISOString().slice(0, 10);
  const query = buildQuery(options.bbox);
  console.log(`[importOsmParks] querying Overpass bbox=${options.bbox.join(",")} dryRun=${options.dryRun}`);
  const response = await fetchOverpass(options.sourceUrl, query);
  const elements = response.elements ?? [];
  console.log(`[importOsmParks] received elements=${elements.length}`);

  const jobs: UpsertJob[] = [];
  for (const element of elements) {
    const job = buildJob(element);
    if (job) jobs.push(job);
    if (options.limit && jobs.length >= options.limit) break;
  }
  console.log(`[importOsmParks] candidate jobs=${jobs.length}`);

  if (options.dryRun) {
    for (const j of jobs.slice(0, 8)) console.log(`  ${j.entityKey} ${j.name}`);
    return;
  }

  const pool = getPool();
  const client = await pool.connect();
  let inserted = 0, refreshed = 0;
  const found = new Set<string>();
  try {
    await client.query("BEGIN");
    for (const job of jobs) {
      found.add(job.entityKey);
      const result = await applyJob(client, job, publishDate);
      if (result === "inserted") inserted += 1; else refreshed += 1;
      if (options.delayMs > 0) await new Promise((r) => setTimeout(r, 0)); // yield only
    }
    let closed = 0;
    if (options.sweep) {
      closed = await sweep(client, found, options.bbox, publishDate);
    }
    await client.query("COMMIT");
    console.log(`[importOsmParks] done inserted=${inserted} refreshed=${refreshed} closed=${closed}`);
    await flushAreaPolygonCacheRemote();
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  await pool.end();
}

main().catch((err) => {
  console.error("[importOsmParks] failed", err);
  process.exit(1);
});
