import assert from "node:assert/strict";
import test from "node:test";
import {
  planRawRecordPortabilityArchive,
  serializeRawRecordPortabilityArchivePlan,
  type RawRecordArchiveCandidate,
  type RawRecordPortabilityArchiveRequest,
} from "./programRawRecordPortabilityArchive.js";

function candidate(overrides: Partial<RawRecordArchiveCandidate> = {}): RawRecordArchiveCandidate {
  return {
    recordId: "record-1",
    contributorFields: {
      enteredLabel: "river bird",
      privateNote: "near the reed bed",
    },
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
      areaProfileUseConsent: "aggregated_public",
      publicAggregationAllowed: true,
      withdrawalStatus: "active",
    },
    visibility: "public_candidate",
    locationPolicy: {
      publicLocationMode: "site",
      publicTimePrecision: "date",
      sensitivityStatus: "none",
      sensitivityReason: "ordinary_public_area_profile",
      policyRulesetVersion: "site_intelligence_p0_v1",
      recalculatedAt: "2026-09-10T02:00:00.000Z",
    },
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
    authorization: "authorized",
    lifecycle: {
      sourceAvailability: "available",
      retentionStatus: "retained",
    },
    contributorFieldPolicies: {
      enteredLabel: {
        authorization: "authorized",
        consent: "allowed",
        visibility: "public_candidate",
        retention: "retained",
      },
      privateNote: {
        authorization: "authorized",
        consent: "allowed",
        visibility: "private",
        retention: "retained",
      },
    },
    recordFieldPolicies: {
      capturedAt: {
        authorization: "authorized",
        consent: "allowed",
        visibility: "private",
        retention: "retained",
      },
      placeRef: {
        authorization: "authorized",
        consent: "allowed",
        visibility: "private",
        retention: "retained",
      },
      provenance: {
        authorization: "authorized",
        consent: "allowed",
        visibility: "private",
        retention: "retained",
      },
      review: {
        authorization: "authorized",
        consent: "allowed",
        visibility: "private",
        retention: "retained",
      },
      consent: {
        authorization: "authorized",
        consent: "allowed",
        visibility: "private",
        retention: "retained",
      },
      visibility: {
        authorization: "authorized",
        consent: "allowed",
        visibility: "private",
        retention: "retained",
      },
      visibilityHistory: {
        authorization: "authorized",
        consent: "allowed",
        visibility: "private",
        retention: "retained",
      },
      changeHistory: {
        authorization: "authorized",
        consent: "allowed",
        visibility: "private",
        retention: "retained",
      },
    },
    mediaRefs: [{
      mediaId: "media-1",
      sourceRef: "r2://records/record-1/media-1",
      mediaKind: "image",
      authorization: "authorized",
      consent: "allowed",
      visibility: "public_candidate",
      availability: "available",
      retentionStatus: "retained",
    }],
    ...overrides,
  };
}

function request(overrides: Partial<RawRecordPortabilityArchiveRequest> = {}): RawRecordPortabilityArchiveRequest {
  return {
    requesterId: "subject-1",
    authorization: "authorized",
    sourceSnapshot: "source-watermark-7",
    rightsSnapshot: "rights-snapshot-3",
    recordIds: ["record-1"],
    records: [candidate()],
    ...overrides,
  };
}

test("raw_record_archive_preserves_record_granularity", () => {
  const plan = planRawRecordPortabilityArchive(request());
  const item = plan.items[0]!;

  assert.equal(plan.state, "complete");
  assert.equal(plan.archiveKind, "private_source_archive");
  assert.equal(plan.publicProjection, false);
  assert.equal(item.decision, "included");
  assert.equal(item.record?.recordId, "record-1");
  assert.deepEqual(item.record?.provenance, candidate().provenance);
  assert.equal(item.record?.review?.history[0]?.state, "approved");
  assert.deepEqual(item.mediaRefs, [{
    mediaId: "media-1",
    sourceRef: "r2://records/record-1/media-1",
    mediaKind: "image",
  }]);
  assert.equal(item.lifecycle?.retentionStatus, "retained");
  assert.equal(item.locationPolicy?.publicLocationMode, "site");
});

