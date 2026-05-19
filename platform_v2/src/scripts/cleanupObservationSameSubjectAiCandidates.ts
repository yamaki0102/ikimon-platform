/**
 * Dismiss AI subject candidates that are actually same-subject identification
 * alternatives, and optionally remove the AI-only occurrence rows created for them.
 *
 * Usage:
 *   npx tsx src/scripts/cleanupObservationSameSubjectAiCandidates.ts --visit-id=record-1779074761133
 *   npx tsx src/scripts/cleanupObservationSameSubjectAiCandidates.ts --visit-id=record-1779074761133 --apply
 */

import { pathToFileURL } from "node:url";
import { getPool } from "../db.js";
import { deriveVisitDisplayState, upsertVisitDisplayState } from "../services/visitDisplayState.js";
import { getVisitSubjectSummaries } from "../services/visitSubjects.js";

type Args = {
  visitId: string;
  apply: boolean;
};

type CandidateRow = {
  candidate_id: string;
  ai_run_id: string;
  suggested_occurrence_id: string | null;
  candidate_key: string;
  vernacular_name: string | null;
  scientific_name: string | null;
  taxon_rank: string | null;
  confidence_score: string | null;
  candidate_status: string;
  note: string | null;
  source_payload: Record<string, unknown> | null;
  region_count: string;
};

type OccurrenceRow = {
  occurrence_id: string;
  subject_index: number | null;
  vernacular_name: string | null;
  scientific_name: string | null;
  taxon_rank: string | null;
  data_quality: string | null;
  quality_grade: string | null;
  ai_assessment_status: string | null;
  source_payload: Record<string, unknown> | null;
  identification_count: string;
  review_count: string;
  reaction_count: string;
  evidence_asset_count: string;
};

export type CleanupCandidateInput = {
  vernacularName?: string | null;
  scientificName?: string | null;
  taxonRank?: string | null;
  confidence?: number | null;
  note?: string | null;
  sourcePayload?: Record<string, unknown> | null;
  regionCount?: number;
};

export type CleanupOccurrenceInput = {
  subjectIndex?: number | null;
  dataQuality?: string | null;
  qualityGrade?: string | null;
  aiAssessmentStatus?: string | null;
  sourcePayload?: Record<string, unknown> | null;
  identificationCount?: number;
  reviewCount?: number;
  reactionCount?: number;
  evidenceAssetCount?: number;
};

function parseArgs(argv: string[]): Args {
  let visitId = "";
  let apply = false;
  for (const arg of argv.slice(2)) {
    if (arg === "--apply") {
      apply = true;
    } else if (arg.startsWith("--visit-id=")) {
      visitId = arg.slice("--visit-id=".length).trim();
    }
  }
  if (!visitId) {
    throw new Error("missing_required_arg: --visit-id=<visit_id>");
  }
  return { visitId, apply };
}

function asNumber(value: string | number | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? "0"));
  return Number.isFinite(parsed) ? parsed : 0;
}

function sourcePayloadText(payload: Record<string, unknown> | null | undefined): string {
  return JSON.stringify(payload ?? {});
}

function candidateReadingText(payload: Record<string, unknown> | null | undefined): string {
  const reading = payload?.candidateReading;
  if (reading && typeof reading === "object") {
    return sourcePayloadText(reading as Record<string, unknown>);
  }
  return "";
}

export function isSameSubjectAlternativeCandidate(input: CleanupCandidateInput): boolean {
  const confidence = input.confidence ?? null;
  const regionCount = input.regionCount ?? 0;
  const rank = String(input.taxonRank ?? "").toLowerCase();
  const text = [
    input.vernacularName,
    input.scientificName,
    input.taxonRank,
    input.note,
    candidateReadingText(input.sourcePayload),
  ].filter(Boolean).join(" ");

  const separateSubject = /副対象|別対象|別個体|一緒に写|同場面|背景|植生|草本|木本|地表|足元|周囲|訪花|昆虫|虫|鳥|哺乳類|爬虫類|両生類|菌類|植物|花|葉|実|樹皮/u.test(text);
  if (separateSubject) {
    return false;
  }

  if (/比較候補|別候補|代替候補|類似候補|同定候補|分類候補|混同|似ている|同じ対象|同一対象|same[-_\s]?subject|alternative/i.test(text)) {
    return true;
  }

  const weakBroadMillipede = /ヤスデ|倍脚綱|Diplopoda|オビヤスデ|クシヤスデ|Polydesmida/i.test(text)
    && (rank === "class" || rank === "order")
    && (confidence == null || confidence <= 0.55)
    && regionCount === 0;

  return weakBroadMillipede;
}

