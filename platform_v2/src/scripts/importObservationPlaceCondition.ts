import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { getPool } from "../db.js";
import { resolveLegacyRoots } from "../legacy/legacyRoots.js";

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
  biome?: string;
  cultivation?: string;
  organism_origin?: string;
  managed_context?: JsonRecord;
  substrate_tags?: unknown[];
  evidence_tags?: unknown[];
  note?: string;
};

type ImportSummary = {
  observationsRead: number;
  conditionsPlanned: number;
  conditionsImported: number;
  conditionsSkipped: number;
  conditionsAlreadyImported: number;
  missingBindings: number;
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
    const leftTime = toIsoTimestamp(left.observed_at ?? left.created_at ?? left.updated_at) ?? "";
    const rightTime = toIsoTimestamp(right.observed_at ?? right.created_at ?? right.updated_at) ?? "";
    if (leftTime === rightTime) {
      return left.id.localeCompare(right.id);
    }
    return leftTime.localeCompare(rightTime);
  });
  return options.limit === null ? observations : observations.slice(0, options.limit);
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

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item !== "");
}

async function ensureDatabaseReady(): Promise<void> {
  await getPool().query("select 1");
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const observations = await loadLegacyObservations(options);
  const summary: ImportSummary = {
    observationsRead: observations.length,
    conditionsPlanned: observations.length,
    conditionsImported: 0,
    conditionsSkipped: 0,
    conditionsAlreadyImported: 0,
    missingBindings: 0,
  };

  if (options.dryRun) {
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
     where entity_type = 'place_condition'
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
  const ledgerRows = await pool.query<{
    legacy_id: string;
    canonical_id: string;
    canonical_parent_id: string | null;
    place_id: string | null;
  }>(
    `select ledger.legacy_id, ledger.canonical_id, ledger.canonical_parent_id, visits.place_id
     from migration_ledger ledger
     left join visits on visits.visit_id = ledger.canonical_parent_id
     where entity_type = 'observation_meaning'
       and import_status = 'imported'
       and import_version = $1`,
    [options.importVersion],
  );

  const bindingMap = new Map<string, { occurrenceId: string; visitId: string; placeId: string | null }>();
  for (const row of ledgerRows.rows) {
    if (!row.legacy_id || !row.canonical_id) {
      continue;
    }
    bindingMap.set(row.legacy_id, {
      occurrenceId: row.canonical_id,
      visitId: row.canonical_parent_id ?? row.legacy_id,
      placeId: row.place_id ?? null,
    });
  }

  for (const observation of observations) {
    const ledgerKey = `${observation.id}:condition`;
    if (completedLedger.has(ledgerKey)) {
      summary.conditionsAlreadyImported += 1;
      continue;
    }

    const binding = bindingMap.get(observation.id);
    if (!binding || !binding.placeId) {
      summary.missingBindings += 1;
      summary.conditionsSkipped += 1;
      await pool.query(
        `insert into migration_ledger (
            migration_ledger_id, entity_type, legacy_source, legacy_entity_type, legacy_id,
            canonical_entity_type, canonical_id, canonical_parent_type, canonical_parent_id,
            import_status, skipped_reason, import_version, metadata
         ) values (
            gen_random_uuid(), 'place_condition', 'php_json', 'observation_condition', $1,
            'place_condition', null, 'visit', null,
            'skipped', 'missing_required_fields', $2, $3::jsonb
         )
         on conflict (legacy_source, legacy_entity_type, legacy_id, import_version) do update set
            import_status = excluded.import_status,
            skipped_reason = excluded.skipped_reason,
            metadata = excluded.metadata`,
        [
          ledgerKey,
          options.importVersion,
          JSON.stringify({ reason: "missing_binding", importer: "importObservationPlaceCondition" }),
        ],
      );
      continue;
    }

    const managed = observation.managed_context ?? {};
    const observedAt = toIsoTimestamp(observation.observed_at ?? observation.created_at ?? observation.updated_at) ?? new Date().toISOString();

    const result = await pool.query<{ place_condition_id: string }>(
      `insert into place_conditions (
          place_condition_id, place_id, visit_id, observed_at, biome, managed_context_type, managed_site_name,
          substrate_tags, evidence_tags, organism_origin, cultivation, locality_note, summary, metadata
       ) values (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6,
          $7::jsonb, $8::jsonb, $9, $10, $11, $12, $13::jsonb
      ) returning place_condition_id`,
      [
        binding.placeId,
        binding.visitId,
        observedAt,
        observation.biome ?? null,
        typeof (managed as JsonRecord).type === "string" ? ((managed as JsonRecord).type as string) : null,
        typeof (managed as JsonRecord).site_name === "string" ? ((managed as JsonRecord).site_name as string) : null,
        JSON.stringify(asStringArray(observation.substrate_tags)),
        JSON.stringify(asStringArray(observation.evidence_tags)),
        observation.organism_origin ?? null,
        observation.cultivation ?? null,
        observation.note ?? null,
        null,
        JSON.stringify({ legacy_observation_id: observation.id, importer: "importObservationPlaceCondition" }),
      ],
    );

    const placeConditionId = result.rows[0]?.place_condition_id ?? null;
    await pool.query(
      `insert into migration_ledger (
          migration_ledger_id, entity_type, legacy_source, legacy_entity_type, legacy_id,
          canonical_entity_type, canonical_id, canonical_parent_type, canonical_parent_id,
          import_status, skipped_reason, import_version, metadata
       ) values (
          gen_random_uuid(), 'place_condition', 'php_json', 'observation_condition', $1,
          'place_condition', $2, 'visit', $3,
          'imported', null, $4, $5::jsonb
       )
       on conflict (legacy_source, legacy_entity_type, legacy_id, import_version) do update set
          canonical_entity_type = excluded.canonical_entity_type,
          canonical_id = excluded.canonical_id,
          canonical_parent_type = excluded.canonical_parent_type,
          canonical_parent_id = excluded.canonical_parent_id,
          import_status = excluded.import_status,
          skipped_reason = excluded.skipped_reason,
          metadata = excluded.metadata`,
      [
        ledgerKey,
        placeConditionId,
        binding.visitId,
        options.importVersion,
        JSON.stringify({ importer: "importObservationPlaceCondition" }),
      ],
    );

    summary.conditionsImported += 1;
  }

  console.log(JSON.stringify({ options, summary }, null, 2));
  await pool.end();
}

void main();
