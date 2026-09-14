import { createHash } from "node:crypto";
import {
  RAW_RECORD_PORTABILITY_ARCHIVE_SCHEMA_VERSION,
  normalizeRawRecordPortabilityRecord,
  type RawRecordPortabilityRecord,
  type RawRecordPortabilityRecordInput,
  type RawRecordVisibility,
} from "./programPortabilityBoundary.js";
import type { ObservationPublicationPolicy } from "./observationPublicationPolicy.js";

export const RAW_RECORD_PORTABILITY_MANIFEST_SCHEMA_VERSION =
  "zukan.raw-record-portability-manifest/v1" as const;

export type RawRecordArchiveAuthorization = "authorized" | "unauthorized" | "unknown";
export type RawRecordArchiveConsent = "allowed" | "denied" | "unknown";
export type RawRecordArchiveSourceAvailability = "available" | "missing" | "unknown";
export type RawRecordArchiveRetentionStatus =
  | "retained"
  | "delete_requested"
  | "deleted"
  | "quarantined"
  | "unknown";
export type RawRecordArchiveMediaAvailability =
  | "available"
  | "missing"
  | "deleted"
  | "quarantined"
  | "unknown";
export type RawRecordArchiveMediaKind = "image" | "video" | "audio" | "other";
export type RawRecordArchiveItemDecision = "included" | "partial" | "blocked";
export type RawRecordArchivePlanState = "complete" | "partial" | "blocked";

export type RawRecordArchiveFieldPolicy = {
  authorization: RawRecordArchiveAuthorization;
  consent: RawRecordArchiveConsent;
  visibility: RawRecordVisibility | "unknown";
  retention: RawRecordArchiveRetentionStatus;
};

export type RawRecordArchiveMediaInput = {
  mediaId: string;
  sourceRef: string;
  mediaKind: RawRecordArchiveMediaKind;
  authorization: RawRecordArchiveAuthorization;
  consent: RawRecordArchiveConsent;
  visibility: RawRecordVisibility | "unknown";
  availability: RawRecordArchiveMediaAvailability;
  retentionStatus: RawRecordArchiveRetentionStatus;
};

export type RawRecordArchiveLocationPolicy = Pick<
  ObservationPublicationPolicy,
  "publicLocationMode" | "publicTimePrecision" | "sensitivityStatus" | "sensitivityReason" | "policyRulesetVersion" | "recalculatedAt"
>;

export type RawRecordArchiveCandidate = RawRecordPortabilityRecordInput & {
  authorization: RawRecordArchiveAuthorization;
  locationPolicy: RawRecordArchiveLocationPolicy;
  lifecycle: {
    sourceAvailability: RawRecordArchiveSourceAvailability;
    retentionStatus: RawRecordArchiveRetentionStatus;
  };
  fieldPolicies: Readonly<Record<string, RawRecordArchiveFieldPolicy>>;
  mediaRefs: readonly RawRecordArchiveMediaInput[];
};

export type RawRecordPortabilityArchiveRequest = {
  requesterId: string;
  authorization: RawRecordArchiveAuthorization;
  sourceSnapshot: string;
  rightsSnapshot: string;
  recordIds: readonly string[];
  records: readonly RawRecordArchiveCandidate[];
};

export type RawRecordArchiveIssue = {
  code: string;
  retryable: boolean;
  fieldName?: string;
  mediaId?: string;
};

export type RawRecordArchiveFieldDecision = {
  fieldName: string;
  decision: "included" | "blocked";
  visibility: RawRecordVisibility | "unknown";
  issue: RawRecordArchiveIssue | null;
};

export type RawRecordArchiveMediaDecision = {
  mediaId: string;
  mediaKind: RawRecordArchiveMediaKind | "other";
  availability: RawRecordArchiveMediaAvailability | "unknown";
  retentionStatus: RawRecordArchiveRetentionStatus;
  visibility: RawRecordVisibility | "unknown";
  decision: "included" | "blocked";
  sourceRef: string | null;
  issue: RawRecordArchiveIssue | null;
};

