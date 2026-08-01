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
 * Read the species identity from the server-side occurrence row before any
 * notification writer is reached. Client flags, AI context, and experience
 * link state are intentionally not accepted as the source of this decision.
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
       select o.scientific_name
         from occurrences o
         join visits v on v.visit_id = o.visit_id
        where o.occurrence_id = $1
          and v.visit_id = $2
        limit 2
        for update`,
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
