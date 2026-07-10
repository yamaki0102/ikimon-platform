import type { PoolClient } from "pg";
import { getPool } from "../db.js";

const CONFIRMABLE_AREA_LEVELS = new Set(["osm_park", "park"]);
const CONFIRMABLE_AREA_PRIORITY = new Map<string, number>([
  ["osm_park", 0],
  ["park", 1],
]);

export type ObservationPlaceConfirmationDecision = "field" | "none";

export type ObservationPlaceConfirmationResult = {
  visitId: string;
  decision: "confirmed_field" | "not_listed";
  fieldId: string | null;
  fieldName: string | null;
  confirmedAt: string;
};

type CandidateRow = {
  field_id: string;
  name: string;
  admin_level: string | null;
  source: string | null;
};

type TargetRow = {
  visit_id: string;
  user_id: string | null;
};

function confirmablePriority(row: CandidateRow): number | null {
  const level = String(row.admin_level ?? row.source ?? "").trim().toLowerCase();
  if (!CONFIRMABLE_AREA_LEVELS.has(level)) return null;
  return CONFIRMABLE_AREA_PRIORITY.get(level) ?? 99;
}

function selectBoundaryCandidates(rows: CandidateRow[]): CandidateRow[] {
  const ranked = rows
    .map((row) => ({ row, priority: confirmablePriority(row) }))
    .filter((item): item is { row: CandidateRow; priority: number } => item.priority != null)
    .sort((a, b) => a.priority - b.priority || a.row.name.localeCompare(b.row.name, "ja"));
  const topPriority = ranked[0]?.priority;
  if (topPriority == null) return [];

  const seenNames = new Set<string>();
  const candidates: CandidateRow[] = [];
  for (const item of ranked) {
    if (item.priority !== topPriority) continue;
    const name = item.row.name.trim();
    if (!name || seenNames.has(name)) continue;
    seenNames.add(name);
    candidates.push(item.row);
  }
  return candidates;
}

async function loadTarget(client: PoolClient, observationId: string): Promise<TargetRow | null> {
  const result = await client.query<TargetRow>(
    `select v.visit_id, v.user_id
       from visits v
       left join occurrences o on o.visit_id = v.visit_id
      where v.visit_id = $1
         or v.legacy_observation_id = $1
         or o.occurrence_id = $1
      order by v.observed_at desc, v.visit_id desc
      limit 1
      for update of v`,
    [observationId],
  );
  return result.rows[0] ?? null;
}

async function loadConfirmableCandidates(client: PoolClient, visitId: string): Promise<CandidateRow[]> {
  const result = await client.query<CandidateRow>(
    `select distinct f.field_id::text as field_id,
            f.name,
            f.admin_level,
            f.source
       from visits v
       join observation_fields f on f.valid_to is null
      where v.visit_id = $1
        and f.admin_level in ('osm_park', 'park')
        and (
          f.field_id = any(coalesce(v.resolved_field_ids, array[]::uuid[]))
          or f.field_id::text = v.source_payload->>'field_id'
          or (
            v.point_latitude is not null
            and v.point_longitude is not null
            and f.bbox_min_lat is not null
            and f.bbox_min_lat <= v.point_latitude + (35.0 / 111320.0)
            and f.bbox_max_lat >= v.point_latitude - (35.0 / 111320.0)
            and f.bbox_min_lng <= v.point_longitude + (35.0 / (111320.0 * greatest(0.2, abs(cos(radians(v.point_latitude))))))
            and f.bbox_max_lng >= v.point_longitude - (35.0 / (111320.0 * greatest(0.2, abs(cos(radians(v.point_latitude))))))
          )
        )`,
    [visitId],
  );
  return selectBoundaryCandidates(result.rows);
}

export async function confirmObservationPlace(input: {
  observationId: string;
  actorUserId: string;
  decision: ObservationPlaceConfirmationDecision;
  fieldId?: string | null;
}): Promise<ObservationPlaceConfirmationResult> {
  const observationId = input.observationId.trim();
  const actorUserId = input.actorUserId.trim();
  const decision = input.decision;
  const fieldId = typeof input.fieldId === "string" ? input.fieldId.trim() : null;
  if (!observationId) throw new Error("observation_id_required");
  if (!actorUserId) throw new Error("session_required");
  if (decision !== "field" && decision !== "none") throw new Error("place_confirmation_decision_invalid");
  if (decision === "field" && !fieldId) throw new Error("field_id_required");

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const target = await loadTarget(client, observationId);
    if (!target) throw new Error("observation_not_found");
    if (target.user_id !== actorUserId) throw new Error("observation_not_owned");

    const candidates = await loadConfirmableCandidates(client, target.visit_id);
    if (candidates.length < 2) throw new Error("place_confirmation_not_boundary_candidate");
    const selected = decision === "field"
      ? candidates.find((candidate) => candidate.field_id === fieldId)
      : null;
    if (decision === "field" && !selected) throw new Error("field_not_confirmable_candidate");

    const confirmedAt = new Date().toISOString();
    const candidateIds = candidates.map((candidate) => candidate.field_id);
    const updateResult = decision === "field"
      ? await client.query<{ visit_id: string }>(
          `update visits v
              set resolved_field_ids = (
                    select coalesce(array_agg(distinct field_id), array[]::uuid[])
                      from (
                        select unnest(coalesce(v.resolved_field_ids, array[]::uuid[]) || array[$2::uuid]) as field_id
                      ) refs
                     where not (field_id = any($6::uuid[]) and field_id <> $2::uuid)
                  ),
                  source_payload = coalesce(v.source_payload, '{}'::jsonb) || jsonb_build_object(
                    'field_id', $2::text,
                    'area_confirmation', jsonb_build_object(
                      'decision', 'confirmed_field',
                      'field_id', $2::text,
                      'field_name', $3::text,
                      'confirmed_by_user_id', $4::text,
                      'confirmed_at', $5::text,
                      'source', 'owner_boundary_place_confirm'
                    )
                  ),
                  updated_at = now()
            where v.visit_id = $1
            returning v.visit_id`,
          [target.visit_id, selected!.field_id, selected!.name, actorUserId, confirmedAt, candidateIds],
        )
      : await client.query<{ visit_id: string }>(
          `update visits v
              set resolved_field_ids = (
                    select coalesce(array_agg(distinct field_id), array[]::uuid[])
                      from unnest(coalesce(v.resolved_field_ids, array[]::uuid[])) as refs(field_id)
                     where not (field_id = any($2::uuid[]))
                  ),
                  source_payload = (coalesce(v.source_payload, '{}'::jsonb) - 'field_id') || jsonb_build_object(
                    'area_confirmation', jsonb_build_object(
                      'decision', 'not_listed',
                      'field_id', null,
                      'field_name', null,
                      'confirmed_by_user_id', $3::text,
                      'confirmed_at', $4::text,
                      'source', 'owner_boundary_place_confirm'
                    )
                  ),
                  updated_at = now()
            where v.visit_id = $1
            returning v.visit_id`,
          [target.visit_id, candidateIds, actorUserId, confirmedAt],
        );
    await client.query("commit");
    return {
      visitId: updateResult.rows[0]?.visit_id ?? target.visit_id,
      decision: decision === "field" ? "confirmed_field" : "not_listed",
      fieldId: selected?.field_id ?? null,
      fieldName: selected?.name ?? null,
      confirmedAt,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