export type RawRecordArchiveLifecycle = {
  sourceAvailability: RawRecordArchiveSourceAvailability;
  retentionStatus: RawRecordArchiveRetentionStatus;
  withdrawalStatus: RawRecordPortabilityRecord["consent"]["withdrawalStatus"];
  visibility: RawRecordPortabilityRecord["visibility"];
  reviewState: RawRecordPortabilityRecord["review"]["state"];
};

export type RawRecordArchiveItem = {
  recordId: string;
  decision: RawRecordArchiveItemDecision;
  record: RawRecordPortabilityRecord | null;
  mediaRefs: ReadonlyArray<Pick<RawRecordArchiveMediaInput, "mediaId" | "sourceRef" | "mediaKind">>;
  locationPolicy: RawRecordArchiveLocationPolicy | null;
  fieldDecisions: readonly RawRecordArchiveFieldDecision[];
  mediaDecisions: readonly RawRecordArchiveMediaDecision[];
  lifecycle: RawRecordArchiveLifecycle | null;
  issues: readonly RawRecordArchiveIssue[];
  retryable: boolean;
};

export type RawRecordPortabilityArchivePlan = {
  schemaVersion: typeof RAW_RECORD_PORTABILITY_MANIFEST_SCHEMA_VERSION;
  archiveSchemaVersion: typeof RAW_RECORD_PORTABILITY_ARCHIVE_SCHEMA_VERSION;
  archiveKind: "private_source_archive";
  publicProjection: false;
  requesterId: string;
  sourceSnapshot: string;
  rightsSnapshot: string;
  state: RawRecordArchivePlanState;
  items: readonly RawRecordArchiveItem[];
  manifestDigest: string;
};

const RAW_RECORD_VISIBILITIES = [
  "private",
  "program_restricted",
  "shared",
  "public_candidate",
  "public",
  "withdrawn",
] as const satisfies readonly RawRecordVisibility[];
const RAW_RECORD_ARCHIVE_AUTHORIZATIONS = ["authorized", "unauthorized", "unknown"] as const;
const RAW_RECORD_ARCHIVE_SOURCE_AVAILABILITIES = ["available", "missing", "unknown"] as const;
const RAW_RECORD_ARCHIVE_RETENTION_STATUSES = [
  "retained",
  "delete_requested",
  "deleted",
  "quarantined",
  "unknown",
] as const;
const RAW_RECORD_ARCHIVE_MEDIA_AVAILABILITIES = [
  "available",
  "missing",
  "deleted",
  "quarantined",
  "unknown",
] as const;
const RAW_RECORD_ARCHIVE_MEDIA_KINDS = ["image", "video", "audio", "other"] as const;
const RAW_RECORD_ARCHIVE_PUBLIC_LOCATION_MODES = ["exact", "site", "grid_250m", "grid_1km", "municipality", "hidden"] as const;
const RAW_RECORD_ARCHIVE_PUBLIC_TIME_PRECISIONS = ["datetime", "date", "month", "season", "hidden"] as const;
const RAW_RECORD_ARCHIVE_SENSITIVITY_STATUSES = [
  "none",
  "taxon_sensitive",
  "context_sensitive",
  "human_sensitive",
  "manager_restricted",
  "uncertain",
] as const;

function requiredText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${field}_required`);
  return value.trim();
}

function compareCanonicalStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("manifest_value_not_serializable");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value !== "object") throw new Error("manifest_value_not_serializable");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new Error("manifest_value_not_serializable");
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => compareCanonicalStrings(left, right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
    .join(",")}}`;
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function issue(
  code: string,
  retryable: boolean,
  details: Pick<RawRecordArchiveIssue, "fieldName" | "mediaId"> = {},
): RawRecordArchiveIssue {
  return { code, retryable, ...details };
}

function recordIdFrom(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const recordId = (value as { recordId?: unknown }).recordId;
  return typeof recordId === "string" && recordId.trim() ? recordId.trim() : null;
}

