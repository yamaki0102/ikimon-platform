/**
 * Backfill `bbox_min_lat / bbox_max_lat / bbox_min_lng / bbox_max_lng`
 * and `admin_level` for `observation_fields` rows whose `polygon` JSONB exists
 * but bbox columns are still NULL (created before migration 0079).
 *
 * Usage:
 *   npx tsx src/scripts/backfillFieldPolygonBbox.ts            # apply
 *   npx tsx src/scripts/backfillFieldPolygonBbox.ts --dry-run  # report only
 *   npx tsx src/scripts/backfillFieldPolygonBbox.ts --limit 500
 */

import { getPool } from "../db.js";
import { computeBbox } from "../services/geoJsonBbox.js";

type Options = { dryRun: boolean; limit: number | null };

const SOURCE_TO_ADMIN_LEVEL: Record<string, string | null> = {
  user_defined: null,
  nature_symbiosis_site: "symbiosis",
  tsunag: "tsunag",
  protected_area: "protected",
  oecm: "oecm",
};

function parseArgs(argv: string[]): Options {
  const options: Options = { dryRun: false, limit: null };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--limit" && argv[i + 1]) {
      const value = Number.parseInt(argv[i + 1] ?? "", 10);
      if (!Number.isNaN(value) && value > 0) options.limit = value;
      i += 1;
    }
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv);
  const pool = getPool();
  const limitClause = options.limit != null ? `LIMIT ${options.limit}` : "";
  const result = await pool.query<{
    field_id: string;
    source: string;
    polygon: Record<string, unknown> | null;
    admin_level: string | null;
  }>(
    `SELECT field_id, source, polygon, admin_level
       FROM observation_fields
      WHERE polygon IS NOT NULL
        AND (bbox_min_lat IS NULL OR admin_level IS NULL)
      ORDER BY created_at ASC
      ${limitClause}`,
  );

  console.log(`[backfillFieldPolygonBbox] candidates=${result.rows.length} dryRun=${options.dryRun}`);
  let updated = 0;
  let skipped = 0;

  for (const row of result.rows) {
    const bbox = computeBbox(row.polygon);
    const adminLevel = row.admin_level ?? SOURCE_TO_ADMIN_LEVEL[row.source] ?? null;
    if (!bbox && !adminLevel) {
      skipped += 1;
      continue;
    }
    if (options.dryRun) {
      console.log(`would update ${row.field_id} bbox=${bbox ? JSON.stringify(bbox) : "null"} admin_level=${adminLevel}`);
      continue;
    }
    await pool.query(
      `UPDATE observation_fields
          SET bbox_min_lat = COALESCE($2, bbox_min_lat),
              bbox_max_lat = COALESCE($3, bbox_max_lat),
              bbox_min_lng = COALESCE($4, bbox_min_lng),
              bbox_max_lng = COALESCE($5, bbox_max_lng),
              admin_level  = COALESCE(admin_level, $6),
              updated_at   = NOW()
        WHERE field_id = $1`,
      [
        row.field_id,
        bbox?.minLat ?? null,
        bbox?.maxLat ?? null,
        bbox?.minLng ?? null,
        bbox?.maxLng ?? null,
        adminLevel,
      ],
    );
    updated += 1;
  }

  console.log(`[backfillFieldPolygonBbox] done updated=${updated} skipped=${skipped}`);
  await pool.end();
}

main().catch((err) => {
  console.error("[backfillFieldPolygonBbox] failed", err);
  process.exit(1);
});
