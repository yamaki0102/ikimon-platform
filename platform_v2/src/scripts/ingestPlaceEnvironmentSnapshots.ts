import { readFile } from "node:fs/promises";
import { ingestPlaceEnvironmentRecords, type PlaceEnvironmentIngestRecord } from "../services/placeEnvironmentIngest.js";

function argValue(name: string): string | null {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  if (hit) return hit.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function asRecords(value: unknown): PlaceEnvironmentIngestRecord[] {
  if (Array.isArray(value)) return value as PlaceEnvironmentIngestRecord[];
  if (value && typeof value === "object" && Array.isArray((value as { records?: unknown }).records)) {
    return (value as { records: PlaceEnvironmentIngestRecord[] }).records;
  }
  throw new Error("expected JSON array or { records: [...] }");
}

async function loadRecords(): Promise<PlaceEnvironmentIngestRecord[]> {
  const file = argValue("file");
  const url = argValue("url");
  const envJson = process.env.PLACE_ENVIRONMENT_INGEST_JSON;
  if (file) {
    return asRecords(JSON.parse(await readFile(file, "utf8")));
  }
  if (url) {
    const response = await fetch(url, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`fetch_failed:${response.status}`);
    return asRecords(await response.json());
  }
  if (envJson) {
    return asRecords(JSON.parse(envJson));
  }
  throw new Error("usage: npm run ingest:place-environment -- --file=records.json [--dry-run] or --url=https://...");
}

async function main(): Promise<void> {
  const records = await loadRecords();
  const result = await ingestPlaceEnvironmentRecords(records, {
    dryRun: hasFlag("dry-run"),
    curatorRunId: argValue("curator-run-id"),
  });
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
