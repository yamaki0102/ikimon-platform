import assert from "node:assert/strict";
import test from "node:test";
import {
  REGIONAL_PUBLISHERS,
  REGIONAL_SOURCE_ASSETS,
} from "./regionalSourceRegistry.js";
import {
  adaptRegionalSourceRecord,
  serializeRegionalSourceRecord,
  type RegionalSourceRecordAdapterInput,
} from "./regionalSourceRecordAdapter.js";
import { buildRegionalSourceRegistryEntries } from "./regionalSourceRegistryV2.js";

const entries = buildRegionalSourceRegistryEntries();

function inputFor(sourceAssetId: string): RegionalSourceRecordAdapterInput {
  const entry = entries.find((candidate) => candidate.source.sourceAssetId === sourceAssetId) ?? null;
  return {
    entry,
    sourceRecordId: "record:test:001",
    locator: { kind: "row", value: 3 },
    title: "  藤の見どころ  ",
    fields: [
      { key: "name", value: "  藤棚  ", locator: { kind: "cell", value: "B3" } },
      { key: "address", value: null, locator: { kind: "cell", value: "C3" } },
    ],
  };
}

test("adapter preserves source, publisher, edition, rights and acquisition identity", () => {
  const result = adaptRegionalSourceRecord(inputFor("source:iwata:tourism-facilities-linkdata"));
  assert.equal(result.status, "READY_FOR_REVIEW");
  if (result.status !== "READY_FOR_REVIEW") return;

  assert.equal(result.record.sourceAssetId, "source:iwata:tourism-facilities-linkdata");
  assert.equal(result.record.sourceEditionId, "edition:iwata:tourism-facilities-linkdata:2024-03-26");
  assert.deepEqual(result.record.publisherIds, ["publisher:iwata-city"]);
  assert.equal(result.record.rightsClass, "ATTRIBUTION_REUSE");
  assert.equal(result.record.acquisitionState, "METADATA_ONLY");
  assert.equal(result.record.issuedAt, null);
  assert.equal(result.record.updatedAt, "2024-03-26");
  assert.equal(result.record.retrievedAt, "2026-07-28");
  assert.deepEqual(result.record.promotion, {
    placeCandidate: null,
    entityCandidate: null,
    reviewState: "NOT_REVIEWED",
    publicationState: "NOT_PUBLISHED",
  });
});

test("adapter keeps unknown dates explicit and sorts fields deterministically", () => {
  const result = adaptRegionalSourceRecord({
    ...inputFor("source:iwata:open-data-landing"),
    fields: [
      { key: "zeta", value: "z", locator: { kind: "cell", value: "D3" } },
      { key: "alpha", value: "a", locator: { kind: "cell", value: "A3" } },
    ],
  });
  assert.equal(result.status, "READY_FOR_REVIEW");
  if (result.status !== "READY_FOR_REVIEW") return;

  assert.equal(result.record.issuedAt, null);
  assert.equal(result.record.updatedAt, null);
  assert.deepEqual(result.record.fields.map((field) => field.key), ["alpha", "zeta"]);
  const reordered = {
    promotion: result.record.promotion,
    fields: result.record.fields,
    sourceLocator: result.record.sourceLocator,
    acquisitionState: result.record.acquisitionState,
    rightsClass: result.record.rightsClass,
    language: result.record.language,
    retrievedAt: result.record.retrievedAt,
    updatedAt: result.record.updatedAt,
    issuedAt: result.record.issuedAt,
    canonicalUrl: result.record.canonicalUrl,
    recordTitle: result.record.recordTitle,
    sourceTitle: result.record.sourceTitle,
    publisherIds: result.record.publisherIds,
    sourceEditionId: result.record.sourceEditionId,
    sourceAssetId: result.record.sourceAssetId,
    sourceRecordId: result.record.sourceRecordId,
  };
  assert.equal(serializeRegionalSourceRecord(result.record), serializeRegionalSourceRecord(reordered));
});

test("restricted and unknown rights fail closed without a source record", () => {
  const publisher = REGIONAL_PUBLISHERS[0];
  const source = REGIONAL_SOURCE_ASSETS[0];
  assert.ok(publisher);
  assert.ok(source);
  const base = buildRegionalSourceRegistryEntries([
    {
      ...source,
      rightsClass: "RESTRICTED",
      publisherIds: [publisher.publisherId],
    },
  ], [publisher])[0];
  assert.ok(base);

  const restricted = adaptRegionalSourceRecord({ ...inputFor(source.sourceAssetId), entry: base });
  assert.deepEqual(restricted, {
    status: "BLOCKED",
    blockers: ["rights_class_restricted", "acquisition_rights_blocked"],
    record: null,
  });
});

