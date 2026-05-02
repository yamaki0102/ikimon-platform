import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { getPool } from "../db.js";
import { resolveLegacyRoots } from "../legacy/legacyRoots.js";
import {
  assessLegacyObservationQuality,
  shouldQuarantineLegacyNoPhoto,
  upsertLegacyObservationQualityReview,
} from "../services/observationQualityGate.js";

type JsonRecord = Record<string, unknown>;

type ImportOptions = {
  legacyDataRoot: string;
  dryRun: boolean;
  limit: number | null;
  importVersion: string;
};

type LegacyObservation = JsonRecord & {
  id: string;
  user_id?: string;
  observed_at?: string;
  created_at?: string;
  updated_at?: string;
  lat?: number | string;
  lng?: number | string;
  municipality?: string;
  prefecture?: string;
  country?: string;
  note?: string;
  status?: string;
  taxon?: JsonRecord;
  site_id?: string;
  site_name?: string;
  cultivation?: string;
  biome?: string;
  evidence_tags?: unknown[];
  substrate_tags?: unknown[];
  quality_grade?: string;
  data_quality?: string;
  ai_assessment_status?: string;
  best_supported_descendant_taxon?: string;
  coordinate_accuracy?: number | string;
};

type ImportSummary = {
  pendingRowsSeen: number;
  rowsImported: number;
  rowsSkipped: number;
  rowsFailed: number;
  rowsAlreadyImported: number;
  rowsQuarantinedNoPhoto: number;
};

function parseArgs(argv: string[]): ImportOptions {
  const projectRoot = process.cwd();
  const legacyRoots = resolveLegacyRoots(projectRoot, {
    mirrorRoot: process.env.LEGACY_MIRROR_ROOT,
    legacyDataRoot: process.env.LEGACY_DATA_ROOT,
  });
  const options: ImportOptions = {
    legacyDataRoot: legacyRoots.legacyDataRoot,
    dryRun: false,
    limit: null,
    importVersion: "v0-plan",
  };

  for (const arg of argv) {
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg.startsWith("--legacy-data-root=")) {
      options.legacyDataRoot = path.resolve(arg.slice("--legacy-data-root=".length));
      continue;
    }
    if (arg.startsWith("--limit=")) {
      const parsed = Number.parseInt(arg.slice("--limit=".length), 10);
      options.limit = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      continue;
    }
    if (arg.startsWith("--import-version=")) {
      options.importVersion = arg.slice("--import-version=".length).trim() || options.importVersion;
    }
  }

  return options;
}

async function exists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  if (!(await exists(filePath))) {
    return fallback;
  }
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content) as T;
}

async function loadLegacyObservations(options: ImportOptions): Promise<Map<string, LegacyObservation>> {
  const rootObservations = await readJsonFile<LegacyObservation[]>(
    path.join(options.legacyDataRoot, "observations.json"),
    [],
  );
  const partitionDir = path.join(options.legacyDataRoot, "observations");
  const partitionFiles = (await exists(partitionDir))
    ? (await readdir(partitionDir)).filter((name) => name.endsWith(".json")).sort()
    : [];

  const deduped = new Map<string, LegacyObservation>();
  for (const observation of rootObservations) {
    if (typeof observation.id === "string" && observation.id !== "") {
      deduped.set(observation.id, observation);
    }
  }
  for (const filename of partitionFiles) {
    const batch = await readJsonFile<LegacyObservation[]>(path.join(partitionDir, filename), []);
    for (const observation of batch) {
      if (typeof observation.id === "string" && observation.id !== "") {
        deduped.set(observation.id, observation);
      }
    }
  }
  return deduped;
}

function toIsoTimestamp(value: unknown): string | null {
  if (typeof value === "number") {
    return new Date(value > 1_000_000_000_000 ? value : value * 1000).toISOString();
  }
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item !== "");
}

function buildPlaceId(observation: LegacyObservation): string {
  const siteId = typeof observation.site_id === "string" ? observation.site_id.trim() : "";
  if (siteId !== "") return `site:${siteId}`;
  const lat = asFiniteNumber(observation.lat);
  const lng = asFiniteNumber(observation.lng);
  if (lat !== null && lng !== null) return `geo:${lat.toFixed(3)}:${lng.toFixed(3)}`;
  const municipality = typeof observation.municipality === "string" ? observation.municipality.trim() : "";
  const prefecture = typeof observation.prefecture === "string" ? observation.prefecture.trim() : "";
  if (municipality !== "" || prefecture !== "") return `locality:${prefecture}:${municipality}`;
  return "place:unknown";
}

