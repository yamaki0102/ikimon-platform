// Biodiversity Freshness OS: read-side accessor for *_versions tables.
//
// Returns the current ("valid_to IS NULL") version_id for invasive / risk /
// taxonomy / place_environment lookups, plus the time-travel variant for
// historical reproduction. Powers user_output_cache.knowledge_version_set
// construction on the Hot path.

import { getPool } from "../db.js";

export type KnowledgeVersionRef = {
  versionId: string;
  scientificName?: string | null;
  regionScope?: string | null;
};

export type CurrentKnowledgeSet = {
  invasive: string[];      // version_ids referenced by this Hot-path call
  redlist: string[];
  taxonomy: string[];
  placeEnv: string[];
};

export type LookupTaxonInput = {
  scientificName: string;
  regionScope?: string;
};

export type LookupPlaceInput = {
  placeId: string;
  metricKinds?: string[];
};

const DEFAULT_REGION = "JP";

function asArray(scientificNames: string | string[] | null | undefined): string[] {
  if (!scientificNames) return [];
  if (Array.isArray(scientificNames)) return scientificNames.map((n) => n.trim()).filter(Boolean);
  const trimmed = scientificNames.trim();
  return trimmed ? [trimmed] : [];
}

export async function lookupCurrentInvasiveVersions(
  scientificNames: string | string[] | null | undefined,
  regionScope: string = DEFAULT_REGION,
): Promise<KnowledgeVersionRef[]> {
  const names = asArray(scientificNames);
  if (names.length === 0) return [];
  const pool = getPool();
  const result = await pool.query<{ version_id: string; scientific_name: string; region_scope: string }>(
    `SELECT version_id, scientific_name, region_scope
       FROM invasive_status_versions
      WHERE valid_to IS NULL
        AND lower(scientific_name) = ANY($1::text[])
        AND region_scope = $2`,
    [names.map((n) => n.toLowerCase()), regionScope],
  );
  return result.rows.map((row) => ({
    versionId: row.version_id,
    scientificName: row.scientific_name,
    regionScope: row.region_scope,
  }));
}

export async function lookupCurrentRedlistVersions(
  scientificNames: string | string[] | null | undefined,
  regionScope: string = DEFAULT_REGION,
): Promise<KnowledgeVersionRef[]> {
  const names = asArray(scientificNames);
  if (names.length === 0) return [];
  const pool = getPool();
  const result = await pool.query<{ version_id: string; scientific_name: string; region_scope: string }>(
    `SELECT version_id, scientific_name, region_scope
       FROM risk_status_versions
      WHERE valid_to IS NULL
        AND lower(scientific_name) = ANY($1::text[])
        AND region_scope = $2`,
    [names.map((n) => n.toLowerCase()), regionScope],
  );
  return result.rows.map((row) => ({
    versionId: row.version_id,
    scientificName: row.scientific_name,
    regionScope: row.region_scope,
  }));
}

export async function lookupCurrentTaxonomyVersions(
  scientificNames: string | string[] | null | undefined,
): Promise<KnowledgeVersionRef[]> {
  const names = asArray(scientificNames);
  if (names.length === 0) return [];
  const pool = getPool();
  const result = await pool.query<{ version_id: string; scientific_name: string }>(
    `SELECT version_id, scientific_name
       FROM taxonomy_versions
      WHERE valid_to IS NULL
        AND lower(scientific_name) = ANY($1::text[])`,
    [names.map((n) => n.toLowerCase())],
  );
  return result.rows.map((row) => ({
    versionId: row.version_id,
    scientificName: row.scientific_name,
  }));
}

export async function lookupCurrentPlaceEnvVersions(
  placeId: string | null | undefined,
  metricKinds?: string[],
): Promise<KnowledgeVersionRef[]> {
  if (!placeId || placeId.trim().length === 0) return [];
  const pool = getPool();
  const params: Array<string | string[]> = [placeId];
  let metricClause = "";
  if (metricKinds && metricKinds.length > 0) {
    params.push(metricKinds);
    metricClause = "AND metric_kind = ANY($2::text[])";
  }
  const result = await pool.query<{ snapshot_id: string }>(
    `SELECT snapshot_id
       FROM place_environment_snapshots
      WHERE valid_to IS NULL
        AND place_id = $1
        ${metricClause}`,
    params,
  );
  return result.rows.map((row) => ({ versionId: row.snapshot_id }));
}

export type BuildKnowledgeVersionSetInput = {
  scientificNames: string | string[] | null | undefined;
  regionScope?: string;
  placeId?: string | null;
  placeMetricKinds?: string[];
};

/** Build the knowledge_version_set JSON used as a cache_key component. */
export async function buildKnowledgeVersionSet(
  input: BuildKnowledgeVersionSetInput,
): Promise<CurrentKnowledgeSet> {
  const region = input.regionScope ?? DEFAULT_REGION;
  const [invasive, redlist, taxonomy, placeEnv] = await Promise.all([
    lookupCurrentInvasiveVersions(input.scientificNames, region),
    lookupCurrentRedlistVersions(input.scientificNames, region),
    lookupCurrentTaxonomyVersions(input.scientificNames),
    lookupCurrentPlaceEnvVersions(input.placeId, input.placeMetricKinds),
  ]);

  return {
    invasive: invasive.map((r) => r.versionId).sort(),
    redlist: redlist.map((r) => r.versionId).sort(),
    taxonomy: taxonomy.map((r) => r.versionId).sort(),
    placeEnv: placeEnv.map((r) => r.versionId).sort(),
  };
}

/** Time-travel variant: which versions were current at a given timestamp. */
export async function lookupInvasiveVersionsAt(
  scientificNames: string | string[] | null | undefined,
  asOf: Date,
  regionScope: string = DEFAULT_REGION,
): Promise<KnowledgeVersionRef[]> {
  const names = asArray(scientificNames);
  if (names.length === 0) return [];
  const pool = getPool();
  const result = await pool.query<{ version_id: string; scientific_name: string }>(
    `SELECT version_id, scientific_name
       FROM invasive_status_versions
      WHERE lower(scientific_name) = ANY($1::text[])
        AND region_scope = $2
        AND valid_from <= $3::date
        AND (valid_to IS NULL OR valid_to > $3::date)`,
    [names.map((n) => n.toLowerCase()), regionScope, asOf.toISOString().slice(0, 10)],
  );
  return result.rows.map((row) => ({
    versionId: row.version_id,
    scientificName: row.scientific_name,
    regionScope,
  }));
}
