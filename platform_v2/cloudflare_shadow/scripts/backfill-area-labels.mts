import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import {
  AREA_BACKFILL_ACTIVE_LIST_VERSION_SQL,
  AREA_BACKFILL_CANDIDATE_SQL,
  buildAreaBackfillSensitiveTaxaSql,
  buildAreaBackfillSql,
  buildAreaPreviewCsv,
  cellLocalityFromNominatim,
  decideAreaLabel,
  parsePublicCellCenter,
  summarizeAreaDecisions,
  type AreaBackfillRow,
  type CellLocality,
  type SensitiveTier,
} from "../src/areaLabelBackfill";

const NOMINATIM_USER_AGENT = "zukan-area-label-backfill/1.0 (+https://zukan.earth)";

type Args = { snapshot: string | null; d1: string | null; sensitive: string | null; outDir: string; cache: string; offline: boolean; delayMs: number };

function parseArgs(argv: string[]): Args {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key?.startsWith("--")) throw new Error("usage: (--snapshot <rows.json> | --d1 <db_name>) --out-dir <dir> [--sensitive <tiers.json>] [--cache <file>] [--offline] [--delay-ms <n>]");
    if (key === "--offline") { flags.add(key); continue; }
    const value = argv[i + 1];
    if (!value) throw new Error(`missing_value:${key}`);
    values.set(key, value);
    i += 1;
  }
  const outDir = values.get("--out-dir");
  const snapshot = values.get("--snapshot") ?? null;
  const d1 = values.get("--d1") ?? null;
  if (!outDir || (!snapshot && !d1)) throw new Error("invalid_arguments: --out-dir and one of --snapshot/--d1 are required");
  const delayMs = Number(values.get("--delay-ms") ?? "1100");
  if (!Number.isFinite(delayMs) || delayMs < 1000) throw new Error("delay_ms_must_be_at_least_1000_(Nominatim 1 req/s policy)");
  return {
    snapshot: snapshot ? path.resolve(snapshot) : null,
    d1,
    sensitive: values.get("--sensitive") ? path.resolve(values.get("--sensitive")!) : null,
    outDir: path.resolve(outDir),
    cache: path.resolve(values.get("--cache") ?? path.join(outDir, "cell-cache.json")),
    offline: flags.has("--offline"),
    delayMs,
  };
}

function d1Select<T>(database: string, sql: string): T[] {
  if (!/^\s*SELECT\b/iu.test(sql)) throw new Error("only_select_allowed");
  const wranglerBin = path.join(path.dirname(createRequire(import.meta.url).resolve("wrangler/package.json")), "bin", "wrangler.js");
  const result = spawnSync(process.execPath, [wranglerBin, "d1", "execute", database, "--remote", "--json", "--command", sql.replace(/\s+/gu, " ")], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`wrangler_failed:${result.stderr?.slice(0, 300)}`);
  const parsed = JSON.parse(result.stdout) as Array<{ results?: T[] }>;
  return parsed[0]?.results ?? [];
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try { return JSON.parse(await readFile(file, "utf8")) as T; } catch { return fallback; }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  await mkdir(args.outDir, { recursive: true });

  const rows: AreaBackfillRow[] = args.snapshot
    ? JSON.parse(await readFile(args.snapshot, "utf8"))
    : d1Select<AreaBackfillRow>(args.d1!, AREA_BACKFILL_CANDIDATE_SQL);
  let sensitiveRows: Array<{ name_key: string; tier: string }> = [];
  if (args.sensitive) {
    sensitiveRows = JSON.parse(await readFile(args.sensitive, "utf8"));
  } else if (args.d1) {
    const activeVersion = d1Select<{ list_version: string }>(args.d1, AREA_BACKFILL_ACTIVE_LIST_VERSION_SQL)[0];
    if (activeVersion?.list_version) {
      sensitiveRows = d1Select(args.d1, buildAreaBackfillSensitiveTaxaSql(String(activeVersion.list_version)));
    }
  }
  const tiers = new Map<string, SensitiveTier>(sensitiveRows.map((r) => [String(r.name_key), r.tier === "withhold" ? "withhold" : "coarse"]));

  const cache = await readJson<Record<string, CellLocality | null>>(args.cache, {});
  const cells = new Set<string>();
  for (const row of rows) {
    const cell = parsePublicCellCenter(row.public_cell);
    if (cell && row.visibility === "public") cells.add(cell.key);
  }
  let fetched = 0;
  for (const key of [...cells].sort()) {
    if (key in cache) continue;
    if (args.offline) continue;
    const [lat, lng] = key.split(",");
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&accept-language=ja&zoom=12&lat=${lat}&lon=${lng}`;
    try {
      const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": NOMINATIM_USER_AGENT } });
      cache[key] = response.ok ? cellLocalityFromNominatim(await response.json()) : null;
    } catch {
      cache[key] = null;
    }
    fetched += 1;
    await new Promise((resolve) => setTimeout(resolve, args.delayMs));
  }
  await writeFile(args.cache, JSON.stringify(cache, null, 1), "utf8");

  const localities = new Map(Object.entries(cache));
  const decisions = rows.map((row) => decideAreaLabel(row, localities, tiers));
  const sql = buildAreaBackfillSql(decisions);
  const summary = summarizeAreaDecisions(decisions);

  const header = [
    "-- area label backfill (dry-run output; apply only after review)",
    "-- BEFORE APPLY: record the D1 Time Travel bookmark (wrangler d1 time-travel info <db> --remote)",
    "-- idempotent: every UPDATE is guarded by an empty-label check and visibility/emergency_hidden",
    "",
  ].join("\n");
  await writeFile(path.join(args.outDir, "updates.sql"), header + sql.updates, "utf8");
  await writeFile(path.join(args.outDir, "rollback.sql"), "-- reverts only labels written by updates.sql (matches value)\n" + sql.rollback, "utf8");
  await writeFile(path.join(args.outDir, "preview.csv"), buildAreaPreviewCsv(decisions), "utf8");
  await writeFile(path.join(args.outDir, "summary.json"), JSON.stringify({ ...summary, fetchedCells: fetched, uniqueCells: cells.size, statements: sql.statementCount, sensitiveListRows: tiers.size }, null, 2), "utf8");
  console.log(JSON.stringify({ ...summary, fetchedCells: fetched, uniqueCells: cells.size, statements: sql.statementCount }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