test("raw_record_archive_keeps_private_source_for_authorized_requester", () => {
  const privateCandidate = candidate({
    consent: {
      ...candidate().consent,
      recordConsent: "private",
      researchUseConsent: "none",
      datasetLicense: null,
      mediaLicense: null,
      externalExportAllowed: false,
      publicAggregationAllowed: false,
      areaProfileUseConsent: "none",
    },
    visibility: "private",
    locationPolicy: {
      ...candidate().locationPolicy,
      publicLocationMode: "hidden",
      publicTimePrecision: "hidden",
      sensitivityStatus: "context_sensitive",
      sensitivityReason: "public_aggregation_not_allowed",
    },
    contributorFieldPolicies: {
      enteredLabel: {
        authorization: "authorized",
        consent: "allowed",
        visibility: "private",
        retention: "retained",
      },
      privateNote: {
        authorization: "authorized",
        consent: "allowed",
        visibility: "private",
        retention: "retained",
      },
    },
    visibilityHistory: [{
      visibility: "private",
      actorId: "subject-1",
      occurredAt: "2026-09-10T01:00:00.000Z",
      source: "private_draft",
    }],
  });
  const plan = planRawRecordPortabilityArchive(request({ records: [privateCandidate] }));
  const item = plan.items[0]!;

  assert.equal(plan.state, "complete");
  assert.equal(item.decision, "included");
  assert.equal(item.record?.visibility, "private");
  assert.equal(item.record?.consent?.externalExportAllowed, false);
  assert.deepEqual(item.record?.contributorFields, {
    enteredLabel: "river bird",
    privateNote: "near the reed bed",
  });
});

test("raw_record_archive_blocks_location_policy_that_exceeds_record_rights", () => {
  const privateWithPublicLocationPolicy = candidate({
    consent: {
      ...candidate().consent,
      recordConsent: "private",
      researchUseConsent: "none",
      datasetLicense: null,
      mediaLicense: null,
      externalExportAllowed: false,
      publicAggregationAllowed: false,
      areaProfileUseConsent: "none",
    },
    visibility: "private",
    visibilityHistory: [{
      visibility: "private",
      actorId: "subject-1",
      occurredAt: "2026-09-10T01:00:00.000Z",
      source: "private_draft",
    }],
  });
  const plan = planRawRecordPortabilityArchive(request({ records: [privateWithPublicLocationPolicy] }));
  const item = plan.items[0]!;

  assert.equal(plan.state, "blocked");
  assert.equal(item.decision, "blocked");
  assert.equal(item.record, null);
  assert.equal(item.locationPolicy, null);
  assert.equal(item.issues[0]?.code, "location_policy_rights_mismatch");
  assert.equal(item.issues[0]?.retryable, true);
});

test("raw_record_archive_blocks_noncanonical_location_policy_combinations", () => {
  const inconsistentPolicy = candidate({
    locationPolicy: {
      ...candidate().locationPolicy,
      publicLocationMode: "site",
      publicTimePrecision: "date",
      sensitivityStatus: "human_sensitive",
      sensitivityReason: "human_or_school_context",
    },
  });
  const plan = planRawRecordPortabilityArchive(request({ records: [inconsistentPolicy] }));
  const item = plan.items[0]!;

  assert.equal(plan.state, "blocked");
  assert.equal(item.decision, "blocked");
  assert.equal(item.record, null);
  assert.equal(item.locationPolicy, null);
  assert.equal(item.issues[0]?.code, "location_policy_inconsistent");
  assert.equal(item.issues[0]?.retryable, true);
});

test("raw_record_archive_does_not_default_missing_withdrawal_to_active", () => {
  const missingWithdrawal = candidate({
    consent: {
      ...candidate().consent,
      withdrawalStatus: undefined,
    },
  });
  const plan = planRawRecordPortabilityArchive(request({ records: [missingWithdrawal] }));
  const item = plan.items[0]!;

  assert.equal(plan.state, "blocked");
  assert.equal(item.decision, "blocked");
  assert.equal(item.record, null);
  assert.equal(item.lifecycle, null);
  assert.equal(item.issues[0]?.code, "record_withdrawal_unknown");
  assert.equal(item.issues[0]?.retryable, true);
});

test("raw_record_archive_applies_rights_to_fixed_record_fields", () => {
  const placeDenied = candidate({
    recordFieldPolicies: {
      ...candidate().recordFieldPolicies,
      placeRef: {
        authorization: "unauthorized",
        consent: "allowed",
        visibility: "private",
        retention: "retained",
      },
    },
  });
  const plan = planRawRecordPortabilityArchive(request({ records: [placeDenied] }));
  const item = plan.items[0]!;

  assert.equal(plan.state, "partial");
  assert.equal(item.decision, "partial");
  assert.equal("placeRef" in (item.record ?? {}), false);
  assert.equal(item.fieldDecisions.find((entry) => entry.fieldName === "record:placeRef")?.decision, "blocked");
  assert.equal(item.fieldDecisions.find((entry) => entry.fieldName === "record:placeRef")?.issue?.code, "field_authorization_denied");
  assert.doesNotMatch(JSON.stringify(item), /place-river/);
});

