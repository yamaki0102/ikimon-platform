import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { classifyOrientationBackfill, readJpegDimensions, readJpegExifOrientation } from "../src/imageOrientation";

// Dry run only: reads D1 rows and R2 originals through wrangler, writes nothing, prints one JSON line per asset and a SQL proposal that is never executed.
// usage: npx tsx scripts/media-orientation-backfill.mts [--db ikimon_prod_observations_2026_06] [--bucket ikimon-prod-media] [--limit 200] [--since 2026-01-01] [--asset <asset_id>]
const argv = process.argv.slice(2);
const arg = (name: string, fallback: string): string => {
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] ? argv[index + 1]! : fallback;
};
const database = arg("--db", "ikimon_prod_observations_2026_06");
const bucket = arg("--bucket", "ikimon-prod-media");
const limit = Math.max(1, Math.min(2000, Number(arg("--limit", "200")) || 200));
const since = arg("--since", "");
const onlyAsset = arg("--asset", "");
const wrangler = (args: string[]): string => execFileSync("npx", ["wrangler", ...args], { encoding: "utf8", maxBuffer: 256 << 20, shell: process.platform === "win32" });

const where = ["mime = 'image/jpeg'", "public_derivative_key IS NOT NULL", "public_derivative_metadata_json IS NOT NULL"];
if (since) where.push(`uploaded_at >= '${since.replace(/[^0-9T:\- ]/g, "")}'`);
if (onlyAsset) where.push(`asset_id = '${onlyAsset.replace(/[^A-Za-z0-9_-]/g, "")}'`);
const sql = `SELECT asset_id, observation_id, object_key, public_derivative_metadata_json FROM asset_ledger WHERE ${where.join(" AND ")} ORDER BY uploaded_at DESC LIMIT ${limit}`;
const parsed = JSON.parse(wrangler(["d1", "execute", database, "--remote", "--json", "--command", sql])) as Array<{ results: Array<{ asset_id: string; observation_id: string; object_key: string; public_derivative_metadata_json: string }> }>;
const rows = parsed[0]?.results ?? [];

const scratch = mkdtempSync(join(tmpdir(), "orientation-backfill-"));
const regenerate: string[] = [];
const counts = { ok: 0, regenerate: 0, no_exif_orientation: 0, error: 0 };
try {
  for (const row of rows) {
    try {
      const metadata = JSON.parse(row.public_derivative_metadata_json) as Record<string, unknown>;
      const file = join(scratch, "original.jpg");
      wrangler(["r2", "object", "get", `${bucket}/${row.object_key}`, "--remote", "--file", file]);
      const bytes = new Uint8Array(readFileSync(file));
      const raw = readJpegDimensions(bytes);
      const exifOrientation = readJpegExifOrientation(bytes);
      const verdict = classifyOrientationBackfill({
        exifOrientation,
        rawWidth: raw?.width ?? Number(metadata.sourceWidth ?? 0),
        rawHeight: raw?.height ?? Number(metadata.sourceHeight ?? 0),
        derivativeWidth: Number(metadata.derivativeWidth ?? 0),
        derivativeHeight: Number(metadata.derivativeHeight ?? 0),
      });
      counts[verdict] += 1;
      if (verdict === "regenerate") regenerate.push(row.asset_id);
      console.log(JSON.stringify({ assetId: row.asset_id, observationId: row.observation_id, exifOrientation, raw, derivative: { width: metadata.derivativeWidth, height: metadata.derivativeHeight }, verdict }));
    } catch (error) {
      counts.error += 1;
      console.log(JSON.stringify({ assetId: row.asset_id, verdict: "error", message: error instanceof Error ? error.message.slice(0, 200) : "unknown" }));
    }
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
console.log(JSON.stringify({ summary: counts, scanned: rows.length }));
if (regenerate.length > 0) {
  console.log("-- NOT EXECUTED. Re-derive through the scheduled public derivative upgrade (the new derivative code corrects the orientation):");
  console.log(`UPDATE asset_ledger SET public_derivative_metadata_json = json_remove(public_derivative_metadata_json, '$.inspectionVersion') WHERE asset_id IN (${regenerate.map((id) => `'${id}'`).join(", ")});`);
}
console.log("-- no_exif_orientation rows cannot be inferred: the stored pixels themselves may be sideways. The owner fixes those with the per-photo rotate button in record settings (stored in asset_display_rotation).");
