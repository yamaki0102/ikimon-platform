import { createHash } from "node:crypto";

import { canonicalFoundationJson } from "./zukanFoundationV2RepositoryContract.js";

export const ZUKAN_PUBLICATION_BUILDER_SCHEMA = "zukan.publication-builder/v1" as const;

export type PublicationJsonPrimitive = string | number | boolean | null;
export type PublicationJsonValue =
  | PublicationJsonPrimitive
  | readonly PublicationJsonValue[]
  | { readonly [key: string]: PublicationJsonValue };

export type PublicationOutput = PublicationJsonValue | string | Uint8Array;

export type PublicationSelectedPlaceEntityClaimIds = {
  placeIds: readonly string[];
  entityIds: readonly string[];
  claimIds: readonly string[];
};

export type PublicationQueryAndFilters = {
  query: string | null;
  filters: { readonly [key: string]: PublicationJsonValue };
};

export type PublicationEditorialChange = {
  targetId: string;
  description: string;
};

export type PublicationEditorialExclusion = {
  targetId: string;
  reason: string;
};

export type PublicationEditorialChangesAndExclusions = {
  changes: readonly PublicationEditorialChange[];
  exclusions: readonly PublicationEditorialExclusion[];
};

export type PublicationEditorAndReviewer = {
  editorIds: readonly string[];
  reviewerIds: readonly string[];
};

export type PublicationEditionDiff = {
  added: readonly string[];
  removed: readonly string[];
  changed: readonly string[];
};

export type PublicationBuilderInput = {
  selectedPlaceEntityClaimIds: PublicationSelectedPlaceEntityClaimIds;
  sourceEditionIds: readonly string[];
  queryAndFilters: PublicationQueryAndFilters;
  editorialChangesAndExclusions: PublicationEditorialChangesAndExclusions;
  editorAndReviewer: PublicationEditorAndReviewer;
  finalizedTime: string;
  output: PublicationOutput;
  editionDiff: PublicationEditionDiff;
};

export type PublicationEditionManifest = {
  schema_version: typeof ZUKAN_PUBLICATION_BUILDER_SCHEMA;
  selected_place_entity_claim_ids: {
    place_ids: readonly string[];
    entity_ids: readonly string[];
    claim_ids: readonly string[];
  };
  source_edition_ids: readonly string[];
  query_and_filters: {
    query: string | null;
    filters: { readonly [key: string]: PublicationJsonValue };
  };
  editorial_changes_and_exclusions: {
    changes: readonly PublicationEditorialChange[];
    exclusions: readonly PublicationEditorialExclusion[];
  };
  editor_and_reviewer: {
    editor_ids: readonly string[];
    reviewer_ids: readonly string[];
  };
  finalized_time: string;
  output_checksum: string;
  edition_diff: {
    added: readonly string[];
    removed: readonly string[];
    changed: readonly string[];
  };
};

export type PublicationBuilderEffects = {
  databaseReads: 0;
  databaseWrites: 0;
  networkCalls: 0;
  publicationEffects: 0;
  runtimeMutations: 0;
};

export type PublicationBuilderResult =
  | {
      status: "READY_FOR_REVIEW";
      blockers: readonly [];
      manifest: PublicationEditionManifest;
      serializedManifest: string;
      outputChecksum: string;
      effects: PublicationBuilderEffects;
    }
  | {
      status: "BLOCKED";
      blockers: readonly string[];
      manifest: null;
      serializedManifest: null;
      outputChecksum: null;
      effects: PublicationBuilderEffects;
    };

const NO_EFFECTS: PublicationBuilderEffects = {
  databaseReads: 0,
  databaseWrites: 0,
  networkCalls: 0,
  publicationEffects: 0,
  runtimeMutations: 0,
};

function compareStable(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isJsonValue(value: unknown, ancestors = new Set<object>()): value is PublicationJsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object") return false;
  if (value instanceof Uint8Array || value instanceof Date || value instanceof Map || value instanceof Set) {
    return false;
  }
  if (ancestors.has(value)) return false;
  ancestors.add(value);
  if (Array.isArray(value)) {
    const valid = value.every((item) => isJsonValue(item, ancestors));
    ancestors.delete(value);
    return valid;
  }
  if (!isRecord(value)) {
    ancestors.delete(value);
    return false;
  }
  const valid = Object.values(value).every((item) => isJsonValue(item, ancestors));
  ancestors.delete(value);
  return valid;
}

function canonicalJsonValue(value: PublicationJsonValue): PublicationJsonValue {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => compareStable(left, right))
      .map(([key, child]) => [key, canonicalJsonValue(child as PublicationJsonValue)]),
  );
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
}