test("incomplete inputs fail closed and never create Place or Entity candidates", () => {
  const incomplete = adaptRegionalSourceRecord({
    entry: null,
    sourceRecordId: "",
    locator: null,
    fields: [{ key: "name", value: "candidate", locator: null as never }],
  });
  assert.equal(incomplete.status, "BLOCKED");
  assert.equal(incomplete.record, null);
  assert.deepEqual(incomplete.blockers, [
    "missing_source_registry_entry",
    "missing_source_record_id",
    "missing_source_locator",
  ]);
});

test("missing edition and field locator fail closed", () => {
  const entry = buildRegionalSourceRegistryEntries().find(
    (candidate) => candidate.source.sourceAssetId === "source:iwata:open-data-landing",
  );
  assert.ok(entry);
  const withoutEdition = { ...entry, currentEdition: null };
  const result = adaptRegionalSourceRecord({
    entry: withoutEdition,
    sourceRecordId: "record:test:002",
    locator: { kind: "record", value: "card-2" },
    fields: [{ key: "name", value: "x", locator: null as never }],
  });
  assert.equal(result.status, "BLOCKED");
  assert.deepEqual(result.blockers, ["missing_current_source_edition", "field_0_missing_locator"]);
});

test("unknown runtime rights, acquisition, dates and field values fail closed", () => {
  const entry = entries.find((candidate) => candidate.source.sourceAssetId === "source:iwata:open-data-landing");
  assert.ok(entry);
  const result = adaptRegionalSourceRecord({
    ...inputFor(entry.source.sourceAssetId),
    entry: {
      ...entry,
      source: { ...entry.source, rightsClass: "FUTURE_RIGHTS" as never },
      currentEdition: {
        ...entry.currentEdition!,
        acquisitionState: "FUTURE_ACQUISITION" as never,
        issuedAt: "2026/99/99",
      },
    },
    fields: [{ key: "name", value: 42 as never, locator: { kind: "row", value: 1 } }],
  });
  assert.equal(result.status, "BLOCKED");
  assert.deepEqual(result.blockers, [
    "unknown_rights_class",
    "unknown_acquisition_state",
    "invalid_issued_at_date",
    "field_0_invalid_value_type",
  ]);
});

test("unacquired sources and malformed provenance fail closed", () => {
  const entry = entries.find((candidate) => candidate.source.sourceAssetId === "source:iwata:open-data-landing");
  assert.ok(entry);
  const result = adaptRegionalSourceRecord({
    ...inputFor(entry.source.sourceAssetId),
    entry: {
      ...entry,
      source: { ...entry.source, title: "", sourceAssetId: "" },
      publishers: [{ ...entry.publishers[0]!, publisherId: "" }],
      currentEdition: {
        ...entry.currentEdition!,
        sourceEditionId: "",
        canonicalUrl: "not-a-url",
        acquisitionState: "NOT_ACQUIRED",
      },
    },
  });
  assert.equal(result.status, "BLOCKED");
  assert.deepEqual(result.blockers, [
    "missing_source_title",
    "missing_source_asset_id",
    "invalid_publisher_reference",
    "source_edition_asset_mismatch",
    "acquisition_not_acquired",
    "missing_source_edition_id",
    "invalid_canonical_url",
  ]);
});

test("stable serialization and dates reject locale or runtime-dependent forms", () => {
  const entry = entries.find((candidate) => candidate.source.sourceAssetId === "source:iwata:open-data-landing");
  assert.ok(entry);
  const bareYear = adaptRegionalSourceRecord({
    ...inputFor(entry.source.sourceAssetId),
    entry: {
      ...entry,
      currentEdition: { ...entry.currentEdition!, issuedAt: "2024" },
    },
  });
  assert.equal(bareYear.status, "BLOCKED");
  assert.deepEqual(bareYear.blockers, ["invalid_issued_at_date"]);

  const unknownLocator = adaptRegionalSourceRecord({
    ...inputFor(entry.source.sourceAssetId),
    locator: { kind: "future-kind", value: "record-1" } as never,
  });
  assert.deepEqual(unknownLocator, {
    status: "BLOCKED",
    blockers: ["missing_source_locator"],
    record: null,
  });
});
