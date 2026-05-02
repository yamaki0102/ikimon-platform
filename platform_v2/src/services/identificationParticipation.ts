import type { PoolClient } from "pg";
import { getPool } from "../db.js";
import { computeIdentificationConsensus, getIdentificationConsensus } from "./identificationConsensus.js";
import { normalizeRank } from "./taxonRank.js";
import { tryPromoteToTier3 } from "./tierPromotion.js";

export type PublicIdentificationStance = "support" | "alternative";

export type SubmitObservationIdentificationInput = {
  occurrenceId: string;
  actorUserId: string;
  proposedName: string;
  proposedRank?: string | null;
  notes?: string | null;
  stance: PublicIdentificationStance;
};

export type OpenObservationDisputeInput = {
  occurrenceId: string;
  actorUserId: string;
  kind: "alternative_id" | "needs_more_evidence" | "not_organism" | "location_date_issue";
  proposedName?: string | null;
  proposedRank?: string | null;
  reason?: string | null;
};

export type DisputeResolution = "accept_alternative" | "reject_dispute" | "needs_more_evidence";

export type ResolveIdentificationDisputeInput = {
  disputeId: string;
  actorUserId: string;
  resolution: DisputeResolution;
  note?: string | null;
};

function normalizeText(value: string | null | undefined): string | null {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

async function resolveOccurrenceId(client: PoolClient, id: string): Promise<{ occurrenceId: string; visitId: string }> {
  const normalized = id.trim();
  if (!normalized) throw new Error("observation_not_found");
  const result = await client.query<{ occurrence_id: string; visit_id: string }>(
    `select o.occurrence_id, o.visit_id
       from occurrences o
       join visits v on v.visit_id = o.visit_id
      where o.occurrence_id = $1
         or o.legacy_observation_id = $1
         or v.visit_id = $1
         or v.legacy_observation_id = $1
      order by o.subject_index asc
      limit 1`,
    [normalized],
  );
  const row = result.rows[0];
  if (!row) throw new Error("observation_not_found");
  return {
    occurrenceId: row.occurrence_id,
    visitId: row.visit_id,
  };
}

async function upsertPublicIdentification(
  client: PoolClient,
  input: SubmitObservationIdentificationInput,
): Promise<void> {
  const proposedName = normalizeText(input.proposedName);
  if (!proposedName) throw new Error("identification_name_required");
  const proposedRank = normalizeText(input.proposedRank);
  const notes = normalizeText(input.notes);
  const legacyIdentificationKey = `v2_public_identification:${input.occurrenceId}:${input.actorUserId}`;
  const payload = {
    source: "v2_public_identification",
    stance: input.stance,
    updatedAt: new Date().toISOString(),
  };

  await client.query(
    `insert into identifications (
        occurrence_id, actor_user_id, actor_kind, proposed_name, proposed_rank,
        legacy_identification_key, identification_method, confidence_score,
        is_current, notes, source_payload, created_at
     ) values (
        $1, $2, 'human', $3, $4, $5, 'v2_public_identification',
        null, true, $6, $7::jsonb, now()
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
      input.occurrenceId,
      input.actorUserId,
      proposedName,
      proposedRank,
      legacyIdentificationKey,
      notes,
      JSON.stringify(payload),
    ],
  );

  await client.query(
    `update occurrences
        set evidence_tier = case
              when coalesce(evidence_tier, 0) < 2 then 2
              else evidence_tier
            end,
            updated_at = now()
      where occurrence_id = $1`,
    [input.occurrenceId],
  );
}

export async function submitObservationIdentification(input: SubmitObservationIdentificationInput) {
  if (!input.actorUserId.trim()) throw new Error("session_required");
  const pool = getPool();
  const client = await pool.connect();
  let occurrenceId = "";
  try {
    await client.query("begin");
    const occurrence = await resolveOccurrenceId(client, input.occurrenceId);
    occurrenceId = occurrence.occurrenceId;
    await upsertPublicIdentification(client, {
      ...input,
      occurrenceId,
    });
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  const promoted = await tryPromoteToTier3(occurrenceId);
  const consensus = await getIdentificationConsensus(occurrenceId);
  return {
    ok: true,
    occurrenceId,
    promoted,
    consensus,
  };
}

export async function openObservationDispute(input: OpenObservationDisputeInput) {
  if (!input.actorUserId.trim()) throw new Error("session_required");
  const reason = normalizeText(input.reason);
  const proposedName = normalizeText(input.proposedName);
  const proposedRank = normalizeText(input.proposedRank);
  if (input.kind === "alternative_id" && !proposedName) {
    throw new Error("identification_name_required");
  }
  const pool = getPool();
  const client = await pool.connect();
  let occurrenceId = "";
  let disputeId = "";
  try {
    await client.query("begin");
    const occurrence = await resolveOccurrenceId(client, input.occurrenceId);
    occurrenceId = occurrence.occurrenceId;

    if (input.kind === "alternative_id" && proposedName) {
      await upsertPublicIdentification(client, {
        occurrenceId,
        actorUserId: input.actorUserId,
        proposedName,
        proposedRank,
        notes: reason,
        stance: "alternative",
      });
    }

    const payload = {
      source: "v2_public_dispute",
      createdBy: input.actorUserId,
      createdAt: new Date().toISOString(),
    };
    const result = await client.query<{ dispute_id: string }>(
      `insert into identification_disputes (
          occurrence_id, actor_user_id, kind, proposed_name, proposed_rank,
          reason, status, source_payload
       ) values (
          $1, $2, $3, $4, $5, $6, 'open', $7::jsonb
       )
       returning dispute_id::text`,
      [
        occurrenceId,
        input.actorUserId,
        input.kind,
        proposedName,
        proposedRank,
        reason ?? "",
        JSON.stringify(payload),
      ],
    );
    disputeId = result.rows[0]?.dispute_id ?? "";
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  const consensus = await getIdentificationConsensus(occurrenceId);
  return {
    ok: true,
    occurrenceId,
    disputeId,
    consensus,
  };
}

export async function resolveIdentificationDispute(input: ResolveIdentificationDisputeInput) {
  if (!input.actorUserId.trim()) throw new Error("session_required");
  if (
    input.resolution !== "accept_alternative"
    && input.resolution !== "reject_dispute"
    && input.resolution !== "needs_more_evidence"
  ) {
    throw new Error("invalid_dispute_resolution");
  }

  const pool = getPool();
  const client = await pool.connect();
  let occurrenceId = "";
  try {
    await client.query("begin");
    const disputeResult = await client.query<{
      dispute_id: string;
      occurrence_id: string;
      kind: string;
      proposed_name: string | null;
      proposed_rank: string | null;
      reason: string | null;
      source_payload: Record<string, unknown> | null;
    }>(
      `select dispute_id::text, occurrence_id, kind, proposed_name, proposed_rank, reason, source_payload
         from identification_disputes
        where dispute_id = $1
        limit 1`,
      [input.disputeId],
    );
    const dispute = disputeResult.rows[0];
    if (!dispute) throw new Error("dispute_not_found");
    occurrenceId = dispute.occurrence_id;

    const note = normalizeText(input.note);
    const nextPayload = {
      ...(dispute.source_payload ?? {}),
      resolution: input.resolution,
      resolutionNote: note,
      resolvedBy: input.actorUserId,
      resolvedAt: new Date().toISOString(),
    };

    if (input.resolution === "needs_more_evidence") {
      await client.query(
        `update identification_disputes
            set source_payload = $2::jsonb,
                reason = case when $3::text <> '' then $3 else reason end,
                updated_at = now()
          where dispute_id = $1`,
        [input.disputeId, JSON.stringify(nextPayload), note ?? ""],
      );
    } else {
      await client.query(
        `update identification_disputes
            set status = 'resolved',
                resolved_by_user_id = $2,
                resolved_at = now(),
                source_payload = $3::jsonb,
                updated_at = now()
          where dispute_id = $1`,
        [input.disputeId, input.actorUserId, JSON.stringify(nextPayload)],
      );
    }

    if (input.resolution === "accept_alternative" && dispute.proposed_name) {
      const acceptedRank = normalizeRank(dispute.proposed_rank);
      const legacyIdentificationKey = `v2_dispute_resolution:${occurrenceId}:${input.actorUserId}:${input.disputeId}`;
      const payload = {
        source: "v2_dispute_resolution",
        lane: "public-claim",
        decision: "approve",
        reviewClass: "authority_backed",
        disputeId: input.disputeId,
        resolution: input.resolution,
        updatedAt: new Date().toISOString(),
      };
      await client.query(
        `insert into identifications (
            occurrence_id, actor_user_id, actor_kind, proposed_name, proposed_rank, accepted_rank,
            legacy_identification_key, identification_method, confidence_score, is_current, notes, source_payload
         ) values (
            $1, $2, 'human', $3, $4, $5, $6, 'v2_dispute_resolution', null, true, $7, $8::jsonb
         )
         on conflict (legacy_identification_key) do update set
            proposed_name = excluded.proposed_name,
            proposed_rank = excluded.proposed_rank,
            accepted_rank = excluded.accepted_rank,
            identification_method = excluded.identification_method,
            is_current = true,
            notes = excluded.notes,
            source_payload = excluded.source_payload,
            created_at = now()`,
        [
          occurrenceId,
          input.actorUserId,
          dispute.proposed_name,
          normalizeText(dispute.proposed_rank),
          acceptedRank,
          legacyIdentificationKey,
          note,
          JSON.stringify(payload),
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

  const promoted = await tryPromoteToTier3(occurrenceId);
  const consensus = await getIdentificationConsensus(occurrenceId);
  return {
    ok: true,
    occurrenceId,
    promoted,
    consensus,
  };
}

export function computePublicIdentificationPreview(input: SubmitObservationIdentificationInput) {
  return computeIdentificationConsensus({
    occurrenceId: input.occurrenceId,
    identifications: [{
      actorUserId: input.actorUserId,
      proposedName: input.proposedName,
      proposedRank: input.proposedRank,
      notes: input.notes,
      sourcePayload: { stance: input.stance },
      isCurrent: true,
      createdAt: new Date(),
      gbifMatch: null,
    }],
    hasMedia: false,
  });
}
