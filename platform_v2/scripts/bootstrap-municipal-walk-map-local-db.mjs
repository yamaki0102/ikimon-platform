#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, parse, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const platformRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ikimonRoot = resolve(platformRoot, "..", "..", "..");
const defaultScratchRoot = join(parse(platformRoot).root, "Projects", "_agent_scratch");

function parseArgs(argv) {
  const options = {
    port: 55432,
    reset: false,
    stop: false,
    scratchRoot: process.env.AGENT_SCRATCH_ROOT || defaultScratchRoot,
    pgBin: process.env.IKIMON_LOCAL_PG_BIN || "",
  };
  for (const arg of argv) {
    if (arg === "--reset") options.reset = true;
    else if (arg === "--stop") options.stop = true;
    else if (arg.startsWith("--port=")) options.port = Number(arg.slice("--port=".length));
    else if (arg.startsWith("--scratch-root=")) options.scratchRoot = resolve(arg.slice("--scratch-root=".length));
    else if (arg.startsWith("--pg-bin=")) options.pgBin = resolve(arg.slice("--pg-bin=".length));
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isInteger(options.port) || options.port < 1024 || options.port > 65535) {
    throw new Error("--port must be an integer between 1024 and 65535");
  }
  return options;
}

function commandPath(pgBin, command) {
  const exe = process.platform === "win32" ? `${command}.exe` : command;
  return join(pgBin, exe);
}

function findPgBin(explicitPgBin) {
  const candidates = [
    explicitPgBin,
    join(ikimonRoot, "repo_root", "build", "tools", "postgresql-16.14", "pgsql", "bin"),
    "E:\\Projects\\ikimon\\repo_root\\build\\tools\\postgresql-16.14\\pgsql\\bin",
    "C:\\Program Files\\PostgreSQL\\17\\bin",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (existsSync(commandPath(candidate, "initdb"))
      && existsSync(commandPath(candidate, "pg_ctl"))
      && existsSync(commandPath(candidate, "psql"))
      && existsSync(commandPath(candidate, "createdb"))) {
      return candidate;
    }
  }
  throw new Error("PostgreSQL CLI tools were not found. Set IKIMON_LOCAL_PG_BIN or pass --pg-bin=<path>.");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || platformRoot,
    env: { ...process.env, ...(options.env || {}) },
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  if (result.status !== 0) {
    const details = options.capture ? `\n${result.stdout || ""}${result.stderr || ""}` : "";
    throw new Error(`Command failed: ${command} ${args.join(" ")}${details}`);
  }
  return result.stdout || "";
}

function runAllowFailure(command, args) {
  return spawnSync(command, args, {
    cwd: platformRoot,
    env: process.env,
    encoding: "utf8",
    stdio: "ignore",
  });
}

function readDatabaseUrl(envFile) {
  if (!existsSync(envFile)) return "";
  const match = readFileSync(envFile, "utf8").match(/^DATABASE_URL=(.+)$/m);
  return match?.[1]?.trim() || "";
}

function writeDatabaseUrl(envFile, databaseUrl) {
  const previous = existsSync(envFile) ? readFileSync(envFile, "utf8") : "";
  const lines = previous
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith("DATABASE_URL="));
  lines.unshift(`DATABASE_URL=${databaseUrl}`);
  writeFileSync(envFile, `${lines.join("\n")}\n`, "utf8");
}

function passwordFromDatabaseUrl(databaseUrl) {
  const parsed = new URL(databaseUrl);
  return decodeURIComponent(parsed.password);
}

