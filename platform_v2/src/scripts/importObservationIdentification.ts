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
  user_id?: string;
  taxon?: JsonRecord;
  observed_at?: string;
  created_at?: string;
  updated_at?: string;
};

type ImportSummary = {
  observationsRead: number;
  identificationPlanned: number;
  identificationImported: number;
  identificationSkipped: number;
  identificationAlreadyImported: number;
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

function resolveProposedName(observation: LegacyObservation): string | null {
  const taxon = observation.taxon;
  if (taxon && typeof taxon === "object") {
    const sci = (taxon as JsonRecord).scientific_name;
    if (typeof sci === "string" && sci.trim() !== "") {
      return sci.trim();
    }
    const name = (taxon as JsonRecord).name;
    if (typeof name === "string" && name.trim() !== "") {
      return name.trim();
    }
  }
  return null;
}

async function ensureDatabaseReady(): Promise<void> {
  await getPool().query("select 1");
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const observations = await loadLegacyObservations(options);
  const summary: ImportSummary = {
    observationsRead: observations.length,
    identificationPlanned: 0,
    identificationImported: 0,
    identificationSkipped: 0,
    identificationAlreadyImported: 0,
    missingBindings: 0,
  };

  for (const observation of observations) {
    if (resolveProposedName(observation) && typeof observation.user_id === "string" && observation.user_id !== "") {
      summary.identificationPlanned += 1;
    }
  }

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
     where entity_type = 'identification'
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
  }>(
    `select legacy_id, canonical_id, canonical_parent_id
     from migration_ledger
     where entity_type = 'observation_meaning'
       and import_status = 'imported'
       and import_version = $1`,
    [options.importVersion],
  );

  const bindingMap = new Map<string, { occurrenceId: string; visitId: string }>();
  for (const row of ledgerRows.rows) {
    if (!row.legacy_id || !row.canonical_id) {
      continue;
    }
    bindingMap.set(row.legacy_id, {
      occurrenceId: row.canonical_id,
      visitId: row.canonical_parent_id ?? row.legacy_id,
    });
  }

  for (const observation of observations) {
    const proposedName = resolveProposedName(observation);
    if (!proposedName || typeof observation.user_id !== "string" || observation.user_id === "") {
      continue;
    }

    const ledgerKey = `${observation.id}:primary`;
    if (completedLedger.has(ledgerKey)) {
      summary.identificationAlreadyImported += 1;
      continue;
    }

    const binding = bindingMap.get(observation.id);
    if (!binding) {
      summary.missingBindings += 1;
      summary.identificationSkipped += 1;
      await pool.query(
        `insert into migration_ledger (
            migration_ledger_id, entity_type, legacy_source, legacy_entity_type, legacy_id,
            canonical_entity_type, canonical_id, canonical_parent_type, canonical_parent_id,
            import_status, skipped_reason, import_version, metadata
         ) values (
            gen_random_uuid(), 'identification', 'php_json', 'observation_identification', $1,
            'identification', null, 'occurrence', null,
            'skipped', 'missing_required_fields', $2, $3::jsonb
         )
         on conflict (legacy_source, legacy_entity_type, legacy_id, import_version) do update set
            import_status = excluded.import_status,
            skipped_reason = excluded.skipped_reason,
            metadata = excluded.metadata`,
        [
          ledgerKey,
          options.importVersion,
          JSON.stringify({ reason: "missing_binding", importer: "importObservationIdentification" }),
        ],
      );
      continue;
    }

    const legacyIdentificationKey = `legacy_taxon:${binding.occurrenceId}:primary`;
    const identificationResult = await pool.query<{ identification_id: string }>(
      `insert into identifications (
          occurrence_id, actor_user_id, actor_kind, proposed_name, proposed_rank, legacy_identification_key,
          identification_method, confidence_score, is_current, notes, source_payload
       ) values (
          $1, $2, 'human', $3, $4, $5, 'legacy_taxon_snapshot', null, true, null, $6::jsonb
       )
       on conflict (legacy_identification_key) do update set
          occurrence_id = excluded.occurrence_id,
          actor_user_id = excluded.actor_user_id,
          proposed_name = excluded.proposed_name,
          proposed_rank = excluded.proposed_rank,
          identification_method = excluded.identification_method,
          is_current = excluded.is_current,
          notes = excluded.notes,
          source_payload = excluded.source_payload
       returning identification_id`,
      [
        binding.occurrenceId,
        observation.user_id,
        proposedName,
        typeof observation.taxon === "object" ? ((observation.taxon as JsonRecord).rank as string | undefined) ?? null : null,
        legacyIdentificationKey,
        JSON.stringify({
          legacy_observation_id: observation.id,
          importer: "importObservationIdentification",
        }),
      ],
    );

    const identificationId = identificationResult.rows[0]?.identification_id ?? null;
    await pool.query(
      `insert into migration_ledger (
          migration_ledger_id, entity_type, legacy_source, legacy_entity_type, legacy_id,
          canonical_entity_type, canonical_id, canonical_parent_type, canonical_parent_id,
          import_status, skipped_reason, import_version, metadata
       ) values (
          gen_random_uuid(), 'identification', 'php_json', 'observation_identification', $1,
          'identification', $2, 'occurrence', $3,
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
        identificationId,
        binding.occurrenceId,
        options.importVersion,
        JSON.stringify({
          legacy_identification_key: legacyIdentificationKey,
          importer: "importObservationIdentification",
        }),
      ],
    );

    summary.identificationImported += 1;
  }

  console.log(JSON.stringify({ options, summary }, null, 2));
  await pool.end();
}

void main();
