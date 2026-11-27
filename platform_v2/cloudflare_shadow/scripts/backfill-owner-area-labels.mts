import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import {
  OWNER_AREA_BACKFILL_SQL,
  buildOwnerAreaBackfillSql,
  ownerAreaCellKey,
  ownerAreaLabelFromNominatim,
  type OwnerAreaBackfillRow,
} from "../src/ownerAreaLabel";

const UA = "zukan-owner-area-label-backfill/1.0 (+https://zukan.earth)";

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

function d1Select<T>(database: string, sql: string): T[] {
  if (!/^\s*SELECT\b/iu.test(sql)) throw new Error("only_select_allowed");
  const bin = path.join(path.dirname(createRequire(import.meta.url).resolve("wrangler/package.json")), "bin", "wrangler.js");
  const r = spawnSync(process.execPath, [bin, "d1", "execute", database, "--remote", "--json", "--command", sql.replace(/\s+/gu, " ")], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`wrangler_failed:${r.stderr?.slice(0, 300)}`);
  return (JSON.parse(r.stdout) as Array<{ results?: T[] }>)[0]?.results ?? [];
}

async function main(): Promise<void> {
  const outDir = arg("--out-dir");
  const snapshot = arg("--snapshot");
  const d1 = arg("--d1");
  const offline = process.argv.includes("--offline");
  const delayMs = Number(arg("--delay-ms") ?? "1100");
  if (!outDir || (!snapshot && !d1)) throw new Error("usage: (--snapshot <rows.json> | --d1 <db_name>) --out-dir <dir> [--cache <file>] [--offline] [--delay-ms <n>]");
  if (!Number.isFinite(delayMs) || delayMs < 1000) throw new Error("delay_ms_must_be_at_least_1000");
  await mkdir(outDir, { recursive: true });
  const cacheFile = path.resolve(arg("--cache") ?? path.join(outDir, "cell-cache.json"));
  const rows: OwnerAreaBackfillRow[] = snapshot ? JSON.parse(await readFile(snapshot, "utf8")) : d1Select<OwnerAreaBackfillRow>(d1!, OWNER_AREA_BACKFILL_SQL);
  let cache: Record<string, string | null> = {};
  try { cache = JSON.parse(await readFile(cacheFile, "utf8")); } catch { cache = {}; }
  const cells = new Set<string>();
  for (const row of rows) { const key = ownerAreaCellKey(row); if (key) cells.add(key); }
  let fetched = 0;
  for (const key of [...cells].sort()) {
    if (key in cache || offline) continue;
    const [lat, lng] = key.split(",");
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&accept-language=ja&zoom=12&lat=${lat}&lon=${lng}`, { headers: { Accept: "application/json", "User-Agent": UA } });
      cache[key] = response.ok ? ownerAreaLabelFromNominatim(await response.json()) : null;
    } catch {
      cache[key] = null;
    }
    fetched += 1;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  await writeFile(cacheFile, JSON.stringify(cache, null, 1), "utf8");
  const entries: Array<{ observationId: string; label: string }> = [];
  const byReason: Record<string, number> = {};
  const preview = ["observation_id,cell,label"];
  for (const row of rows) {
    const key = ownerAreaCellKey(row);
    const label = key ? cache[key] ?? null : null;
    const reason = !key ? "no_cell" : label ? "fill" : "unresolved";
    byReason[reason] = (byReason[reason] ?? 0) + 1;
    preview.push([row.observation_id, key ?? "", label ?? ""].join(","));
    if (label) entries.push({ observationId: row.observation_id, label });
  }
  const sql = buildOwnerAreaBackfillSql(entries);
  const header = "-- owner area label cache (dry-run output; apply only after review)\n-- BEFORE APPLY: record D1 Time Travel bookmark; migration 0088_owner_area_label_cache.sql must be applied first\n-- idempotent: INSERT OR IGNORE\n";
  await writeFile(path.join(outDir, "updates.sql"), header + sql.updates, "utf8");
  await writeFile(path.join(outDir, "rollback.sql"), "-- removes only rows written by updates.sql\n" + sql.rollback, "utf8");
  await writeFile(path.join(outDir, "preview.csv"), preview.join("\n") + "\n", "utf8");
  const summary = { total: rows.length, statements: entries.length, byReason, fetchedCells: fetched, uniqueCells: cells.size };
  await writeFile(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
