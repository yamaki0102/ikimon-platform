import { createHash } from "node:crypto";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { getPool } from "../db.js";
import { resolveLegacyRoots } from "../legacy/legacyRoots.js";
import { shouldQuarantineLegacyNoPhoto } from "../services/observationQualityGate.js";

type JsonRecord = Record<string, unknown>;

type VerifyOptions = {
  legacyDataRoot: string;
  uploadsRoot: string;
  publicRoot?: string;
  importVersion: string;
  limit: number | null;
  json: boolean;
};

type LegacyObservation = JsonRecord & {
  id: string;
  observed_at?: string;
  created_at?: string;
  updated_at?: string;
  user_id?: string;
  taxon?: JsonRecord;
  photos?: unknown[];
};

type LegacyAuthToken = JsonRecord & {
  user_id?: string;
  token_hash?: string;
};

type LegacyTrackPoint = {
  lat?: number;
  lng?: number;
};

type LegacyTrackSession = JsonRecord & {
  session_id: string;
  user_id?: string;
  started_at?: string;
  updated_at?: string;
  points?: LegacyTrackPoint[];
};

type EntityStatusCounts = {
  pending: number;
  imported: number;
  skipped: number;
  failed: number;
};

type ParityMismatch = {
  key: string;
  expected: number | string;
  actual: number | string;
};

function parseArgs(argv: string[]): VerifyOptions {
  const projectRoot = process.cwd();
  const resolvedRoots = resolveLegacyRoots(projectRoot, {
    mirrorRoot: process.env.LEGACY_MIRROR_ROOT,
    legacyDataRoot: process.env.LEGACY_DATA_ROOT,
    uploadsRoot: process.env.LEGACY_UPLOADS_ROOT,
    publicRoot: process.env.LEGACY_PUBLIC_ROOT,
  });
  const options: VerifyOptions = {
    legacyDataRoot: resolvedRoots.legacyDataRoot,
    uploadsRoot: resolvedRoots.uploadsRoot,
    publicRoot: resolvedRoots.publicRoot,
    importVersion: "v0-plan",
    limit: null,
    json: false,
  };

  for (const arg of argv) {
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg.startsWith("--legacy-data-root=")) {
      options.legacyDataRoot = path.resolve(arg.slice("--legacy-data-root=".length));
      continue;
    }
    if (arg.startsWith("--import-version=")) {
      options.importVersion = arg.slice("--import-version=".length).trim() || options.importVersion;
      continue;
    }
    if (arg.startsWith("--uploads-root=")) {
      options.uploadsRoot = path.resolve(arg.slice("--uploads-root=".length));
      continue;
    }
    if (arg.startsWith("--public-root=")) {
      options.publicRoot = path.resolve(arg.slice("--public-root=".length));
      continue;
    }
    if (arg.startsWith("--mirror-root=")) {
      const mirrorRoots = resolveLegacyRoots(projectRoot, {
        mirrorRoot: arg.slice("--mirror-root=".length),
      });
      options.legacyDataRoot = mirrorRoots.legacyDataRoot;
      options.uploadsRoot = mirrorRoots.uploadsRoot;
      options.publicRoot = mirrorRoots.publicRoot;
      continue;
    }
    if (arg.startsWith("--limit=")) {
      const parsed = Number.parseInt(arg.slice("--limit=".length), 10);
      options.limit = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
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
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function hashRecord(record: unknown): string {
  return createHash("sha256").update(JSON.stringify(record)).digest("hex");
}

function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\/+/, "");
}

function resolveAssetCandidatePaths(relativePath: string, options: VerifyOptions): string[] {
  const normalized = normalizeRelativePath(relativePath);
  const candidates: string[] = [];

  if (normalized.startsWith("uploads/")) {
    candidates.push(path.join(options.uploadsRoot, normalized.slice("uploads/".length)));
    if (options.publicRoot) {
      candidates.push(path.join(options.publicRoot, normalized));
    }
  } else if (normalized.startsWith("data/uploads/")) {
    candidates.push(path.join(options.legacyDataRoot, normalized.slice("data/".length)));
  } else if (options.publicRoot) {
    candidates.push(path.join(options.publicRoot, normalized));
  }

  return [...new Set(candidates)];
}