function normalizeLocationPolicy(value: unknown): RawRecordArchiveLocationPolicy | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const policy = value as Partial<RawRecordArchiveLocationPolicy>;
  if (!isOneOf(policy.publicLocationMode, RAW_RECORD_ARCHIVE_PUBLIC_LOCATION_MODES)) return null;
  if (!isOneOf(policy.publicTimePrecision, RAW_RECORD_ARCHIVE_PUBLIC_TIME_PRECISIONS)) return null;
  if (!isOneOf(policy.sensitivityStatus, RAW_RECORD_ARCHIVE_SENSITIVITY_STATUSES)) return null;
  const sensitivityReason = typeof policy.sensitivityReason === "string" ? policy.sensitivityReason.trim() : "";
  const policyRulesetVersion = typeof policy.policyRulesetVersion === "string" ? policy.policyRulesetVersion.trim() : "";
  const recalculatedAt = typeof policy.recalculatedAt === "string" ? policy.recalculatedAt.trim() : "";
  if (!sensitivityReason || !policyRulesetVersion || !recalculatedAt || !Number.isFinite(Date.parse(recalculatedAt))) return null;
  return {
    publicLocationMode: policy.publicLocationMode,
    publicTimePrecision: policy.publicTimePrecision,
    sensitivityStatus: policy.sensitivityStatus,
    sensitivityReason,
    policyRulesetVersion,
    recalculatedAt,
  };
}

function lifecycleFor(
  candidate: RawRecordArchiveCandidate,
  record: RawRecordPortabilityRecord,
): RawRecordArchiveLifecycle {
  return {
    sourceAvailability: isOneOf(candidate.lifecycle?.sourceAvailability, RAW_RECORD_ARCHIVE_SOURCE_AVAILABILITIES)
      ? candidate.lifecycle.sourceAvailability
      : "unknown",
    retentionStatus: isOneOf(candidate.lifecycle?.retentionStatus, RAW_RECORD_ARCHIVE_RETENTION_STATUSES)
      ? candidate.lifecycle.retentionStatus
      : "unknown",
    withdrawalStatus: record.consent.withdrawalStatus,
    visibility: record.visibility,
    reviewState: record.review.state,
  };
}

function emptyItem(
  recordId: string,
  issues: readonly RawRecordArchiveIssue[],
  lifecycle: RawRecordArchiveLifecycle | null = null,
  locationPolicy: RawRecordArchiveLocationPolicy | null = null,
): RawRecordArchiveItem {
  return {
    recordId,
    decision: "blocked",
    record: null,
    mediaRefs: [],
    locationPolicy,
    fieldDecisions: [],
    mediaDecisions: [],
    lifecycle,
    issues,
    retryable: issues.some((item) => item.retryable),
  };
}

function recordIssues(
  candidate: RawRecordArchiveCandidate,
  record: RawRecordPortabilityRecord,
): RawRecordArchiveIssue[] {
  // `externalExportAllowed` belongs to public syndication. This manifest is a
  // private archive for an already-authorized requester, so field/media policy
  // and the observed Record lifecycle remain the governing boundaries here.
  const issues: RawRecordArchiveIssue[] = [];
  const sourceAvailability = candidate.lifecycle?.sourceAvailability;
  const retentionStatus = candidate.lifecycle?.retentionStatus;
  if (sourceAvailability === "missing") issues.push(issue("record_source_unavailable", true));
  else if (sourceAvailability !== "available") issues.push(issue("record_source_unknown", true));

  if (retentionStatus === "delete_requested") issues.push(issue("record_delete_requested", false));
  else if (retentionStatus === "deleted") issues.push(issue("record_deleted", false));
  else if (retentionStatus === "quarantined") issues.push(issue("record_quarantined", false));
  else if (retentionStatus !== "retained") issues.push(issue("record_retention_unknown", true));

  if (record.consent.withdrawalStatus === "withdrawn") issues.push(issue("record_withdrawn", false));
  else if (record.consent.withdrawalStatus === "delete_requested") issues.push(issue("record_delete_requested", false));
  else if (record.consent.withdrawalStatus === "deleted") issues.push(issue("record_deleted", false));
  if (record.visibility === "withdrawn") issues.push(issue("record_withdrawn", false));
  return issues;
}

