import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  buildRecordObservationBackfillPlan,
  type RecordObservationBackfillInput,
} from "../src/cloudflareObservationBackfill";
import { publicRecordDetailPrivacyFindings } from "../src/cloudflareObservationReadModel";

type CliArgs = { input: string; outputDir: string; report: string; batchSize: number };

function parseArgs(argv: string[]): CliArgs {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value) throw new Error("usage: --input <json> --output-dir <dir> --report <json> [--batch-size <n>]");
    values.set(key, value);
  }
  const input = values.get("--input");
  const outputDir = values.get("--output-dir");
  const report = values.get("--report");
  const batchSize = Number(values.get("--batch-size") ?? "200");
  if (!input || !outputDir || !report || !Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500) {
    throw new Error("invalid_backfill_builder_arguments");
  }
  return { input: path.resolve(input), outputDir: path.resolve(outputDir), report: path.resolve(report), batchSize };
}

function validateSnapshot(value: unknown): asserts value is RecordObservationBackfillInput {
  if (!value || typeof value !== "object") throw new Error("backfill_snapshot_invalid");
  const row = value as Partial<RecordObservationBackfillInput>;
  if (!Array.isArray(row.observations) || !Array.isArray(row.assets) || !Array.isArray(row.identifications) || !Array.isArray(row.aiTargets)) {
    throw new Error("backfill_snapshot_collections_invalid");
  }
}

function sqlLiteral(value: string | number | null): string {
  if (value === null) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("backfill_sql_non_finite_number");
    return String(value);
  }
  return `'${value.replaceAll("'", "''")}'`;
}

export function compileBackfillMutation(sql: string, values: Array<string | number | null>): string {
  let index = 0;
  const compiled = sql.replace(/\?/gu, () => {
    if (index >= values.length) throw new Error("backfill_sql_placeholder_underflow");
    return sqlLiteral(values[index++] ?? null);
  });
  if (index !== values.length) throw new Error("backfill_sql_placeholder_overflow");
  return `${compiled.trim()};`;
}

const digest = (value: string): string => createHash("sha256").update(value).digest("hex");

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const snapshot = JSON.parse(await readFile(args.input, "utf8")) as unknown;
  validateSnapshot(snapshot);
  const plan = await buildRecordObservationBackfillPlan(snapshot);
  const batches: Array<{ file: string; mutationCount: number; sha256: string }> = [];
  await mkdir(args.outputDir, { recursive: true });
  for (let offset = 0; offset < plan.mutations.length; offset += args.batchSize) {
    const batch = plan.mutations.slice(offset, offset + args.batchSize);
    const content = [
      "PRAGMA foreign_keys = ON;",
      ...batch.map((mutation) => compileBackfillMutation(mutation.sql, mutation.values)),
      "PRAGMA foreign_key_check;",
      "",
    ].join("\n");
    const file = `record-observation-backfill-${String(batches.length + 1).padStart(4, "0")}.sql`;
    await writeFile(path.join(args.outputDir, file), content, { encoding: "utf8", flag: "wx" });
    batches.push({ file, mutationCount: batch.length, sha256: digest(content) });
  }
  const snapshotDigest = digest(JSON.stringify(snapshot));
  const report = {
    ...plan.report,
    snapshotSha256: snapshotDigest,
    batchCount: batches.length,
    batches,
    generatedAt: new Date().toISOString(),
    containsRawLocation: publicRecordDetailPrivacyFindings(snapshot).length > 0,
    executionRequired: true,
  };
  await writeFile(args.report, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  process.stdout.write(`${JSON.stringify({ ok: true, report: plan.report, batchCount: batches.length, snapshotSha256: snapshotDigest })}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
