import { getPool } from "../db.js";

type CliOptions = {
  json: boolean;
  userId: string | null;
  limit: number;
};

type SummaryRow = {
  place_user_pairs: string;
  source_visit_records: string;
  continuous_visits: string;
  merged_record_delta: string;
  multi_record_windows: string;
};

type TopMergedRow = {
  user_id: string;
  place_id: string;
  place_name: string | null;
  source_visit_records: string;
  continuous_visits: string;
  merged_record_delta: string;
  first_started_at: string;
  latest_ended_at: string;
};

type MultiRecordWindowRow = {
  visit_window_id: string;
  user_id: string;
  place_id: string;
  place_name: string | null;
  started_at: string;
  ended_at: string;
  record_count: number;
  visit_ids: string[];
};

type VisitWindowReport = {
  summary: {
    placeUserPairs: number;
    sourceVisitRecords: number;
    continuousVisits: number;
    mergedRecordDelta: number;
    multiRecordWindows: number;
  };
  topMergedPlaces: Array<{
    userId: string;
    placeId: string;
    placeName: string | null;
    sourceVisitRecords: number;
    continuousVisits: number;
    mergedRecordDelta: number;
    firstStartedAt: string;
    latestEndedAt: string;
  }>;
  sampleMultiRecordWindows: Array<{
    visitWindowId: string;
    userId: string;
    placeId: string;
    placeName: string | null;
    startedAt: string;
    endedAt: string;
    recordCount: number;
    visitIds: string[];
  }>;
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
    limit: 20,
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
    if (arg === "--limit") {
      const parsed = Number(readOptionValue(argv, index, arg));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error("--limit must be a positive number");
      }
      options.limit = Math.min(100, Math.trunc(parsed));
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }

  return options;
}

