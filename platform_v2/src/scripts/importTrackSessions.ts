import { access, readFile, readdir, stat } from "node:fs/promises";
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

type LegacyTrackPoint = {
  lat?: number;
  lng?: number;
  accuracy?: number;
  altitude?: number | null;
  timestamp?: number;
};

type LegacyTrackSession = JsonRecord & {
  session_id: string;
  user_id?: string;
  field_id?: string | null;
  started_at?: string;
  updated_at?: string;
  total_distance_m?: number;
  step_count?: number;
  points?: LegacyTrackPoint[];
};

type ImportSummary = {
  tracksRead: number;
  tracksPlanned: number;
  tracksImported: number;
  tracksSkipped: number;
  tracksAlreadyImported: number;
  trackPointsImported: number;
  missingUsers: number;
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

async function loadLegacyTracks(options: ImportOptions): Promise<LegacyTrackSession[]> {
  const tracksRoot = path.join(options.legacyDataRoot, "tracks");
  if (!(await exists(tracksRoot))) {
    return [];
  }

  const sessions: LegacyTrackSession[] = [];
  const userDirs = await readdir(tracksRoot);
  for (const userDir of userDirs) {
    const userRoot = path.join(tracksRoot, userDir);
    const userStat = await stat(userRoot);
    if (!userStat.isDirectory()) {
      continue;
    }

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

async function ensureDatabaseReady(): Promise<void> {
  await getPool().query("select 1");
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const tracks = await loadLegacyTracks(options);
  const summary: ImportSummary = {
    tracksRead: tracks.length,
    tracksPlanned: tracks.length,
    tracksImported: 0,
    tracksSkipped: 0,
    tracksAlreadyImported: 0,
    trackPointsImported: 0,
    missingUsers: 0,
  };

  if (options.dryRun) {
    summary.trackPointsImported = tracks.reduce((sum, track) => sum + (Array.isArray(track.points) ? track.points.length : 0), 0);
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
     where entity_type = 'track_visit'
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

  for (const session of tracks) {
    const ledgerKey = session.session_id;
    if (completedLedger.has(ledgerKey)) {
      summary.tracksAlreadyImported += 1;
      continue;
    }

    const userId = typeof session.user_id === "string" ? session.user_id : "";
    const userExistsResult = userId === ""
      ? { rows: [{ exists: false }] }
      : await pool.query<{ exists: boolean }>(
          `select exists(select 1 from users where user_id = $1) as exists`,
          [userId],
        );
    const userExists = Boolean(userExistsResult.rows[0]?.exists);
    if (!userExists) {
      summary.missingUsers += 1;
      summary.tracksSkipped += 1;
      await pool.query(
        `insert into migration_ledger (
            migration_ledger_id, entity_type, legacy_source, legacy_entity_type, legacy_id,
            canonical_entity_type, canonical_id, canonical_parent_type, canonical_parent_id,
            import_status, skipped_reason, import_version, metadata
         ) values (
            gen_random_uuid(), 'track_visit', 'php_json', 'track_session', $1,
            'visit', null, 'user', $2,
            'skipped', 'missing_required_fields', $3, $4::jsonb
         )
         on conflict (legacy_source, legacy_entity_type, legacy_id, import_version) do update set
            import_status = excluded.import_status,
            skipped_reason = excluded.skipped_reason,
            canonical_parent_type = excluded.canonical_parent_type,
            canonical_parent_id = excluded.canonical_parent_id,
            metadata = excluded.metadata`,
        [
          ledgerKey,
          userId || null,
          options.importVersion,
          JSON.stringify({ importer: "importTrackSessions", reason: "missing_user" }),
        ],
      );
      continue;
    }

    const points = Array.isArray(session.points) ? session.points : [];
    const visitId = `track:${session.session_id}`;
    const firstPoint = points.find((point) => asFiniteNumber(point.lat) !== null && asFiniteNumber(point.lng) !== null);
    const observedAt = toIsoTimestamp(session.started_at ?? session.updated_at) ?? new Date().toISOString();
    const firstLat = asFiniteNumber(firstPoint?.lat);
    const firstLng = asFiniteNumber(firstPoint?.lng);
    const placeId =
      firstLat !== null && firstLng !== null
        ? `geo:${firstLat.toFixed(3)}:${firstLng.toFixed(3)}`
        : "place:unknown";

    await pool.query(
      `insert into places (
          place_id, legacy_place_key, canonical_name, source_kind, center_latitude, center_longitude, metadata, created_at, updated_at
       ) values (
          $1, $2, $3, 'legacy_track', $4, $5, $6::jsonb, $7, now()
       )
       on conflict (place_id) do update set
          center_latitude = coalesce(excluded.center_latitude, places.center_latitude),
          center_longitude = coalesce(excluded.center_longitude, places.center_longitude),
          metadata = excluded.metadata,
          updated_at = now()`,
      [
        placeId,
        placeId,
        "Legacy Track Place",
        firstLat,
        firstLng,
        JSON.stringify({ field_id: session.field_id ?? null, importer: "importTrackSessions" }),
        observedAt,
      ],
    );

    await pool.query(
      `insert into visits (
          visit_id, place_id, user_id, observed_at, session_mode, visit_mode, effort_minutes,
          distance_meters, step_count, point_latitude, point_longitude, source_kind, source_payload, created_at, updated_at
       ) values (
          $1, $2, $3, $4, 'fieldscan', 'track', null, $5, $6, $7, $8, 'legacy_track_session', $9::jsonb, $10, now()
       )
       on conflict (visit_id) do update set
          place_id = excluded.place_id,
          user_id = excluded.user_id,
          observed_at = excluded.observed_at,
          distance_meters = excluded.distance_meters,
          step_count = excluded.step_count,
          point_latitude = excluded.point_latitude,
          point_longitude = excluded.point_longitude,
          source_payload = excluded.source_payload,
          updated_at = now()`,
      [
        visitId,
        placeId,
        userId,
        observedAt,
        asFiniteNumber(session.total_distance_m),
        Number.isFinite(session.step_count) ? session.step_count : null,
        firstLat,
        firstLng,
        JSON.stringify(session),
        observedAt,
      ],
    );

    await pool.query(`delete from visit_track_points where visit_id = $1`, [visitId]);
    let sequence = 0;
    for (const point of points) {
      const lat = asFiniteNumber(point.lat);
      const lng = asFiniteNumber(point.lng);
      if (lat === null || lng === null) {
        continue;
      }

      await pool.query(
        `insert into visit_track_points (
            visit_id, observed_at, sequence_no, point_latitude, point_longitude, accuracy_m, altitude_m, speed_mps, heading_degrees, raw_payload
         ) values (
            $1, $2, $3, $4, $5, $6, $7, null, null, $8::jsonb
         )`,
        [
          visitId,
          toIsoTimestamp(point.timestamp) ?? observedAt,
          sequence,
          lat,
          lng,
          asFiniteNumber(point.accuracy),
          asFiniteNumber(point.altitude),
          JSON.stringify(point),
        ],
      );

      summary.trackPointsImported += 1;
      sequence += 1;
    }

    await pool.query(
      `insert into migration_ledger (
          migration_ledger_id, entity_type, legacy_source, legacy_entity_type, legacy_id,
          canonical_entity_type, canonical_id, canonical_parent_type, canonical_parent_id,
          import_status, skipped_reason, import_version, observed_at, metadata
       ) values (
          gen_random_uuid(), 'track_visit', 'php_json', 'track_session', $1,
          'visit', $2, 'user', $3,
          'imported', null, $4, $5, $6::jsonb
       )
       on conflict (legacy_source, legacy_entity_type, legacy_id, import_version) do update set
          canonical_entity_type = excluded.canonical_entity_type,
          canonical_id = excluded.canonical_id,
          canonical_parent_type = excluded.canonical_parent_type,
          canonical_parent_id = excluded.canonical_parent_id,
          import_status = excluded.import_status,
          skipped_reason = excluded.skipped_reason,
          observed_at = excluded.observed_at,
          metadata = excluded.metadata`,
      [
        ledgerKey,
        visitId,
        userId,
        options.importVersion,
        observedAt,
        JSON.stringify({ importer: "importTrackSessions", track_point_count: sequence }),
      ],
    );

    summary.tracksImported += 1;
  }

  console.log(JSON.stringify({ options, summary }, null, 2));
  await pool.end();
}

void main();
