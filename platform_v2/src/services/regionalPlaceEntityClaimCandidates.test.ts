import assert from "node:assert/strict";
import test from "node:test";
import { adaptRegionalSourceRecord } from "./regionalSourceRecordAdapter.js";
import {
  planRegionalPlaceEntityClaimCandidates,
  type RegionalPlaceEntityClaimCandidateInput,
} from "./regionalPlaceEntityClaimCandidates.js";
import { buildRegionalSourceRegistryEntries } from "./regionalSourceRegistryV2.js";

const entry = buildRegionalSourceRegistryEntries().find(
  (candidate) => candidate.source.sourceAssetId === "source:iwata:open-data-landing",
) ?? null;
assert.ok(entry);

function record() {
  const result = adaptRegionalSourceRecord({
    entry,
    sourceRecordId: "record:iwata:001",
    locator: { kind: "row", value: 3 },
    fields: [
      { key: "name", value: "藤棚", locator: { kind: "cell", value: "B3" } },
      { key: "address", value: "磐田市", locator: { kind: "cell", value: "C3" } },
    ],
  });
  assert.equal(result.status, "READY_FOR_REVIEW");
  if (result.status !== "READY_FOR_REVIEW") throw new Error("fixture_record_not_ready");
  return result.record;
}

function candidateInput(overrides: Partial<RegionalPlaceEntityClaimCandidateInput> = {}): RegionalPlaceEntityClaimCandidateInput {
  return {
    record: record(),
    subjectKind: "entity",
    subjectCandidateId: "source-entity:iwata:001",
    predicates: [
      { fieldKey: "name", predicateUri: "https://zukan.earth/predicate/display-name" },
      { fieldKey: "address", predicateUri: "https://zukan.earth/predicate/address" },
    ],
    ...overrides,
  };
}

test("maps explicit Place or Entity subject candidates without canonical promotion", () => {
  const result = planRegionalPlaceEntityClaimCandidates(candidateInput());
  assert.equal(result.status, "READY_FOR_REVIEW");
  if (result.status !== "READY_FOR_REVIEW") return;
  assert.equal(result.candidates.length, 2);
  assert.deepEqual(result.candidates.map((candidate) => candidate.fieldKey), ["address", "name"]);
  assert.ok(result.candidates.every((candidate) => candidate.subjectKind === "entity"));
  assert.ok(result.candidates.every((candidate) => candidate.sourceRecordId === "record:iwata:001"));
  assert.ok(result.candidates.every((candidate) => candidate.sourceEditionId === "edition:iwata:open-data-landing:2026-07-28"));
  assert.ok(result.candidates.every((candidate) => candidate.recordLocator.kind === "row" && candidate.recordLocator.value === 3));
  assert.ok(result.candidates.every((candidate) => candidate.fieldLocator.kind === "cell"));
  assert.equal(result.candidates.find((candidate) => candidate.fieldKey === "name")?.value, "藤棚");
  assert.ok(result.candidates.every((candidate) => candidate.reviewState === "unreviewed"));
  assert.ok(result.candidates.every((candidate) => candidate.publicationState === "NOT_PUBLISHED"));
  assert.ok(result.candidates.every((candidate) => candidate.claimCandidateId.length > 0));

  const place = planRegionalPlaceEntityClaimCandidates(candidateInput({ subjectKind: "place", subjectCandidateId: "source-place:iwata:001" }));
  assert.equal(place.status, "READY_FOR_REVIEW");
  if (place.status === "READY_FOR_REVIEW") assert.ok(place.candidates.every((candidate) => candidate.subjectKind === "place"));
});