function fieldDecision(
  fieldName: string,
  policy: RawRecordArchiveFieldPolicy | undefined,
): { decision: RawRecordArchiveFieldDecision; issue: RawRecordArchiveIssue | null } {
  const visibility = isOneOf(policy?.visibility, RAW_RECORD_VISIBILITIES) ? policy.visibility : "unknown";
  let fieldIssue: RawRecordArchiveIssue | null = null;
  if (!policy) fieldIssue = issue("field_policy_missing", true, { fieldName });
  else if (policy.authorization === "unauthorized") fieldIssue = issue("field_authorization_denied", false, { fieldName });
  else if (policy.authorization !== "authorized") fieldIssue = issue("field_authorization_unknown", true, { fieldName });
  else if (policy.consent === "denied") fieldIssue = issue("field_consent_denied", false, { fieldName });
  else if (policy.consent !== "allowed") fieldIssue = issue("field_consent_unknown", true, { fieldName });
  else if (visibility === "withdrawn") fieldIssue = issue("field_withdrawn", false, { fieldName });
  else if (visibility === "unknown") fieldIssue = issue("field_visibility_unknown", true, { fieldName });
  else if (policy.retention === "delete_requested" || policy.retention === "deleted" || policy.retention === "quarantined") {
    fieldIssue = issue("field_retention_blocked", false, { fieldName });
  } else if (policy.retention !== "retained") {
    fieldIssue = issue("field_retention_unknown", true, { fieldName });
  }
  return {
    decision: {
      fieldName,
      decision: fieldIssue ? "blocked" : "included",
      visibility,
      issue: fieldIssue,
    },
    issue: fieldIssue,
  };
}

function mediaDecision(
  media: RawRecordArchiveMediaInput,
): { decision: RawRecordArchiveMediaDecision; issue: RawRecordArchiveIssue | null } {
  const mediaId = typeof media?.mediaId === "string" ? media.mediaId.trim() : "";
  const mediaKind = isOneOf(media?.mediaKind, RAW_RECORD_ARCHIVE_MEDIA_KINDS) ? media.mediaKind : "other";
  const availability = isOneOf(media?.availability, RAW_RECORD_ARCHIVE_MEDIA_AVAILABILITIES)
    ? media.availability
    : "unknown";
  const retentionStatus = isOneOf(media?.retentionStatus, RAW_RECORD_ARCHIVE_RETENTION_STATUSES)
    ? media.retentionStatus
    : "unknown";
  const visibility = isOneOf(media?.visibility, RAW_RECORD_VISIBILITIES) ? media.visibility : "unknown";
  const details = { mediaId, mediaKind, availability, retentionStatus, visibility } as const;
  let mediaIssue: RawRecordArchiveIssue | null = null;
  if (!mediaId) mediaIssue = issue("media_id_required", false);
  else if (media.authorization === "unauthorized") mediaIssue = issue("media_authorization_denied", false, { mediaId });
  else if (media.authorization !== "authorized") mediaIssue = issue("media_authorization_unknown", true, { mediaId });
  else if (media.consent === "denied") mediaIssue = issue("media_consent_denied", false, { mediaId });
  else if (media.consent !== "allowed") mediaIssue = issue("media_consent_unknown", true, { mediaId });
  else if (retentionStatus === "delete_requested" || retentionStatus === "deleted" || retentionStatus === "quarantined") {
    mediaIssue = issue("media_retention_blocked", false, { mediaId });
  } else if (retentionStatus !== "retained") {
    mediaIssue = issue("media_retention_unknown", true, { mediaId });
  }
  else if (availability === "missing") mediaIssue = issue("media_unavailable", true, { mediaId });
  else if (availability === "unknown") mediaIssue = issue("media_availability_unknown", true, { mediaId });
  else if (availability === "deleted") mediaIssue = issue("media_deleted", false, { mediaId });
  else if (availability === "quarantined") mediaIssue = issue("media_quarantined", false, { mediaId });
  else if (visibility === "withdrawn") mediaIssue = issue("media_withdrawn", false, { mediaId });
  else if (visibility === "unknown") mediaIssue = issue("media_visibility_unknown", true, { mediaId });
  else if (typeof media.sourceRef !== "string" || media.sourceRef.trim().length === 0) mediaIssue = issue("media_source_ref_required", true, { mediaId });
  return {
    decision: {
      ...details,
      mediaId: mediaId || "unknown",
      decision: mediaIssue ? "blocked" : "included",
      sourceRef: mediaIssue ? null : media.sourceRef.trim(),
      issue: mediaIssue,
    },
    issue: mediaIssue,
  };
}

