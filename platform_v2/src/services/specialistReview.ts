import { getPool } from "../db.js";

export type SpecialistDecision = "approve" | "reject" | "note";
export type SpecialistLane = "default" | "public-claim" | "expert-lane" | "review-queue";

export type SpecialistReviewInput = {
  occurrenceId: string;
  actorUserId: string;
  lane: SpecialistLane;
  decision: SpecialistDecision;
  proposedName?: string | null;
  proposedRank?: string | null;
  notes?: string | null;
};

export async function recordSpecialistReview(input: SpecialistReviewInput) {
  if (!input.occurrenceId.trim()) {
    throw new Error("occurrenceId is required");
  }
  if (!input.actorUserId.trim()) {
    throw new Error("actorUserId is required");
  }
  if (input.decision === "approve" && !(input.proposedName ?? "").trim()) {
    throw new Error("proposedName is required for approve");
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");

    const occurrenceResult = await client.query<{ occurrence_id: string }>(
      `select occurrence_id
       from occurrences
       where occurrence_id = $1
       limit 1`,
      [input.occurrenceId],
    );
    const occurrenceId = occurrenceResult.rows[0]?.occurrence_id;
    if (!occurrenceId) {
      throw new Error("occurrence_not_found");
    }

    const reviewPayload = {
      lane: input.lane,
      decision: input.decision,
      actorUserId: input.actorUserId,
      proposedName: (input.proposedName ?? "").trim() || null,
      proposedRank: (input.proposedRank ?? "").trim() || null,
      notes: (input.notes ?? "").trim() || null,
      updatedAt: new Date().toISOString(),
      source: "v2_specialist_review",
    };

    await client.query(
      `update occurrences
       set source_payload = jsonb_set(
         coalesce(source_payload, '{}'::jsonb),
         '{specialist_review}',
         $2::jsonb,
         true
       ),
       updated_at = now()
       where occurrence_id = $1`,
      [occurrenceId, JSON.stringify(reviewPayload)],
    );

    if (input.decision === "approve") {
      const legacyIdentificationKey = `v2_specialist:${occurrenceId}:${input.lane}:${input.actorUserId}`;
      await client.query(
        `insert into identifications (
            occurrence_id, actor_user_id, actor_kind, proposed_name, proposed_rank, legacy_identification_key,
            identification_method, confidence_score, is_current, notes, source_payload
         ) values (
            $1, $2, 'human', $3, $4, $5, 'v2_specialist_review', null, true, $6, $7::jsonb
         )
         on conflict (legacy_identification_key) do update set
            proposed_name = excluded.proposed_name,
            proposed_rank = excluded.proposed_rank,
            identification_method = excluded.identification_method,
            is_current = excluded.is_current,
            notes = excluded.notes,
            source_payload = excluded.source_payload`,
        [
          occurrenceId,
          input.actorUserId,
          (input.proposedName ?? "").trim(),
          (input.proposedRank ?? "").trim() || null,
          legacyIdentificationKey,
          (input.notes ?? "").trim() || null,
          JSON.stringify(reviewPayload),
        ],
      );
    }

    await client.query("commit");
    return {
      ok: true,
      occurrenceId,
      lane: input.lane,
      decision: input.decision,
      proposedName: (input.proposedName ?? "").trim() || null,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
