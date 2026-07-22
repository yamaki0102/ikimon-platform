import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  compareLegacyAndObservationFirstRecord,
  summarizeRecordShadowComparison,
  type LegacyRecordShadowSummary,
  type RecordObservationReadSnapshot,
} from "../src/cloudflareObservationReadModel";

type ComparisonInput = {
  pairs: Array<{ legacy: LegacyRecordShadowSummary; observationFirst: RecordObservationReadSnapshot }>;
};

const digest = (value: string): string => createHash("sha256").update(value).digest("hex");

export function compareShadowPairs(input: ComparisonInput) {
  if (!input || !Array.isArray(input.pairs)) throw new Error("shadow_comparison_input_invalid");
  const differences = input.pairs.flatMap((pair) => compareLegacyAndObservationFirstRecord(pair.legacy, pair.observationFirst));
  return {
    ...summarizeRecordShadowComparison(differences, input.pairs.length),
    differenceCodes: Object.entries(differences.reduce<Record<string, number>>((counts, item) => {
      counts[item.code] = (counts[item.code] ?? 0) + 1;
      return counts;
    }, {})).sort(([left], [right]) => left.localeCompare(right)).map(([code, count]) => ({ code, count })),
    containsRawLocation: false,
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf("--input");
  const reportIndex = args.indexOf("--report");
  if (inputIndex < 0 || reportIndex < 0 || !args[inputIndex + 1] || !args[reportIndex + 1]) {
    throw new Error("usage: --input <json> --report <json>");
  }
  const inputPath = path.resolve(args[inputIndex + 1]!);
  const reportPath = path.resolve(args[reportIndex + 1]!);
  const raw = await readFile(inputPath, "utf8");
  const input = JSON.parse(raw) as ComparisonInput;
  const report = {
    ...compareShadowPairs(input),
    inputSha256: digest(raw),
    generatedAt: new Date().toISOString(),
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  process.stdout.write(`${JSON.stringify(report)}\n`);
  if (!report.pass) process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
