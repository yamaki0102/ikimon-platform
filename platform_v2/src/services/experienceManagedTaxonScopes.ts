export type ExperienceManagedTaxonRoutingStatus =
  | "deny_external_routing"
  | "routing_enabled";

export type ExperienceManagedTaxonRoutingApproval = {
  allowExternalRouting: true;
  approvedPolicyVersion: string;
  approvalRef: string;
};

export type ExperienceManagedTaxonScope = {
  scopeKey: string;
  acceptedNormalizedScientificNames: readonly string[];
  status: ExperienceManagedTaxonRoutingStatus;
  policyVersion: string;
  routingApproval?: ExperienceManagedTaxonRoutingApproval;
};

export type ExperienceManagedTaxonMatch = {
  scope: ExperienceManagedTaxonScope;
  inputNormalizedScientificName: string;
  matchedNormalizedScientificName: string;
};

export type ExperienceManagedTaxonNotificationBlockReason =
  | "managed_taxon_gate_denied"
  | "species_unresolved"
  | "notification_gate_unavailable"
  | "notification_gate_error";

export type ExperienceManagedTaxonNotificationDecision = {
  allowed: boolean;
  reason: ExperienceManagedTaxonNotificationBlockReason | null;
  managedTaxonScopeKey: string | null;
  normalizedScientificName: string | null;
};

/**
 * Source-only Gate 0 registry. External routing remains denied until a later,
 * explicitly approved release adds a version-matched routing approval.
 *
 * The synonym set was reviewed against the EPPO AROMBU identity record and
 * GBIF Backbone/Catalogue of Life records on 2026-07-29.
 */
const KUBIAKA_ACCEPTED_NORMALIZED_SCIENTIFIC_NAMES = [
  "aromia bungii",
  "aromia bungi",
  "aromia cyanicornis",
  "aromia ruficollis",
  "callichroma bungii",
  "callichroma cyanicornis",
  "callichroma ruficolle",
  "cerambyx bungii",
] as const;

export const EXPERIENCE_MANAGED_TAXON_SCOPES: readonly ExperienceManagedTaxonScope[] = [
  {
    scopeKey: "kubiaka-watch",
    acceptedNormalizedScientificNames: KUBIAKA_ACCEPTED_NORMALIZED_SCIENTIFIC_NAMES,
    status: "deny_external_routing",
    policyVersion: "kubiaka-watch-routing-v1",
  },
];

