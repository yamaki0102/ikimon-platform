import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { getPool } from "../db.js";
import { resolveLegacyRoots } from "../legacy/legacyRoots.js";

type JsonRecord = Record<string, unknown>;

type ImportOptions = {
  legacyDataRoot: string;
  uploadsRoot: string;
  publicRoot?: string;
  dryRun: boolean;
  limit: number | null;
  importVersion: string;
};

type LegacyObservation = JsonRecord & {
  id: string;
  photos?: unknown[];
  observed_at?: string;
  created_at?: string;
  updated_at?: string;
};

type EvidenceSummary = {
  observationsRead: number;
  evidencePlanned: number;
  evidenceImported: number;
  evidenceSkipped: number;
  missingFiles: number;
  missingBindings: number;
  evidenceAlreadyImported: number;
};

function parseArgs(argv: string[]): ImportOptions {
  const projectRoot = process.cwd();
  const legacyRoots = resolveLegacyRoots(projectRoot, {
    mirrorRoot: process.env.LEGACY_MIRROR_ROOT,
    legacyDataRoot: process.env.LEGACY_DATA_ROOT,
    uploadsRoot: process.env.LEGACY_UPLOADS_ROOT,
    publicRoot: process.env.LEGACY_PUBLIC_ROOT,
  });
  const options: ImportOptions = {
    legacyDataRoot: legacyRoots.legacyDataRoot,
    uploadsRoot: legacyRoots.uploadsRoot,
    publicRoot: legacyRoots.publicRoot,
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
  const observations = [...deduped.values()].sort((left, right) => {
    const leftTime = toIsoTimestamp(left.observed_at ?? left.created_at ?? left.updated_at) ?? "";
    const rightTime = toIsoTimestamp(right.observed_at ?? right.created_at ?? right.updated_at) ?? "";
    if (leftTime === rightTime) {
      return left.id.localeCompare(right.id);
    }
    return leftTime.localeCompare(rightTime);
  });
  const limited = options.limit === null ? observations : observations.slice(0, options.limit);

  return new Map(limited.map((observation) => [observation.id, observation]));
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

function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\/+/, "");
}

