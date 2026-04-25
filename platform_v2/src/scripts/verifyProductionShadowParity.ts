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
  limit: number | null;
  json: boolean;
  importVersion: string;
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

type ParityMismatch = {
  key: string;
  expected: number | string;
  actual: number | string;
};

function parseArgs(argv: string[]): VerifyOptions {
  const projectRoot = process.cwd();
  const legacyRoots = resolveLegacyRoots(projectRoot, {
    mirrorRoot: process.env.LEGACY_MIRROR_ROOT,
    legacyDataRoot: process.env.LEGACY_DATA_ROOT,
    uploadsRoot: process.env.LEGACY_UPLOADS_ROOT,
    publicRoot: process.env.LEGACY_PUBLIC_ROOT,
  });
  const options: VerifyOptions = {
    legacyDataRoot: legacyRoots.legacyDataRoot,
    uploadsRoot: legacyRoots.uploadsRoot,
    publicRoot: legacyRoots.publicRoot,
    limit: null,
    json: false,
    importVersion: "production_shadow_live",
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
    if (arg.startsWith("--uploads-root=")) {
      options.uploadsRoot = path.resolve(arg.slice("--uploads-root=".length));
      continue;
    }
    if (arg.startsWith("--public-root=")) {
      options.publicRoot = path.resolve(arg.slice("--public-root=".length));
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

function normalizeForHash(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForHash(item));
  }
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = normalizeForHash((value as Record<string, unknown>)[key]);
        return accumulator;
      }, {});
  }
  return value;
}

function hashRecord(record: unknown): string {
  return createHash("sha256").update(JSON.stringify(normalizeForHash(record))).digest("hex");
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

  const sorted = [...deduped.values()].sort((left, right) => left.id.localeCompare(right.id));
  return options.limit === null ? sorted : sorted.slice(0, options.limit);
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

  return options.limit === null ? sessions : sessions.slice(0, options.limit);
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
        'verify_legacy_parity', 'production_shadow_bootstrap', 'running', $1::jsonb
     ) returning migration_run_id`,
    [JSON.stringify({ import_version: importVersion, limit, verifier: "verifyProductionShadowParity" })],
  );
  const runId = result.rows[0]?.migration_run_id;
  if (!runId) {
    throw new Error("Failed to create production shadow parity run.");
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
    let expectedExistingPhotoRefs = 0;
    let expectedMissingPhotoRefs = 0;

    for (const observation of observations) {
      expectedChecksums.set(observation.id, hashRecord(observation));
      const photos = Array.isArray(observation.photos) ? observation.photos : [];
      for (const photo of photos) {
        if (typeof photo !== "string" || photo.trim() === "") {
          continue;
        }
        expectedPhotoRefs += 1;
        let found = false;
        for (const candidate of resolveAssetCandidatePaths(photo, options)) {
          if (await exists(candidate)) {
            found = true;
            break;
          }
        }
        if (found) {
          expectedExistingPhotoRefs += 1;
        } else {
          expectedMissingPhotoRefs += 1;
        }
      }
    }

    const actualCountsResult = await pool.query<{
      remember_tokens: string;
      track_visits: string;
      track_points: string;
      observation_visits: string;
      observation_occurrences: string;
      identifications_linked: string;
      evidence_assets_linked: string;
    }>(
      `select
          (select count(*)::text from remember_tokens where token_family = 'legacy') as remember_tokens,
          (select count(*)::text from visits where source_kind = 'legacy_track_session') as track_visits,
          (select count(*)::text
           from visit_track_points vtp
           where exists (
             select 1 from visits v
             where v.visit_id = vtp.visit_id
               and v.source_kind = 'legacy_track_session'
           )) as track_points,
          (select count(*)::text from visits where source_kind = 'legacy_observation') as observation_visits,
          (select count(*)::text
           from occurrences o
           where exists (
             select 1 from visits v
             where v.visit_id = o.visit_id
               and v.source_kind = 'legacy_observation'
           )) as observation_occurrences,
          (select count(*)::text
           from identifications ident
           where exists (
             select 1
             from occurrences o
             join visits v on v.visit_id = o.visit_id
             where o.occurrence_id = ident.occurrence_id
               and v.source_kind = 'legacy_observation'
           )) as identifications_linked,
          (select count(*)::text
           from evidence_assets ea
           where ea.asset_role = 'observation_photo'
             and exists (
               select 1 from visits v
               where v.visit_id = ea.visit_id
                 and v.source_kind = 'legacy_observation'
           )) as evidence_assets_linked`,
    );

    const visitRows = await pool.query<{ legacy_observation_id: string; source_payload: JsonRecord | null }>(
      `select legacy_observation_id, source_payload
       from visits
       where source_kind = 'legacy_observation'
         and legacy_observation_id is not null`,
    );

    const checksumMismatches: Array<{ legacyId: string; expected: string; actual: string | null }> = [];
    for (const row of visitRows.rows) {
      const legacyId = row.legacy_observation_id;
      const expectedChecksum = expectedChecksums.get(legacyId);
      if (!expectedChecksum) {
        continue;
      }
      const actualChecksum = row.source_payload ? hashRecord(row.source_payload) : null;
      if (actualChecksum !== expectedChecksum) {
        checksumMismatches.push({
          legacyId,
          expected: expectedChecksum,
          actual: actualChecksum,
        });
      }
    }

    const actualCounts = actualCountsResult.rows[0];
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
        photoRefs: expectedPhotoRefs,
        existingPhotoRefs: expectedExistingPhotoRefs,
        missingPhotoRefs: expectedMissingPhotoRefs,
      },
      actual: {
        rememberTokens: Number(actualCounts?.remember_tokens ?? 0),
        trackVisits: Number(actualCounts?.track_visits ?? 0),
        trackPoints: Number(actualCounts?.track_points ?? 0),
        observationVisits: Number(actualCounts?.observation_visits ?? 0),
        observationOccurrences: Number(actualCounts?.observation_occurrences ?? 0),
        identificationsLinked: Number(actualCounts?.identifications_linked ?? 0),
        evidenceAssetsLinked: Number(actualCounts?.evidence_assets_linked ?? 0),
      },
      checksum: {
        sampled: expectedChecksums.size,
        compared: visitRows.rows.length,
        mismatches: checksumMismatches,
      },
    };

    const mismatches: ParityMismatch[] = [
      { key: "remember_tokens", expected: report.expected.rememberTokens, actual: report.actual.rememberTokens },
      { key: "track_visits", expected: report.expected.trackVisits, actual: report.actual.trackVisits },
      { key: "track_points", expected: report.expected.trackPoints, actual: report.actual.trackPoints },
      { key: "observation_visits", expected: report.expected.observationsImportable, actual: report.actual.observationVisits },
      { key: "observation_occurrences", expected: report.expected.observationsImportable, actual: report.actual.observationOccurrences },
      { key: "identifications_linked", expected: report.expected.importableIdentificationCandidates, actual: report.actual.identificationsLinked },
      { key: "evidence_assets_linked", expected: report.expected.photoRefs, actual: report.actual.evidenceAssetsLinked },
      { key: "checksum.mismatches", expected: 0, actual: report.checksum.mismatches.length },
    ].filter((mismatch) => mismatch.expected !== mismatch.actual);

    await finalizeMigrationRun(
      runId,
      mismatches.length === 0 ? "succeeded" : "failed",
      observations.length,
      mismatches,
      { report, mismatches },
    );

    const output = { report, mismatches };
    console.log(JSON.stringify(output, null, 2));
    if (mismatches.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

void main();