export function normalizeManagedScientificName(
  value: string | null | undefined,
): string | null {
  const normalized = String(value ?? "")
    .normalize("NFKC")
    .replace(/([A-Za-z])\(/g, "$1 (")
    .replace(/[\s\u00a0]+/g, " ")
    .trim()
    .toLowerCase();
  return normalized || null;
}

function buildScientificNameMatchKeys(normalizedName: string): readonly string[] {
  const keys = new Set<string>([normalizedName]);
  const tokens = normalizedName.split(" ");
  if (
    tokens.length >= 2
    && /^[a-z][a-z.-]*$/.test(tokens[0] ?? "")
    && /^[a-z][a-z.-]*$/.test(tokens[1] ?? "")
  ) {
    keys.add(`${tokens[0]} ${tokens[1]}`);
  }
  return [...keys];
}

export function findExperienceManagedTaxon(
  scientificName: string | null | undefined,
  scopes: readonly ExperienceManagedTaxonScope[] = EXPERIENCE_MANAGED_TAXON_SCOPES,
): ExperienceManagedTaxonMatch | null {
  const inputNormalizedScientificName = normalizeManagedScientificName(scientificName);
  if (!inputNormalizedScientificName) return null;

  const matchKeys = buildScientificNameMatchKeys(inputNormalizedScientificName);
  for (const scope of scopes) {
    const acceptedNames = new Set(
      scope.acceptedNormalizedScientificNames
        .map((name) => normalizeManagedScientificName(name))
        .filter((name): name is string => Boolean(name)),
    );
    const matchedNormalizedScientificName = matchKeys.find((key) => acceptedNames.has(key));
    if (matchedNormalizedScientificName) {
      return {
        scope,
        inputNormalizedScientificName,
        matchedNormalizedScientificName,
      };
    }
  }
  return null;
}

export function isExperienceManagedTaxonRoutingEnabled(
  scope: ExperienceManagedTaxonScope,
): boolean {
  const approval = scope.routingApproval;
  if (scope.status !== "routing_enabled" || !approval) return false;
  return approval.allowExternalRouting === true
    && approval.approvedPolicyVersion === scope.policyVersion
    && approval.approvalRef.trim().length > 0;
}

function deniedNotificationDecision(
  reason: ExperienceManagedTaxonNotificationBlockReason,
  normalizedScientificName: string | null = null,
  managedTaxonScopeKey: string | null = null,
): ExperienceManagedTaxonNotificationDecision {
  return {
    allowed: false,
    reason,
    managedTaxonScopeKey,
    normalizedScientificName,
  };
}

function isValidScopeConfiguration(
  scopes: readonly ExperienceManagedTaxonScope[],
): boolean {
  if (!Array.isArray(scopes) || scopes.length === 0) return false;
  return scopes.every((scope) => {
    if (!scope || typeof scope.scopeKey !== "string" || scope.scopeKey.trim() === "") return false;
    if (!Array.isArray(scope.acceptedNormalizedScientificNames) || scope.acceptedNormalizedScientificNames.length === 0) {
      return false;
    }
    if (scope.acceptedNormalizedScientificNames.some((name: unknown) => typeof name !== "string" || name.trim() === "")) {
      return false;
    }
    if (scope.status !== "deny_external_routing" && scope.status !== "routing_enabled") return false;
    if (typeof scope.policyVersion !== "string" || scope.policyVersion.trim() === "") return false;
    if (scope.routingApproval === undefined) return true;
    return scope.routingApproval.allowExternalRouting === true
      && typeof scope.routingApproval.approvedPolicyVersion === "string"
      && typeof scope.routingApproval.approvalRef === "string"
      && scope.routingApproval.approvedPolicyVersion.trim() !== ""
      && scope.routingApproval.approvalRef.trim() !== "";
  });
}

/**
 * Shared notification boundary for every managed-taxon delivery path.
 *
 * An absent/invalid policy or an unresolvable species is not treated as an
 * unmanaged taxon. That distinction is what keeps an incomplete Gate 0
 * configuration from reopening a notification sink.
 */
export function evaluateExperienceManagedTaxonNotificationEligibility(
  scientificName: string | null | undefined,
  scopes: readonly ExperienceManagedTaxonScope[] = EXPERIENCE_MANAGED_TAXON_SCOPES,
): ExperienceManagedTaxonNotificationDecision {
  try {
    if (!isValidScopeConfiguration(scopes)) {
      return deniedNotificationDecision("notification_gate_unavailable");
    }
    if (typeof scientificName !== "string") {
      return deniedNotificationDecision("species_unresolved");
    }
    const normalizedScientificName = normalizeManagedScientificName(scientificName);
    if (!normalizedScientificName) {
      return deniedNotificationDecision("species_unresolved");
    }
    const match = findExperienceManagedTaxon(scientificName, scopes);
    if (!match) {
      return {
        allowed: true,
        reason: null,
        managedTaxonScopeKey: null,
        normalizedScientificName,
      };
    }
    if (!isExperienceManagedTaxonRoutingEnabled(match.scope)) {
      return deniedNotificationDecision(
        "managed_taxon_gate_denied",
        normalizedScientificName,
        match.scope.scopeKey,
      );
    }
    return {
      allowed: true,
      reason: null,
      managedTaxonScopeKey: match.scope.scopeKey,
      normalizedScientificName,
    };
  } catch {
    return deniedNotificationDecision("notification_gate_error");
  }
}