function databaseNameFromUrl(databaseUrl) {
  const parsed = new URL(databaseUrl);
  return parsed.pathname.replace(/^\//, "") || "ikimon_v2";
}

function ensureCleanDataDir(pgBin, dataDir, allowReset) {
  if (!existsSync(dataDir)) return;
  if (!allowReset) return;
  runAllowFailure(commandPath(pgBin, "pg_ctl"), ["-D", dataDir, "stop", "-m", "fast"]);
  rmSync(dataDir, { recursive: true, force: true });
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const pgBin = findPgBin(options.pgBin);
  const root = resolve(options.scratchRoot, "ikimon-local-postgres", "municipal-walk-map");
  const dataDir = join(root, "data");
  const logPath = join(root, "postgres.log");
  const pwFile = join(root, "pw.tmp");
  const envFile = join(platformRoot, ".env.local");

  mkdirSync(root, { recursive: true });

  if (options.stop) {
    if (existsSync(dataDir)) {
      run(commandPath(pgBin, "pg_ctl"), ["-D", dataDir, "stop", "-m", "fast"]);
    }
    console.log(`local postgres stopped: ${dataDir}`);
    return;
  }

  ensureCleanDataDir(pgBin, dataDir, options.reset);

  let databaseUrl = readDatabaseUrl(envFile);
  if (!existsSync(dataDir)) {
    const password = randomBytes(20).toString("hex");
    databaseUrl = `postgres://ikimon:${password}@127.0.0.1:${options.port}/ikimon_v2`;
    writeDatabaseUrl(envFile, databaseUrl);
    writeFileSync(pwFile, password, "ascii");
    try {
      run(commandPath(pgBin, "initdb"), [
        "-D", dataDir,
        "-U", "ikimon",
        `--pwfile=${pwFile}`,
        "--auth-host=scram-sha-256",
        "--auth-local=scram-sha-256",
        "--encoding=UTF8",
        "--locale=C",
      ]);
    } finally {
      rmSync(pwFile, { force: true });
    }
  } else if (!databaseUrl) {
    throw new Error("Existing local data directory found, but .env.local has no DATABASE_URL. Re-run with --reset or restore .env.local.");
  }

  const password = passwordFromDatabaseUrl(databaseUrl);
  const databaseName = databaseNameFromUrl(databaseUrl);
  const commonEnv = { PGPASSWORD: password };
  const pgCtlStatus = spawnSync(commandPath(pgBin, "pg_ctl"), ["-D", dataDir, "status"], { encoding: "utf8" });
  if (pgCtlStatus.status !== 0) {
    run(commandPath(pgBin, "pg_ctl"), [
      "-D", dataDir,
      "-o", `-p ${options.port} -h 127.0.0.1`,
      "-l", logPath,
      "-w",
      "start",
    ]);
  }

  const dbExists = run(commandPath(pgBin, "psql"), [
    "-h", "127.0.0.1",
    "-p", String(options.port),
    "-U", "ikimon",
    "-d", "postgres",
    "-w",
    "-tAc",
    `select datname from pg_database where datname='${databaseName.replaceAll("'", "''")}'`,
  ], { env: commonEnv, capture: true }).trim();
  if (!dbExists) {
    run(commandPath(pgBin, "createdb"), ["-h", "127.0.0.1", "-p", String(options.port), "-U", "ikimon", "-w", databaseName], { env: commonEnv });
  }

  run(commandPath(pgBin, "psql"), [
    "-h", "127.0.0.1",
    "-p", String(options.port),
    "-U", "ikimon",
    "-d", databaseName,
    "-w",
    "-v", "ON_ERROR_STOP=1",
    "-c", "CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE TABLE IF NOT EXISTS users (user_id TEXT PRIMARY KEY);",
  ], { env: commonEnv });
  run(commandPath(pgBin, "psql"), [
    "-h", "127.0.0.1",
    "-p", String(options.port),
    "-U", "ikimon",
    "-d", databaseName,
    "-w",
    "-v", "ON_ERROR_STOP=1",
    "-f", join(platformRoot, "db", "migrations", "0123_municipal_walk_maps.sql"),
  ], { env: commonEnv });

  const summary = run(commandPath(pgBin, "psql"), [
    "-h", "127.0.0.1",
    "-p", String(options.port),
    "-U", "ikimon",
    "-d", databaseName,
    "-w",
    "-tAc",
    "select walk_map_id || '|' || jsonb_array_length(source_references) from municipal_walk_maps where walk_map_id like 'jp-shizuoka-%sample-v0' order by walk_map_id",
  ], { env: commonEnv, capture: true }).trim();

  process.stdout.write([
    "municipal walk-map local DB ready",
    `pg_bin=${pgBin}`,
    `data_dir=${dataDir}`,
    `env_file=${envFile}`,
    "database_url_written=true value_hidden",
    summary,
    "",
  ].join("\n"));
}

main();
