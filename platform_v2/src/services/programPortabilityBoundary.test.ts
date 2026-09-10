import assert from "node:assert/strict";
import test from "node:test";
import {
  RAW_RECORD_PORTABILITY_ARCHIVE_SCHEMA_VERSION,
  TAXON_INVENTORY_SCHEMA_VERSION,
  archiveHasNoDerivedOutputFields,
  buildRawRecordPortabilityArchive,
  deserializeRawRecordPortabilityArchive,
  isRawRecordPortabilityArchive,
  isTaxonInventory,
  serializeRawRecordPortabilityArchive,
  type RawRecordPortabilityArchiveInput,
  type TaxonInventory,
} from "./programPortabilityBoundary.js";

const recordInput = (overrides: Partial<RawRecordPortabilityArchiveInput["records"][number]> = {}): RawRecordPortabilityArchiveInput["records"][number] => ({
  recordId: "record-1",
  contributorFields: { enteredLabel: "river bird", note: "near the reed bed" },
  capturedAt: "2026-09-10T00:00:00.000Z",
  placeRef: "place-river",
  provenance: {
    sourceRef: "source-record-1",
    sourceRevision: "rev-1",
    sourceKind: "record",
  },
  review: {
    state: "approved",
    history: [{
      state: "approved",
      actorId: "reviewer-1",
      occurredAt: "2026-09-10T01:00:00.000Z",
      source: "staff_review",
      note: "source checked",
    }],
  },
  consent: {
    visitId: "visit-1",
    recordConsent: "external_export",
    researchUseConsent: "public_export",
    datasetLicense: "CC-BY-4.0",
    mediaLicense: "CC-BY-4.0",
    externalExportAllowed: true,
    withdrawalStatus: "active",
  },
  visibility: "public_candidate",
  visibilityHistory: [{
    visibility: "public_candidate",
    actorId: "reviewer-1",
    occurredAt: "2026-09-10T01:00:00.000Z",
    source: "staff_review",
  }],
  changeHistory: [{
    actorId: "participant-1",
    occurredAt: "2026-09-10T00:30:00.000Z",
    source: "participant_edit",
    revision: "rev-1",
    changeType: "create",
  }],
  ...overrides,
});

const archiveInput = (): RawRecordPortabilityArchiveInput => ({ records: [recordInput()] });

test("RawRecordPortabilityArchive and TaxonInventory are distinct schemas", () => {
  const archive = buildRawRecordPortabilityArchive(archiveInput());
  const inventory: TaxonInventory = {
    schemaVersion: TAXON_INVENTORY_SCHEMA_VERSION,
    scope: "program",
    generatedAt: "2026-09-10T02:00:00.000Z",
    entries: [{ taxonName: "Example species", recordCount: 1 }],
    totalTaxa: 1,
    composition: { bird: 1 },
    reportRef: "report-1",
  };

  assert.equal(archive.schemaVersion, RAW_RECORD_PORTABILITY_ARCHIVE_SCHEMA_VERSION);
  assert.equal(inventory.schemaVersion, TAXON_INVENTORY_SCHEMA_VERSION);
  assert.equal(isRawRecordPortabilityArchive(archive), true);
  assert.equal(isTaxonInventory(inventory), true);
  assert.equal(isRawRecordPortabilityArchive(inventory), false);
  assert.equal(isTaxonInventory(archive), false);
  assert.notEqual(archive.schemaVersion, inventory.schemaVersion);
});

test("archive serialization preserves one record with source, provenance, review, consent, visibility and history", () => {
  const archive = buildRawRecordPortabilityArchive(archiveInput());
  const before = structuredClone(archive);
  const serialized = serializeRawRecordPortabilityArchive(archive);
  const roundTrip = deserializeRawRecordPortabilityArchive(serialized);

  assert.deepEqual(roundTrip, before);
  assert.equal(roundTrip.records.length, 1);
  assert.equal(roundTrip.records[0]?.recordId, "record-1");
  assert.equal(roundTrip.records[0]?.provenance.sourceRef, "source-record-1");
  assert.equal(roundTrip.records[0]?.review.history[0]?.actorId, "reviewer-1");
  assert.equal(roundTrip.records[0]?.consent.rightsPolicyVersion, "site_intelligence_p0_v1");
  assert.equal(roundTrip.records[0]?.consent.withdrawalStatus, "active");
  assert.equal(roundTrip.records[0]?.visibility, "public_candidate");
  assert.equal(roundTrip.records[0]?.visibilityHistory[0]?.source, "staff_review");
  assert.equal(roundTrip.records[0]?.changeHistory[0]?.revision, "rev-1");
  assert.deepEqual(archive, before);
});

test("consent withdrawal remains preserved and normalized rights fail closed", () => {
  const archive = buildRawRecordPortabilityArchive({
    records: [recordInput({
      consent: { ...recordInput().consent, withdrawalStatus: "withdrawn" },
      visibility: "withdrawn",
      visibilityHistory: [{
        visibility: "withdrawn",
        actorId: "subject-1",
        occurredAt: "2026-09-11T00:00:00.000Z",
        source: "consent_withdrawal",
      }],
    })],
  });

  assert.equal(archive.records[0]?.consent.withdrawalStatus, "withdrawn");
  assert.equal(archive.records[0]?.consent.publicAggregationAllowed, false);
  assert.equal(archive.records[0]?.visibility, "withdrawn");
});

test("free archive has no taxon aggregate, count, composition or report fields", () => {
  const archive = buildRawRecordPortabilityArchive(archiveInput());
  const parsed: Record<string, unknown> = JSON.parse(serializeRawRecordPortabilityArchive(archive));

  assert.equal(archiveHasNoDerivedOutputFields(archive), true);
  assert.equal("records" in parsed, true);
  assert.equal("taxa" in parsed, false);
  assert.equal("taxonName" in parsed, false);
  assert.equal("recordCount" in parsed, false);
  assert.equal("totalTaxa" in parsed, false);
  assert.equal("composition" in parsed, false);
  assert.equal("reportRef" in parsed, false);
  assert.equal("report" in parsed, false);
  assert.equal("speciesCount" in parsed, false);
});

test("duplicate records and mismatched histories fail closed", () => {
  assert.throws(
    () => buildRawRecordPortabilityArchive({ records: [recordInput(), recordInput()] }),
    /archive_record_id_duplicate/,
  );
  assert.throws(
    () => buildRawRecordPortabilityArchive({ records: [recordInput({
      visibility: "public",
      visibilityHistory: [{
        visibility: "public_candidate",
        actorId: "reviewer-1",
        occurredAt: "2026-09-10T01:00:00.000Z",
        source: "staff_review",
      }],
    })] }),
    /visibility_history_mismatch/,
  );
});

test("consent requires an explicit visit identity and deserialize validates records", () => {
  const missingVisit = structuredClone(recordInput());
  missingVisit.consent.visitId = undefined as never;
  assert.throws(
    () => buildRawRecordPortabilityArchive({ records: [missingVisit] }),
    /consent_visit_id_required/,
  );

  assert.throws(
    () => deserializeRawRecordPortabilityArchive(JSON.stringify({
      schemaVersion: RAW_RECORD_PORTABILITY_ARCHIVE_SCHEMA_VERSION,
      records: [{ recordId: "record-1" }],
    })),
    /archive_payload_invalid/,
  );
});