function sortedStable(values: readonly string[]): string[] {
  return [...values].sort(compareStable);
}

function normalizeIdList(
  value: unknown,
  fieldName: string,
  blockers: string[],
  required: boolean,
): string[] {
  if (!Array.isArray(value)) {
    blockers.push(`${fieldName}_required`);
    return [];
  }

  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const [index, item] of value.entries()) {
    const id = cleanText(item);
    if (!id) {
      blockers.push(`${fieldName}_${index}_invalid`);
      continue;
    }
    if (seen.has(id)) {
      blockers.push(`duplicate_${fieldName}:${id}`);
      continue;
    }
    seen.add(id);
    normalized.push(id);
  }
  if (required && normalized.length === 0) blockers.push(`${fieldName}_required`);
  return sortedStable(normalized);
}

function normalizeSelectedIds(
  value: unknown,
  blockers: string[],
): PublicationEditionManifest["selected_place_entity_claim_ids"] {
  if (!isRecord(value)) {
    blockers.push("selected_place_entity_claim_ids_required");
    return { place_ids: [], entity_ids: [], claim_ids: [] };
  }
  const placeIds = normalizeIdList(value.placeIds, "selected_place_ids", blockers, false);
  const entityIds = normalizeIdList(value.entityIds, "selected_entity_ids", blockers, false);
  const claimIds = normalizeIdList(value.claimIds, "selected_claim_ids", blockers, false);
  if (placeIds.length + entityIds.length + claimIds.length === 0) {
    blockers.push("selected_place_entity_claim_ids_required");
  }
  return { place_ids: placeIds, entity_ids: entityIds, claim_ids: claimIds };
}

function normalizeQueryAndFilters(
  value: unknown,
  blockers: string[],
): PublicationEditionManifest["query_and_filters"] {
  if (!isRecord(value)) {
    blockers.push("query_and_filters_required");
    return { query: null, filters: {} };
  }
  const queryValue = value.query;
  if (queryValue !== null && typeof queryValue !== "string") {
    blockers.push("query_invalid");
  }
  const filters = value.filters;
  if (!isRecord(filters) || !isJsonValue(filters)) {
    blockers.push("filters_invalid");
    return { query: typeof queryValue === "string" ? queryValue.trim() || null : null, filters: {} };
  }
  return {
    query: typeof queryValue === "string" ? queryValue.trim() || null : null,
    filters: canonicalJsonValue(filters) as { readonly [key: string]: PublicationJsonValue },
  };
}

function normalizeEditorialEntries(
  value: unknown,
  fieldName: "changes" | "exclusions",
  blockers: string[],
): PublicationEditorialChange[] | PublicationEditorialExclusion[] {
  if (!Array.isArray(value)) {
    blockers.push(`${fieldName}_required`);
    return [];
  }

  const entries: Array<PublicationEditorialChange | PublicationEditorialExclusion> = [];
  for (const [index, item] of value.entries()) {
    if (!isRecord(item)) {
      blockers.push(`${fieldName}_${index}_invalid`);
      continue;
    }
    const targetId = cleanText(item.targetId);
    const detailKey = fieldName === "changes" ? "description" : "reason";
    const detail = cleanText(item[detailKey]);
    if (!targetId) blockers.push(`${fieldName}_${index}_target_id_invalid`);
    if (!detail) blockers.push(`${fieldName}_${index}_${detailKey}_invalid`);
    if (!targetId || !detail) continue;
    entries.push(fieldName === "changes"
      ? { targetId, description: detail }
      : { targetId, reason: detail });
  }

  return entries.sort((left, right) => {
    const targetOrder = compareStable(left.targetId, right.targetId);
    if (targetOrder !== 0) return targetOrder;
    const leftDetail = "description" in left ? left.description : left.reason;
    const rightDetail = "description" in right ? right.description : right.reason;
    return compareStable(leftDetail, rightDetail);
  }) as PublicationEditorialChange[] | PublicationEditorialExclusion[];
}

function normalizeEditorialChangesAndExclusions(
  value: unknown,
  blockers: string[],
): PublicationEditionManifest["editorial_changes_and_exclusions"] {
  if (!isRecord(value)) {
    blockers.push("editorial_changes_and_exclusions_required");
    return { changes: [], exclusions: [] };
  }
  return {
    changes: normalizeEditorialEntries(value.changes, "changes", blockers) as PublicationEditorialChange[],
    exclusions: normalizeEditorialEntries(value.exclusions, "exclusions", blockers) as PublicationEditorialExclusion[],
  };
}