export function canDeleteAiOnlyOccurrence(input: CleanupOccurrenceInput): boolean {
  const payloadText = sourcePayloadText(input.sourcePayload);
  return (input.subjectIndex ?? 0) > 0
    && asNumber(input.identificationCount) === 0
    && asNumber(input.reviewCount) === 0
    && asNumber(input.reactionCount) === 0
    && asNumber(input.evidenceAssetCount) === 0
    && input.dataQuality === "ai_only_unreviewed"
    && input.qualityGrade === "ai_judgement"
    && input.aiAssessmentStatus === "ai_judgement"
    && /ai_judgement_observation_record|0106_materialize_visible_ai_subject_candidates/.test(payloadText);
}

async function collectCandidates(visitId: string): Promise<CandidateRow[]> {
  const pool = getPool();
  const result = await pool.query<CandidateRow>(
    `SELECT c.candidate_id::text,
            c.ai_run_id::text,
            c.suggested_occurrence_id,
            c.candidate_key,
            c.vernacular_name,
            c.scientific_name,
            c.taxon_rank,
            c.confidence_score::text,
            c.candidate_status,
            c.note,
            c.source_payload,
            (
              SELECT count(*)::text
                FROM subject_media_regions smr
               WHERE smr.candidate_id = c.candidate_id
                  OR (c.suggested_occurrence_id IS NOT NULL AND smr.occurrence_id = c.suggested_occurrence_id)
            ) AS region_count
       FROM observation_ai_subject_candidates c
       JOIN observation_ai_runs r
         ON r.ai_run_id = c.ai_run_id
      WHERE c.visit_id = $1
        AND c.candidate_status <> 'dismissed'
        AND r.generated_at = (
          SELECT max(r2.generated_at)
            FROM observation_ai_runs r2
           WHERE r2.visit_id = c.visit_id
             AND r2.run_status = 'succeeded'
        )
      ORDER BY c.confidence_score DESC NULLS LAST, c.created_at DESC`,
    [visitId],
  );
  return result.rows;
}

async function collectOccurrences(occurrenceIds: string[]): Promise<Map<string, OccurrenceRow>> {
  if (occurrenceIds.length === 0) return new Map();
  const result = await getPool().query<OccurrenceRow>(
    `SELECT o.occurrence_id,
            o.subject_index,
            o.vernacular_name,
            o.scientific_name,
            o.taxon_rank,
            o.data_quality,
            o.quality_grade,
            o.ai_assessment_status,
            o.source_payload,
            (SELECT count(*)::text FROM identifications i WHERE i.occurrence_id = o.occurrence_id) AS identification_count,
            (SELECT count(*)::text FROM observation_record_ai_reviews r WHERE r.occurrence_id = o.occurrence_id) AS review_count,
            (SELECT count(*)::text FROM observation_reactions rx WHERE rx.occurrence_id = o.occurrence_id) AS reaction_count,
            (SELECT count(*)::text FROM evidence_assets ea WHERE ea.occurrence_id = o.occurrence_id) AS evidence_asset_count
       FROM occurrences o
      WHERE o.occurrence_id = ANY($1::text[])`,
    [occurrenceIds],
  );
  return new Map(result.rows.map((row) => [row.occurrence_id, row]));
}

