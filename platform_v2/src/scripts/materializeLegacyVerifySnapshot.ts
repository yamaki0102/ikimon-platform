import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { getPool } from "../db.js";
import { resolveLegacyRoots } from "../legacy/legacyRoots.js";

type Options = {
  mirrorRoot?: string;
  legacyDataRoot: string;
  fallbackMirrorRoots: string[];
  fallbackLegacyDataRoots: string[];
  outputRoot: string;
  importVersion: string;
};

type JsonRecord = Record<string, unknown>;

type LegacyObservation = JsonRecord & {
  id: string;
};

type LegacyAuthToken = JsonRecord & {
  token_hash?: string;
};

type LegacyTrackSession = JsonRecord & {
  session_id: string;
  user_id?: string;
};

function parseArgs(argv: string[]): Options {
  const projectRoot = process.cwd();
  const resolvedRoots = resolveLegacyRoots(projectRoot, {
    mirrorRoot: process.env.LEGACY_MIRROR_ROOT,
    legacyDataRoot: process.env.LEGACY_DATA_ROOT,
    uploadsRoot: process.env.LEGACY_UPLOADS_ROOT,
    publicRoot: process.env.LEGACY_PUBLIC_ROOT,
  });
  const options: Options = {
    mirrorRoot: process.env.LEGACY_MIRROR_ROOT,
    legacyDataRoot: resolvedRoots.legacyDataRoot,
    fallbackMirrorRoots: [],
    fallbackLegacyDataRoots: [],
    outputRoot: path.resolve(projectRoot, "../tmp/legacy-verify-snapshot"),
    importVersion: "",
  };

  for (const arg of argv) {
    if (arg.startsWith("--mirror-root=")) {
      options.mirrorRoot = path.resolve(arg.slice("--mirror-root=".length));
      const mirrorRoots = resolveLegacyRoots(projectRoot, {
        mirrorRoot: options.mirrorRoot,
      });
      options.legacyDataRoot = mirrorRoots.legacyDataRoot;
      continue;
    }
    if (arg.startsWith("--legacy-data-root=")) {
      options.legacyDataRoot = path.resolve(arg.slice("--legacy-data-root=".length));
      continue;
    }
    if (arg.startsWith("--output-root=")) {
      options.outputRoot = path.resolve(arg.slice("--output-root=".length));
      continue;
    }
    if (arg.startsWith("--fallback-legacy-data-root=")) {
      options.fallbackLegacyDataRoots.push(
        path.resolve(arg.slice("--fallback-legacy-data-root=".length)),
      );
      continue;
    }
    if (arg.startsWith("--fallback-mirror-root=")) {
      options.fallbackMirrorRoots.push(
        path.resolve(arg.slice("--fallback-mirror-root=".length)),
      );
      continue;
    }
    if (arg.startsWith("--import-version=")) {
      options.importVersion = arg.slice("--import-version=".length).trim() || options.importVersion;
    }
  }

  return options;
}

