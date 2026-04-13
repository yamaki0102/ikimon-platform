import { spawn } from "node:child_process";
import { getPool } from "../db.js";
import { getReadinessSnapshot } from "../services/readiness.js";

type RehearsalOptions = {
  mirrorRoot?: string;
  legacyDataRoot?: string;
  uploadsRoot?: string;
  publicRoot?: string;
  baseUrl?: string;
  fixturePrefix?: string;
  syncForce: boolean;
  skipReadSmoke: boolean;
  skipWriteSmoke: boolean;
};

function parseArgs(argv: string[]): RehearsalOptions {
  const options: RehearsalOptions = {
    syncForce: false,
    skipReadSmoke: false,
    skipWriteSmoke: false,
  };
  for (const arg of argv) {
    if (arg.startsWith("--mirror-root=")) {
      options.mirrorRoot = arg.slice("--mirror-root=".length);
      continue;
    }
    if (arg.startsWith("--legacy-data-root=")) {
      options.legacyDataRoot = arg.slice("--legacy-data-root=".length);
      continue;
    }
    if (arg.startsWith("--uploads-root=")) {
      options.uploadsRoot = arg.slice("--uploads-root=".length);
      continue;
    }
    if (arg.startsWith("--public-root=")) {
      options.publicRoot = arg.slice("--public-root=".length);
      continue;
    }
    if (arg.startsWith("--base-url=")) {
      options.baseUrl = arg.slice("--base-url=".length);
      continue;
    }
    if (arg.startsWith("--fixture-prefix=")) {
      options.fixturePrefix = arg.slice("--fixture-prefix=".length);
      continue;
    }
    if (arg === "--force-sync") {
      options.syncForce = true;
      continue;
    }
    if (arg === "--skip-read-smoke") {
      options.skipReadSmoke = true;
      continue;
    }
    if (arg === "--skip-write-smoke") {
      options.skipWriteSmoke = true;
    }
  }
  return options;
}

function runNpmScript(scriptName: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", scriptName, "--", ...args], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${scriptName} exited with code ${code ?? -1}`));
    });
  });
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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const latestImportVersion = await resolveLatestSucceededImportVersion();
  const sharedArgs = [
    ...(options.mirrorRoot ? [`--mirror-root=${options.mirrorRoot}`] : []),
    ...(options.legacyDataRoot ? [`--legacy-data-root=${options.legacyDataRoot}`] : []),
    ...(options.uploadsRoot ? [`--uploads-root=${options.uploadsRoot}`] : []),
    ...(options.publicRoot ? [`--public-root=${options.publicRoot}`] : []),
    ...(latestImportVersion ? [`--import-version=${latestImportVersion}`] : []),
    ...(options.syncForce ? ["--force"] : []),
  ];
  const readSmokeArgs = options.baseUrl ? [`--base-url=${options.baseUrl}`] : [];
  const writeSmokeArgs = [
    ...(options.baseUrl ? [`--base-url=${options.baseUrl}`] : []),
    ...(options.fixturePrefix ? [`--fixture-prefix=${options.fixturePrefix}`] : []),
  ];

  await runNpmScript("sync:legacy", sharedArgs);
  await runNpmScript("verify:legacy", sharedArgs);
  if (!options.skipReadSmoke && options.baseUrl) {
    await runNpmScript("smoke:v2-lane", readSmokeArgs);
    await runNpmScript("smoke:v2-read-lane", readSmokeArgs);
  }
  if (!options.skipWriteSmoke && options.baseUrl) {
    await runNpmScript("smoke:v2-write-lane", writeSmokeArgs);
  }

  try {
    const readiness = await getReadinessSnapshot();
    console.log(JSON.stringify(readiness, null, 2));
    if (!readiness.gates.rollbackSafetyWindowReady) {
      process.exitCode = 1;
    }
  } finally {
    await getPool().end();
  }
}

void main();
