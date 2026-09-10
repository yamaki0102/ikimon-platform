import {
  OBSERVATION_DATA_RIGHTS_POLICY_VERSION,
  normalizeObservationDataRights,
  type ObservationDataRights,
  type ObservationDataRightsInput,
} from "./observationDataRights.js";

export const RAW_RECORD_PORTABILITY_ARCHIVE_SCHEMA_VERSION = "zukan.raw-record-portability-archive/v1";
export const TAXON_INVENTORY_SCHEMA_VERSION = "zukan.taxon-inventory/v1";

export type RawRecordVisibility = "private" | "program_restricted" | "shared" | "public_candidate" | "public" | "withdrawn";
export type RawRecordReviewState = "requested" | "in_review" | "changes_requested" | "held" | "approved" | "rejected" | "withdrawn";

export type RawRecordProvenance = {
  sourceRef: string;
  sourceRevision: string;
  sourceKind: string;
};

export type RawRecordReviewHistoryEntry = {
  state: RawRecordReviewState;
  actorId: string;
  occurredAt: string;
  source: string;
  note: string | null;
};

export type RawRecordReview = {
  state: RawRecordReviewState;
  history: RawRecordReviewHistoryEntry[];
};

export type RawRecordVisibilityHistoryEntry = {
  visibility: RawRecordVisibility;
  actorId: string;
  occurredAt: string;
  source: string;
};

export type RawRecordChangeHistoryEntry = {
  actorId: string;
  occurredAt: string;
  source: string;
  revision: string;
  changeType: string;
};

export type RawRecordPortabilityRecord = {
  recordId: string;
  contributorFields: Record<string, unknown>;
  capturedAt: string;
  placeRef: string | null;
  provenance: RawRecordProvenance;
  review: RawRecordReview;
  consent: ObservationDataRights;
  visibility: RawRecordVisibility;
  visibilityHistory: RawRecordVisibilityHistoryEntry[];
  changeHistory: RawRecordChangeHistoryEntry[];
};

export type RawRecordPortabilityRecordInput = Omit<RawRecordPortabilityRecord, "consent" | "review" | "visibility" | "visibilityHistory" | "changeHistory"> & {
  consent: ObservationDataRightsInput;
  review: RawRecordReview;
  visibility: RawRecordVisibility;
  visibilityHistory: RawRecordVisibilityHistoryEntry[];
  changeHistory: RawRecordChangeHistoryEntry[];
};

export type RawRecordPortabilityArchive = {
  schemaVersion: typeof RAW_RECORD_PORTABILITY_ARCHIVE_SCHEMA_VERSION;
  records: RawRecordPortabilityRecord[];
};

export type RawRecordPortabilityArchiveInput = {
  records: RawRecordPortabilityRecordInput[];
};

export type TaxonInventoryEntry = {
  taxonName: string;
  recordCount: number;
};

export type TaxonInventory = {
  schemaVersion: typeof TAXON_INVENTORY_SCHEMA_VERSION;
  scope: "place" | "program" | "organization" | "period";
  generatedAt: string;
  entries: TaxonInventoryEntry[];
  totalTaxa: number;
  composition: Record<string, number>;
  reportRef: string | null;
};

