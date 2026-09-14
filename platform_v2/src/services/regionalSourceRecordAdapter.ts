import type {
  RegionalSourceRegistryEntryV2,
  RegionalSourceEdition,
} from "./regionalSourceRegistryV2.js";

export type RegionalSourceRecordLocator =
  | { kind: "row"; value: number }
  | { kind: "cell"; value: string }
  | { kind: "page"; value: number }
  | { kind: "selector"; value: string }
  | { kind: "record"; value: string }
  | { kind: "bounding-box"; value: readonly [number, number, number, number] };

export type RegionalSourceRecordFieldInput = {
  key: string;
  value: string | null;
  locator: RegionalSourceRecordLocator;
};

export type RegionalSourceRecordAdapterInput = {
  entry: RegionalSourceRegistryEntryV2 | null;
  sourceRecordId: string;
  locator: RegionalSourceRecordLocator | null;
  title?: string | null;
  fields?: readonly RegionalSourceRecordFieldInput[];
};

export type RegionalSourceRecordField = {
  key: string;
  value: string | null;
  locator: RegionalSourceRecordLocator;
};

export type RegionalSourceRecordEnvelope = {
  sourceRecordId: string;
  sourceAssetId: string;
  sourceEditionId: string;
  publisherIds: readonly string[];
  sourceTitle: string;
  recordTitle: string | null;
  canonicalUrl: string;
  issuedAt: string | null;
  updatedAt: string | null;
  retrievedAt: string | null;
  language: string;
  rightsClass: RegionalSourceRegistryEntryV2["source"]["rightsClass"];
  acquisitionState: RegionalSourceEdition["acquisitionState"];
  sourceLocator: RegionalSourceRecordLocator;
  fields: readonly RegionalSourceRecordField[];
  promotion: {
    placeCandidate: null;
    entityCandidate: null;
    reviewState: "NOT_REVIEWED";
    publicationState: "NOT_PUBLISHED";
  };
};

export type RegionalSourceRecordAdapterResult =
  | {
      status: "READY_FOR_REVIEW";
      blockers: readonly [];
      record: RegionalSourceRecordEnvelope;
    }
  | {
      status: "BLOCKED";
      blockers: readonly string[];
      record: null;
    };

function cleanText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
}

