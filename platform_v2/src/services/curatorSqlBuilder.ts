import type { CuratorSourceSnapshot } from "./curatorSourceSnapshot.js";
import type { InvasiveLawParsedRow } from "./curatorTrustBoundary.js";

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlNullableString(value: string | undefined): string {
  return value ? sqlString(value) : "NULL";
}

export function buildInvasiveLawMigrationSql(input: {
  runId: string;
  snapshot: CuratorSourceSnapshot;
  rows: InvasiveLawParsedRow[];
}): string {
  if (input.rows.length === 0) {
    throw new Error("cannot_build_invasive_sql_without_rows");
  }
  const values = input.rows
    .map((row) => `  (${[
      sqlString(row.scientific_name),
      sqlNullableString(row.vernacular_jp),
      sqlString("JP"),
      sqlString(row.mhlw_category),
      sqlString("特定外来生物による生態系等に係る被害の防止に関する法律および環境省公開リスト"),
      sqlString(row.source_excerpt),
    ].join(", ")})`)
    .join(",\n");

  return `-- agent: invasive-law
-- run_id: ${input.runId}
-- source: ${input.snapshot.sourceUrl}
-- fetched_at: ${input.snapshot.fetchedAtIso}
-- content_sha256: ${input.snapshot.contentSha256}
--
-- Snapshot-backed proposal. Every target row points at source_snapshots.

WITH inserted_snapshot AS (
  INSERT INTO source_snapshots (
    source_kind, source_url, fetched_at, content_sha256, content_bytes,
    storage_backend, storage_path, license, curator_run_id, notes
  ) VALUES (
    ${sqlString(input.snapshot.sourceKind)},
    ${sqlString(input.snapshot.sourceUrl)},
    ${sqlString(input.snapshot.fetchedAtIso)}::timestamptz,
    ${sqlString(input.snapshot.contentSha256)},
    ${input.snapshot.contentBytes},
    'local_disk',
    ${sqlString(input.snapshot.storagePath)},
    ${sqlString(input.snapshot.license)},
    ${sqlString(input.runId)}::uuid,
    ${sqlString(JSON.stringify({ generated_by: "curator/invasive-law/v7-gemini-node" }))}::jsonb
  )
  ON CONFLICT (source_kind, content_sha256) DO NOTHING
  RETURNING snapshot_id
),
source_snapshot AS (
  SELECT snapshot_id FROM inserted_snapshot
  UNION ALL
  SELECT snapshot_id
    FROM source_snapshots
   WHERE source_kind = ${sqlString(input.snapshot.sourceKind)}
     AND content_sha256 = ${sqlString(input.snapshot.contentSha256)}
     AND NOT EXISTS (SELECT 1 FROM inserted_snapshot)
   LIMIT 1
),
candidate_rows (
  scientific_name, vernacular_jp, region_scope, mhlw_category,
  designation_basis, source_excerpt
) AS (
  VALUES
${values}
),
deduped_rows AS (
  SELECT DISTINCT ON (lower(scientific_name), region_scope)
         scientific_name, vernacular_jp, region_scope, mhlw_category,
         designation_basis, source_excerpt
    FROM candidate_rows
   ORDER BY lower(scientific_name), region_scope, mhlw_category
)
INSERT INTO invasive_status_versions (
  scientific_name, gbif_usage_key, region_scope, mhlw_category,
  designation_basis, source_snapshot_id, source_excerpt, valid_from, curator_run_id
)
SELECT d.scientific_name,
       NULL,
       d.region_scope,
       d.mhlw_category,
       d.designation_basis,
       (SELECT snapshot_id FROM source_snapshot),
       d.source_excerpt,
       CURRENT_DATE,
       ${sqlString(input.runId)}::uuid
  FROM deduped_rows d
 WHERE NOT EXISTS (
   SELECT 1
     FROM invasive_status_versions current_row
    WHERE current_row.valid_to IS NULL
      AND lower(current_row.scientific_name) = lower(d.scientific_name)
      AND current_row.region_scope = d.region_scope
 );
`;
}