async function refreshDisplayState(visitId: string): Promise<void> {
  const pool = getPool();
  const latestRun = await pool.query<{ ai_run_id: string }>(
    `SELECT ai_run_id::text
       FROM observation_ai_runs
      WHERE visit_id = $1
        AND run_status = 'succeeded'
      ORDER BY generated_at DESC
      LIMIT 1`,
    [visitId],
  );
  const subjects = await getVisitSubjectSummaries(visitId, pool);
  await upsertVisitDisplayState(pool, deriveVisitDisplayState(visitId, subjects, latestRun.rows[0]?.ai_run_id ?? null));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const candidates = await collectCandidates(args.visitId);
  const targets = candidates.filter((candidate) => isSameSubjectAlternativeCandidate({
    vernacularName: candidate.vernacular_name,
    scientificName: candidate.scientific_name,
    taxonRank: candidate.taxon_rank,
    confidence: candidate.confidence_score == null ? null : Number(candidate.confidence_score),
    note: candidate.note,
    sourcePayload: candidate.source_payload,
    regionCount: asNumber(candidate.region_count),
  }));
  const occurrenceIds = targets.map((row) => row.suggested_occurrence_id).filter((id): id is string => Boolean(id));
  const occurrences = await collectOccurrences(occurrenceIds);
  const deletableOccurrenceIds = occurrenceIds.filter((id) => {
    const occurrence = occurrences.get(id);
    return occurrence ? canDeleteAiOnlyOccurrence({
      subjectIndex: occurrence.subject_index,
      dataQuality: occurrence.data_quality,
      qualityGrade: occurrence.quality_grade,
      aiAssessmentStatus: occurrence.ai_assessment_status,
      sourcePayload: occurrence.source_payload,
      identificationCount: asNumber(occurrence.identification_count),
      reviewCount: asNumber(occurrence.review_count),
      reactionCount: asNumber(occurrence.reaction_count),
      evidenceAssetCount: asNumber(occurrence.evidence_asset_count),
    }) : false;
  });

  const summary = {
    visitId: args.visitId,
    mode: args.apply ? "apply" : "dry_run",
    inspectedCandidateCount: candidates.length,
    dismissCandidateCount: targets.length,
    deleteOccurrenceCount: deletableOccurrenceIds.length,
    dismissCandidates: targets.map((candidate) => ({
      candidateId: candidate.candidate_id,
      name: candidate.vernacular_name ?? candidate.scientific_name ?? candidate.candidate_key,
      rank: candidate.taxon_rank,
      confidence: candidate.confidence_score,
      status: candidate.candidate_status,
      suggestedOccurrenceId: candidate.suggested_occurrence_id,
      regionCount: candidate.region_count,
    })),
    deleteOccurrenceIds: deletableOccurrenceIds,
  };

  if (!args.apply) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (targets.length > 0) {
      await client.query(
        `UPDATE observation_ai_subject_candidates
            SET candidate_status = 'dismissed',
                suggested_occurrence_id = NULL,
                source_payload = COALESCE(source_payload, '{}'::jsonb)
                  || jsonb_build_object(
                    'same_subject_cleanup',
                    jsonb_build_object(
                      'reason', 'same_subject_identification_alternative',
                      'script', 'cleanupObservationSameSubjectAiCandidates',
                      'cleaned_at', NOW()
                    )
                  ),
                updated_at = NOW()
          WHERE candidate_id = ANY($1::uuid[])`,
        [targets.map((candidate) => candidate.candidate_id)],
      );
    }
    if (deletableOccurrenceIds.length > 0) {
      await client.query(
        `DELETE FROM occurrences
          WHERE occurrence_id = ANY($1::text[])`,
        [deletableOccurrenceIds],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await refreshDisplayState(args.visitId);
  console.log(JSON.stringify(summary, null, 2));
}

const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entryUrl) {
  void main().catch(async (error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    try {
      await getPool().end();
    } catch {
      // ignore cleanup errors
    }
    process.exitCode = 1;
  }).finally(async () => {
    try {
      await getPool().end();
    } catch {
      // ignore cleanup errors
    }
  });
}
