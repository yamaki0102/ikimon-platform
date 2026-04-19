import type { Pool, PoolClient } from "pg";
import { getPool } from "../db.js";
import type { AssessmentBand, SubjectRankInput } from "./subjectRanking.js";

type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

export type VisitSubjectSummary = SubjectRankInput & {
  visitId: string;
  vernacularName: string | null;
  latestAssessmentGeneratedAt: string | null;
  hasSpecialistApproval: boolean;
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
    source_payload: Record<string, unknown> | null;
  }>(
    `SELECT occurrence_id,
            visit_id,
            subject_index,
            scientific_name,
            vernacular_name,
            taxon_rank,
            confidence_score::text,
            source_payload
       FROM occurrences
      WHERE visit_id = $1
      ORDER BY subject_index ASC, created_at ASC`,
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
    return {
      occurrenceId: row.occurrence_id,
      visitId: row.visit_id,
      subjectIndex: row.subject_index,
      displayName: row.vernacular_name || row.scientific_name || "Unresolved",
      scientificName: row.scientific_name,
      vernacularName: row.vernacular_name,
      rank: row.taxon_rank,
      roleHint: String(v2SubjectPayload?.role_hint ?? (row.subject_index === 0 ? "primary" : "coexisting")),
      confidence: row.confidence_score != null ? Number(row.confidence_score) : null,
      identificationCount: identificationCounts.get(row.occurrence_id) ?? 0,
      latestAssessmentBand: latestAssessment?.band ?? null,
      latestAssessmentGeneratedAt: latestAssessment?.generatedAt ?? null,
      hasSpecialistApproval: specialistPayload?.decision === "approve",
      isPrimary: row.subject_index === 0,
    };
  });
}
