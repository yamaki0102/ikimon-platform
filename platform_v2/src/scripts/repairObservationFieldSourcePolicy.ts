import { getPool } from "../db.js";

const LEGACY_AREA_SOURCES = [
  "osm_park",
  "admin_municipality",
  "admin_prefecture",
  "admin_country",
] as const;

type RepairRow = {
  legacy_source: string;
  repaired: string;
};

async function main(): Promise<void> {
  const pool = getPool();
  try {
    const result = await pool.query<RepairRow>(
      `WITH repaired AS (
         UPDATE observation_fields
            SET admin_level = COALESCE(NULLIF(admin_level, ''), source),
                source = 'user_defined',
                payload = payload || jsonb_build_object(
                  'source_policy_repair',
                  jsonb_build_object(
                    'legacy_source', source,
                    'repaired_at', now()
                  )
                ),
                updated_at = now()
          WHERE source = ANY($1::text[])
          RETURNING admin_level AS legacy_source
       )
       SELECT legacy_source, COUNT(*)::text AS repaired
         FROM repaired
        GROUP BY legacy_source
        ORDER BY legacy_source`,
      [LEGACY_AREA_SOURCES],
    );

    const total = result.rows.reduce((sum, row) => sum + Number(row.repaired), 0);
    if (total === 0) {
      console.log("[field-source-policy] no legacy source rows to repair");
      return;
    }
    for (const row of result.rows) {
      console.log(`[field-source-policy] repaired ${row.legacy_source}: ${row.repaired}`);
    }
    console.log(`[field-source-policy] repaired_total=${total}`);
  } finally {
    await pool.end();
  }
}

void main().catch((error) => {
  console.error("[field-source-policy] failed", error);
  process.exitCode = 1;
});
