import { getPool } from "../db.js";

function observationOwnershipTargetIds(observationId: string): string[] {
  const primary = observationId.trim();
  if (!primary) return [];
  const candidates = [primary];
  const occurrenceMatch = /^occ:([^:]+):\d+$/.exec(primary);
  if (occurrenceMatch?.[1]) {
    candidates.push(occurrenceMatch[1]);
  }
  return [...new Set(candidates)];
}

export async function assertObservationOwnedByUser(observationId: string, userId: string): Promise<void> {
  const pool = getPool();
  const targetIds = observationOwnershipTargetIds(observationId);
  const result = await pool.query<{ owned: boolean }>(
    `select exists(
        select 1
        from visits v
        join occurrences o on o.visit_id = v.visit_id
        where (v.visit_id = any($1::text[]) or v.legacy_observation_id = any($1::text[]) or o.occurrence_id = any($1::text[]))
          and v.user_id = $2
     ) as owned`,
    [targetIds, userId],
  );

  if (!result.rows[0]?.owned) {
    throw new Error("observation_not_owned");
  }
}

/** Lock a visit during its upsert and reject a different owner before any rows are changed. */
export async function assertVisitUpsertOwner(
  visitId: string,
  userId: string,
  query: (statement: string, values: unknown[]) => Promise<{ rows: Array<{ user_id: string | null }> }>,
): Promise<void> {
  // PostgreSQL does not lock a missing row with FOR UPDATE. Serialize first
  // inserts for this visit ID too, so concurrent owners cannot race the check.
  await query(
    "select pg_advisory_xact_lock(hashtextextended($1, 0))",
    [visitId],
  );
  const result = await query(
    "select user_id from visits where visit_id = $1 for update",
    [visitId],
  );
  const existing = result.rows[0];
  if (existing && existing.user_id !== userId) {
    throw new Error("observation_not_owned");
  }
}
