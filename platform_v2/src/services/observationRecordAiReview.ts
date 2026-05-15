import { getPool } from "../db.js";
import { getIdentificationConsensus } from "./identificationConsensus.js";

export type ObservationRecordAiReviewState = "agree" | "disagree" | "later";

export type SubmitObservationRecordAiReviewInput = {
  occurrenceId: string;
  actorUserId: string;
  reviewState: ObservationRecordAiReviewState;
};

export type AiJudgementIdentificationNameInput = {
  scientificName?: string | null;
  vernacularName?: string | null;
  candidateScientificName?: string | null;
  candidateVernacularName?: string | null;
  aiRecommendedTaxonName?: string | null;
};

function assertReviewState(value: string): asserts value is ObservationRecordAiReviewState {
  if (value !== "agree" && value !== "disagree" && value !== "later") {
    throw new Error("invalid_ai_review_state");
  }
}

function normalizedText(value: string | null | undefined): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveAiJudgementIdentificationName(input: AiJudgementIdentificationNameInput): string | null {
  return normalizedText(input.scientificName)
    ?? normalizedText(input.vernacularName)
    ?? normalizedText(input.candidateScientificName)
    ?? normalizedText(input.candidateVernacularName)
    ?? normalizedText(input.aiRecommendedTaxonName);
}

export async function submitObservationRecordAiReview(input: SubmitObservationRecordAiReviewInput) {
  if (!input.actorUserId.trim()) throw new Error("session_required");
  assertReviewState(input.reviewState);

  const pool = getPool();
  const client = await pool.connect();
  let occurrenceId = "";
  try {
    await client.query("begin");
    const occurrenceResult = await client.query<{
      occurrence_id: string;
      ai_assessment_status: string | null;
      scientific_name: string | null;
      vernacular_name: string | null;
      taxon_rank: string | null;
      ai_run_id: string | null;
      candidate_id: string | null;
      candidate_scientific_name: string | null;
      candidate_vernacular_name: string | null;
      candidate_taxon_rank: string | null;
      ai_recommended_taxon_name: string | null;
      ai_recommended_rank: string | null;
    }>(
      `select o.occurrence_id,
              o.ai_assessment_status,
              o.scientific_name,
              o.vernacular_name,
              o.taxon_rank,
              c.ai_run_id::text,
              c.candidate_id::text,
              c.scientific_name as candidate_scientific_name,
              c.vernacular_name as candidate_vernacular_name,
              c.taxon_rank as candidate_taxon_rank,
              ai.recommended_taxon_name as ai_recommended_taxon_name,
              ai.recommended_rank as ai_recommended_rank
         from occurrences o
         join visits v on v.visit_id = o.visit_id
         left join lateral (
           select candidate_id, ai_run_id, scientific_name, vernacular_name, taxon_rank
             from observation_ai_subject_candidates c
            where c.suggested_occurrence_id = o.occurrence_id
            order by c.updated_at desc
            limit 1
         ) c on true
         left join lateral (
           select recommended_taxon_name, recommended_rank
             from observation_ai_assessments a
            where a.occurrence_id = o.occurrence_id
            order by a.generated_at desc
            limit 1
         ) ai on true
        where o.occurrence_id = $1
          and coalesce(v.public_visibility, 'public') <> 'hidden'
        limit 1`,
      [input.occurrenceId.trim()],
    );
    const occurrence = occurrenceResult.rows[0];
    if (!occurrence) throw new Error("observation_not_found");
    occurrenceId = occurrence.occurrence_id;
    if (occurrence.ai_assessment_status !== "ai_judgement") {
      throw new Error("not_ai_judgement_record");
    }

    await client.query(
      `insert into observation_record_ai_reviews (
          occurrence_id, ai_run_id, candidate_id, actor_user_id, review_state, source_payload, created_at, updated_at
       ) values (
          $1, $2::uuid, $3::uuid, $4, $5, $6::jsonb, now(), now()
       )
       on conflict (occurrence_id, actor_user_id) do update set
          ai_run_id = excluded.ai_run_id,
          candidate_id = excluded.candidate_id,
          review_state = excluded.review_state,
          source_payload = excluded.source_payload,
          updated_at = now()`,
      [
        occurrenceId,
        occurrence.ai_run_id,
        occurrence.candidate_id,
        input.actorUserId,
        input.reviewState,
        JSON.stringify({
          source: "ai_judgement_review",
          updatedAt: new Date().toISOString(),
        }),
      ],
    );

    if (input.reviewState === "agree") {
      const proposedName = resolveAiJudgementIdentificationName({
        scientificName: occurrence.scientific_name,
        vernacularName: occurrence.vernacular_name,
        candidateScientificName: occurrence.candidate_scientific_name,
        candidateVernacularName: occurrence.candidate_vernacular_name,
        aiRecommendedTaxonName: occurrence.ai_recommended_taxon_name,
      });
      if (!proposedName) throw new Error("identification_name_required");
      const proposedRank = normalizedText(occurrence.taxon_rank)
        ?? normalizedText(occurrence.candidate_taxon_rank)
        ?? normalizedText(occurrence.ai_recommended_rank);
      const legacyIdentificationKey = `v2_ai_judgement_agree:${occurrenceId}:${input.actorUserId}`;
      await client.query(
        `insert into identifications (
            occurrence_id, actor_user_id, actor_kind, proposed_name, proposed_rank,
            legacy_identification_key, identification_method, confidence_score,
            is_current, notes, source_payload, created_at
         ) values (
            $1, $2, 'human', $3, $4, $5, 'ai_judgement_agree',
            null, true, null, $6::jsonb, now()
         )
         on conflict (legacy_identification_key) do update set
            proposed_name = excluded.proposed_name,
            proposed_rank = excluded.proposed_rank,
            identification_method = excluded.identification_method,
            is_current = true,
            notes = excluded.notes,
            source_payload = excluded.source_payload,
            created_at = now()`,
        [
          occurrenceId,
          input.actorUserId,
          proposedName,
          proposedRank,
          legacyIdentificationKey,
          JSON.stringify({
            source: "ai_judgement_agree",
            aiRunId: occurrence.ai_run_id,
            candidateId: occurrence.candidate_id,
            updatedAt: new Date().toISOString(),
          }),
        ],
      );
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  const consensus = occurrenceId ? await getIdentificationConsensus(occurrenceId).catch(() => null) : null;
  return {
    ok: true,
    occurrenceId,
    reviewState: input.reviewState,
    consensus,
  };
}