function toInteger(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

async function assertVisitWindowViewsExist(): Promise<void> {
  const result = await getPool().query<{ exists: boolean }>(
    `SELECT to_regclass('public.visit_continuous_windows') IS NOT NULL AS exists`,
  );
  if (!result.rows[0]?.exists) {
    throw new Error("visit_continuous_windows view is missing. Run migrations before this report.");
  }
}

async function buildVisitWindowReport(options: CliOptions): Promise<VisitWindowReport> {
  await assertVisitWindowViewsExist();

  const params: Array<string | number> = [];
  const userFilter = options.userId
    ? (() => {
        params.push(options.userId!);
        return `WHERE user_id = $${params.length}`;
      })()
    : "";

  const summaryResult = await getPool().query<SummaryRow>(
    `WITH windows AS (
        SELECT *
          FROM visit_continuous_windows
         ${userFilter}
      )
      SELECT
        COUNT(DISTINCT user_id || ':' || place_id)::text AS place_user_pairs,
        COALESCE(SUM(record_count), 0)::text AS source_visit_records,
        COUNT(*)::text AS continuous_visits,
        (COALESCE(SUM(record_count), 0) - COUNT(*))::text AS merged_record_delta,
        COUNT(*) FILTER (WHERE record_count > 1)::text AS multi_record_windows
      FROM windows`,
    params,
  );

  const topParams = [...params];
  topParams.push(options.limit);
  const topMergedResult = await getPool().query<TopMergedRow>(
    `WITH windows AS (
        SELECT *
          FROM visit_continuous_windows
         ${userFilter}
      )
      SELECT
        w.user_id,
        w.place_id,
        p.canonical_name AS place_name,
        COALESCE(SUM(w.record_count), 0)::text AS source_visit_records,
        COUNT(*)::text AS continuous_visits,
        (COALESCE(SUM(w.record_count), 0) - COUNT(*))::text AS merged_record_delta,
        MIN(w.started_at)::text AS first_started_at,
        MAX(w.ended_at)::text AS latest_ended_at
      FROM windows w
      LEFT JOIN places p ON p.place_id = w.place_id
      GROUP BY w.user_id, w.place_id, p.canonical_name
      HAVING COALESCE(SUM(w.record_count), 0) > COUNT(*)
      ORDER BY (COALESCE(SUM(w.record_count), 0) - COUNT(*)) DESC,
               COALESCE(SUM(w.record_count), 0) DESC,
               MAX(w.ended_at) DESC
      LIMIT $${topParams.length}`,
    topParams,
  );

  const sampleParams = [...params];
  sampleParams.push(options.limit);
  const sampleResult = await getPool().query<MultiRecordWindowRow>(
    `WITH windows AS (
        SELECT *
          FROM visit_continuous_windows
         ${userFilter}
      )
      SELECT
        w.visit_window_id,
        w.user_id,
        w.place_id,
        p.canonical_name AS place_name,
        w.started_at::text,
        w.ended_at::text,
        w.record_count,
        w.visit_ids
      FROM windows w
      LEFT JOIN places p ON p.place_id = w.place_id
      WHERE w.record_count > 1
      ORDER BY w.record_count DESC, w.ended_at DESC
      LIMIT $${sampleParams.length}`,
    sampleParams,
  );

  const summary = summaryResult.rows[0] ?? {
    place_user_pairs: "0",
    source_visit_records: "0",
    continuous_visits: "0",
    merged_record_delta: "0",
    multi_record_windows: "0",
  };

  return {
    summary: {
      placeUserPairs: toInteger(summary.place_user_pairs),
      sourceVisitRecords: toInteger(summary.source_visit_records),
      continuousVisits: toInteger(summary.continuous_visits),
      mergedRecordDelta: toInteger(summary.merged_record_delta),
      multiRecordWindows: toInteger(summary.multi_record_windows),
    },
    topMergedPlaces: topMergedResult.rows.map((row) => ({
      userId: row.user_id,
      placeId: row.place_id,
      placeName: row.place_name,
      sourceVisitRecords: toInteger(row.source_visit_records),
      continuousVisits: toInteger(row.continuous_visits),
      mergedRecordDelta: toInteger(row.merged_record_delta),
      firstStartedAt: row.first_started_at,
      latestEndedAt: row.latest_ended_at,
    })),
    sampleMultiRecordWindows: sampleResult.rows.map((row) => ({
      visitWindowId: row.visit_window_id,
      userId: row.user_id,
      placeId: row.place_id,
      placeName: row.place_name,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      recordCount: row.record_count,
      visitIds: row.visit_ids,
    })),
  };
}

function formatText(report: VisitWindowReport): string {
  const lines = [
    [
      "visit_windows",
      `place_user_pairs=${report.summary.placeUserPairs}`,
      `source_visit_records=${report.summary.sourceVisitRecords}`,
      `continuous_visits=${report.summary.continuousVisits}`,
      `merged_delta=${report.summary.mergedRecordDelta}`,
      `multi_record_windows=${report.summary.multiRecordWindows}`,
    ].join(" "),
    "",
    "top_merged_places",
  ];

  for (const row of report.topMergedPlaces) {
    lines.push([
      `user=${row.userId}`,
      `place=${row.placeName ?? row.placeId}`,
      `records=${row.sourceVisitRecords}`,
      `windows=${row.continuousVisits}`,
      `merged_delta=${row.mergedRecordDelta}`,
      `first=${row.firstStartedAt}`,
      `latest=${row.latestEndedAt}`,
    ].join(" "));
  }

  lines.push("", "sample_multi_record_windows");
  for (const row of report.sampleMultiRecordWindows) {
    lines.push([
      `window=${row.visitWindowId}`,
      `user=${row.userId}`,
      `place=${row.placeName ?? row.placeId}`,
      `records=${row.recordCount}`,
      `started=${row.startedAt}`,
      `ended=${row.endedAt}`,
      `visit_ids=${row.visitIds.join(",")}`,
    ].join(" "));
  }

  return lines.join("\n");
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const report = await buildVisitWindowReport(options);
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(formatText(report));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end().catch(() => undefined);
  });