function resolveAssetCandidatePaths(relativePath: string, options: ImportOptions): string[] {
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

async function sha256ForFile(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  return createHash("sha256").update(buffer).digest("hex");
}

async function ensureDatabaseReady(): Promise<void> {
  await getPool().query("select 1");
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const observations = await loadLegacyObservations(options);
  const summary: EvidenceSummary = {
    observationsRead: observations.size,
    evidencePlanned: 0,
    evidenceImported: 0,
    evidenceSkipped: 0,
    missingFiles: 0,
    missingBindings: 0,
    evidenceAlreadyImported: 0,
  };

  if (options.dryRun) {
    for (const observation of observations.values()) {
      const photos = Array.isArray(observation.photos) ? observation.photos : [];
      summary.evidencePlanned += photos.filter((photo) => typeof photo === "string" && photo.trim() !== "").length;
    }
    console.log(JSON.stringify({ options, summary }, null, 2));
    return;
  }

  await ensureDatabaseReady();
  const pool = getPool();
  const existingLedger = await pool.query<{
    legacy_relative_path: string;
    import_status: string;
    asset_id: string | null;
    evidence_exists: boolean;
  }>(
    `select al.legacy_relative_path,
            al.import_status,
            al.asset_id::text,
            (ea.asset_id is not null) as evidence_exists
       from asset_ledger al
       left join evidence_assets ea on ea.asset_id = al.asset_id
      where al.legacy_source = 'php_fs'
        and al.import_version = $1`,
    [options.importVersion],
  );
  const completedAssetLedger = new Set<string>();
  for (const row of existingLedger.rows) {
    if (row.import_status === "imported" && row.asset_id && row.evidence_exists) {
      completedAssetLedger.add(row.legacy_relative_path);
    }
  }
  const ledgerRows = await pool.query<{
    legacy_id: string;
    canonical_id: string;
    canonical_parent_id: string | null;
  }>(
    `select ml.legacy_id,
            o.occurrence_id as canonical_id,
            o.visit_id as canonical_parent_id
       from migration_ledger ml
       join occurrences o on o.occurrence_id = ml.canonical_id
      where ml.entity_type = 'observation_meaning'
        and ml.import_status = 'imported'
        and ml.import_version = $1`,
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

  for (const observation of observations.values()) {
    const photos = Array.isArray(observation.photos) ? observation.photos : [];
    if (photos.length === 0) {
      continue;
    }

    const binding = bindingMap.get(observation.id);
    if (!binding) {
      summary.missingBindings += photos.length;
      summary.evidenceSkipped += photos.length;
      continue;
    }

    for (let index = 0; index < photos.length; index += 1) {
      const photo = photos[index];
      if (typeof photo !== "string" || photo.trim() === "") {
        continue;
      }

      const normalized = normalizeRelativePath(photo);
      if (completedAssetLedger.has(normalized)) {
        summary.evidenceAlreadyImported += 1;
        continue;
      }
      const legacyAssetKey = `observation_photo:${observation.id}:${index}:${normalized}`;
      summary.evidencePlanned += 1;

      let storagePath = normalized;
      let sha256: string | null = null;
      let bytes: number | null = null;
      let assetExists = false;
      for (const candidate of resolveAssetCandidatePaths(normalized, options)) {
        if (await exists(candidate)) {
          storagePath = candidate;
          sha256 = await sha256ForFile(candidate);
          bytes = (await stat(candidate)).size;
          assetExists = true;
          break;
        }
      }

      if (!assetExists) {
        summary.missingFiles += 1;
      }

      const assetLedgerStatus = assetExists ? "imported" : "skipped";
      const assetLedgerReason = assetExists ? null : "missing_file";

      const assetLedgerResult = await pool.query<{ asset_ledger_id: string }>(
        `insert into asset_ledger (
            asset_ledger_id, legacy_source, legacy_relative_path, logical_asset_type,
            storage_backend, storage_path, import_status, skipped_reason,
            sha256, bytes, import_version, metadata
         ) values (
            $1::uuid, 'php_fs', $2, 'photo',
            'legacy_fs', $3, $4, $5,
            $6, $7, $8, $9::jsonb
         )
         on conflict (legacy_source, legacy_relative_path, import_version) do update set
            storage_backend = excluded.storage_backend,
            storage_path = excluded.storage_path,
            import_status = excluded.import_status,
            skipped_reason = excluded.skipped_reason,
            sha256 = excluded.sha256,
            bytes = excluded.bytes,
            metadata = excluded.metadata
         returning asset_ledger_id`,
        [
          randomUUID(),
          normalized,
          storagePath,
          assetLedgerStatus,
          assetLedgerReason,
          sha256,
          bytes,
          options.importVersion,
          JSON.stringify({
            legacy_asset_key: legacyAssetKey,
            source_observation_id: observation.id,
            importer: "importObservationEvidence",
          }),
        ],
      );

      if (!assetExists) {
        summary.evidenceSkipped += 1;
        continue;
      }

      const blobResult = await pool.query<{ blob_id: string }>(
        `insert into asset_blobs (
            blob_id, storage_backend, storage_path, media_type, public_url, sha256, bytes, source_payload, created_at, updated_at
         ) values (
            $1::uuid, 'legacy_fs', $2, 'image', $3, $4, $5, $6::jsonb, now(), now()
         )
         on conflict (storage_backend, storage_path) do update set
            sha256 = coalesce(excluded.sha256, asset_blobs.sha256),
            bytes = coalesce(excluded.bytes, asset_blobs.bytes),
            source_payload = excluded.source_payload,
            updated_at = now()
         returning blob_id`,
        [
          randomUUID(),
          storagePath,
          normalized,
          sha256,
          bytes,
          JSON.stringify({
            legacy_relative_path: normalized,
            source_observation_id: observation.id,
          }),
        ],
      );

      const blobId = blobResult.rows[0]?.blob_id;
      if (!blobId) {
        summary.evidenceSkipped += 1;
        continue;
      }

      const assetResult = await pool.query<{ asset_id: string }>(
        `insert into evidence_assets (
            asset_id, blob_id, occurrence_id, visit_id, asset_role, legacy_asset_key, legacy_relative_path, source_payload
         ) values (
            $1::uuid, $2::uuid, $3, $4, 'observation_photo', $5, $6, $7::jsonb
         )
         on conflict (legacy_asset_key) do update set
            blob_id = excluded.blob_id,
            occurrence_id = excluded.occurrence_id,
            visit_id = excluded.visit_id,
            legacy_relative_path = excluded.legacy_relative_path,
            source_payload = excluded.source_payload
         returning asset_id`,
        [
          randomUUID(),
          blobId,
          binding.occurrenceId,
          binding.visitId,
          legacyAssetKey,
          normalized,
          JSON.stringify({
            asset_ledger_id: assetLedgerResult.rows[0]?.asset_ledger_id ?? null,
            source_observation_id: observation.id,
            importer: "importObservationEvidence",
          }),
        ],
      );
      const assetId = assetResult.rows[0]?.asset_id;
      if (!assetId) {
        summary.evidenceSkipped += 1;
        continue;
      }

      await pool.query(
        `update asset_ledger
         set blob_id = $2::uuid, asset_id = $3::uuid, imported_at = now()
         where asset_ledger_id = $1::uuid`,
        [assetLedgerResult.rows[0]?.asset_ledger_id, blobId, assetId],
      );

      summary.evidenceImported += 1;
    }
  }

  console.log(JSON.stringify({ options, summary }, null, 2));
  await pool.end();
}

void main();