test("raw_record_archive_lifecycle_respects_fixed_field_redaction", () => {
  const cases = [
    { fieldName: "review", lifecycleKey: "reviewState" },
    { fieldName: "consent", lifecycleKey: "withdrawalStatus" },
    { fieldName: "visibility", lifecycleKey: "visibility" },
  ] as const;

  for (const { fieldName, lifecycleKey } of cases) {
    const plan = planRawRecordPortabilityArchive(request({
      records: [candidate({
        recordFieldPolicies: {
          ...candidate().recordFieldPolicies,
          [fieldName]: {
            ...candidate().recordFieldPolicies[fieldName],
            authorization: "unauthorized",
          },
        },
      })],
    }));
    const item = plan.items[0]!;

    assert.equal(item.decision, "partial");
    assert.equal(Object.hasOwn(item.record ?? {}, fieldName), false);
    assert.equal(Object.hasOwn(item.lifecycle ?? {}, lifecycleKey), false);
  }
});

test("raw_record_archive_mixed_visibility_is_field_scoped", () => {
  const plan = planRawRecordPortabilityArchive(request({
    records: [candidate({
      contributorFieldPolicies: {
        ...candidate().contributorFieldPolicies,
        privateNote: {
          authorization: "authorized",
          consent: "denied",
          visibility: "private",
          retention: "retained",
        },
      },
    })],
  }));
  const item = plan.items[0]!;

  assert.equal(plan.state, "partial");
  assert.equal(item.decision, "partial");
  assert.deepEqual(item.record?.contributorFields, { enteredLabel: "river bird" });
  assert.equal(item.fieldDecisions.find((entry) => entry.fieldName === "contributor:privateNote")?.decision, "blocked");
  assert.equal(item.fieldDecisions.find((entry) => entry.fieldName === "contributor:privateNote")?.issue?.code, "field_consent_denied");
  assert.doesNotMatch(JSON.stringify(item), /near the reed bed/);
});

test("raw_record_archive_withdrawal_is_explicit", () => {
  const withdrawn = candidate({
    consent: {
      ...candidate().consent,
      withdrawalStatus: "withdrawn",
    },
    visibility: "withdrawn",
    visibilityHistory: [{
      visibility: "withdrawn",
      actorId: "subject-1",
      occurredAt: "2026-09-11T00:00:00.000Z",
      source: "consent_withdrawal",
    }],
  });
  const plan = planRawRecordPortabilityArchive(request({ records: [withdrawn] }));
  const item = plan.items[0]!;

  assert.equal(plan.state, "blocked");
  assert.equal(item.decision, "blocked");
  assert.equal(item.record, null);
  assert.equal(item.lifecycle?.withdrawalStatus, "withdrawn");
  assert.ok(item.issues.some((entry) => entry.code === "record_withdrawn"));
});

test("raw_record_archive_partial_item_failure_is_recoverable", () => {
  const unavailableMedia = candidate({
    mediaRefs: [{
      ...candidate().mediaRefs[0]!,
      availability: "missing",
    }],
  });
  const plan = planRawRecordPortabilityArchive(request({ records: [unavailableMedia] }));
  const item = plan.items[0]!;

  assert.equal(plan.state, "partial");
  assert.equal(item.decision, "partial");
  assert.equal(item.retryable, true);
  assert.deepEqual(item.mediaRefs, []);
  assert.equal(item.mediaDecisions[0]?.issue?.code, "media_unavailable");
  assert.equal(item.mediaDecisions[0]?.issue?.retryable, true);
});

test("raw_record_archive_retry_same_manifest", () => {
  const second = candidate({ recordId: "record-2", mediaRefs: [{
    ...candidate().mediaRefs[0]!,
    mediaId: "media-2",
    sourceRef: "r2://records/record-2/media-2",
  }] });
  const firstInput = request({ recordIds: ["record-2", "record-1"], records: [second, candidate()] });
  const secondInput = request({ recordIds: ["record-1", "record-2"], records: [candidate(), second] });
  const firstPlan = planRawRecordPortabilityArchive(firstInput);
  const secondPlan = planRawRecordPortabilityArchive(secondInput);

  assert.equal(firstPlan.state, "complete");
  assert.equal(firstPlan.manifestDigest, secondPlan.manifestDigest);
  assert.deepEqual(firstPlan, secondPlan);
  assert.equal(new Set(firstPlan.items.map((item) => item.recordId)).size, 2);
  assert.equal(serializeRawRecordPortabilityArchivePlan(firstPlan), serializeRawRecordPortabilityArchivePlan(secondPlan));
});

