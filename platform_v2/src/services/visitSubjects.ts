import type { Pool, PoolClient } from "pg";
import { getPool } from "../db.js";
import type { AssessmentBand, SubjectRankInput } from "./subjectRanking.js";

type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

export type VisitSubjectSummary = SubjectRankInput & {
  visitId: string;
  vernacularName: string | null;
  latestAssessmentGeneratedAt: string | null;
  hasSpecialistApproval: boolean;
  evidenceTier: number | null;
  aiCandidateName: string | null;
  aiCandidateRank: string | null;
  /** displayName が AI 候補 (人手 vernacular/scientific 欠落で AI 名を借りている) ときのみ true。 */
  isAiCandidate: boolean;
};

function normalizeAssessmentBand(raw: string | null | undefined): AssessmentBand {
  if (raw === "high" || raw === "medium" || raw === "low" || raw === "unknown") {
    return raw;
  }
  return raw == null ? null : "unknown";
}

export async function getVisitSubjectSummaries(
  visitId: string,
  queryable?: Queryable,
): Promise<VisitSubjectSummary[]> {
  if (!visitId) {
    return [];
  }
  const db = queryable ?? getPool();
  const rows = await db.query<{
    occurrence_id: string;
    visit_id: string;
    subject_index: number;
    scientific_name: string | null;
    vernacular_name: string | null;
    taxon_rank: string | null;
    confidence_score: string | null;
    evidence_tier: string | null;
    source_payload: Record<string, unknown> | null;
    ai_candidate_name: string | null;
    ai_candidate_rank: string | null;
  }>(
    `SELECT o.occurrence_id,
            o.visit_id,
            o.subject_index,
            o.scientific_name,
            o.vernacular_name,
            o.taxon_rank,
            o.confidence_score::text,
            o.evidence_tier::text,
            o.source_payload,
            ai.recommended_taxon_name AS ai_candidate_name,
            ai.recommended_rank       AS ai_candidate_rank
       FROM occurrences o
       LEFT JOIN LATERAL (
         SELECT recommended_taxon_name, recommended_rank
           FROM observation_ai_assessments a
          WHERE a.occurrence_id = o.occurrence_id
          ORDER BY generated_at DESC
          LIMIT 1
       ) ai ON true
      WHERE o.visit_id = $1
      ORDER BY o.subject_index ASC, o.created_at ASC`,
    [visitId],
  );
  const occurrenceIds = rows.rows.map((row) => row.occurrence_id);
  if (occurrenceIds.length === 0) {
    return [];
  }

  const identificationCounts = new Map<string, number>();
  const latestAssessments = new Map<string, { band: AssessmentBand; generatedAt: string | null }>();

  const [idRows, aiRows] = await Promise.all([
    db.query<{ occurrence_id: string; n: string }>(
      `SELECT occurrence_id, count(*)::text AS n
         FROM identifications
        WHERE occurrence_id = ANY($1::text[])
        GROUP BY occurrence_id`,
      [occurrenceIds],
    ).catch(() => ({ rows: [] })),
    db.query<{
      occurrence_id: string;
      confidence_band: string | null;
      generated_at: string;
    }>(
      `SELECT DISTINCT ON (occurrence_id)
              occurrence_id,
              confidence_band,
              generated_at::text
         FROM observation_ai_assessments
        WHERE occurrence_id = ANY($1::text[])
        ORDER BY occurrence_id, generated_at DESC`,
      [occurrenceIds],
    ).catch(() => ({ rows: [] })),
  ]);

  for (const row of idRows.rows) {
    identificationCounts.set(row.occurrence_id, Number(row.n));
  }
  for (const row of aiRows.rows) {
    latestAssessments.set(row.occurrence_id, {
      band: normalizeAssessmentBand(row.confidence_band),
      generatedAt: row.generated_at,
    });
  }

  return rows.rows.map((row) => {
    const latestAssessment = latestAssessments.get(row.occurrence_id);
    const specialistPayload = ((row.source_payload ?? {}) as { specialist_review?: { decision?: string } }).specialist_review;
    const v2SubjectPayload = ((row.source_payload ?? {}) as { v2_subject?: { role_hint?: string } }).v2_subject;
    const humanName = row.vernacular_name || row.scientific_name || null;
    const aiName = row.ai_candidate_name && row.ai_candidate_name.trim() ? row.ai_candidate_name.trim() : null;
    const displayName = humanName || aiName || "同定待ち";
    return {
      occurrenceId: row.occurrence_id,
      visitId: row.visit_id,
      subjectIndex: row.subject_index,
      displayName,
      scientificName: row.scientific_name,
      vernacularName: row.vernacular_name,
      rank: row.taxon_rank,
      roleHint: String(v2SubjectPayload?.role_hint ?? (row.subject_index === 0 ? "primary" : "coexisting")),
      confidence: row.confidence_score != null ? Number(row.confidence_score) : null,
      identificationCount: identificationCounts.get(row.occurrence_id) ?? 0,
      latestAssessmentBand: latestAssessment?.band ?? null,
      latestAssessmentGeneratedAt: latestAssessment?.generatedAt ?? null,
      hasSpecialistApproval: specialistPayload?.decision === "approve",
      evidenceTier: row.evidence_tier != null ? Number(row.evidence_tier) : null,
      isPrimary: row.subject_index === 0,
      aiCandidateName: aiName,
      aiCandidateRank: row.ai_candidate_rank ?? null,
      isAiCandidate: !humanName && !!aiName,
    };
  });
}
