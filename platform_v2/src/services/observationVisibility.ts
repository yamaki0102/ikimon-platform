import { getPool } from "../db.js";

export type HideOwnObservationResult = {
  visitId: string;
  hiddenAt: string;
};

export async function hideOwnObservation(input: {
  observationId: string;
  actorUserId: string;
}): Promise<HideOwnObservationResult> {
  const observationId = input.observationId.trim();
  const actorUserId = input.actorUserId.trim();
  if (!observationId) throw new Error("observation_id_required");
  if (!actorUserId) throw new Error("session_required");

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const targetResult = await client.query<{
      visit_id: string;
      user_id: string | null;
    }>(
      `select v.visit_id, v.user_id
         from visits v
         left join occurrences o on o.visit_id = v.visit_id
        where v.visit_id = $1
           or v.legacy_observation_id = $1
           or o.occurrence_id = $1
        order by v.visit_id
        limit 1
        for update of v`,
      [observationId],
    );
    const target = targetResult.rows[0];
    if (!target) throw new Error("observation_not_found");
    if (target.user_id !== actorUserId) throw new Error("observation_not_owned");

    const hiddenAt = new Date().toISOString();
    const updateResult = await client.query<{ visit_id: string }>(
      `update visits
          set public_visibility = 'hidden',
              quality_review_status = 'archived',
              source_payload = coalesce(source_payload, '{}'::jsonb) || jsonb_build_object(
                'owner_hidden_at', $2::text,
                'owner_hidden_by', $3::text,
                'owner_hidden_reason', 'user_requested_delete'
              ),
              updated_at = now()
        where visit_id = $1
        returning visit_id`,
      [target.visit_id, hiddenAt, actorUserId],
    );
    await client.query("commit");
    return {
      visitId: updateResult.rows[0]?.visit_id ?? target.visit_id,
      hiddenAt,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
