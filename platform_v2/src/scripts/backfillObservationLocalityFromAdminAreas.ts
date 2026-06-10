import { pathToFileURL } from "node:url";
import { getPool } from "../db.js";
import { resolveAdminLocalityForPoint } from "../services/adminLocalityResolver.js";

type Options = {
  limit: number;
  dryRun: boolean;
  since: string | null;
};

type CandidateRow = {
  visit_id: string;
  place_id: string | null;
  observed_at: string;
  observed_prefecture: string | null;
  observed_municipality: string | null;
  point_latitude: string | number | null;
  point_longitude: string | number | null;
};

function parseArgs(argv: string[]): Options {
  const options: Options = {
    limit: 5000,
    dryRun: false,
    since: null,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i] ?? "";
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--limit" && argv[i + 1]) {
      const n = Number.parseInt(argv[i + 1] ?? "", 10);
      if (Number.isFinite(n) && n > 0) options.limit = n;
      i += 1;
    } else if (arg.startsWith("--limit=")) {
      const n = Number.parseInt(arg.slice("--limit=".length), 10);
      if (Number.isFinite(n) && n > 0) options.limit = n;
    } else if (arg === "--since" && argv[i + 1]) {
      options.since = argv[i + 1] ?? null;
      i += 1;
    } else if (arg.startsWith("--since=")) {
      options.since = arg.slice("--since=".length) || null;
    }
  }
  return options;
}

function clean(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed === "" ? null : trimmed;
}

async function loadCandidates(options: Options): Promise<CandidateRow[]> {
  const pool = getPool();
  const params: unknown[] = [];
  const where = [
    "v.point_latitude is not null",
    "v.point_longitude is not null",
    "(nullif(v.observed_municipality, '') is null or nullif(v.observed_prefecture, '') is null)",
  ];
  if (options.since) {
    params.push(options.since);
    where.push(`v.observed_at >= $${params.length}::timestamptz`);
  }
  params.push(options.limit);
  const result = await pool.query<CandidateRow>(
    `select v.visit_id,
            v.place_id,
            v.observed_at::text as observed_at,
            v.observed_prefecture,
            v.observed_municipality,
            v.point_latitude::text as point_latitude,
            v.point_longitude::text as point_longitude
       from visits v
      where ${where.join(" and ")}
      order by v.observed_at desc, v.visit_id desc
      limit $${params.length}`,
    params,
  );
  return result.rows;
}

export async function backfillObservationLocalityFromAdminAreas(options: Options): Promise<{
  scanned: number;
  matched: number;
  updated: number;
  dryRun: boolean;
}> {
  const pool = getPool();
  const client = await pool.connect();
  let matched = 0;
  let updated = 0;
  try {
    const candidates = await loadCandidates(options);
    if (!options.dryRun) await client.query("BEGIN");
    for (const row of candidates) {
      const lat = Number(row.point_latitude);
      const lng = Number(row.point_longitude);
      const locality = await resolveAdminLocalityForPoint(client, lat, lng, { observedAt: row.observed_at });
      if (!locality?.municipality && !locality?.prefecture) continue;
      matched += 1;
      const nextPrefecture = clean(row.observed_prefecture) ?? locality.prefecture;
      const nextMunicipality = clean(row.observed_municipality) ?? locality.municipality;
      if (!nextPrefecture && !nextMunicipality) continue;
      if (options.dryRun) {
        console.log(`[dry] ${row.visit_id} -> ${nextMunicipality ?? ""} / ${nextPrefecture ?? ""}`);
        continue;
      }
      await client.query(
        `update visits
            set observed_prefecture = coalesce(nullif(observed_prefecture, ''), $2),
                observed_municipality = coalesce(nullif(observed_municipality, ''), $3),
                source_payload = coalesce(source_payload, '{}'::jsonb) || jsonb_build_object(
                  'admin_locality_backfill',
                  jsonb_build_object(
                    'field_id', $4::text,
                    'name', $5::text,
                    'entity_key', $6::text,
                    'valid_from', $7::text,
                    'valid_to', $8::text,
                    'observed_at', $9::text,
                    'updated_at', now()
                  )
                ),
                updated_at = now()
          where visit_id = $1`,
        [
          row.visit_id,
          nextPrefecture,
          nextMunicipality,
          locality.fieldId,
          locality.name,
          locality.entityKey,
          locality.validFrom,
          locality.validTo,
          row.observed_at,
        ],
      );
      if (row.place_id) {
        await client.query(
          `update places
              set prefecture = coalesce(nullif(prefecture, ''), $2),
                  municipality = coalesce(nullif(municipality, ''), $3),
                  updated_at = now()
            where place_id = $1`,
          [row.place_id, nextPrefecture, nextMunicipality],
        );
      }
      updated += 1;
    }
    if (!options.dryRun) await client.query("COMMIT");
    return { scanned: candidates.length, matched, updated, dryRun: options.dryRun };
  } catch (error) {
    if (!options.dryRun) await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv);
  const result = await backfillObservationLocalityFromAdminAreas(options);
  console.log(`[admin-locality-backfill] scanned=${result.scanned} matched=${result.matched} updated=${result.updated} dry_run=${result.dryRun}`);
  await getPool().end();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error("[admin-locality-backfill] failed", error);
    process.exit(1);
  });
}
