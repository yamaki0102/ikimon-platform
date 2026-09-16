import {
  deterministicRegionalKnowledgeUuid,
} from "./zukanRegionalKnowledgeEnvelope.js";
import type {
  RegionalSourceRecordEnvelope,
  RegionalSourceRecordField,
} from "./regionalSourceRecordAdapter.js";

export type RegionalPlaceEntitySubjectKind = "place" | "entity";

export type RegionalPlaceEntityClaimPredicate = {
  fieldKey: string;
  predicateUri: string;
};

export type RegionalPlaceEntityClaimCandidateInput = {
  record: RegionalSourceRecordEnvelope | null;
  subjectKind: RegionalPlaceEntitySubjectKind | null;
  subjectCandidateId: string | null;
  predicates: readonly RegionalPlaceEntityClaimPredicate[];
};

export type RegionalPlaceEntityClaimCandidate = {
  claimCandidateId: string;
  sourceRecordId: string;
  sourceEditionId: string;
  subjectKind: RegionalPlaceEntitySubjectKind;
  subjectCandidateId: string;
  predicateUri: string;
  fieldKey: string;
  value: string;
  recordLocator: RegionalSourceRecordEnvelope["sourceLocator"];
  fieldLocator: RegionalSourceRecordField["locator"];
  rightsClass: RegionalSourceRecordEnvelope["rightsClass"];
  acquisitionState: RegionalSourceRecordEnvelope["acquisitionState"];
  reviewState: "unreviewed";
  publicationState: "NOT_PUBLISHED";
};

export type RegionalPlaceEntityClaimCandidateResult =
  | {
      status: "READY_FOR_REVIEW";
      blockers: readonly [];
      candidates: readonly RegionalPlaceEntityClaimCandidate[];
    }
  | {
      status: "BLOCKED";
      blockers: readonly string[];
      candidates: readonly [];
    };

const compareStable = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const KNOWN_RIGHTS_CLASSES = new Set([
  "OPEN_REUSE",
  "ATTRIBUTION_REUSE",
  "FACTS_ONLY",
  "INDEX_ONLY",
  "CONTRIBUTED_PRIVATE",
  "RESTRICTED",
  "UNKNOWN",
]);

const KNOWN_ACQUISITION_STATES = new Set([
  "NOT_ACQUIRED",
  "METADATA_ONLY",
  "FETCHED",
  "CHECKSUMMED",
  "PRESERVED",
  "EXTRACTION_FAILED",
  "ACCESS_BLOCKED",
  "RIGHTS_BLOCKED",
]);

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
}

function validHttpsUrl(value: unknown): value is string {
  const cleaned = cleanText(value);
  if (!cleaned) return false;
  try {
    return new URL(cleaned).protocol === "https:";
  } catch {
    return false;
  }
}

function validLocator(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const locator = value as { kind?: unknown; value?: unknown };
  if (locator.kind === "row" || locator.kind === "page") {
    return Number.isInteger(locator.value) && (locator.value as number) > 0;
  }
  if (locator.kind === "bounding-box") {
    return Array.isArray(locator.value)
      && locator.value.length === 4
      && locator.value.every((item) => typeof item === "number" && Number.isFinite(item));
  }
  if (locator.kind !== "cell" && locator.kind !== "selector" && locator.kind !== "record") {
    return false;
  }
  return typeof locator.value === "string" && locator.value.trim().length > 0;
}

function findUniqueField(
  fields: readonly RegionalSourceRecordField[],
  fieldKey: string,
): RegionalSourceRecordField | null {
  const matches = fields.filter((field) => field.key === fieldKey);
  return matches.length === 1 ? matches[0] ?? null : null;
}

function candidateId(input: {
  sourceRecordId: string;
  sourceEditionId: string;
  subjectKind: RegionalPlaceEntitySubjectKind;
  subjectCandidateId: string;
  predicateUri: string;
  fieldKey: string;
  normalizedValue: string;
}): string {
  return deterministicRegionalKnowledgeUuid({
    tenantId: "zukan-regional-source",
    entityKind: "place_entity_claim_candidate",
    externalId: [
      input.sourceRecordId,
      input.sourceEditionId,
      input.subjectKind,
      input.subjectCandidateId,
      input.predicateUri,
      input.fieldKey,
      input.normalizedValue,
    ].join("\u0000"),
  });
}