async function loadLegacyObservations(options: VerifyOptions): Promise<LegacyObservation[]> {
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

async function loadLegacyAuthTokens(options: VerifyOptions): Promise<LegacyAuthToken[]> {
  const tokens = await readJsonFile<LegacyAuthToken[]>(path.join(options.legacyDataRoot, "auth_tokens.json"), []);
  const filtered = tokens.filter(
    (token) =>
      typeof token.user_id === "string" &&
      token.user_id !== "" &&
      typeof token.token_hash === "string" &&
      token.token_hash !== "",
  );
  return options.limit === null ? filtered : filtered.slice(0, options.limit);
}

async function loadLegacyTracks(options: VerifyOptions): Promise<LegacyTrackSession[]> {
  const tracksRoot = path.join(options.legacyDataRoot, "tracks");
  if (!(await exists(tracksRoot))) {
    return [];
  }

  const sessions: LegacyTrackSession[] = [];
  const userDirs = await readdir(tracksRoot);
  for (const userDir of userDirs) {
    const userRoot = path.join(tracksRoot, userDir);
    const files = (await readdir(userRoot)).filter((name) => name.endsWith(".json")).sort();
    for (const filename of files) {
      const session = await readJsonFile<LegacyTrackSession | null>(path.join(userRoot, filename), null);
      if (session?.session_id) {
        sessions.push(session);
      }
    }
  }

  const sorted = sessions.sort((left, right) => {
    const leftTime = toIsoTimestamp(left.started_at ?? left.updated_at) ?? "";
    const rightTime = toIsoTimestamp(right.started_at ?? right.updated_at) ?? "";
    if (leftTime === rightTime) {
      return left.session_id.localeCompare(right.session_id);
    }
    return leftTime.localeCompare(rightTime);
  });
  return options.limit === null ? sorted : sorted.slice(0, options.limit);
}

function countIdentificationCandidates(observations: LegacyObservation[]): number {
  let count = 0;
  for (const observation of observations) {
    const taxon = observation.taxon;
    const proposedName =
      taxon && typeof taxon === "object"
        ? typeof (taxon as JsonRecord).scientific_name === "string" && (taxon as JsonRecord).scientific_name
          ? (taxon as JsonRecord).scientific_name
          : (taxon as JsonRecord).name
        : null;
    if (typeof proposedName === "string" && proposedName.trim() !== "" && typeof observation.user_id === "string" && observation.user_id !== "") {
      count += 1;
    }
  }
  return count;
}

async function createMigrationRun(importVersion: string, limit: number | null): Promise<string> {
  const result = await getPool().query<{ migration_run_id: string }>(
    `insert into migration_runs (
        run_type, source_name, status, details
     ) values (
        'verify_legacy_parity', 'legacy_observation_sample', 'running', $1::jsonb
     ) returning migration_run_id`,
    [JSON.stringify({ import_version: importVersion, limit, verifier: "verifyLegacyParity" })],
  );
  const runId = result.rows[0]?.migration_run_id;
  if (!runId) {
    throw new Error("Failed to create parity verification run.");
  }
  return runId;
}

async function finalizeMigrationRun(
  runId: string,
  status: "succeeded" | "failed",
  rowsSeen: number,
  mismatches: ParityMismatch[],
  report: unknown,
): Promise<void> {
  await getPool().query(
    `update migration_runs
     set status = $2,
         finished_at = now(),
         rows_seen = $3,
         rows_imported = $4,
         rows_failed = $5,
         details = $6::jsonb
     where migration_run_id = $1`,
    [runId, status, rowsSeen, rowsSeen - mismatches.length, mismatches.length, JSON.stringify(report)],
  );
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const observations = await loadLegacyObservations(options);
  const importableObservations = observations.filter((observation) => !shouldQuarantineLegacyNoPhoto(observation));
  const quarantinedNoPhotoObservations = observations.length - importableObservations.length;
  const tokens = await loadLegacyAuthTokens(options);
  const tracks = await loadLegacyTracks(options);
  const pool = getPool();
  const runId = await createMigrationRun(options.importVersion, options.limit);

  try {
    const expectedChecksums = new Map<string, string>();
    let expectedPhotoRefs = 0;
    const expectedUniquePhotoRefs = new Set<string>();
    let expectedExistingPhotoRefs = 0;
    let expectedMissingPhotoRefs = 0;
    const expectedUniqueExistingPhotoRefs = new Set<string>();
    const expectedUniqueMissingPhotoRefs = new Set<string>();
    for (const observation of observations) {
      expectedChecksums.set(observation.id, hashRecord(observation));
      const photos = Array.isArray(observation.photos) ? observation.photos : [];
      for (const photo of photos) {
        if (typeof photo === "string" && photo.trim() !== "") {
          const normalized = normalizeRelativePath(photo);
          expectedPhotoRefs += 1;
          expectedUniquePhotoRefs.add(normalized);
          let found = false;
          for (const candidate of resolveAssetCandidatePaths(normalized, options)) {
            if (await exists(candidate)) {
              found = true;
              break;
            }
          }
          if (found) {
            expectedExistingPhotoRefs += 1;
            expectedUniqueExistingPhotoRefs.add(normalized);
          } else {
            expectedMissingPhotoRefs += 1;
            expectedUniqueMissingPhotoRefs.add(normalized);
          }
        }
      }
    }

    const ledgerCountsResult = await pool.query<{
      entity_type: string;
      import_status: string;
      count: string;
    }>(
      `select entity_type, import_status, count(*)::text as count
       from migration_ledger
       where import_version = $1
       group by entity_type, import_status`,
      [options.importVersion],
    );

    const statusTemplate = (): EntityStatusCounts => ({
      pending: 0,
      imported: 0,
      skipped: 0,
      failed: 0,
    });
    const ledgerCounts: Record<string, EntityStatusCounts> = {};
    for (const row of ledgerCountsResult.rows) {
      const entityType = row.entity_type;
      const status = row.import_status as keyof EntityStatusCounts;
      ledgerCounts[entityType] ??= statusTemplate();
      if (status in ledgerCounts[entityType]) {
        ledgerCounts[entityType][status] = Number(row.count);
      }
    }

    const checksumRows = await pool.query<{
      legacy_id: string;
      source_checksum: string | null;
      import_status: string;
    }>(
      `select legacy_id, source_checksum, import_status
       from migration_ledger
       where entity_type = 'observation_meaning'
         and import_version = $1`,
      [options.importVersion],
    );

    const checksumMismatches: Array<{ legacyId: string; expected: string; actual: string | null }> = [];
    for (const row of checksumRows.rows) {
      const expectedChecksum = expectedChecksums.get(row.legacy_id);
      if (!expectedChecksum) {
        continue;
      }
      if (row.source_checksum !== expectedChecksum) {
        checksumMismatches.push({
          legacyId: row.legacy_id,
          expected: expectedChecksum,
          actual: row.source_checksum,
        });
      }
    }

    const importedObservationIds = checksumRows.rows
      .filter((row) => row.import_status === "imported")
      .map((row) => row.legacy_id);

    const importedMeaningRowsResult = importedObservationIds.length === 0
      ? { rows: [{ visits: "0", occurrences: "0" }] }
      : await pool.query<{ visits: string; occurrences: string }>(
          `select
              count(distinct visits.visit_id)::text as visits,
              count(distinct occurrences.occurrence_id)::text as occurrences
           from visits
           left join occurrences on occurrences.visit_id = visits.visit_id
           where visits.legacy_observation_id = any($1::text[])`,
          [importedObservationIds],
        );

    const importedMeaningRows = importedMeaningRowsResult.rows[0];
    const assetCountsResult = await pool.query<{
      asset_ledger_imported: string;
      asset_ledger_skipped: string;
      evidence_assets_linked: string;
      identifications_linked: string;
      place_conditions_linked: string;
    }>(
      `select
         (select count(*)::text
           from asset_ledger
           where import_version = $1
             and logical_asset_type = 'observation_photo'
             and import_status = 'imported') as asset_ledger_imported,
         (select count(*)::text
           from asset_ledger
           where import_version = $1
             and logical_asset_type = 'observation_photo'
             and import_status = 'skipped') as asset_ledger_skipped,
          (select count(*)::text
           from evidence_assets ea
           where exists (
             select 1
             from asset_ledger al
             where al.import_version = $1
               and al.asset_ledger_id::text = ea.source_payload->>'asset_ledger_id'
           )) as evidence_assets_linked,
          (select count(*)::text
           from identifications ident
           where exists (
             select 1
             from migration_ledger ml
             where ml.import_version = $1
               and ml.entity_type = 'identification'
               and ml.import_status = 'imported'
               and ml.canonical_id = ident.identification_id::text
           )) as identifications_linked,
          (select count(*)::text
           from place_conditions pc
           where exists (
             select 1
             from migration_ledger ml
             where ml.import_version = $1
               and ml.entity_type = 'place_condition'
               and ml.import_status = 'imported'
               and ml.canonical_id = pc.place_condition_id::text
           )) as place_conditions_linked`,
      [options.importVersion],
    );

    const assetCounts = assetCountsResult.rows[0];
    const report = {
      options,
      expected: {
        observationsSampled: observations.length,
        observationsImportable: importableObservations.length,
        quarantinedNoPhotoObservations,
        rememberTokens: tokens.length,
        trackVisits: tracks.length,
        trackPoints: tracks.reduce((sum, track) => sum + (Array.isArray(track.points) ? track.points.length : 0), 0),
        identificationCandidates: countIdentificationCandidates(observations),
        importableIdentificationCandidates: countIdentificationCandidates(importableObservations),
        conditionCandidates: observations.length,
        importableConditionCandidates: importableObservations.length,
        photoRefs: expectedPhotoRefs,
        uniquePhotoRefs: expectedUniquePhotoRefs.size,
        existingPhotoRefs: expectedExistingPhotoRefs,
        missingPhotoRefs: expectedMissingPhotoRefs,
        uniqueExistingPhotoRefs: expectedUniqueExistingPhotoRefs.size,
        uniqueMissingPhotoRefs: expectedUniqueMissingPhotoRefs.size,
      },
      actual: {
        rememberToken: ledgerCounts.remember_token ?? statusTemplate(),
        trackVisit: ledgerCounts.track_visit ?? statusTemplate(),
        observationMeaning: ledgerCounts.observation_meaning ?? statusTemplate(),
        identification: ledgerCounts.identification ?? statusTemplate(),
        placeCondition: ledgerCounts.place_condition ?? statusTemplate(),
        visitsImported: Number(importedMeaningRows?.visits ?? 0),
        occurrencesImported: Number(importedMeaningRows?.occurrences ?? 0),
        assetLedgerImported: Number(assetCounts?.asset_ledger_imported ?? 0),
        assetLedgerSkipped: Number(assetCounts?.asset_ledger_skipped ?? 0),
        evidenceAssetsLinked: Number(assetCounts?.evidence_assets_linked ?? 0),
        identificationsLinked: Number(assetCounts?.identifications_linked ?? 0),
        placeConditionsLinked: Number(assetCounts?.place_conditions_linked ?? 0),
        trackVisitsLinked: ledgerCounts.track_visit?.imported ?? 0,
        trackPointsImported: 0,
      },
      checksum: {
        sampled: expectedChecksums.size,
        compared: checksumRows.rows.length,
        mismatches: checksumMismatches,
      },
    };

    const trackVisitIdsResult = await pool.query<{ canonical_id: string }>(
      `select canonical_id
       from migration_ledger
       where import_version = $1
         and entity_type = 'track_visit'
         and import_status = 'imported'`,
      [options.importVersion],
    );
    const importedTrackVisitIds = trackVisitIdsResult.rows
      .map((row) => row.canonical_id)
      .filter((value): value is string => typeof value === "string" && value !== "");
    if (importedTrackVisitIds.length > 0) {
      const trackPointResult = await pool.query<{ count: string }>(
        `select count(*)::text as count
         from visit_track_points
         where visit_id = any($1::text[])`,
        [importedTrackVisitIds],
      );
      report.actual.trackPointsImported = Number(trackPointResult.rows[0]?.count ?? 0);
    }

    const mismatches: ParityMismatch[] = [
      {
        key: "remember_token.imported",
        expected: report.expected.rememberTokens,
        actual: report.actual.rememberToken.imported,
      },
      {
        key: "track_visit.imported",
        expected: report.expected.trackVisits,
        actual: report.actual.trackVisit.imported,
      },
      {
        key: "track_points.imported",
        expected: report.expected.trackPoints,
        actual: report.actual.trackPointsImported,
      },
      {
        key: "observation_meaning.imported",
        expected: report.expected.observationsImportable,
        actual: report.actual.observationMeaning.imported,
      },
      {
        key: "observation_meaning.skipped",
        expected: report.expected.quarantinedNoPhotoObservations,
        actual: report.actual.observationMeaning.skipped,
      },
      {
        key: "visitsImported",
        expected: report.expected.observationsImportable,
        actual: report.actual.visitsImported,
      },
      {
        key: "occurrencesImported",
        expected: report.expected.observationsImportable,
        actual: report.actual.occurrencesImported,
      },
      {
        key: "identification.imported",
        expected: report.expected.importableIdentificationCandidates,
        actual: report.actual.identification.imported,
      },
      {
        key: "identification.skipped",
        expected: report.expected.identificationCandidates - report.expected.importableIdentificationCandidates,
        actual: report.actual.identification.skipped,
      },
      {
        key: "identifications.linked",
        expected: report.expected.importableIdentificationCandidates,
        actual: report.actual.identificationsLinked,
      },
      {
        key: "place_condition.imported",
        expected: report.expected.importableConditionCandidates,
        actual: report.actual.placeCondition.imported,
      },
      {
        key: "place_condition.skipped",
        expected: report.expected.conditionCandidates - report.expected.importableConditionCandidates,
        actual: report.actual.placeCondition.skipped,
      },
      {
        key: "place_conditions.linked",
        expected: report.expected.importableConditionCandidates,
        actual: report.actual.placeConditionsLinked,
      },
      {
        key: "asset_ledger.imported",
        expected: report.expected.uniqueExistingPhotoRefs,
        actual: report.actual.assetLedgerImported,
      },
      {
        key: "asset_ledger.skipped",
        expected: report.expected.uniqueMissingPhotoRefs,
        actual: report.actual.assetLedgerSkipped,
      },
      {
        key: "evidence_assets.linked",
        expected: report.expected.existingPhotoRefs,
        actual: report.actual.evidenceAssetsLinked,
      },
      {
        key: "checksum.mismatches",
        expected: 0,
        actual: report.checksum.mismatches.length,
      },
    ].filter((mismatch) => mismatch.expected !== mismatch.actual);

    await finalizeMigrationRun(
      runId,
      mismatches.length === 0 ? "succeeded" : "failed",
      observations.length,
      mismatches,
      { report, mismatches },
    );

    const output = { report, mismatches };
    if (options.json) {
      console.log(JSON.stringify(output, null, 2));
    } else {
      console.log(JSON.stringify(output, null, 2));
    }

    if (mismatches.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

void main();
