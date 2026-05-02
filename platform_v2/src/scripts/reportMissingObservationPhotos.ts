import { getMissingObservationPhotoReport } from "../services/observationMediaIntegrity.js";

type CliOptions = {
  json: boolean;
  userId: string | null;
  visitId: string | null;
  limit: number;
};

function readOptionValue(args: string[], index: number, name: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    json: false,
    userId: null,
    visitId: null,
    limit: 100,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--user-id") {
      options.userId = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--visit-id") {
      options.visitId = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--limit") {
      const parsed = Number(readOptionValue(argv, index, arg));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error("--limit must be a positive number");
      }
      options.limit = Math.min(500, Math.trunc(parsed));
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }

  return options;
}

function formatText(report: Awaited<ReturnType<typeof getMissingObservationPhotoReport>>): string {
  const lines = [
    `missing_observation_photos total=${report.total} shown=${report.records.length}`,
  ];
  for (const record of report.records) {
    lines.push([
      `visit=${record.visitId}`,
      `occurrence=${record.occurrenceId}`,
      `user=${record.userId ?? "-"}`,
      `observed_at=${record.observedAt}`,
      `expected=${record.expectedPhotoCount}`,
      `valid_photos=${record.validPhotoCount}`,
      `valid_videos=${record.validVideoCount}`,
      `visibility=${record.publicVisibility ?? "-"}`,
      `quality=${record.qualityReviewStatus ?? "-"}`,
      `source=${record.source ?? "-"}`,
      `name=${record.displayName}`,
    ].join(" "));
  }
  return lines.join("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = await getMissingObservationPhotoReport({
    userId: options.userId,
    visitId: options.visitId,
    limit: options.limit,
  });
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(formatText(report));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