export function planRegionalPlaceEntityClaimCandidates(
  input: RegionalPlaceEntityClaimCandidateInput,
): RegionalPlaceEntityClaimCandidateResult {
  const blockers: string[] = [];
  const record = input.record;
  if (!record) blockers.push("missing_source_record");

  const subjectCandidateId = cleanText(input.subjectCandidateId);
  if (!subjectCandidateId) blockers.push("missing_subject_candidate_id");
  if (input.subjectKind !== "place" && input.subjectKind !== "entity") {
    blockers.push("invalid_subject_kind");
  }

  if (!record) return { status: "BLOCKED", blockers, candidates: [] };

  const sourceRecordId = cleanText(record.sourceRecordId);
  const sourceEditionId = cleanText(record.sourceEditionId);
  if (!sourceRecordId) blockers.push("missing_source_record_id");
  if (!sourceEditionId) blockers.push("missing_source_edition_id");
  const fields = Array.isArray(record.fields) ? record.fields : [];
  if (!validLocator(record.sourceLocator) || !Array.isArray(record.fields)) {
    blockers.push("source_evidence_required");
  }
  if (!KNOWN_RIGHTS_CLASSES.has(record.rightsClass)) {
    blockers.push("unknown_rights_class");
  } else if (record.rightsClass === "RESTRICTED"
    || record.rightsClass === "UNKNOWN"
    || record.rightsClass === "INDEX_ONLY") {
    blockers.push(`rights_class_${record.rightsClass.toLowerCase()}`);
  }
  if (!KNOWN_ACQUISITION_STATES.has(record.acquisitionState)) {
    blockers.push("unknown_acquisition_state");
  } else if (record.acquisitionState === "NOT_ACQUIRED") {
    blockers.push("acquisition_not_acquired");
  } else if (record.acquisitionState === "RIGHTS_BLOCKED") {
    blockers.push("acquisition_rights_blocked");
  } else if (record.acquisitionState === "EXTRACTION_FAILED" || record.acquisitionState === "ACCESS_BLOCKED") {
    blockers.push(`acquisition_${record.acquisitionState.toLowerCase()}`);
  }

  // CONTRIBUTED_PRIVATE and METADATA_ONLY remain candidate-eligible here because
  // every candidate is explicitly unreviewed and unpublished; downstream rights,
  // visibility and publication gates retain the narrower source contract.

  const predicates = Array.isArray(input.predicates) ? input.predicates : [];
  if (!Array.isArray(input.predicates)) blockers.push("predicates_required");
  const predicateByField = new Map<string, string>();
  for (const [index, predicate] of predicates.entries()) {
    const fieldKey = cleanText(predicate?.fieldKey);
    if (!fieldKey) {
      blockers.push(`predicate_${index}_missing_field_key`);
      continue;
    }
    if (predicateByField.has(fieldKey)) {
      blockers.push(`duplicate_predicate_field:${fieldKey}`);
      continue;
    }
    if (!validHttpsUrl(predicate?.predicateUri)) {
      blockers.push(`invalid_predicate_uri:${fieldKey}`);
      continue;
    }
    predicateByField.set(fieldKey, predicate.predicateUri.trim());
  }

  const candidates: RegionalPlaceEntityClaimCandidate[] = [];
  for (const [fieldKey, predicateUri] of [...predicateByField.entries()].sort(([left], [right]) => compareStable(left, right))) {
    const field = findUniqueField(fields, fieldKey);
    if (!field) {
      blockers.push(`field_not_present_or_ambiguous:${fieldKey}`);
      continue;
    }
    const normalizedValue = cleanText(field.value);
    if (!normalizedValue) {
      blockers.push(`field_missing_value:${fieldKey}`);
      continue;
    }
    if (!validLocator(field.locator)) {
      blockers.push(`field_evidence_required:${fieldKey}`);
      continue;
    }
    if (!subjectCandidateId || !input.subjectKind || !sourceRecordId || !sourceEditionId) continue;
    candidates.push({
      claimCandidateId: candidateId({
        sourceRecordId,
        sourceEditionId,
        subjectKind: input.subjectKind,
        subjectCandidateId,
        predicateUri,
        fieldKey,
        normalizedValue,
      }),
      sourceRecordId,
      sourceEditionId,
      subjectKind: input.subjectKind,
      subjectCandidateId,
      predicateUri,
      fieldKey,
      value: normalizedValue,
      recordLocator: record.sourceLocator,
      fieldLocator: field.locator,
      rightsClass: record.rightsClass,
      acquisitionState: record.acquisitionState,
      reviewState: "unreviewed",
      publicationState: "NOT_PUBLISHED",
    });
  }

  const uniqueBlockers = [...new Set(blockers)].sort(compareStable);
  if (uniqueBlockers.length > 0 || candidates.length === 0) {
    if (candidates.length === 0 && uniqueBlockers.length === 0) uniqueBlockers.push("claim_candidate_required");
    return { status: "BLOCKED", blockers: uniqueBlockers, candidates: [] };
  }
  return { status: "READY_FOR_REVIEW", blockers: [], candidates };
}
