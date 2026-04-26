import { getPool } from "../db.js";
import { makeOccurrenceId } from "./writeSupport.js";

export type AdoptObservationCandidateInput = {
  visitId: string;
  candidateId: string;
  actorUserId: string;
};

export type AdoptObservationCandidateResult = {
  visitId: string;
  occurrenceId: string;
  alreadyAdopted: boolean;
};

function numericConfidence(value: string | null): number | null {
  if (value == null) return null;
  const confidence = Number(value);
  return Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : null;
}

export async function adoptObservationCandidate(
  input: AdoptObservationCandidateInput,
): Promise<AdoptObservationCandidateResult> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");

    const candidateResult = await client.query<{
      candidate_id: string;
      ai_run_id: string;
      visit_id: string;
      visit_legacy_observation_id: string | null;
      user_id: string;
      suggested_occurrence_id: string | null;
      vernacular_name: string | null;
      scientific_name: string | null;
      taxon_rank: string | null;
      confidence_score: string | null;
      candidate_status: string;
      candidate_key: string;
      note: string | null;
      max_subject_index: number | null;
    }>(
      `select c.candidate_id::text,
              c.ai_run_id::text,
              c.visit_id,
              v.legacy_observation_id as visit_legacy_observation_id,
              v.user_id,
              c.suggested_occurrence_id,
              c.vernacular_name,
              c.scientific_name,
              c.taxon_rank,
              c.confidence_score::text,
              c.candidate_status,
              c.candidate_key,
              c.note,
              (select max(subject_index) from occurrences where visit_id = c.visit_id) as max_subject_index
         from observation_ai_subject_candidates c
         join visits v on v.visit_id = c.visit_id
        where c.visit_id = $1
          and c.candidate_id = $2::uuid
        for update of c`,
      [input.visitId, input.candidateId],
    );
    const candidate = candidateResult.rows[0];
    if (!candidate) {
      throw new Error("candidate_not_found");
    }
    if (candidate.user_id !== input.actorUserId) {
      throw new Error("observation_not_owned");
    }
    if (candidate.candidate_status === "dismissed") {
      throw new Error("candidate_dismissed");
    }
    if (candidate.suggested_occurrence_id) {
      await client.query("commit");
      return {
        visitId: candidate.visit_id,
        occurrenceId: candidate.suggested_occurrence_id,
        alreadyAdopted: true,
      };
    }

    const confidence = numericConfidence(candidate.confidence_score);
    const nextSubjectIndex = Math.max(0, Number(candidate.max_subject_index ?? -1) + 1);
    const occurrenceId = makeOccurrenceId(candidate.visit_id, nextSubjectIndex);
    const sourcePayload = {
      source: "ai_candidate_adoption",
      ai_run_id: candidate.ai_run_id,
      candidate_id: candidate.candidate_id,
      candidate_key: candidate.candidate_key,
      media_role: "secondary_candidate",
      v2_subject: {
        subject_index: nextSubjectIndex,
        is_primary: false,
        role_hint: "coexisting",
        confidence,
        note: candidate.note,
      },
    };

    await client.query(
      `insert into occurrences (
          occurrence_id, visit_id, legacy_observation_id, subject_index,
          scientific_name, vernacular_name, taxon_rank,
          basis_of_record, occurrence_status, confidence_score,
          evidence_tier, source_payload, created_at, updated_at
       ) values (
          $1, $2, $3, $4,
          $5, $6, $7,
          'HumanObservation', 'present', $8,
          1, $9::jsonb, now(), now()
       )
       on conflict (occurrence_id) do update set
          scientific_name = excluded.scientific_name,
          vernacular_name = excluded.vernacular_name,
          taxon_rank = excluded.taxon_rank,
          confidence_score = excluded.confidence_score,
          source_payload = excluded.source_payload,
          updated_at = now()`,
      [
        occurrenceId,
        candidate.visit_id,
        candidate.visit_legacy_observation_id ?? candidate.visit_id,
        nextSubjectIndex,
        candidate.scientific_name,
        candidate.vernacular_name,
        candidate.taxon_rank,
        confidence,
        JSON.stringify(sourcePayload),
      ],
    );

    await client.query(
      `update observation_ai_subject_candidates
          set suggested_occurrence_id = $1,
              candidate_status = 'adopted',
              updated_at = now()
        where candidate_id = $2::uuid`,
      [occurrenceId, candidate.candidate_id],
    );

    await client.query(
      `update subject_media_regions
          set occurrence_id = $1
        where candidate_id = $2::uuid
          and occurrence_id is null`,
      [occurrenceId, candidate.candidate_id],
    );

    await client.query("commit");
    return {
      visitId: candidate.visit_id,
      occurrenceId,
      alreadyAdopted: false,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
