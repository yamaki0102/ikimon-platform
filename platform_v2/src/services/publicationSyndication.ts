export const PUBLICATION_SYNDICATION_PURPOSE = "public_syndication" as const;
export const PUBLICATION_SYNDICATION_POLICY_VERSION = "zukan-syndication-v1" as const;

export type PublicationSyndicationStatus = "active" | "withdrawn" | "unknown";
export type PublicationSyndicationSubjectStatus = "adult" | "minor" | "unknown";
export type PublicationSyndicationGuardianStatus = "not_required" | "confirmed" | "withdrawn" | "unknown";

export type PublicationSyndicationGuardian = {
  status: PublicationSyndicationGuardianStatus;
  purpose: string | null;
  policyVersion: string | null;
  grantedAt: string | null;
  validUntil: string | null;
};

export type PublicationSyndicationConsent = {
  status: PublicationSyndicationStatus;
  purpose: string | null;
  policyVersion: string | null;
  grantedAt: string | null;
  validUntil: string | null;
  subjectStatus: PublicationSyndicationSubjectStatus;
  destinationFeedKeys: string[];
  guardian: PublicationSyndicationGuardian;
};

export type PublicationSyndicationReasonCode =
  | "eligible"
  | "rights_not_exportable"
  | "record_withdrawn"
  | "syndication_consent_missing"
  | "syndication_consent_withdrawn"
  | "syndication_purpose_mismatch"
  | "syndication_policy_mismatch"
  | "syndication_term_missing"
  | "syndication_term_invalid"
  | "syndication_not_yet_active"
  | "syndication_expired"
  | "minor_status_unresolved"
  | "guardian_authority_unresolved"
  | "guardian_authority_withdrawn"
  | "guardian_authority_mismatch"
  | "guardian_term_invalid"
  | "guardian_not_yet_active"
  | "guardian_expired"
  | "destination_not_consented";

export type PublicationSyndicationEvaluation = {
  decision: "ALLOW" | "DENY";
  reasonCode: PublicationSyndicationReasonCode;
  consent: PublicationSyndicationConsent;
};

export type PublicationSyndicationInput = {
  recordConsent?: unknown;
  researchUseConsent?: unknown;
  datasetLicense?: unknown;
  mediaLicense?: unknown;
  externalExportAllowed?: unknown;
  withdrawalStatus?: unknown;
  sourcePayload?: unknown;
  destinationFeedKey?: string | null;
  now?: Date;
};

type PlainObject = Record<string, unknown>;

function asRecord(value: unknown): PlainObject {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as PlainObject : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? value as PlainObject : {};
}

function firstValue(source: PlainObject, keys: readonly string[]): unknown {
  for (const key of keys) {
    if (source[key] !== undefined) return source[key];
  }
  return undefined;
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized || null;
}