test("candidate IDs and ordering are stable when predicate input order changes", () => {
  const first = planRegionalPlaceEntityClaimCandidates(candidateInput());
  const second = planRegionalPlaceEntityClaimCandidates(candidateInput({
    predicates: [...candidateInput().predicates].reverse(),
  }));
  assert.deepEqual(second, first);

  const changedValue = planRegionalPlaceEntityClaimCandidates(candidateInput({
    record: {
      ...record(),
      fields: record().fields.map((field) => field.key === "name" ? { ...field, value: "別の藤棚" } : field),
    },
  }));
  assert.equal(changedValue.status, "READY_FOR_REVIEW");
  if (changedValue.status === "READY_FOR_REVIEW" && first.status === "READY_FOR_REVIEW") {
    assert.notEqual(changedValue.candidates.find((candidate) => candidate.fieldKey === "name")?.claimCandidateId,
      first.candidates.find((candidate) => candidate.fieldKey === "name")?.claimCandidateId);
  }
});

test("blocked records fail closed before claim candidates are emitted", () => {
  const restrictedRecord = { ...record(), rightsClass: "RESTRICTED" as const };
  const restricted = planRegionalPlaceEntityClaimCandidates(candidateInput({ record: restrictedRecord }));
  assert.deepEqual(restricted, {
    status: "BLOCKED",
    blockers: ["rights_class_restricted"],
    candidates: [],
  });

  const unacquiredRecord = { ...record(), acquisitionState: "NOT_ACQUIRED" as const };
  const unacquired = planRegionalPlaceEntityClaimCandidates(candidateInput({ record: unacquiredRecord }));
  assert.deepEqual(unacquired, {
    status: "BLOCKED",
    blockers: ["acquisition_not_acquired"],
    candidates: [],
  });

  const indexOnlyRecord = { ...record(), rightsClass: "INDEX_ONLY" as const };
  const indexOnly = planRegionalPlaceEntityClaimCandidates(candidateInput({ record: indexOnlyRecord }));
  assert.deepEqual(indexOnly, {
    status: "BLOCKED",
    blockers: ["rights_class_index_only"],
    candidates: [],
  });
});

test("missing subject, evidence, values, fields and predicate URI fail closed", () => {
  const malformed = {
    ...record(),
    sourceRecordId: "",
    sourceEditionId: "",
    sourceLocator: null as never,
    fields: [
      { key: "name", value: null, locator: null as never },
    ],
  };
  const result = planRegionalPlaceEntityClaimCandidates(candidateInput({
    record: malformed,
    subjectKind: null,
    subjectCandidateId: "",
    predicates: [
      { fieldKey: "name", predicateUri: "https://zukan.earth/predicate/display-name" },
      { fieldKey: "missing", predicateUri: "https://zukan.earth/predicate/missing" },
      { fieldKey: "address", predicateUri: "not-a-url" },
    ],
  }));
  assert.equal(result.status, "BLOCKED");
  assert.deepEqual(result.blockers, [
    "field_missing_value:name",
    "field_not_present_or_ambiguous:missing",
    "invalid_predicate_uri:address",
    "invalid_subject_kind",
    "missing_source_edition_id",
    "missing_source_record_id",
    "missing_subject_candidate_id",
    "source_evidence_required",
  ]);
  assert.deepEqual(result.candidates, []);
});

test("duplicate field predicates and ambiguous source fields cannot create candidates", () => {
  const result = planRegionalPlaceEntityClaimCandidates(candidateInput({
    record: {
      ...record(),
      fields: [
        ...record().fields,
        { key: "name", value: "別名", locator: { kind: "cell", value: "D3" } },
      ],
    },
    predicates: [
      { fieldKey: "name", predicateUri: "https://zukan.earth/predicate/display-name" },
      { fieldKey: "name", predicateUri: "https://zukan.earth/predicate/alternate-name" },
    ],
  }));
  assert.deepEqual(result, {
    status: "BLOCKED",
    blockers: ["duplicate_predicate_field:name", "field_not_present_or_ambiguous:name"],
    candidates: [],
  });
});

test("runtime-shaped non-arrays fail closed instead of throwing", () => {
  const result = planRegionalPlaceEntityClaimCandidates(candidateInput({
    record: { ...record(), fields: null as never },
    predicates: null as never,
  }));
  assert.deepEqual(result, {
    status: "BLOCKED",
    blockers: ["predicates_required", "source_evidence_required"],
    candidates: [],
  });
});