function compareStable(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function validLocator(locator: RegionalSourceRecordLocator | null): boolean {
  if (!locator || typeof locator !== "object") return false;
  if (locator.kind === "row" || locator.kind === "page") {
    return Number.isInteger(locator.value) && locator.value > 0;
  }
  if (locator.kind === "bounding-box") {
    return Array.isArray(locator.value)
      && locator.value.length === 4
      && locator.value.every((value) => Number.isFinite(value));
  }
  if (locator.kind !== "cell" && locator.kind !== "selector" && locator.kind !== "record") {
    return false;
  }
  return typeof locator.value === "string" && locator.value.trim().length > 0;
}

function locatorKey(locator: RegionalSourceRecordLocator): string {
  return JSON.stringify(locator);
}

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

function validEditionDate(value: string | null): boolean {
  if (value === null) return true;
  if (!/^\d{4}-\d{2}-\d{2}(?:T[^\s]+)?$/.test(value)) return false;
  return Number.isFinite(Date.parse(value));
}

function validCanonicalUrl(value: string): boolean {
  const cleaned = cleanText(value);
  if (!cleaned) return false;
  try {
    new URL(cleaned);
    return true;
  } catch {
    return false;
  }
}

function validateInput(input: RegionalSourceRecordAdapterInput): string[] {
  const blockers: string[] = [];
  if (!input.entry) blockers.push("missing_source_registry_entry");

  const sourceRecordId = cleanText(input.sourceRecordId);
  if (!sourceRecordId) blockers.push("missing_source_record_id");
  if (!validLocator(input.locator)) blockers.push("missing_source_locator");

  if (!input.entry) return blockers;
  if (!input.entry.currentEdition) blockers.push("missing_current_source_edition");
  if (!Array.isArray(input.entry.publishers) || input.entry.publishers.length === 0) {
    blockers.push("missing_publisher_reference");
  }
  if (!cleanText(input.entry.source.title)) blockers.push("missing_source_title");
  if (!cleanText(input.entry.source.sourceAssetId)) blockers.push("missing_source_asset_id");
  if (input.entry.publishers.some((publisher) => !cleanText(publisher.publisherId))) {
    blockers.push("invalid_publisher_reference");
  }
  if (input.entry.currentEdition && input.entry.currentEdition.sourceAssetId !== input.entry.source.sourceAssetId) {
    blockers.push("source_edition_asset_mismatch");
  }
  if (!KNOWN_RIGHTS_CLASSES.has(input.entry.source.rightsClass)) {
    blockers.push("unknown_rights_class");
  } else if (input.entry.source.rightsClass === "RESTRICTED" || input.entry.source.rightsClass === "UNKNOWN") {
    blockers.push(`rights_class_${input.entry.source.rightsClass.toLowerCase()}`);
  }
  const acquisitionState = input.entry.currentEdition?.acquisitionState;
  if (acquisitionState && !KNOWN_ACQUISITION_STATES.has(acquisitionState)) {
    blockers.push("unknown_acquisition_state");
  } else if (acquisitionState === "RIGHTS_BLOCKED") {
    blockers.push("acquisition_rights_blocked");
  } else if (acquisitionState === "EXTRACTION_FAILED" || acquisitionState === "ACCESS_BLOCKED") {
    blockers.push(`acquisition_${acquisitionState.toLowerCase()}`);
  } else if (acquisitionState === "NOT_ACQUIRED") {
    blockers.push("acquisition_not_acquired");
  }
  if (input.entry.currentEdition) {
    if (!cleanText(input.entry.currentEdition.sourceEditionId)) blockers.push("missing_source_edition_id");
    if (!validCanonicalUrl(input.entry.currentEdition.canonicalUrl)) blockers.push("invalid_canonical_url");
    if (!validEditionDate(input.entry.currentEdition.issuedAt)) blockers.push("invalid_issued_at_date");
    if (!validEditionDate(input.entry.currentEdition.updatedAt)) blockers.push("invalid_updated_at_date");
    if (!validEditionDate(input.entry.currentEdition.retrievedAt)) blockers.push("invalid_retrieved_at_date");
  }

  for (const [index, field] of (input.fields ?? []).entries()) {
    if (!cleanText(field.key)) blockers.push(`field_${index}_missing_key`);
    if (field.value !== null && typeof field.value !== "string") blockers.push(`field_${index}_invalid_value_type`);
    if (!validLocator(field.locator)) blockers.push(`field_${index}_missing_locator`);
  }
  return blockers;
}

export function adaptRegionalSourceRecord(
  input: RegionalSourceRecordAdapterInput,
): RegionalSourceRecordAdapterResult {
  const blockers = validateInput(input);
  if (blockers.length > 0 || !input.entry || !input.entry.currentEdition || !input.locator) {
    return { status: "BLOCKED", blockers, record: null };
  }

  const source = input.entry.source;
  const edition = input.entry.currentEdition;
  const fields = [...(input.fields ?? [])]
    .map((field) => ({
      key: cleanText(field.key) as string,
      value: field.value === null ? null : cleanText(field.value),
      locator: field.locator,
    }))
    .sort((left, right) => compareStable(left.key, right.key) || compareStable(locatorKey(left.locator), locatorKey(right.locator)));

  return {
    status: "READY_FOR_REVIEW",
    blockers: [],
    record: {
      sourceRecordId: cleanText(input.sourceRecordId) as string,
      sourceAssetId: source.sourceAssetId,
      sourceEditionId: edition.sourceEditionId,
      publisherIds: [...new Set(input.entry.publishers.map((publisher) => publisher.publisherId))].sort(),
      sourceTitle: source.title,
      recordTitle: cleanText(input.title),
      canonicalUrl: edition.canonicalUrl,
      issuedAt: edition.issuedAt,
      updatedAt: edition.updatedAt,
      retrievedAt: edition.retrievedAt,
      language: edition.language,
      rightsClass: source.rightsClass,
      acquisitionState: edition.acquisitionState,
      sourceLocator: input.locator,
      fields,
      promotion: {
        placeCandidate: null,
        entityCandidate: null,
        reviewState: "NOT_REVIEWED",
        publicationState: "NOT_PUBLISHED",
      },
    },
  };
}

export function serializeRegionalSourceRecord(record: RegionalSourceRecordEnvelope): string {
  const canonicalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([left], [right]) => compareStable(left, right))
          .map(([key, child]) => [key, canonicalize(child)]),
      );
    }
    return value;
  };
  return JSON.stringify(canonicalize(record));
}