async function resolveLatestSucceededImportVersion(): Promise<string | null> {
  const result = await getPool().query<{ import_version: string | null }>(
    `select details->'report'->'options'->>'importVersion' as import_version
     from migration_runs
     where run_type = 'verify_legacy_parity'
       and status = 'succeeded'
     order by started_at desc
     limit 1`,
  );
  const importVersion = result.rows[0]?.import_version;
  return typeof importVersion === "string" && importVersion !== "" ? importVersion : null;
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

async function loadLegacyObservations(legacyDataRoots: string[]): Promise<Map<string, LegacyObservation>> {
  const observations = new Map<string, LegacyObservation>();
  for (const legacyDataRoot of legacyDataRoots) {
    const rootObservations = await readJsonFile<LegacyObservation[]>(
      path.join(legacyDataRoot, "observations.json"),
      [],
    );

    for (const observation of rootObservations) {
      if (typeof observation.id === "string" && observation.id !== "") {
        observations.set(observation.id, observation);
      }
    }

    const observationDir = path.join(legacyDataRoot, "observations");
    try {
      const { readdir } = await import("node:fs/promises");
      const files = (await readdir(observationDir)).filter((name) => name.endsWith(".json")).sort();
      for (const file of files) {
        const batch = await readJsonFile<LegacyObservation[]>(path.join(observationDir, file), []);
        for (const observation of batch) {
          if (typeof observation.id === "string" && observation.id !== "") {
            observations.set(observation.id, observation);
          }
        }
      }
    } catch {
      // ignore missing partition directory
    }
  }

  return observations;
}

async function loadLegacyAuthTokens(legacyDataRoots: string[]): Promise<LegacyAuthToken[]> {
  const tokens = new Map<string, LegacyAuthToken>();
  for (const legacyDataRoot of legacyDataRoots) {
    const batch = await readJsonFile<LegacyAuthToken[]>(path.join(legacyDataRoot, "auth_tokens.json"), []);
    for (const token of batch) {
      if (typeof token.token_hash === "string" && token.token_hash !== "") {
        tokens.set(token.token_hash, token);
      }
    }
  }
  return [...tokens.values()];
}

async function loadLegacyTracks(legacyDataRoots: string[]): Promise<LegacyTrackSession[]> {
  const tracks = new Map<string, LegacyTrackSession>();
  for (const legacyDataRoot of legacyDataRoots) {
    const tracksRoot = path.join(legacyDataRoot, "tracks");

    try {
      const { readdir, stat } = await import("node:fs/promises");
      const userDirs = await readdir(tracksRoot);
      for (const userDir of userDirs) {
        const userRoot = path.join(tracksRoot, userDir);
        if (!(await stat(userRoot)).isDirectory()) {
          continue;
        }
        const files = (await readdir(userRoot)).filter((name) => name.endsWith(".json")).sort();
        for (const file of files) {
          const session = await readJsonFile<LegacyTrackSession | null>(path.join(userRoot, file), null);
          if (session?.session_id) {
            tracks.set(session.session_id, session);
          }
        }
      }
    } catch {
      // ignore missing tracks root
    }
  }

  return [...tracks.values()];
}

async function loadImportedLegacyIds(importVersion: string) {
  const pool = getPool();
  const result = await pool.query<{
    entity_type: string;
    legacy_id: string;
  }>(
    `select entity_type, legacy_id
     from migration_ledger
     where import_version = $1
       and import_status = 'imported'
       and entity_type in ('observation_meaning', 'remember_token', 'track_visit')`,
    [importVersion],
  );

  const ids = {
    observationMeaning: new Set<string>(),
    rememberToken: new Set<string>(),
    trackVisit: new Set<string>(),
  };

  for (const row of result.rows) {
    if (row.entity_type === "observation_meaning") {
      ids.observationMeaning.add(row.legacy_id);
      continue;
    }
    if (row.entity_type === "remember_token") {
      ids.rememberToken.add(row.legacy_id);
      continue;
    }
    if (row.entity_type === "track_visit") {
      ids.trackVisit.add(row.legacy_id);
    }
  }

  return ids;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const importVersion = options.importVersion || (await resolveLatestSucceededImportVersion()) || "v0-plan";
  const fallbackLegacyDataRoots = [
    ...options.fallbackMirrorRoots.map((mirrorRoot) =>
      resolveLegacyRoots(process.cwd(), { mirrorRoot }).legacyDataRoot,
    ),
    ...options.fallbackLegacyDataRoots,
  ];
  const legacyDataRoots = [options.legacyDataRoot, ...fallbackLegacyDataRoots];
  if (options.mirrorRoot && options.outputRoot.endsWith(path.join("tmp", "legacy-verify-snapshot"))) {
    options.outputRoot = path.join(options.mirrorRoot, "verify-fixtures", importVersion);
  }
  const importedIds = await loadImportedLegacyIds(importVersion);
  const observations = await loadLegacyObservations(legacyDataRoots);
  const authTokens = await loadLegacyAuthTokens(legacyDataRoots);
  const tracks = await loadLegacyTracks(legacyDataRoots);

  const filteredObservations = [...observations.values()].filter((item) =>
    importedIds.observationMeaning.has(item.id),
  );
  const filteredAuthTokens = authTokens.filter((item) =>
    typeof item.token_hash === "string" && importedIds.rememberToken.has(item.token_hash),
  );
  const filteredTracks = tracks.filter((item) => importedIds.trackVisit.has(item.session_id));

  const outputDataRoot = path.join(options.outputRoot, "data");
  const outputTracksRoot = path.join(outputDataRoot, "tracks");

  await rm(options.outputRoot, { recursive: true, force: true });
  await mkdir(outputDataRoot, { recursive: true });
  await writeFile(
    path.join(outputDataRoot, "observations.json"),
    JSON.stringify(filteredObservations, null, 2),
    "utf8",
  );
  await writeFile(
    path.join(outputDataRoot, "auth_tokens.json"),
    JSON.stringify(filteredAuthTokens, null, 2),
    "utf8",
  );

  for (const session of filteredTracks) {
    const userId = typeof session.user_id === "string" && session.user_id !== "" ? session.user_id : "_unknown";
    const userRoot = path.join(outputTracksRoot, userId);
    await mkdir(userRoot, { recursive: true });
    await writeFile(
      path.join(userRoot, `${session.session_id}.json`),
      JSON.stringify(session, null, 2),
      "utf8",
    );
  }

  console.log(
    JSON.stringify(
      {
        importVersion,
        mirrorRoot: options.mirrorRoot ?? null,
        legacyDataRoot: options.legacyDataRoot,
        fallbackMirrorRoots: options.fallbackMirrorRoots,
        fallbackLegacyDataRoots,
        outputRoot: options.outputRoot,
        observations: filteredObservations.length,
        rememberTokens: filteredAuthTokens.length,
        trackVisits: filteredTracks.length,
      },
      null,
      2,
    ),
  );

  await getPool().end();
}

void main();
