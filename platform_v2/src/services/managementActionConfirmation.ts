import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool } from "../db.js";
import {
  normalizeAreaInferenceFromDb,
  normalizeManagementActionCandidatesFromRaw,
  type ManagementActionCandidate,
  type ManagementActionConfirmState,
} from "./observationAiAssessment.js";

export type ConfirmManagementActionInput = {
  observationId: string;
  candidateIndex: number;
  confirmState: ManagementActionConfirmState;
  actorUserId: string;
};

export type ConfirmManagementActionResult = {
  candidate: ManagementActionCandidate;
  stewardshipActionId: string | null;
};

export type UpsertAiInferredManagementActionsInput = {
  assessmentId: string;
  occurrenceId: string;
  visitId: string;
  placeId: string | null;
  observedAt: string;
  candidates: ManagementActionCandidate[];
};

function toDbJson(candidate: ManagementActionCandidate): Record<string, unknown> {
  return {
    action_kind: candidate.actionKind,
    label: candidate.label,
    why: candidate.why,
    confidence: candidate.confidence,
    source: candidate.source,
    source_asset_id: candidate.sourceAssetId,
    confirm_state: candidate.confirmState,
  };
}

export function isAutoPersistableManagementActionCandidate(candidate: ManagementActionCandidate): boolean {
  if (candidate.confirmState === "rejected") return false;
  if (candidate.actionKind === "unknown") return false;
  return (candidate.confidence ?? 0) >= 0.55;
}

function candidateKey(candidate: ManagementActionCandidate, assessmentId: string, index: number): string {
  return [
    assessmentId,
    index,
    candidate.actionKind,
    candidate.label,
    candidate.why,
  ].join("|").toLowerCase();
}

function metadataPatch(input: {
  key: string;
  assessmentId: string;
  occurrenceId: string;
  candidateIndex: number;
  candidate: ManagementActionCandidate;
  verificationStatus: "ai_inferred" | "human_confirmed";
  confirmedBy?: string | null;
}): Record<string, unknown> {
  return {
    source: "ai_management_candidate",
    verification_status: input.verificationStatus,
    confirm_state: input.verificationStatus === "human_confirmed" ? "confirmed" : "suggested",
    ai_management_candidate_key: input.key,
    assessment_id: input.assessmentId,
    occurrence_id: input.occurrenceId,
    candidate_index: input.candidateIndex,
    why: input.candidate.why,
    confidence: input.candidate.confidence,
    candidate_source: input.candidate.source,
    source_asset_id: input.candidate.sourceAssetId,
    confirmed_by: input.confirmedBy ?? null,
  };
}

export async function upsertAiInferredManagementActions(
  client: PoolClient,
  input: UpsertAiInferredManagementActionsInput,
): Promise<string[]> {
  if (!input.placeId) return [];
  const actionIds: string[] = [];
  for (let index = 0; index < input.candidates.length; index += 1) {
    const candidate = input.candidates[index];
    if (!candidate || !isAutoPersistableManagementActionCandidate(candidate)) continue;
    const key = candidateKey(candidate, input.assessmentId, index);
    const existing = await client.query<{ action_id: string; metadata: Record<string, unknown> | null }>(
      `select action_id, metadata
         from stewardship_actions
        where linked_visit_id = $1
          and metadata ->> 'ai_management_candidate_key' = $2
        limit 1`,
      [input.visitId, key],
    );
    const patch = metadataPatch({
      key,
      assessmentId: input.assessmentId,
      occurrenceId: input.occurrenceId,
      candidateIndex: index,
      candidate,
      verificationStatus: "ai_inferred",
    });
    const existingId = existing.rows[0]?.action_id ?? null;
    if (existingId) {
      const currentStatus = existing.rows[0]?.metadata?.verification_status;
      if (currentStatus !== "human_confirmed") {
        await client.query(
          `update stewardship_actions
              set action_kind = $2,
                  description = $3,
                  metadata = metadata || $4::jsonb,
                  updated_at = now()
            where action_id = $1`,
          [existingId, candidate.actionKind, `AI推定: ${candidate.label}`, JSON.stringify(patch)],
        );
      }
      actionIds.push(existingId);
      continue;
    }
    const actionId = randomUUID();
    await client.query(
      `insert into stewardship_actions (
         action_id, place_id, occurred_at, action_kind, actor_user_id,
         linked_visit_id, description, species_status, metadata
       ) values (
         $1, $2, $3::timestamptz, $4, null,
         $5, $6, null, $7::jsonb
       )`,
      [
        actionId,
        input.placeId,
        input.observedAt,
        candidate.actionKind,
        input.visitId,
        `AI推定: ${candidate.label}`,
        JSON.stringify(patch),
      ],
    );
    actionIds.push(actionId);
  }
  return actionIds;
}

