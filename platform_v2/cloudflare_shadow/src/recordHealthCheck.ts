import type { Env } from "./core/env";

export const RECORD_HEALTH_SNAPSHOTS_CREATE_SQL = `
CREATE TABLE IF NOT EXISTS record_health_snapshots (
  snapshot_date TEXT PRIMARY KEY,
  total_public INTEGER NOT NULL,
  missing_area_label INTEGER NOT NULL,
  missing_taxon_everywhere INTEGER NOT NULL,
  taxon_mismatch_awaiting INTEGER NOT NULL,
  created_at INTEGER NOT NULL
)
`.trim();

export type RecordHealthReport = {
  snapshotDate: string;
  totalPublic: number;
  missingAreaLabel: number;
  missingTaxonEverywhere: number;
  taxonMismatchAwaiting: number;
};

export type RecordHealthHistoryRow = {
  snapshot_date: string;
  total_public: number;
  missing_area_label: number;
  missing_taxon_everywhere: number;
  taxon_mismatch_awaiting: number;
  created_at: number;
};

const WEAK_TAXON_SET = new Set([
  "",
  "unidentified",
  "unknown",
  "unresolved",
  "awaiting id",
  "同定待ち",
  "名前待ち",
  "未同定",
  "不明"
]);

export function isRecordTaxonWeak(label: string | null | undefined): boolean {
  return WEAK_TAXON_SET.has(String(label ?? "").trim().toLowerCase());
}

export function normalizeMunicipalityLabel(raw: string | null | undefined): string | null {
  const cleaned = String(raw ?? "").trim().replace(/\s+/gu, " ");
  if (!cleaned || cleaned.length > 60) return null;
  if (/[0-9０-９]+[-－丁目番地号]/u.test(cleaned)) return null;
  return cleaned;
}

type PublicHealthScanRow = {
  observation_id: string;
  obs_taxon_label: string | null;
  rm_taxon_label: string | null;
  obs_area_label: string | null;
  rm_area_label: string | null;
  exact_lat: number | null;
  exact_lng: number | null;
};

async function loadPublicHealthRows(env: Env): Promise<PublicHealthScanRow[]> {
  const res = await env.OBS_DB.prepare(
    `SELECT o.observation_id,
            o.taxon_label AS obs_taxon_label,
            r.taxon_label AS rm_taxon_label,
            o.public_area_label AS obs_area_label,
            r.public_area_label AS rm_area_label,
            o.exact_lat,
            o.exact_lng
       FROM observations o
       JOIN readmodel_public_observations r ON r.observation_id = o.observation_id
      WHERE o.visibility = 'public'
        AND o.emergency_hidden = 0
      ORDER BY o.observed_at DESC
      LIMIT 5000`
  ).all<PublicHealthScanRow>();
  return res.results ?? [];
}

async function loadCurrentIdentificationMap(env: Env): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const rows = await env.OBS_DB.prepare(
      `SELECT occurrence_id, proposed_name
         FROM observation_identifications
        WHERE is_current = 1
          AND COALESCE(stance, 'propose') <> 'disagree'
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 5000`
    ).all<{ occurrence_id: string; proposed_name: string | null }>();
    for (const r of rows.results ?? []) {
      const name = String(r.proposed_name ?? "").trim();
      if (isRecordTaxonWeak(name)) continue;
      const obsId = r.occurrence_id.startsWith("occ:") && r.occurrence_id.endsWith(":0")
        ? r.occurrence_id.slice(4, -2)
        : r.occurrence_id;
      if (!map.has(obsId)) map.set(obsId, name);
    }
  } catch {}
  return map;
}

async function loadAiCandidateSet(env: Env): Promise<Set<string>> {
  const set = new Set<string>();
  try {
    const rows = await env.OBS_DB.prepare(
      `SELECT occurrence_id,
              COALESCE(candidate_vernacular_name, candidate_scientific_name, ai_recommended_taxon_name) AS label
         FROM observation_ai_review_targets
        LIMIT 5000`
    ).all<{ occurrence_id: string; label: string | null }>();
    for (const r of rows.results ?? []) {
      if (isRecordTaxonWeak(r.label)) continue;
      const obsId = r.occurrence_id.startsWith("occ:") && r.occurrence_id.endsWith(":0")
        ? r.occurrence_id.slice(4, -2)
        : r.occurrence_id;
      set.add(obsId);
    }
  } catch {}
  return set;
}

