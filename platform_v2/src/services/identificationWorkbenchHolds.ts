import type { Pool, PoolClient } from "pg";
import { getPool } from "../db.js";

export type IdentificationWorkbenchHoldInput = {
  occurrenceId: string;
  actorUserId: string;
  reason?: string | null;
};

function normalizeText(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

async function resolveOccurrenceId(client: PoolClient, id: string): Promise<string> {
  const normalized = normalizeText(id);
  if (!normalized) throw new Error("observation_not_found");
  const result = await client.query<{ occurrence_id: string }>(
    `select o.occurrence_id
       from occurrences o
       join visits v on v.visit_id = o.visit_id
      where o.occurrence_id::text = $1
         or o.legacy_observation_id = $1
         or v.visit_id::text = $1
         or v.legacy_observation_id = $1
      order by o.subject_index asc
      limit 1`,
    [normalized],
  );
  const row = result.rows[0];
  if (!row) throw new Error("observation_not_found");
  return row.occurrence_id;
}

export async function holdIdentificationWorkbenchItem(input: IdentificationWorkbenchHoldInput) {
  const actorUserId = normalizeText(input.actorUserId);
  if (!actorUserId) throw new Error("session_required");
  const pool = getPool();
  const client = await pool.connect();
  let occurrenceId = "";
  try {
    await client.query("begin");
    occurrenceId = await resolveOccurrenceId(client, input.occurrenceId);
    await client.query(
      `insert into identification_workbench_holds (
          occurrence_id, actor_user_id, hold_reason, source_payload, created_at, updated_at
       ) values (
          $1, $2, $3, $4::jsonb, now(), now()
       )
       on conflict (occurrence_id, actor_user_id) do update set
          hold_reason = excluded.hold_reason,
          source_payload = excluded.source_payload,
          updated_at = now()`,
      [
        occurrenceId,
        actorUserId,
        normalizeText(input.reason),
        JSON.stringify({
          source: "identification_workbench",
          updatedAt: new Date().toISOString(),
        }),
      ],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
  return { ok: true, occurrenceId, hold: true };
}

export async function listHeldIdentificationOccurrenceIds(
  actorUserId: string | null | undefined,
  pool?: Pool,
): Promise<Set<string>> {
  const normalizedUserId = normalizeText(actorUserId);
  if (!normalizedUserId) return new Set();
  try {
    const db = pool ?? getPool();
    const result = await db.query<{ occurrence_id: string }>(
      `select occurrence_id::text
         from identification_workbench_holds
        where actor_user_id = $1`,
      [normalizedUserId],
    );
    return new Set(result.rows.map((row) => row.occurrence_id));
  } catch {
    return new Set();
  }
}