function requiredId(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${field}_required`);
  return value.trim();
}

function requiredTimestamp(value: unknown, field: string): string {
  const timestamp = requiredId(value, field);
  if (!Number.isFinite(Date.parse(timestamp))) throw new Error(`${field}_invalid`);
  return timestamp;
}

function optionalId(value: unknown, field: string): string | null {
  if (value == null || value === "") return null;
  return requiredId(value, field);
}

function copyRecordFields(value: Record<string, unknown>): Record<string, unknown> {
  return structuredClone(value);
}

function normalizeReview(review: RawRecordReview, recordId: string): RawRecordReview {
  if (!Array.isArray(review.history) || review.history.length === 0) throw new Error(`${recordId}_review_history_required`);
  const history = review.history.map((entry) => ({
    state: entry.state,
    actorId: requiredId(entry.actorId, "review_actor_id"),
    occurredAt: requiredTimestamp(entry.occurredAt, "review_occurred_at"),
    source: requiredId(entry.source, "review_source"),
    note: entry.note == null ? null : String(entry.note),
  }));
  const state = history[history.length - 1]!.state;
  if (review.state !== state) throw new Error("review_state_history_mismatch");
  return { state, history };
}

function normalizeVisibilityHistory(
  history: RawRecordVisibilityHistoryEntry[],
  visibility: RawRecordVisibility,
  recordId: string,
): RawRecordVisibilityHistoryEntry[] {
  if (!Array.isArray(history) || history.length === 0) throw new Error(`${recordId}_visibility_history_required`);
  const normalized = history.map((entry) => ({
    visibility: entry.visibility,
    actorId: requiredId(entry.actorId, "visibility_actor_id"),
    occurredAt: requiredTimestamp(entry.occurredAt, "visibility_occurred_at"),
    source: requiredId(entry.source, "visibility_source"),
  }));
  if (normalized[normalized.length - 1]!.visibility !== visibility) throw new Error("visibility_history_mismatch");
  return normalized;
}

function normalizeChangeHistory(history: RawRecordChangeHistoryEntry[], recordId: string): RawRecordChangeHistoryEntry[] {
  if (!Array.isArray(history)) throw new Error(`${recordId}_change_history_invalid`);
  return history.map((entry) => ({
    actorId: requiredId(entry.actorId, "change_actor_id"),
    occurredAt: requiredTimestamp(entry.occurredAt, "change_occurred_at"),
    source: requiredId(entry.source, "change_source"),
    revision: requiredId(entry.revision, "change_revision"),
    changeType: requiredId(entry.changeType, "change_type"),
  }));
}

export function normalizeRawRecordPortabilityRecord(
  input: RawRecordPortabilityRecordInput,
): RawRecordPortabilityRecord {
  const recordId = requiredId(input.recordId, "record_id");
  const rights = normalizeObservationDataRights({
    ...input.consent,
    visitId: input.consent.visitId ?? recordId,
    sourcePayload: {
      ...(input.consent.sourcePayload ?? {}),
      recordId,
      archiveSchemaVersion: RAW_RECORD_PORTABILITY_ARCHIVE_SCHEMA_VERSION,
    },
  });
  return {
    recordId,
    contributorFields: copyRecordFields(input.contributorFields),
    capturedAt: requiredTimestamp(input.capturedAt, "captured_at"),
    placeRef: optionalId(input.placeRef, "place_ref"),
    provenance: {
      sourceRef: requiredId(input.provenance.sourceRef, "provenance_source_ref"),
      sourceRevision: requiredId(input.provenance.sourceRevision, "provenance_source_revision"),
      sourceKind: requiredId(input.provenance.sourceKind, "provenance_source_kind"),
    },
    review: normalizeReview(input.review, recordId),
    consent: rights,
    visibility: input.visibility,
    visibilityHistory: normalizeVisibilityHistory(input.visibilityHistory, input.visibility, recordId),
    changeHistory: normalizeChangeHistory(input.changeHistory, recordId),
  };
}

export function buildRawRecordPortabilityArchive(
  input: RawRecordPortabilityArchiveInput,
): RawRecordPortabilityArchive {
  if (!Array.isArray(input.records)) throw new Error("archive_records_required");
  const records = input.records.map(normalizeRawRecordPortabilityRecord);
  const recordIds = new Set(records.map((record) => record.recordId));
  if (recordIds.size !== records.length) throw new Error("archive_record_id_duplicate");
  return {
    schemaVersion: RAW_RECORD_PORTABILITY_ARCHIVE_SCHEMA_VERSION,
    records,
  };
}

export function serializeRawRecordPortabilityArchive(
  archive: RawRecordPortabilityArchive,
): string {
  if (archive.schemaVersion !== RAW_RECORD_PORTABILITY_ARCHIVE_SCHEMA_VERSION) {
    throw new Error("archive_schema_version_invalid");
  }
  return JSON.stringify({
    schemaVersion: RAW_RECORD_PORTABILITY_ARCHIVE_SCHEMA_VERSION,
    records: archive.records.map((record) => ({
      recordId: record.recordId,
      contributorFields: copyRecordFields(record.contributorFields),
      capturedAt: record.capturedAt,
      placeRef: record.placeRef,
      provenance: { ...record.provenance },
      review: {
        state: record.review.state,
        history: record.review.history.map((entry) => ({ ...entry })),
      },
      consent: structuredClone(record.consent),
      visibility: record.visibility,
      visibilityHistory: record.visibilityHistory.map((entry) => ({ ...entry })),
      changeHistory: record.changeHistory.map((entry) => ({ ...entry })),
    })),
  });
}

export function deserializeRawRecordPortabilityArchive(serialized: string): RawRecordPortabilityArchive {
  const parsed: unknown = JSON.parse(serialized);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("archive_payload_invalid");
  const candidate = parsed as { schemaVersion?: unknown; records?: unknown };
  if (candidate.schemaVersion !== RAW_RECORD_PORTABILITY_ARCHIVE_SCHEMA_VERSION || !Array.isArray(candidate.records)) {
    throw new Error("archive_payload_invalid");
  }
  return {
    schemaVersion: RAW_RECORD_PORTABILITY_ARCHIVE_SCHEMA_VERSION,
    records: structuredClone(candidate.records) as RawRecordPortabilityRecord[],
  };
}

export function isRawRecordPortabilityArchive(value: unknown): value is RawRecordPortabilityArchive {
  return Boolean(
    value
    && typeof value === "object"
    && !Array.isArray(value)
    && (value as { schemaVersion?: unknown }).schemaVersion === RAW_RECORD_PORTABILITY_ARCHIVE_SCHEMA_VERSION
    && Array.isArray((value as { records?: unknown }).records),
  );
}

export function isTaxonInventory(value: unknown): value is TaxonInventory {
  return Boolean(
    value
    && typeof value === "object"
    && !Array.isArray(value)
    && (value as { schemaVersion?: unknown }).schemaVersion === TAXON_INVENTORY_SCHEMA_VERSION
    && Array.isArray((value as { entries?: unknown }).entries),
  );
}

export function archiveHasNoDerivedOutputFields(archive: RawRecordPortabilityArchive): boolean {
  const forbidden = ["taxa", "taxonName", "recordCount", "totalTaxa", "composition", "reportRef"];
  const keys = Object.keys(archive);
  return forbidden.every((key) => !keys.includes(key)) && archive.records.every((record) =>
    forbidden.every((key) => !Object.keys(record).includes(key))
  );
}

export const RAW_ARCHIVE_CONSENT_POLICY_VERSION = OBSERVATION_DATA_RIGHTS_POLICY_VERSION;