export async function runRecordHealthCheck(env: Env, nowDate = new Date()): Promise<RecordHealthReport> {
  const snapshotDate = nowDate.toISOString().slice(0, 10);
  const [rows, idMap, aiSet] = await Promise.all([
    loadPublicHealthRows(env),
    loadCurrentIdentificationMap(env),
    loadAiCandidateSet(env)
  ]);

  let missingAreaLabel = 0;
  let missingTaxonEverywhere = 0;
  let taxonMismatchAwaiting = 0;

  for (const row of rows) {
    const hasArea = Boolean(
      normalizeMunicipalityLabel(row.rm_area_label) ?? normalizeMunicipalityLabel(row.obs_area_label)
    );
    if (!hasArea) missingAreaLabel += 1;

    const rmWeak = isRecordTaxonWeak(row.rm_taxon_label);
    const obsWeak = isRecordTaxonWeak(row.obs_taxon_label);
    const hasIdentified = idMap.has(row.observation_id);
    const hasAi = aiSet.has(row.observation_id);

    if (rmWeak && (!obsWeak || hasIdentified)) {
      taxonMismatchAwaiting += 1;
    } else if (rmWeak && obsWeak && !hasIdentified && !hasAi) {
      missingTaxonEverywhere += 1;
    }
  }

  const report: RecordHealthReport = {
    snapshotDate,
    totalPublic: rows.length,
    missingAreaLabel,
    missingTaxonEverywhere,
    taxonMismatchAwaiting
  };

  await env.CORE_DB.prepare(RECORD_HEALTH_SNAPSHOTS_CREATE_SQL).run();
  await env.CORE_DB.prepare(
    `INSERT INTO record_health_snapshots (
      snapshot_date, total_public, missing_area_label, missing_taxon_everywhere, taxon_mismatch_awaiting, created_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
    ON CONFLICT(snapshot_date) DO UPDATE SET
      total_public = excluded.total_public,
      missing_area_label = excluded.missing_area_label,
      missing_taxon_everywhere = excluded.missing_taxon_everywhere,
      taxon_mismatch_awaiting = excluded.taxon_mismatch_awaiting,
      created_at = excluded.created_at`
  ).bind(
    report.snapshotDate,
    report.totalPublic,
    report.missingAreaLabel,
    report.missingTaxonEverywhere,
    report.taxonMismatchAwaiting,
    nowDate.getTime()
  ).run();

  return report;
}

export async function listRecordHealthHistory(env: Env, limit = 30): Promise<RecordHealthHistoryRow[]> {
  await env.CORE_DB.prepare(RECORD_HEALTH_SNAPSHOTS_CREATE_SQL).run();
  const res = await env.CORE_DB.prepare(
    `SELECT snapshot_date, total_public, missing_area_label, missing_taxon_everywhere, taxon_mismatch_awaiting, created_at
       FROM record_health_snapshots
      ORDER BY snapshot_date DESC
      LIMIT ?1`
  ).bind(Math.max(1, Math.min(90, Math.floor(limit)))).all<RecordHealthHistoryRow>();
  return res.results ?? [];
}

export async function backfillRecordHealthGaps(
  env: Env,
  options: {
    limit?: number;
    resolveMunicipality?: (lat: number, lng: number) => Promise<string | null>;
  } = {}
): Promise<{ backfilledTaxon: number; backfilledArea: number }> {
  const maxBatch = Math.max(1, Math.min(100, Math.floor(options.limit ?? 50)));
  const [rows, idMap] = await Promise.all([
    loadPublicHealthRows(env),
    loadCurrentIdentificationMap(env)
  ]);

  let backfilledTaxon = 0;
  let backfilledArea = 0;

  for (const row of rows) {
    if (backfilledTaxon < maxBatch && isRecordTaxonWeak(row.rm_taxon_label)) {
      const resolvedTaxon = !isRecordTaxonWeak(row.obs_taxon_label)
        ? row.obs_taxon_label!.trim()
        : idMap.get(row.observation_id) ?? null;
      if (resolvedTaxon) {
        await env.OBS_DB.prepare(
          `UPDATE readmodel_public_observations
              SET taxon_label = ?2, updated_at = CURRENT_TIMESTAMP
            WHERE observation_id = ?1
              AND (taxon_label IS NULL OR TRIM(taxon_label) = '' OR LOWER(TRIM(taxon_label)) IN ('unidentified', 'unknown', 'unresolved', 'awaiting id', '同定待ち', '名前待ち', '未同定', '不明'))`
        ).bind(row.observation_id, resolvedTaxon).run();
        if (isRecordTaxonWeak(row.obs_taxon_label)) {
          await env.OBS_DB.prepare(
            `UPDATE observations
                SET taxon_label = ?2, updated_at = CURRENT_TIMESTAMP
              WHERE observation_id = ?1
                AND (taxon_label IS NULL OR TRIM(taxon_label) = '' OR LOWER(TRIM(taxon_label)) IN ('unidentified', 'unknown', 'unresolved', 'awaiting id', '同定待ち', '名前待ち', '未同定', '不明'))`
          ).bind(row.observation_id, resolvedTaxon).run();
        }
        backfilledTaxon += 1;
      }
    }

    if (
      backfilledArea < maxBatch
      && options.resolveMunicipality
      && !normalizeMunicipalityLabel(row.rm_area_label)
      && !normalizeMunicipalityLabel(row.obs_area_label)
      && typeof row.exact_lat === "number"
      && typeof row.exact_lng === "number"
      && Number.isFinite(row.exact_lat)
      && Number.isFinite(row.exact_lng)
    ) {
      const rawCity = await options.resolveMunicipality(row.exact_lat, row.exact_lng).catch(() => null);
      const city = normalizeMunicipalityLabel(rawCity);
      if (city) {
        await env.OBS_DB.prepare(
          `UPDATE observations
              SET public_area_label = ?2, updated_at = CURRENT_TIMESTAMP
            WHERE observation_id = ?1
              AND (public_area_label IS NULL OR TRIM(public_area_label) = '')`
        ).bind(row.observation_id, city).run();
        await env.OBS_DB.prepare(
          `UPDATE readmodel_public_observations
              SET public_area_label = ?2, updated_at = CURRENT_TIMESTAMP
            WHERE observation_id = ?1
              AND (public_area_label IS NULL OR TRIM(public_area_label) = '')`
        ).bind(row.observation_id, city).run();
        backfilledArea += 1;
      }
    }
  }

  return { backfilledTaxon, backfilledArea };
}
