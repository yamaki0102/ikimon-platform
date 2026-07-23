import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { resolveOsmAreaByRef } from "../services/areaPolygons.js";
import {
  buildD1RecordPlaceBackfillSql,
  runRecordPlaceBackfill,
  type RecordBackfillInput,
} from "../services/recordPlaceBackfill.js";
import {
  materializePlaceSeed,
  osmFullJsonToBoundary,
  parsePlaceSeedDocument,
} from "../services/placeSeed.js";

function flag(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readRecordsPayload(path: string): Promise<unknown> {
  if (path !== "-") return JSON.parse(await readFile(resolve(path), "utf8"));
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) throw new Error("records_stdin_empty");
  return JSON.parse(text);
}

const recordsPath = flag("--records");
const reportPath = resolve(flag("--report") ?? "../docs/spec/universal-place-atlas/evidence/backfill-dry-run.json");
const sqlPath = flag("--emit-d1-sql") ? resolve(flag("--emit-d1-sql")!) : null;
const seedPath = resolve(flag("--seed") ?? "../ops/data/universal_place_atlas_canary.json");
const summaryOnly = process.argv.includes("--summary-only");
if (!recordsPath) throw new Error("--records is required; use a local JSON path or '-' for stdin");

const recordPayload = await readRecordsPayload(recordsPath) as
  | RecordBackfillInput[]
  | { results?: RecordBackfillInput[] }
  | Array<{ results?: RecordBackfillInput[] }>;
const records = Array.isArray(recordPayload)
  ? (recordPayload.length > 0 && "results" in (recordPayload[0] as object)
    ? (recordPayload as Array<{ results?: RecordBackfillInput[] }>).flatMap((part) => part.results ?? [])
    : recordPayload as RecordBackfillInput[])
  : recordPayload.results ?? [];
const document = parsePlaceSeedDocument(JSON.parse(await readFile(seedPath, "utf8")));
const materialized = await materializePlaceSeed({
  document,
  resolveBoundary: async (osmType, osmId) => {
    const area = await resolveOsmAreaByRef(osmType, osmId);
    if (area) {
      return {
        geometry: area.geometry as { type: "Polygon" | "MultiPolygon"; coordinates: unknown },
        actualName: area.name,
        actualPlaceKind: area.placeKind ?? "other_named_area",
        osmType,
        osmId,
      };
    }
    const response = await fetch(`https://api.openstreetmap.org/api/0.6/${osmType}/${osmId}/full.json`, {
      headers: { accept: "application/json", "user-agent": "ikimon-place-atlas-backfill/1.0" },
    });
    return response.ok
      ? osmFullJsonToBoundary({ payload: await response.json(), osmType, osmId })
      : null;
  },
});
if (materialized.failed.length > 0) {
  await writeJson(reportPath, {
    version: "record_place_backfill_report/v1",
    dryRun: true,
    blocked: "boundary_resolution_incomplete",
    failed: materialized.failed,
  });
  throw new Error("boundary_resolution_incomplete");
}
const report = runRecordPlaceBackfill({
  records,
  boundaries: materialized.places.map((place) => ({
    placeId: place.entry.placeId,
    geometry: place.boundary.geometry,
    confidence: 0.9,
    precision: "exact",
    hierarchyDepth: 1,
    areaHa: place.areaHa,
  })),
});
const recordsById = new Map(records.map((record) => [record.recordId, record]));
const membershipBreakdownByPlace = Object.fromEntries(
  [...report.memberships.reduce((counts, row) => {
    const current = counts.get(row.placeId) ?? {
      records: 0,
      confirmed: 0,
      candidate: 0,
      publicRecords: 0,
      sourceOccurrences: 0,
    };
    const source = recordsById.get(row.recordId);
    current.records += 1;
    if (row.state === "confirmed") current.confirmed += 1;
    if (row.state === "candidate") current.candidate += 1;
    if (source?.publicVisibility === "public") current.publicRecords += 1;
    const occurrenceCount = Number(source?.occurrenceCount);
    if (Number.isInteger(occurrenceCount) && occurrenceCount >= 0) {
      current.sourceOccurrences += occurrenceCount;
    }
    counts.set(row.placeId, current);
    return counts;
  }, new Map<string, {
    records: number;
    confirmed: number;
    candidate: number;
    publicRecords: number;
    sourceOccurrences: number;
  }>()).entries()].sort(([left], [right]) => left.localeCompare(right)),
);
const evidenceReport = summaryOnly
  ? {
      ...Object.fromEntries(Object.entries(report).filter(([key]) =>
        key !== "memberships" && key !== "themeAssertions"
      )),
      membershipCountsByPlace: Object.fromEntries(report.memberships.reduce((counts, row) => {
        counts.set(row.placeId, (counts.get(row.placeId) ?? 0) + 1);
        return counts;
      }, new Map<string, number>())),
      membershipBreakdownByPlace,
      themeCounts: Object.fromEntries(report.themeAssertions.reduce((counts, row) => {
        counts.set(row.theme, (counts.get(row.theme) ?? 0) + 1);
        return counts;
      }, new Map<string, number>())),
      recordIdsIncluded: false,
      exactCoordinatesIncluded: false,
    }
  : report;
await writeJson(reportPath, evidenceReport);
if (sqlPath) {
  await mkdir(dirname(sqlPath), { recursive: true });
  await writeFile(sqlPath, `${buildD1RecordPlaceBackfillSql(report)}\n`, "utf8");
}
process.stdout.write(`${JSON.stringify({
  reportPath,
  sqlPath,
  inputRows: report.inputRows,
  uniqueRecords: report.uniqueRecords,
  sourceOccurrenceCount: report.sourceOccurrenceCount,
  recordsMatched: report.recordsMatched,
  confirmedMemberships: report.confirmedMemberships,
  candidateMemberships: report.candidateMemberships,
  ambiguousRecords: report.ambiguousRecords,
  sourceRecordsMutated: report.sourceRecordsMutated,
}, null, 2)}\n`);