function buildPlaceName(observation: LegacyObservation): string {
  const siteName = typeof observation.site_name === "string" ? observation.site_name.trim() : "";
  if (siteName !== "") return siteName;
  const municipality = typeof observation.municipality === "string" ? observation.municipality.trim() : "";
  const prefecture = typeof observation.prefecture === "string" ? observation.prefecture.trim() : "";
  if (municipality !== "" || prefecture !== "") return [municipality, prefecture].filter(Boolean).join(" / ");
  return "Legacy Imported Place";
}

async function ensureDatabaseReady(): Promise<void> {
  await getPool().query("select 1");
}

async function createMigrationRun(importVersion: string): Promise<string> {
  const result = await getPool().query<{ migration_run_id: string }>(
    `insert into migration_runs (
        run_type, source_name, status, details
     ) values (
        'bootstrap_import', 'legacy_observations', 'running', $1::jsonb
     ) returning migration_run_id`,
    [JSON.stringify({ import_version: importVersion, importer: "importObservationMeaning" })],
  );
  const runId = result.rows[0]?.migration_run_id;
  if (!runId) throw new Error("Failed to create migration run.");
  return runId;
}

async function finalizeMigrationRun(runId: string, status: "completed" | "failed", summary: ImportSummary): Promise<void> {
  await getPool().query(
    `update migration_runs
     set status = $2,
         finished_at = now(),
         rows_seen = $3,
         rows_imported = $4,
         rows_skipped = $5,
         rows_failed = $6,
         details = coalesce(details, '{}'::jsonb) || $7::jsonb
     where migration_run_id = $1`,
    [runId, status, summary.pendingRowsSeen, summary.rowsImported, summary.rowsSkipped, summary.rowsFailed, JSON.stringify(summary)],
  );
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const observationMap = await loadLegacyObservations(options);
  const summary: ImportSummary = {
    pendingRowsSeen: 0,
    rowsImported: 0,
    rowsSkipped: 0,
    rowsFailed: 0,
    rowsAlreadyImported: 0,
    rowsQuarantinedNoPhoto: 0,
  };

  if (options.dryRun) {
    const pending = [...observationMap.values()].slice(0, options.limit ?? observationMap.size);
    summary.pendingRowsSeen = pending.length;
    summary.rowsQuarantinedNoPhoto = pending.filter((observation) => shouldQuarantineLegacyNoPhoto(observation)).length;
    summary.rowsImported = pending.length - summary.rowsQuarantinedNoPhoto;
    console.log(JSON.stringify({ options, summary }, null, 2));
    return;
  }

  await ensureDatabaseReady();
  const pool = getPool();
  const existingLedger = await pool.query<{
    legacy_id: string;
    import_status: string;
  }>(
    `select legacy_id, import_status
     from migration_ledger
     where entity_type = 'observation_meaning'
       and legacy_source = 'php_json'
       and import_version = $1`,
    [options.importVersion],
  );
  const completedLedger = new Set<string>();
  for (const row of existingLedger.rows) {
    if (row.import_status === "imported" || row.import_status === "skipped") {
      completedLedger.add(row.legacy_id);
    }
  }
  const ledgerResult = await pool.query<{
    legacy_id: string;
    canonical_id: string;
    canonical_parent_id: string | null;
  }>(
    `select legacy_id, canonical_id, canonical_parent_id
     from migration_ledger
     where entity_type = 'observation_meaning'
       and import_status = 'pending'
       and import_version = $1
     order by observed_at nulls first, legacy_id
     ${options.limit !== null ? `limit ${options.limit}` : ""}`,
    [options.importVersion],
  );

  const runId = await createMigrationRun(options.importVersion);
  summary.pendingRowsSeen = ledgerResult.rows.length;

  try {
    for (const row of ledgerResult.rows) {
      const observation = observationMap.get(row.legacy_id);
      if (!observation) {
        summary.rowsSkipped += 1;
        await pool.query(
          `update migration_ledger
           set migration_run_id = $2::uuid, import_status = 'skipped', skipped_reason = 'missing_required_fields', imported_at = now()
           where legacy_source = 'php_json' and legacy_entity_type = 'observation' and legacy_id = $1 and import_version = $3`,
          [row.legacy_id, runId, options.importVersion],
        );
        continue;
      }

      if (completedLedger.has(row.legacy_id)) {
        summary.rowsAlreadyImported += 1;
        continue;
      }

      if (shouldQuarantineLegacyNoPhoto(observation)) {
        const qualitySignals = assessLegacyObservationQuality(observation);
        await upsertLegacyObservationQualityReview(pool, {
          observation,
          importVersion: options.importVersion,
          reasonCode: "legacy_no_photo",
          reasonDetail: "Legacy observation has no photo evidence and must not be imported into visits/occurrences.",
          legacyPath: "data/observations",
        });
        await pool.query(
          `update migration_ledger
           set migration_run_id = $2::uuid,
               import_status = 'skipped',
               skipped_reason = 'no_photo_quarantined',
               imported_at = now(),
               metadata = coalesce(metadata, '{}'::jsonb) || $4::jsonb
           where legacy_source = 'php_json' and legacy_entity_type = 'observation' and legacy_id = $1 and import_version = $3`,
          [
            row.legacy_id,
            runId,
            options.importVersion,
            JSON.stringify({
              importer: "importObservationMeaning",
              quality_gate: qualitySignals,
            }),
          ],
        );
        await pool.query(
          `delete from legacy_id_map
           where legacy_source = 'php_json'
             and legacy_entity_type = 'observation'
             and legacy_id = $1`,
          [row.legacy_id],
        );
        summary.rowsQuarantinedNoPhoto += 1;
        summary.rowsSkipped += 1;
        continue;
      }

      const visitId = row.canonical_parent_id ?? row.legacy_id;
      const occurrenceId = row.canonical_id;
      const placeId = buildPlaceId(observation);
      const observedAt = toIsoTimestamp(observation.observed_at ?? observation.created_at ?? observation.updated_at) ?? new Date().toISOString();
      const latitude = asFiniteNumber(observation.lat);
      const longitude = asFiniteNumber(observation.lng);

      await pool.query("begin");
      try {
        await pool.query(
          `insert into places (
              place_id, legacy_place_key, legacy_site_id, canonical_name, locality_label,
              source_kind, country_code, prefecture, municipality, center_latitude, center_longitude, metadata, created_at, updated_at
           ) values (
              $1, $2, $3, $4, $5, 'legacy_observation', $6, $7, $8, $9, $10, $11::jsonb, $12, now()
           )
           on conflict (place_id) do update set
              canonical_name = excluded.canonical_name,
              locality_label = excluded.locality_label,
              legacy_site_id = excluded.legacy_site_id,
              municipality = excluded.municipality,
              prefecture = excluded.prefecture,
              center_latitude = coalesce(excluded.center_latitude, places.center_latitude),
              center_longitude = coalesce(excluded.center_longitude, places.center_longitude),
              updated_at = now()`,
          [
            placeId,
            placeId,
            observation.site_id ?? null,
            buildPlaceName(observation),
            observation.site_name ?? observation.municipality ?? null,
            observation.country ?? "JP",
            observation.prefecture ?? null,
            observation.municipality ?? null,
            latitude,
            longitude,
            JSON.stringify({ source_observation_id: observation.id, imported_from: "migration_ledger" }),
            observedAt,
          ],
        );

        await pool.query(
          `insert into visits (
              visit_id, legacy_observation_id, place_id, user_id, observed_at, session_mode, visit_mode,
              complete_checklist_flag, target_taxa_scope, point_latitude, point_longitude, coordinate_uncertainty_m,
              observed_country, observed_prefecture, observed_municipality, locality_note, note,
              source_kind, source_payload, created_at, updated_at
           ) values (
              $1, $2, $3, $4, $5, $6, 'manual', false, null, $7, $8,
              $9, $10, $11, $12, $13, $14, 'legacy_observation', $15::jsonb, $16, now()
           )
           on conflict (visit_id) do update set
              place_id = excluded.place_id,
              user_id = excluded.user_id,
              observed_at = excluded.observed_at,
              point_latitude = coalesce(excluded.point_latitude, visits.point_latitude),
              point_longitude = coalesce(excluded.point_longitude, visits.point_longitude),
              coordinate_uncertainty_m = excluded.coordinate_uncertainty_m,
              observed_country = excluded.observed_country,
              observed_prefecture = excluded.observed_prefecture,
              observed_municipality = excluded.observed_municipality,
              note = excluded.note,
              source_payload = excluded.source_payload,
              updated_at = now()`,
          [
            visitId,
            observation.id,
            placeId,
            observation.user_id ?? null,
            observedAt,
            observation.status ?? null,
            latitude,
            longitude,
            asFiniteNumber(observation.coordinate_accuracy),
            observation.country ?? "JP",
            observation.prefecture ?? null,
            observation.municipality ?? null,
            observation.site_name ?? null,
            observation.note ?? null,
            JSON.stringify(observation),
            toIsoTimestamp(observation.created_at) ?? observedAt,
          ],
        );

        await pool.query(
          `insert into occurrences (
              occurrence_id, visit_id, legacy_observation_id, subject_index, scientific_name, vernacular_name,
              taxon_rank, taxon_concept_version, basis_of_record, organism_origin, cultivation,
              occurrence_status, confidence_score, evidence_tier, data_quality, quality_grade,
              ai_assessment_status, best_supported_descendant_taxon, biome, substrate_tags, evidence_tags,
              source_payload, created_at, updated_at
           ) values (
              $1, $2, $3, 0, $4, $5, $6, 'legacy', 'HumanObservation', null, $7,
              'present', null, 1, $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb,
              $15::jsonb, $16, now()
           )
           on conflict (occurrence_id) do update set
              scientific_name = excluded.scientific_name,
              vernacular_name = excluded.vernacular_name,
              taxon_rank = excluded.taxon_rank,
              cultivation = excluded.cultivation,
              data_quality = excluded.data_quality,
              quality_grade = excluded.quality_grade,
              ai_assessment_status = excluded.ai_assessment_status,
              best_supported_descendant_taxon = excluded.best_supported_descendant_taxon,
              biome = excluded.biome,
              substrate_tags = excluded.substrate_tags,
              evidence_tags = excluded.evidence_tags,
              source_payload = excluded.source_payload,
              updated_at = now()`,
          [
            occurrenceId,
            visitId,
            observation.id,
            (observation.taxon?.scientific_name as string | undefined) ?? null,
            (observation.taxon?.name as string | undefined) ?? null,
            (observation.taxon?.rank as string | undefined) ?? null,
            observation.cultivation ?? null,
            observation.data_quality ?? null,
            observation.quality_grade ?? null,
            observation.ai_assessment_status ?? null,
            observation.best_supported_descendant_taxon ?? null,
            observation.biome ?? null,
            JSON.stringify(asStringArray(observation.substrate_tags)),
            JSON.stringify(asStringArray(observation.evidence_tags)),
            JSON.stringify(observation),
            toIsoTimestamp(observation.created_at) ?? observedAt,
          ],
        );

        await pool.query(
          `update migration_ledger
           set migration_run_id = $2::uuid, import_status = 'imported', skipped_reason = null, imported_at = now(),
               metadata = coalesce(metadata, '{}'::jsonb) || $4::jsonb
           where legacy_source = 'php_json' and legacy_entity_type = 'observation' and legacy_id = $1 and import_version = $3`,
          [
            row.legacy_id,
            runId,
            options.importVersion,
            JSON.stringify({ imported_place_id: placeId, importer: "importObservationMeaning" }),
          ],
        );

        await pool.query("commit");
        summary.rowsImported += 1;
      } catch (error) {
        await pool.query("rollback");
        summary.rowsFailed += 1;
        await pool.query(
          `update migration_ledger
           set migration_run_id = $2::uuid, import_status = 'failed', skipped_reason = 'missing_required_fields', imported_at = now(),
               metadata = coalesce(metadata, '{}'::jsonb) || $4::jsonb
           where legacy_source = 'php_json' and legacy_entity_type = 'observation' and legacy_id = $1 and import_version = $3`,
          [
            row.legacy_id,
            runId,
            options.importVersion,
            JSON.stringify({
              importer: "importObservationMeaning",
              error: error instanceof Error ? error.message : "unknown_error",
            }),
          ],
        );
      }
    }

    await finalizeMigrationRun(runId, "completed", summary);
    console.log(JSON.stringify({ options, summary }, null, 2));
  } catch (error) {
    await finalizeMigrationRun(runId, "failed", summary);
    throw error;
  } finally {
    await pool.end();
  }
}

void main();
