import type { PoolClient } from "pg";
import {
  evaluateExperienceManagedTaxonNotificationEligibility,
  type ExperienceManagedTaxonNotificationDecision,
} from "./experienceManagedTaxonScopes.js";

type NotificationGateQueryClient = Pick<PoolClient, "query">;
const NOTIFICATION_GATE_SAVEPOINT = "notification_gate_read";

export type CanonicalNotificationObservationInput = {
  occurrenceId: string;
  visitId: string;
};

/**
 * Resolve the notification species identity only from persisted server-side
 * records. The original occurrence remains immutable; when it has no
 * scientific name, use the latest persisted AI assessment/primary candidate.
 * Client flags, transient AI context, and experience link state are not
 * accepted as the source of this decision.
 */
export async function readCanonicalNotificationEligibility(
  client: NotificationGateQueryClient,
  input: CanonicalNotificationObservationInput,
): Promise<ExperienceManagedTaxonNotificationDecision> {
  const occurrenceId = input.occurrenceId.trim();
  const visitId = input.visitId.trim();
  if (!occurrenceId || !visitId) {
    return {
      allowed: false,
      reason: "notification_gate_unavailable",
      managedTaxonScopeKey: null,
      normalizedScientificName: null,
    };
  }

  try {
    // The dispatcher can run inside the reassessment transaction. A failed
    // PostgreSQL statement aborts that transaction until it is rolled back to
    // a savepoint; preserve the caller's transaction while still failing shut.
    await client.query(`savepoint ${NOTIFICATION_GATE_SAVEPOINT}`);
    const result = await client.query<{ scientific_name: string | null }>(
      `/* notification_gate_canonical_taxon */
       select coalesce(
                nullif(btrim(o.scientific_name), ''),
                latest_primary.scientific_name,
                nullif(btrim(latest_assessment.raw_json #>> '{parsed,taxonomic_rank_guard,final_scientific_name}'), ''),
                nullif(btrim(latest_assessment.raw_json #>> '{parsed,recommended_scientific_name}'), '')
              ) as scientific_name
         from occurrences o
         join visits v on v.visit_id = o.visit_id
         left join lateral (
           select a.assessment_id, a.raw_json
             from observation_ai_assessments a
            where a.occurrence_id = o.occurrence_id
            order by a.generated_at desc, a.assessment_id desc
            limit 1
         ) latest_assessment on true
         left join lateral (
           select max(nullif(btrim(c.scientific_name), '')) as scientific_name
             from visual_subject_candidates c
            where c.assessment_id = latest_assessment.assessment_id
              and c.occurrence_id = o.occurrence_id
              and c.subject_role = 'primary'
         ) latest_primary on true
        where o.occurrence_id = $1
          and v.visit_id = $2
        limit 2
        for update of o`,
      [occurrenceId, visitId],
    );
    await client.query(`release savepoint ${NOTIFICATION_GATE_SAVEPOINT}`);
    if (!Array.isArray(result.rows) || result.rows.length !== 1) {
      return {
        allowed: false,
        reason: "notification_gate_unavailable",
        managedTaxonScopeKey: null,
        normalizedScientificName: null,
      };
    }
    return evaluateExperienceManagedTaxonNotificationEligibility(result.rows[0]?.scientific_name);
  } catch {
    await client.query(`rollback to savepoint ${NOTIFICATION_GATE_SAVEPOINT}`).catch(() => undefined);
    await client.query(`release savepoint ${NOTIFICATION_GATE_SAVEPOINT}`).catch(() => undefined);
    return {
      allowed: false,
      reason: "notification_gate_error",
      managedTaxonScopeKey: null,
      normalizedScientificName: null,
    };
  }
}