function buildItem(recordId: string, candidate: RawRecordArchiveCandidate): RawRecordArchiveItem {
  if (candidate.authorization !== "authorized") {
    return emptyItem(recordId, [issue(
      candidate.authorization === "unauthorized" ? "record_authorization_denied" : "record_authorization_unknown",
      candidate.authorization !== "unauthorized",
    )]);
  }

  let record: RawRecordPortabilityRecord;
  try {
    record = normalizeRawRecordPortabilityRecord(candidate);
  } catch {
    return emptyItem(recordId, [issue("record_payload_invalid", true)]);
  }
  const lifecycle = lifecycleFor(candidate, record);
  const locationPolicy = normalizeLocationPolicy(candidate.locationPolicy);
  if (!locationPolicy) return emptyItem(recordId, [issue("location_policy_unknown", true)], lifecycle);
  const recordBlocked = recordIssues(candidate, record);
  if (recordBlocked.length > 0) return emptyItem(recordId, recordBlocked, lifecycle, locationPolicy);

  const includedFields: Record<string, unknown> = {};
  const fieldDecisions: RawRecordArchiveFieldDecision[] = [];
  const issues: RawRecordArchiveIssue[] = [];
  for (const fieldName of Object.keys(record.contributorFields).sort()) {
    const result = fieldDecision(fieldName, candidate.fieldPolicies?.[fieldName]);
    fieldDecisions.push(result.decision);
    if (result.issue) continue;
    includedFields[fieldName] = structuredClone(record.contributorFields[fieldName]);
  }

  const mediaDecisions: RawRecordArchiveMediaDecision[] = [];
  const includedMedia: Array<Pick<RawRecordArchiveMediaInput, "mediaId" | "sourceRef" | "mediaKind">> = [];
  const mediaInputs = Array.isArray(candidate.mediaRefs) ? [...candidate.mediaRefs] : [];
  if (!Array.isArray(candidate.mediaRefs)) issues.push(issue("media_refs_invalid", true));
  const evaluatedMedia = mediaInputs.map((media) => {
    const result = mediaDecision(media);
    const mediaId = typeof media?.mediaId === "string" && media.mediaId.trim() ? media.mediaId.trim() : null;
    return { mediaId, result };
  });
  evaluatedMedia.sort((left, right) => {
    const idComparison = compareCanonicalStrings(left.mediaId ?? "", right.mediaId ?? "");
    if (idComparison !== 0) return idComparison;
    return compareCanonicalStrings(
      canonicalJson(left.result.decision),
      canonicalJson(right.result.decision),
    );
  });
  const mediaIdCounts = new Map<string, number>();
  for (const evaluated of evaluatedMedia) {
    if (evaluated.mediaId) mediaIdCounts.set(evaluated.mediaId, (mediaIdCounts.get(evaluated.mediaId) ?? 0) + 1);
  }
  for (const evaluated of evaluatedMedia) {
    const { mediaId, result } = evaluated;
    if (mediaId && (mediaIdCounts.get(mediaId) ?? 0) > 1) {
      const duplicate = issue("media_id_duplicate", false, { mediaId: result.decision.mediaId });
      mediaDecisions.push({
        ...result.decision,
        decision: "blocked",
        sourceRef: null,
        issue: duplicate,
      });
      issues.push(duplicate);
      continue;
    }
    mediaDecisions.push(result.decision);
    if (result.issue) issues.push(result.issue);
    else includedMedia.push({
      mediaId: result.decision.mediaId,
      sourceRef: result.decision.sourceRef!,
      mediaKind: result.decision.mediaKind,
    });
  }
  issues.push(...fieldDecisions.flatMap((decision) => decision.issue ? [decision.issue] : []));

  const hasIncludedPayload = Object.keys(includedFields).length > 0 || includedMedia.length > 0 || Object.keys(record.contributorFields).length === 0;
  const hasBlockedParts = issues.length > 0;
  const decision: RawRecordArchiveItemDecision = hasBlockedParts
    ? hasIncludedPayload ? "partial" : "blocked"
    : "included";
  return {
    recordId,
    decision,
    record: hasIncludedPayload ? { ...record, contributorFields: includedFields } : null,
    mediaRefs: includedMedia,
    locationPolicy,
    fieldDecisions,
    mediaDecisions,
    lifecycle,
    issues,
    retryable: issues.some((item) => item.retryable),
  };
}