export async function confirmManagementActionCandidate(
  input: ConfirmManagementActionInput,
): Promise<ConfirmManagementActionResult> {
  if (!Number.isInteger(input.candidateIndex) || input.candidateIndex < 0) {
    throw new Error("invalid_candidate_index");
  }
  if (!["suggested", "confirmed", "rejected"].includes(input.confirmState)) {
    throw new Error("invalid_confirm_state");
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query<{
      assessment_id: string;
      raw_json: Record<string, unknown> | null;
      area_inference: unknown;
      occurrence_id: string;
      visit_id: string;
      place_id: string | null;
      observed_at: string;
    }>(
      `select
          a.assessment_id::text,
          a.raw_json,
          a.area_inference,
          o.occurrence_id,
          v.visit_id,
          v.place_id,
          v.observed_at::text
       from occurrences o
       join visits v on v.visit_id = o.visit_id
       join observation_ai_assessments a on a.occurrence_id = o.occurrence_id
       where (o.occurrence_id = $1 or v.visit_id = $1 or v.legacy_observation_id = $1)
       order by a.generated_at desc
       limit 1
       for update of a`,
      [input.observationId.trim()],
    );
    const row = result.rows[0];
    if (!row) throw new Error("management_candidate_not_found");

    const rawJson = row.raw_json && typeof row.raw_json === "object" ? { ...row.raw_json } : {};
    const parsedRaw = rawJson.parsed && typeof rawJson.parsed === "object"
      ? { ...(rawJson.parsed as Record<string, unknown>) }
      : {};
    const candidates = normalizeManagementActionCandidatesFromRaw(
      parsedRaw.management_action_candidates,
      normalizeAreaInferenceFromDb(row.area_inference),
    );
    const candidate = candidates[input.candidateIndex];
    if (!candidate) throw new Error("management_candidate_not_found");
    const updatedCandidate: ManagementActionCandidate = {
      ...candidate,
      confirmState: input.confirmState,
    };
    candidates[input.candidateIndex] = updatedCandidate;
    parsedRaw.management_action_candidates = candidates.map(toDbJson);
    rawJson.parsed = parsedRaw;
    await client.query(
      `update observation_ai_assessments
          set raw_json = $2::jsonb
        where assessment_id = $1::uuid`,
      [row.assessment_id, JSON.stringify(rawJson)],
    );

    let stewardshipActionId: string | null = null;
    if (input.confirmState === "confirmed") {
      if (!row.place_id) throw new Error("place_id_required_for_stewardship_action");
      const key = candidateKey(updatedCandidate, row.assessment_id, input.candidateIndex);
      const existing = await client.query<{ action_id: string }>(
        `select action_id
           from stewardship_actions
          where linked_visit_id = $1
            and metadata ->> 'ai_management_candidate_key' = $2
          limit 1`,
        [row.visit_id, key],
      );
      stewardshipActionId = existing.rows[0]?.action_id ?? null;
      const patch = metadataPatch({
        key,
        assessmentId: row.assessment_id,
        occurrenceId: row.occurrence_id,
        candidateIndex: input.candidateIndex,
        candidate: updatedCandidate,
        verificationStatus: "human_confirmed",
        confirmedBy: input.actorUserId,
      });
      if (!stewardshipActionId) {
        stewardshipActionId = randomUUID();
        await client.query(
          `insert into stewardship_actions (
             action_id, place_id, occurred_at, action_kind, actor_user_id,
             linked_visit_id, description, species_status, metadata
           ) values (
             $1, $2, $3::timestamptz, $4, $5,
             $6, $7, null, $8::jsonb
           )`,
          [
            stewardshipActionId,
            row.place_id,
            row.observed_at,
            updatedCandidate.actionKind,
            input.actorUserId,
            row.visit_id,
            updatedCandidate.label,
            JSON.stringify(patch),
          ],
        );
      } else {
        await client.query(
          `update stewardship_actions
              set action_kind = $2,
                  actor_user_id = $3,
                  description = $4,
                  metadata = metadata || $5::jsonb,
                  updated_at = now()
            where action_id = $1`,
          [
            stewardshipActionId,
            updatedCandidate.actionKind,
            input.actorUserId,
            updatedCandidate.label,
            JSON.stringify(patch),
          ],
        );
      }
    } else if (input.confirmState === "rejected") {
      const key = candidateKey(updatedCandidate, row.assessment_id, input.candidateIndex);
      await client.query(
        `delete from stewardship_actions
          where linked_visit_id = $1
            and metadata ->> 'ai_management_candidate_key' = $2
            and (metadata ->> 'verification_status') is distinct from 'human_confirmed'`,
        [row.visit_id, key],
      );
    }

    await client.query("commit");
    return { candidate: updatedCandidate, stewardshipActionId };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