test("raw_record_archive_does_not_emit_taxon_inventory", () => {
  const plan = planRawRecordPortabilityArchive(request());
  const serialized = serializeRawRecordPortabilityArchivePlan(plan);
  const parsed = JSON.parse(serialized) as Record<string, unknown>;

  for (const key of ["taxa", "taxonName", "recordCount", "totalTaxa", "composition", "reportRef", "inventory", "report"]) {
    assert.equal(key in parsed, false, key);
  }
  assert.equal((parsed.items as Array<Record<string, unknown>>)[0]!["recordCount"], undefined);
  assert.equal(plan.archiveKind, "private_source_archive");
});

test("unauthorized_requester_does_not_disclose_record_payload", () => {
  const plan = planRawRecordPortabilityArchive(request({ authorization: "unauthorized" }));
  const item = plan.items[0]!;

  assert.equal(plan.state, "blocked");
  assert.equal(item.record, null);
  assert.equal(item.issues[0]?.code, "requester_authorization_denied");
  assert.doesNotMatch(JSON.stringify(plan), /river bird|near the reed bed|source-record-1/);
});

test("raw_record_archive_uses_locale_independent_canonical_ordering", () => {
  const unordered = candidate({
    contributorFields: {
      "ä": "umlaut",
      z: "zee",
      a: "ay",
    },
    contributorFieldPolicies: {
      "ä": { authorization: "authorized", consent: "allowed", visibility: "private", retention: "retained" },
      z: { authorization: "authorized", consent: "allowed", visibility: "private", retention: "retained" },
      a: { authorization: "authorized", consent: "allowed", visibility: "private", retention: "retained" },
    },
    mediaRefs: [
      { ...candidate().mediaRefs[0]!, mediaId: "ä-media" },
      { ...candidate().mediaRefs[0]!, mediaId: "z-media" },
    ],
  });
  const plan = planRawRecordPortabilityArchive(request({ records: [unordered] }));
  const serialized = serializeRawRecordPortabilityArchivePlan(plan);

  assert.deepEqual(plan.items[0]?.mediaDecisions.map((entry) => entry.mediaId), ["z-media", "ä-media"]);
  assert.match(serialized, /"contributorFields":\{"a":"ay","z":"zee","ä":"umlaut"\}/);
});

test("raw_record_archive_blocks_every_duplicate_media_candidate", () => {
  const first = {
    ...candidate().mediaRefs[0]!,
    mediaId: "media-duplicate",
    sourceRef: "r2://records/record-1/media-a",
    authorization: "authorized" as const,
  };
  const second = {
    ...candidate().mediaRefs[0]!,
    mediaId: "media-duplicate",
    sourceRef: "r2://records/record-1/media-b",
    authorization: "unauthorized" as const,
  };
  const firstPlan = planRawRecordPortabilityArchive(request({ records: [candidate({ mediaRefs: [first, second] })] }));
  const secondPlan = planRawRecordPortabilityArchive(request({ records: [candidate({ mediaRefs: [second, first] })] }));
  const firstItem = firstPlan.items[0]!;
  const secondItem = secondPlan.items[0]!;

  assert.equal(firstPlan.manifestDigest, secondPlan.manifestDigest);
  assert.deepEqual(firstPlan, secondPlan);
  assert.equal(firstItem.mediaRefs.length, 0);
  assert.equal(firstItem.mediaDecisions.length, 2);
  assert.ok(firstItem.mediaDecisions.every((entry) => entry.decision === "blocked"));
  assert.ok(firstItem.mediaDecisions.every((entry) => entry.issue?.code === "media_id_duplicate"));
  assert.equal(secondItem.mediaRefs.length, 0);
});

test("raw_record_archive_applies_media_retention_lifecycle", () => {
  const plan = planRawRecordPortabilityArchive(request({
    records: [candidate({
      mediaRefs: [{
        ...candidate().mediaRefs[0]!,
        retentionStatus: "delete_requested",
      }],
    })],
  }));
  const item = plan.items[0]!;

  assert.equal(plan.state, "partial");
  assert.equal(item.decision, "partial");
  assert.deepEqual(item.mediaRefs, []);
  assert.equal(item.mediaDecisions[0]?.retentionStatus, "delete_requested");
  assert.equal(item.mediaDecisions[0]?.issue?.code, "media_retention_blocked");
});

test("raw_record_archive_requires_an_explicit_location_policy_snapshot", () => {
  const plan = planRawRecordPortabilityArchive(request({
    records: [candidate({ locationPolicy: undefined as never })],
  }));
  const item = plan.items[0]!;

  assert.equal(plan.state, "blocked");
  assert.equal(item.decision, "blocked");
  assert.equal(item.record, null);
  assert.equal(item.locationPolicy, null);
  assert.equal(item.issues[0]?.code, "location_policy_unknown");
  assert.equal(item.issues[0]?.retryable, true);
});