function planState(items: readonly RawRecordArchiveItem[]): RawRecordArchivePlanState {
  if (items.every((item) => item.decision === "included")) return "complete";
  return items.some((item) => item.decision !== "blocked") ? "partial" : "blocked";
}

function finalizePlan(input: Omit<RawRecordPortabilityArchivePlan, "manifestDigest">): RawRecordPortabilityArchivePlan {
  return {
    ...input,
    manifestDigest: digest(input),
  };
}

export function planRawRecordPortabilityArchive(
  input: RawRecordPortabilityArchiveRequest,
): RawRecordPortabilityArchivePlan {
  const requesterId = requiredText(input.requesterId, "requester_id");
  const sourceSnapshot = requiredText(input.sourceSnapshot, "source_snapshot");
  const rightsSnapshot = requiredText(input.rightsSnapshot, "rights_snapshot");
  if (!isOneOf(input.authorization, RAW_RECORD_ARCHIVE_AUTHORIZATIONS)) throw new Error("request_authorization_invalid");
  if (!Array.isArray(input.recordIds)) throw new Error("archive_record_ids_required");
  if (!Array.isArray(input.records)) throw new Error("archive_records_required");

  const requestedRecordIds = input.recordIds.map((value) => requiredText(value, "record_id"));
  if (new Set(requestedRecordIds).size !== requestedRecordIds.length) throw new Error("archive_record_id_duplicate_request");
  const orderedRecordIds = [...requestedRecordIds].sort();
  const candidates = new Map<string, RawRecordArchiveCandidate>();
  for (const candidate of input.records) {
    const id = recordIdFrom(candidate);
    if (!id) throw new Error("record_id_required");
    if (candidates.has(id)) throw new Error("archive_record_id_duplicate");
    candidates.set(id, candidate);
  }

  const items = input.authorization !== "authorized"
    ? orderedRecordIds.map((recordId) => emptyItem(recordId, [issue(
      input.authorization === "unauthorized" ? "requester_authorization_denied" : "requester_authorization_unknown",
      input.authorization !== "unauthorized",
    )]))
    : orderedRecordIds.map((recordId) => {
      const candidate = candidates.get(recordId);
      if (!candidate) return emptyItem(recordId, [issue("record_not_found", false)]);
      return buildItem(recordId, candidate);
    });

  const unsigned: Omit<RawRecordPortabilityArchivePlan, "manifestDigest"> = {
    schemaVersion: RAW_RECORD_PORTABILITY_MANIFEST_SCHEMA_VERSION,
    archiveSchemaVersion: RAW_RECORD_PORTABILITY_ARCHIVE_SCHEMA_VERSION,
    archiveKind: "private_source_archive" as const,
    publicProjection: false as const,
    requesterId,
    sourceSnapshot,
    rightsSnapshot,
    state: planState(items),
    items,
  };
  return finalizePlan(unsigned);
}

export function serializeRawRecordPortabilityArchivePlan(
  plan: RawRecordPortabilityArchivePlan,
): string {
  if (plan.schemaVersion !== RAW_RECORD_PORTABILITY_MANIFEST_SCHEMA_VERSION) throw new Error("manifest_schema_version_invalid");
  if (plan.publicProjection !== false) throw new Error("manifest_public_projection_forbidden");
  const unsigned = { ...plan } as Omit<RawRecordPortabilityArchivePlan, "manifestDigest"> & { manifestDigest?: string };
  delete unsigned.manifestDigest;
  const expectedDigest = digest(unsigned);
  if (expectedDigest !== plan.manifestDigest) throw new Error("manifest_digest_invalid");
  return canonicalJson(plan);
}