function normalizeEditorAndReviewer(
  value: unknown,
  blockers: string[],
): PublicationEditionManifest["editor_and_reviewer"] {
  if (!isRecord(value)) {
    blockers.push("editor_and_reviewer_required");
    return { editor_ids: [], reviewer_ids: [] };
  }
  return {
    editor_ids: normalizeIdList(value.editorIds, "editor_ids", blockers, true),
    reviewer_ids: normalizeIdList(value.reviewerIds, "reviewer_ids", blockers, true),
  };
}

function normalizeFinalizedTime(value: unknown, blockers: string[]): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T[^\s]+)?$/u.test(value.trim())) {
    blockers.push("finalized_time_invalid");
    return "";
  }
  const timestamp = Date.parse(value.trim());
  if (!Number.isFinite(timestamp)) {
    blockers.push("finalized_time_invalid");
    return "";
  }
  return new Date(timestamp).toISOString();
}

function normalizeEditionDiff(
  value: unknown,
  blockers: string[],
): PublicationEditionManifest["edition_diff"] {
  if (!isRecord(value)) {
    blockers.push("edition_diff_required");
    return { added: [], removed: [], changed: [] };
  }
  return {
    added: normalizeIdList(value.added, "edition_diff_added", blockers, false),
    removed: normalizeIdList(value.removed, "edition_diff_removed", blockers, false),
    changed: normalizeIdList(value.changed, "edition_diff_changed", blockers, false),
  };
}

function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function computePublicationOutputChecksum(output: PublicationOutput): string {
  if (output instanceof Uint8Array) return sha256Hex(output);
  if (typeof output === "string") return sha256Hex(output);
  if (!isJsonValue(output)) throw new TypeError("publication output must be JSON-safe, text, or bytes");
  return sha256Hex(canonicalFoundationJson(output));
}

function tryPublicationOutputChecksum(value: unknown, blockers: string[]): string | null {
  if (value === undefined) {
    blockers.push("output_required");
    return null;
  }
  try {
    return computePublicationOutputChecksum(value as PublicationOutput);
  } catch {
    blockers.push("output_not_serializable");
    return null;
  }
}

export function serializePublicationEditionManifest(manifest: PublicationEditionManifest): string {
  return canonicalFoundationJson(manifest);
}

export function buildPublicationEdition(input: PublicationBuilderInput): PublicationBuilderResult {
  const candidate: Record<string, unknown> = isRecord(input) ? input : {};
  const blockers: string[] = [];
  const selectedIds = normalizeSelectedIds(candidate.selectedPlaceEntityClaimIds, blockers);
  const sourceEditionIds = normalizeIdList(candidate.sourceEditionIds, "source_edition_ids", blockers, true);
  const queryAndFilters = normalizeQueryAndFilters(candidate.queryAndFilters, blockers);
  const editorialChangesAndExclusions = normalizeEditorialChangesAndExclusions(
    candidate.editorialChangesAndExclusions,
    blockers,
  );
  const editorAndReviewer = normalizeEditorAndReviewer(candidate.editorAndReviewer, blockers);
  const finalizedTime = normalizeFinalizedTime(candidate.finalizedTime, blockers);
  const outputChecksum = tryPublicationOutputChecksum(candidate.output, blockers);
  const editionDiff = normalizeEditionDiff(candidate.editionDiff, blockers);
  const uniqueBlockers = [...new Set(blockers)].sort(compareStable);

  if (uniqueBlockers.length > 0 || !outputChecksum) {
    return {
      status: "BLOCKED",
      blockers: uniqueBlockers.length > 0 ? uniqueBlockers : ["output_required"],
      manifest: null,
      serializedManifest: null,
      outputChecksum: null,
      effects: NO_EFFECTS,
    };
  }

  const manifest: PublicationEditionManifest = {
    schema_version: ZUKAN_PUBLICATION_BUILDER_SCHEMA,
    selected_place_entity_claim_ids: selectedIds,
    source_edition_ids: sourceEditionIds,
    query_and_filters: queryAndFilters,
    editorial_changes_and_exclusions: editorialChangesAndExclusions,
    editor_and_reviewer: editorAndReviewer,
    finalized_time: finalizedTime,
    output_checksum: outputChecksum,
    edition_diff: editionDiff,
  };

  return {
    status: "READY_FOR_REVIEW",
    blockers: [],
    manifest,
    serializedManifest: serializePublicationEditionManifest(manifest),
    outputChecksum,
    effects: NO_EFFECTS,
  };
}

export const buildPublicationManifest = buildPublicationEdition;
export const serializePublicationManifest = serializePublicationEditionManifest;
