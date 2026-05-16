/**
 * Refresh AI assessment for the most recent public observation records.
 *
 * This is intentionally small and operator-driven: it selects recent visible
 * visits with media, prefers video-frame reassessment when video exists, and
 * falls back to photo reassessment. It does not create visits or mutate schema.
 *
 * Usage:
 *   DATABASE_URL=... GEMINI_API_KEY=... npx tsx src/scripts/refreshRecentObservationAi.ts --limit=5
 *   DATABASE_URL=... npx tsx src/scripts/refreshRecentObservationAi.ts --limit=5 --dry-run
 */

import { getPool } from "../db.js";
import { reassessObservation } from "../services/observationReassess.js";
import { reassessFromVideoThumb } from "../services/reassessFromVideoThumb.js";

type Args = {
  dryRun: boolean;
  limit: number;
  includeReview: boolean;
  includeHidden: boolean;
};

type RecentTargetRow = {
  visit_id: string;
  occurrence_id: string;
  observed_at: string;
  display_name: string | null;
  public_visibility: string | null;
  quality_review_status: string | null;
  photo_count: string;
  video_count: string;
  video_with_thumbnail_count: string;
};

type RefreshOutcome = {
  visitId: string;
  occurrenceId: string;
  displayName: string;
  observedAt: string;
  mode: "video" | "photo" | "skip";
  status: "dry_run" | "ok" | "failed" | "skipped";
  recommendedTaxonName?: string | null;
  message?: string;
};

function parsePositiveInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, 20);
}

function parseArgs(argv: string[]): Args {
  let dryRun = false;
  let limit = 5;
  let includeReview = true;
  let includeHidden = false;
  for (const arg of argv.slice(2)) {
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--public-only") {
      includeReview = false;
    } else if (arg === "--include-hidden") {
      includeHidden = true;
    } else if (arg.startsWith("--limit=")) {
      limit = parsePositiveInt(arg.slice("--limit=".length), limit);
    }
  }
  return { dryRun, limit, includeReview, includeHidden };
}

function toCount(value: string | null | undefined): number {
  const parsed = Number.parseInt(String(value ?? "0"), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function collectRecentTargets(args: Args): Promise<RecentTargetRow[]> {
  const pool = getPool();
  const visibilitySql = args.includeHidden
    ? "true"
    : args.includeReview
      ? "coalesce(v.public_visibility, 'public') <> 'hidden'"
      : "coalesce(v.public_visibility, 'public') = 'public'";
  const result = await pool.query<RecentTargetRow>(
    `select
        v.visit_id,
        o.occurrence_id,
        to_char(v.observed_at, 'YYYY-MM-DD HH24:MI') as observed_at,
        coalesce(nullif(o.vernacular_name, ''), nullif(o.scientific_name, ''), '同定待ち') as display_name,
        v.public_visibility,
        v.quality_review_status,
        count(*) filter (where ea.asset_role = 'observation_photo')::text as photo_count,
        count(*) filter (where ea.asset_role = 'observation_video')::text as video_count,
        count(*) filter (
          where ea.asset_role = 'observation_video'
            and coalesce(
              ea.source_payload ->> 'thumbnail_url',
              ab.source_payload ->> 'thumbnail_url',
              nullif(ab.public_url, '')
            ) is not null
        )::text as video_with_thumbnail_count
      from visits v
      join occurrences o
        on o.visit_id = v.visit_id
       and coalesce(o.subject_index, 0) = 0
      join evidence_assets ea
        on ea.occurrence_id = o.occurrence_id
       and ea.asset_role in ('observation_photo', 'observation_video')
      left join asset_blobs ab
        on ab.blob_id = ea.blob_id
      where ${visibilitySql}
        and coalesce(v.source_payload->>'source', '') !~* '(^|[-_])(e2e|fixture|prod[-_]?media[-_]?smoke|smoke[-_]?test|smoke[-_]?regression[-_]?fixture)([-_]|$)'
        and v.visit_id !~* '^(prod-photo-post|prod-media-smoke|smoke-ui)-'
        and o.occurrence_id !~* '^(occ:)?(prod-photo-post|prod-media-smoke|smoke-ui)-'
      group by v.visit_id, o.occurrence_id, o.vernacular_name, o.scientific_name,
               v.observed_at, v.public_visibility, v.quality_review_status, v.created_at
      having count(*) filter (where ea.asset_role in ('observation_photo', 'observation_video')) > 0
      order by v.observed_at desc, v.created_at desc
      limit $1`,
    [args.limit],
  );
  return result.rows;
}

function summarizeTarget(row: RecentTargetRow): string {
  return [
    row.observed_at,
    row.display_name ?? "同定待ち",
    row.visit_id,
    `photos=${toCount(row.photo_count)}`,
    `videos=${toCount(row.video_count)}`,
    `videoThumbs=${toCount(row.video_with_thumbnail_count)}`,
    `visibility=${row.public_visibility ?? "public"}`,
    `quality=${row.quality_review_status ?? "accepted"}`,
  ].join(" | ");
}

async function refreshTarget(row: RecentTargetRow, dryRun: boolean): Promise<RefreshOutcome> {
  const photoCount = toCount(row.photo_count);
  const videoThumbCount = toCount(row.video_with_thumbnail_count);
  const base = {
    visitId: row.visit_id,
    occurrenceId: row.occurrence_id,
    displayName: row.display_name ?? "同定待ち",
    observedAt: row.observed_at,
  };
  const mode: "video" | "photo" | "skip" = videoThumbCount > 0 ? "video" : photoCount > 0 ? "photo" : "skip";
  if (mode === "skip") {
    return { ...base, mode, status: "skipped", message: "no_refreshable_media" };
  }
  if (dryRun) {
    return { ...base, mode, status: "dry_run" };
  }
  try {
    const result = mode === "video"
      ? await reassessFromVideoThumb(row.occurrence_id)
      : await reassessObservation(row.occurrence_id);
    return {
      ...base,
      mode,
      status: "ok",
      recommendedTaxonName: result.recommendedTaxonName ?? null,
    };
  } catch (error) {
    return {
      ...base,
      mode,
      status: "failed",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const targets = await collectRecentTargets(args);
  console.log(`[collect] targets=${targets.length} limit=${args.limit} dryRun=${args.dryRun} includeReview=${args.includeReview} includeHidden=${args.includeHidden}`);
  for (const target of targets) {
    console.log(`[target] ${summarizeTarget(target)}`);
  }

  const outcomes: RefreshOutcome[] = [];
  for (const target of targets) {
    const outcome = await refreshTarget(target, args.dryRun);
    outcomes.push(outcome);
    const suffix = outcome.status === "ok"
      ? ` -> ${outcome.recommendedTaxonName ?? "(no name)"}`
      : outcome.message
        ? ` -> ${outcome.message}`
        : "";
    console.log(`[${outcome.status}] ${outcome.mode} ${outcome.visitId} / ${outcome.occurrenceId}${suffix}`);
  }

  const summary = outcomes.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log(JSON.stringify({ summary, outcomes }, null, 2));

  await getPool().end();
  if (outcomes.some((row) => row.status === "failed")) {
    process.exitCode = 1;
  }
}

void main().catch(async (error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  try {
    await getPool().end();
  } catch {
    // ignore cleanup errors
  }
  process.exitCode = 1;
});
