import {
  evaluateExperienceManagedTaxonNotificationEligibility,
  type ExperienceManagedTaxonNotificationDecision,
} from "./experienceManagedTaxonScopes.js";

export type CanonicalNotificationObservationInput = {
  occurrenceId: string;
  visitId: string;
};

export type CanonicalNotificationTaxonRow = {
  scientific_name: string | null;
  occurrence_scientific_name?: string | null;
  persisted_scientific_name?: string | null;
  persisted_scientific_names?: string[] | null;
};

function cleanScientificNames(values: unknown[]): string[] {
  return values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

/**
 * Evaluate every persisted server-owned identity before ordinary routing. A
 * managed Kubiaka identity keeps Gate 0 closed even when another candidate is
 * unmanaged; missing identity is also fail-closed.
 */
export function evaluatePersistedNotificationIdentity(
  row: CanonicalNotificationTaxonRow,
): ExperienceManagedTaxonNotificationDecision {
  const occurrenceScientificName = row.occurrence_scientific_name ?? null;
  const persistedScientificNames = cleanScientificNames([
    ...(Array.isArray(row.persisted_scientific_names) ? row.persisted_scientific_names : []),
    row.persisted_scientific_name,
  ]);
  const persistedEvidence = cleanScientificNames([
    ...persistedScientificNames,
    occurrenceScientificName,
  ]);
  for (const scientificName of new Set(persistedEvidence)) {
    const decision = evaluateExperienceManagedTaxonNotificationEligibility(scientificName);
    if (!decision.allowed) return decision;
  }
  return evaluateExperienceManagedTaxonNotificationEligibility(
    persistedScientificNames[0] ?? occurrenceScientificName ?? row.scientific_name,
  );
}

/**
 * The PostgreSQL notification reader is retired. Legacy callers fail closed;
 * the active notification path performs the equivalent identity evaluation in
 * the Cloudflare Worker against D1 persisted rows.
 */
export async function readCanonicalNotificationEligibility(
  _client: unknown,
  input: CanonicalNotificationObservationInput,
): Promise<ExperienceManagedTaxonNotificationDecision> {
  if (!input.occurrenceId.trim() || !input.visitId.trim()) {
    return {
      allowed: false,
      reason: "notification_gate_unavailable",
      managedTaxonScopeKey: null,
      normalizedScientificName: null,
    };
  }
  return {
    allowed: false,
    reason: "notification_gate_unavailable",
    managedTaxonScopeKey: null,
    normalizedScientificName: null,
  };
}
