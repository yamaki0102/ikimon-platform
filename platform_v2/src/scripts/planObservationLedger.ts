import { createHash, randomUUID } from "node:crypto";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { getPool } from "../db.js";

type JsonRecord = Record<string, unknown>;

type ImportOptions = {
  legacyDataRoot: string;
  dryRun: boolean;
  limit: number | null;
  importVersion: string;
};

type LegacyObservation = JsonRecord & {
  id: string;
  observed_at?: string;
  created_at?: string;
  updated_at?: string;
};

type PlanSummary = {
  observationsRead: number;
  ledgerRowsPlanned: number;
  idMapRowsPlanned: number;
  skippedMissingId: number;
};

function parseArgs(argv: string[]): ImportOptions {
  const projectRoot = process.cwd();
  const options: ImportOptions = {
    legacyDataRoot: path.resolve(projectRoot, "../upload_package/data"),
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

function toIsoTimestamp(value: unknown): string | null {
  if (typeof value === "number") {
    return new Date(value > 1_000_000_000_000 ? value : value * 1000).toISOString();
  }

  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function hashRecord(record: unknown): string {
  return createHash("sha256").update(JSON.stringify(record)).digest("hex");
}

async function loadLegacyObservations(options: ImportOptions): Promise<LegacyObservation[]> {
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

  const observations = [...deduped.values()].sort((left, right) => {
    const leftTime = toIsoTimestamp(left.observed_at ?? left.created_at) ?? "";
    const rightTime = toIsoTimestamp(right.observed_at ?? right.created_at) ?? "";
    if (leftTime === rightTime) {
      return left.id.localeCompare(right.id);
    }
    return leftTime.localeCompare(rightTime);
  });

  return options.limit === null ? observations : observations.slice(0, options.limit);
}

async function ensureDatabaseReady(): Promise<void> {
  const pool = getPool();
  await pool.query("select 1");
}

async function createMigrationRun(importVersion: string): Promise<string> {
  const pool = getPool();
  const result = await pool.query<{ migration_run_id: string }>(
    `insert into migration_runs (
        run_type, source_name, status, details
     ) values (
        'bootstrap_plan', 'legacy_observations', 'running', $1::jsonb
     ) returning migration_run_id`,
    [JSON.stringify({ import_version: importVersion, planner: "planObservationLedger" })],
  );

  const runId = result.rows[0]?.migration_run_id;
  if (!runId) {
    throw new Error("Failed to create migration run.");
  }
  return runId;
}

async function finalizeMigrationRun(runId: string, status: "completed" | "failed", summary: PlanSummary): Promise<void> {
  const pool = getPool();
  await pool.query(
    `update migration_runs
     set status = $2,
         finished_at = now(),
         rows_seen = $3,
         rows_imported = $4,
         rows_skipped = $5,
         details = coalesce(details, '{}'::jsonb) || $6::jsonb
     where migration_run_id = $1`,
    [
      runId,
      status,
      summary.observationsRead,
      summary.ledgerRowsPlanned,
      summary.skippedMissingId,
      JSON.stringify(summary),
    ],
  );
}

async function planObservations(options: ImportOptions, observations: LegacyObservation[]): Promise<PlanSummary> {
  const summary: PlanSummary = {
    observationsRead: observations.length,
    ledgerRowsPlanned: 0,
    idMapRowsPlanned: 0,
    skippedMissingId: 0,
  };

  if (options.dryRun) {
    for (const observation of observations) {
      if (typeof observation.id !== "string" || observation.id === "") {
        summary.skippedMissingId += 1;
        continue;
      }
      summary.ledgerRowsPlanned += 1;
      summary.idMapRowsPlanned += 1;
    }
    return summary;
  }

  await ensureDatabaseReady();
  const pool = getPool();
  const runId = await createMigrationRun(options.importVersion);

  try {
    for (const observation of observations) {
      if (typeof observation.id !== "string" || observation.id === "") {
        summary.skippedMissingId += 1;
        continue;
      }

      const visitId = observation.id;
      const occurrenceId = `occ:${observation.id}:0`;
      const checksum = hashRecord(observation);
      const observedAt = toIsoTimestamp(observation.observed_at ?? observation.created_at ?? observation.updated_at);

      await pool.query(
        `insert into migration_ledger (
            migration_ledger_id, migration_run_id, entity_type, legacy_source, legacy_entity_type,
            legacy_id, legacy_path, canonical_entity_type, canonical_id,
            canonical_parent_type, canonical_parent_id,
            import_status, skipped_reason, source_checksum, import_version, observed_at, metadata
         ) values (
            $1::uuid, $2::uuid, 'observation_meaning', 'php_json', 'observation',
            $3, $4, 'occurrence', $5,
            'visit', $6,
            'pending', null, $7, $8, $9, $10::jsonb
         )
         on conflict (legacy_source, legacy_entity_type, legacy_id, import_version) do update set
            canonical_entity_type = excluded.canonical_entity_type,
            canonical_id = excluded.canonical_id,
            canonical_parent_type = excluded.canonical_parent_type,
            canonical_parent_id = excluded.canonical_parent_id,
            source_checksum = excluded.source_checksum,
            observed_at = excluded.observed_at,
            metadata = excluded.metadata`,
        [
          randomUUID(),
          runId,
          observation.id,
          "data/observations",
          occurrenceId,
          visitId,
          checksum,
          options.importVersion,
          observedAt,
          JSON.stringify({
            planned_visit_id: visitId,
            planned_occurrence_id: occurrenceId,
            planner: "planObservationLedger",
          }),
        ],
      );

      await pool.query(
        `insert into legacy_id_map (
            legacy_id_map_id, legacy_source, legacy_entity_type, legacy_id,
            canonical_entity_type, canonical_id, legacy_path, checksum_sha256, metadata
         ) values (
            $1::uuid, 'php_json', 'observation', $2,
            'visit', $3, $4, $5, $6::jsonb
         )
         on conflict (legacy_source, legacy_entity_type, legacy_id) do update set
            canonical_entity_type = excluded.canonical_entity_type,
            canonical_id = excluded.canonical_id,
            legacy_path = excluded.legacy_path,
            checksum_sha256 = excluded.checksum_sha256,
            metadata = excluded.metadata`,
        [
          randomUUID(),
          observation.id,
          visitId,
          "data/observations",
          checksum,
          JSON.stringify({
            planned_occurrence_id: occurrenceId,
            import_version: options.importVersion,
            planner: "planObservationLedger",
          }),
        ],
      );

      summary.ledgerRowsPlanned += 1;
      summary.idMapRowsPlanned += 1;
    }

    await finalizeMigrationRun(runId, "completed", summary);
    return summary;
  } catch (error) {
    await finalizeMigrationRun(runId, "failed", summary);
    throw error;
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const observations = await loadLegacyObservations(options);
  const summary = await planObservations(options, observations);
  console.log(JSON.stringify({ options, summary }, null, 2));

  if (!options.dryRun) {
    await getPool().end();
  }
}

void main();