function normalizedDate(value: unknown): string | null {
  const text = cleanText(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function statusValue(value: unknown): PublicationSyndicationStatus {
  return value === "active" || value === "withdrawn" ? value : "unknown";
}

function subjectStatusValue(value: unknown): PublicationSyndicationSubjectStatus {
  return value === "adult" || value === "minor" ? value : "unknown";
}

function guardianStatusValue(value: unknown, subjectStatus: PublicationSyndicationSubjectStatus): PublicationSyndicationGuardianStatus {
  if (value === "confirmed" || value === "withdrawn" || value === "unknown") return value;
  return subjectStatus === "adult" ? "not_required" : "unknown";
}

function destinationKeys(value: unknown): string[] {
  const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
  const keys = new Set<string>();
  for (const item of values) {
    const key = cleanText(item);
    if (key && /^[a-z0-9][a-z0-9:_-]{0,127}$/u.test(key)) keys.add(key);
  }
  return [...keys].sort();
}

function guardianProjection(raw: unknown, subjectStatus: PublicationSyndicationSubjectStatus): PublicationSyndicationGuardian {
  const guardian = asRecord(raw);
  return {
    status: guardianStatusValue(firstValue(guardian, ["status", "guardianStatus", "guardian_status"]), subjectStatus),
    purpose: cleanText(firstValue(guardian, ["purpose", "consentPurpose", "consent_purpose"])),
    policyVersion: cleanText(firstValue(guardian, ["policyVersion", "policy_version", "consentPolicyVersion", "consent_policy_version"])),
    grantedAt: normalizedDate(firstValue(guardian, ["grantedAt", "granted_at", "effectiveAt", "effective_at"])),
    validUntil: normalizedDate(firstValue(guardian, ["validUntil", "valid_until", "expiresAt", "expires_at"])),
  };
}

export function normalizePublicationSyndicationConsent(sourcePayload: unknown): PublicationSyndicationConsent {
  const payload = asRecord(sourcePayload);
  const rawConsent = asRecord(firstValue(payload, [
    "syndicationConsent",
    "syndication_consent",
    "publicationSyndication",
    "publication_syndication",
  ]));
  const subjectStatus = subjectStatusValue(firstValue(rawConsent, ["subjectStatus", "subject_status"]));
  const rawGuardian = firstValue(rawConsent, ["guardian", "guardianAuthority", "guardian_authority"]);
  return {
    status: statusValue(firstValue(rawConsent, ["status", "consentStatus", "consent_status"])),
    purpose: cleanText(firstValue(rawConsent, ["purpose", "consentPurpose", "consent_purpose"])),
    policyVersion: cleanText(firstValue(rawConsent, ["policyVersion", "policy_version", "consentPolicyVersion", "consent_policy_version"])),
    grantedAt: normalizedDate(firstValue(rawConsent, ["grantedAt", "granted_at", "effectiveAt", "effective_at"])),
    validUntil: normalizedDate(firstValue(rawConsent, ["validUntil", "valid_until", "expiresAt", "expires_at"])),
    subjectStatus,
    destinationFeedKeys: destinationKeys(firstValue(rawConsent, [
      "destinationFeedKeys",
      "destination_feed_keys",
      "destinationFeedKey",
      "destination_feed_key",
    ])),
    guardian: guardianProjection(rawGuardian, subjectStatus),
  };
}

function allow(result: PublicationSyndicationConsent): PublicationSyndicationEvaluation {
  return { decision: "ALLOW", reasonCode: "eligible", consent: result };
}

function deny(consent: PublicationSyndicationConsent, reasonCode: Exclude<PublicationSyndicationReasonCode, "eligible">): PublicationSyndicationEvaluation {
  return { decision: "DENY", reasonCode, consent };
}

function truthyBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

function termFailure(
  grantedAt: string | null,
  validUntil: string | null,
  nowMs: number,
  codes: { missing: Exclude<PublicationSyndicationReasonCode, "eligible">; invalid: Exclude<PublicationSyndicationReasonCode, "eligible">; notYet: Exclude<PublicationSyndicationReasonCode, "eligible">; expired: Exclude<PublicationSyndicationReasonCode, "eligible"> },
): Exclude<PublicationSyndicationReasonCode, "eligible"> | null {
  if (!grantedAt || !validUntil) return codes.missing;
  const grantedMs = Date.parse(grantedAt);
  const untilMs = Date.parse(validUntil);
  if (!Number.isFinite(grantedMs) || !Number.isFinite(untilMs) || untilMs <= grantedMs) return codes.invalid;
  if (nowMs < grantedMs) return codes.notYet;
  if (nowMs > untilMs) return codes.expired;
  return null;
}

export function evaluatePublicationSyndication(input: PublicationSyndicationInput): PublicationSyndicationEvaluation {
  const consent = normalizePublicationSyndicationConsent(input.sourcePayload);
  if (input.withdrawalStatus !== "active") return deny(consent, "record_withdrawn");
  if (!truthyBoolean(input.externalExportAllowed)
    || input.recordConsent !== "external_export"
    || input.researchUseConsent !== "public_export"
    || !cleanText(input.datasetLicense)
    || !cleanText(input.mediaLicense)) {
    return deny(consent, "rights_not_exportable");
  }
  if (consent.status === "unknown") return deny(consent, "syndication_consent_missing");
  if (consent.status === "withdrawn") return deny(consent, "syndication_consent_withdrawn");

  const destination = cleanText(input.destinationFeedKey);
  if (!destination || !consent.destinationFeedKeys.includes(destination)) return deny(consent, "destination_not_consented");
  if (consent.purpose !== PUBLICATION_SYNDICATION_PURPOSE) return deny(consent, "syndication_purpose_mismatch");
  if (consent.policyVersion !== PUBLICATION_SYNDICATION_POLICY_VERSION) return deny(consent, "syndication_policy_mismatch");

  const nowMs = input.now?.getTime() ?? Date.now();
  if (!Number.isFinite(nowMs)) return deny(consent, "syndication_term_invalid");
  const consentTermFailure = termFailure(consent.grantedAt, consent.validUntil, nowMs, {
    missing: "syndication_term_missing",
    invalid: "syndication_term_invalid",
    notYet: "syndication_not_yet_active",
    expired: "syndication_expired",
  });
  if (consentTermFailure) return deny(consent, consentTermFailure);
  if (consent.subjectStatus === "unknown") return deny(consent, "minor_status_unresolved");

  if (consent.subjectStatus === "minor") {
    if (consent.guardian.status === "unknown") return deny(consent, "guardian_authority_unresolved");
    if (consent.guardian.status === "withdrawn") return deny(consent, "guardian_authority_withdrawn");
    if (consent.guardian.status !== "confirmed") return deny(consent, "guardian_authority_mismatch");
    if (consent.guardian.purpose !== PUBLICATION_SYNDICATION_PURPOSE
      || consent.guardian.policyVersion !== PUBLICATION_SYNDICATION_POLICY_VERSION) {
      return deny(consent, "guardian_authority_mismatch");
    }
    const guardianTermFailure = termFailure(consent.guardian.grantedAt, consent.guardian.validUntil, nowMs, {
      missing: "guardian_term_invalid",
      invalid: "guardian_term_invalid",
      notYet: "guardian_not_yet_active",
      expired: "guardian_expired",
    });
    if (guardianTermFailure) return deny(consent, guardianTermFailure);
  } else if (consent.guardian.status !== "not_required") {
    return deny(consent, "guardian_authority_mismatch");
  }
  return allow(consent);
}

export type OwnerPublicationReviewState = "not_reviewed" | "approved" | "changes_requested" | "held" | "rejected" | "withdrawn";
export type OwnerPublicationState = "not_ready" | "eligible" | "published" | "excluded";
export type OwnerPublicationExclusionCode = PublicationSyndicationReasonCode | "record_not_public" | "review_not_approved" | "destination_not_configured";

export type OwnerPublicationDestination = {
  feedKey: string;
  label: string;
  sourceEnvironment: "production";
  readOnly: true;
  status: "eligible" | "published" | "excluded";
  exclusionCode: OwnerPublicationExclusionCode | null;
};

export type OwnerPublicationReturn = {
  schema_version: "zukan.publication-return/v1";
  review: {
    state: OwnerPublicationReviewState;
    source: "human_review" | "none";
    decidedAt: string | null;
  };
  publication: {
    state: OwnerPublicationState;
    destinations: OwnerPublicationDestination[];
    exclusionCode: OwnerPublicationExclusionCode | null;
  };
};

export type OwnerPublicationReturnInput = {
  owner: boolean;
  recordVisibility: "public" | "limited" | "private";
  reviewDecision?: { state: string; source?: string; decidedAt?: string | null } | null;
  rights: PublicationSyndicationInput;
  destinations: readonly Omit<OwnerPublicationDestination, "status" | "exclusionCode">[];
  publishedDestinations?: readonly string[];
  now?: Date;
};

function reviewProjection(decision: OwnerPublicationReturnInput["reviewDecision"]): OwnerPublicationReturn["review"] {
  const state = decision?.source === "human_review" && ["approved", "changes_requested", "held", "rejected", "withdrawn"].includes(decision.state)
    ? decision.state as Exclude<OwnerPublicationReviewState, "not_reviewed">
    : "not_reviewed";
  return {
    state,
    source: state === "not_reviewed" ? "none" : "human_review",
    decidedAt: state === "not_reviewed" ? null : normalizedDate(decision?.decidedAt),
  };
}

function destinationProjection(
  input: OwnerPublicationReturnInput["destinations"],
): Array<Omit<OwnerPublicationDestination, "status" | "exclusionCode">> {
  const seen = new Set<string>();
  return input.flatMap((item) => {
    const feedKey = cleanText(item.feedKey);
    const label = cleanText(item.label);
    if (!feedKey || !/^[a-z0-9][a-z0-9:_-]{0,127}$/u.test(feedKey) || !label || item.sourceEnvironment !== "production" || item.readOnly !== true || seen.has(feedKey)) return [];
    seen.add(feedKey);
    return [{ feedKey, label, sourceEnvironment: "production" as const, readOnly: true as const }];
  });
}

export function projectOwnerPublicationReturn(input: OwnerPublicationReturnInput): OwnerPublicationReturn | null {
  if (!input.owner) return null;
  const review = reviewProjection(input.reviewDecision);
  const baseDestinations = destinationProjection(input.destinations);
  const denied = (code: OwnerPublicationExclusionCode): OwnerPublicationDestination[] => baseDestinations.map((destination) => ({ ...destination, status: "excluded" as const, exclusionCode: code }));

  if (input.recordVisibility !== "public") {
    return { schema_version: "zukan.publication-return/v1", review, publication: { state: "excluded", destinations: denied("record_not_public"), exclusionCode: "record_not_public" } };
  }
  if (review.state !== "approved") {
    return { schema_version: "zukan.publication-return/v1", review, publication: { state: "not_ready", destinations: denied("review_not_approved"), exclusionCode: "review_not_approved" } };
  }
  if (baseDestinations.length === 0) {
    return { schema_version: "zukan.publication-return/v1", review, publication: { state: "excluded", destinations: [], exclusionCode: "destination_not_configured" } };
  }

  const published = new Set((input.publishedDestinations ?? []).map((item) => cleanText(item)).filter((item): item is string => item !== null));
  const destinations = baseDestinations.map((destination): OwnerPublicationDestination => {
    const evaluation = evaluatePublicationSyndication({ ...input.rights, destinationFeedKey: destination.feedKey, now: input.now });
    if (evaluation.decision === "ALLOW") {
      return { ...destination, status: published.has(destination.feedKey) ? "published" : "eligible", exclusionCode: null };
    }
    return { ...destination, status: "excluded", exclusionCode: evaluation.reasonCode };
  });
  const eligible = destinations.filter((destination) => destination.status !== "excluded");
  const publishedCount = destinations.filter((destination) => destination.status === "published").length;
  if (eligible.length === 0) {
    return {
      schema_version: "zukan.publication-return/v1",
      review,
      publication: {
        state: "excluded",
        destinations,
        exclusionCode: destinations[0]?.exclusionCode ?? "destination_not_configured",
      },
    };
  }
  const state: OwnerPublicationState = publishedCount === eligible.length ? "published" : "eligible";
  return { schema_version: "zukan.publication-return/v1", review, publication: { state, destinations, exclusionCode: null } };
}
