import assert from "node:assert/strict";
import test from "node:test";
import type { ObservationUpsertInput } from "../services/observationWrite.js";
import {
  KUBIAKA_ACKNOWLEDGEMENT_LABEL,
  KUBIAKA_CONTEXT_VERSION,
  KUBIAKA_EXPERIENCE_KEY,
  KUBIAKA_GENERIC_UPSERT_PATH,
  KUBIAKA_MAX_PHOTOS,
  KUBIAKA_PROTOCOL_PROFILE,
  KUBIAKA_RECORD_PATH,
  KUBIAKA_UPSERT_PATH,
  buildKubiakaObservationInput,
  enforceKubiakaVisitPrivate,
  findOwnedKubiakaAcknowledgement,
  isKubiakaFocusedExperienceEnabled,
  resolveKubiakaMediaCount,
  rewriteKubiakaUpsertUrl,
  type KubiakaDbQuery,
} from "./kubiakaFocusedExperience.js";

function fixture(mediaCount: number = 1): ObservationUpsertInput {
  return {
    observationId: "record-fixture",
    legacyObservationId: "record-fixture",
    clientSubmissionId: "submission-fixture",
    userId: "client-user",
    observedAt: "2026-08-01T00:00:00.000Z",
    latitude: 34.7108,
    longitude: 137.7261,
    prefecture: "静岡県",
    municipality: "浜松市",
    localityNote: "client-only-location-note",
    note: "桜の幹",
    visitMode: "survey",
    completeChecklistFlag: true,
    targetTaxaScope: "Aromia bungii",
    taxon: {
      scientificName: "Aromia bungii",
      vernacularName: "クビアカツヤカミキリ",
      rank: "species",
    },
    subjects: [{ scientificName: "Aromia bungii", isPrimary: true }],
    sourcePayload: {
      source: "untrusted-client",
      experience_key: "other-experience",
      protocol_profile: "other-profile",
      media_count: mediaCount,
      client_photo_sha256s: ["photo-1"],
      public_aggregation_allowed: true,
      research_use_allowed: true,
      enterprise_use_allowed: true,
      external_export_allowed: true,
      external_routing_allowed: true,
      automatic_recipient_delivery_allowed: true,
      arbitrary_client_field: "must-not-survive",
    },
    dataRights: {
      recordConsent: "external_export",
      researchUseConsent: "public_export",
      enterpriseReportConsent: "identified",
      datasetLicense: "CC0-1.0",
      mediaLicense: "CC-BY-4.0",
      externalExportAllowed: true,
      areaProfileUseConsent: "external_export",
      publicAggregationAllowed: true,
      publicProfileAttributionMode: "credited",
    },
  };
}

test("buildKubiakaObservationInput fixes the dedicated private context", () => {
  const result = buildKubiakaObservationInput(fixture(), "session-user");

  assert.equal(result.userId, "session-user");
  assert.equal(result.visitMode, "manual");
  assert.equal(result.completeChecklistFlag, false);
  assert.equal(result.targetTaxaScope, null);
  assert.equal(result.taxon, null);
  assert.deepEqual(result.subjects, [{ isPrimary: true, roleHint: "primary" }]);
  assert.equal(result.aiAssessmentStatus, "not_requested");
  assert.equal(result.sourcePayload?.source, "kubiaka_private_entry");
  assert.equal(result.sourcePayload?.experience_key, KUBIAKA_EXPERIENCE_KEY);
  assert.equal(result.sourcePayload?.experience_context_version, KUBIAKA_CONTEXT_VERSION);
  assert.equal(result.sourcePayload?.entrypoint, KUBIAKA_RECORD_PATH);
  assert.equal(result.sourcePayload?.protocol_profile, KUBIAKA_PROTOCOL_PROFILE);
  assert.equal(result.sourcePayload?.manual_photo_record, true);
  assert.equal(result.sourcePayload?.private_record, true);
  assert.equal(result.sourcePayload?.media_count, 1);
  assert.equal(result.sourcePayload?.arbitrary_client_field, undefined);
});

test("hostile public, research, enterprise, export and routing flags are denied", () => {
  const result = buildKubiakaObservationInput(fixture(), "session-user");

  assert.equal(result.sourcePayload?.public_aggregation_allowed, false);
  assert.equal(result.sourcePayload?.research_use_allowed, false);
  assert.equal(result.sourcePayload?.enterprise_use_allowed, false);
  assert.equal(result.sourcePayload?.external_export_allowed, false);
  assert.equal(result.sourcePayload?.external_routing_allowed, false);
  assert.equal(result.sourcePayload?.automatic_recipient_delivery_allowed, false);
  assert.equal(result.sourcePayload?.automatic_taxon_confirmation_allowed, false);
  assert.equal(result.dataRights?.recordConsent, "private");
  assert.equal(result.dataRights?.researchUseConsent, "none");
  assert.equal(result.dataRights?.enterpriseReportConsent, "none");
  assert.equal(result.dataRights?.datasetLicense, null);
  assert.equal(result.dataRights?.mediaLicense, "all_rights_reserved");
  assert.equal(result.dataRights?.externalExportAllowed, false);
  assert.equal(result.dataRights?.areaProfileUseConsent, "none");
  assert.equal(result.dataRights?.publicAggregationAllowed, false);
  assert.equal(result.dataRights?.publicProfileAttributionMode, "hidden");
});

test("photo count requires 1 to 6", () => {
  assert.throws(() => resolveKubiakaMediaCount(fixture(0)), /kubiaka_photo_required/);
  assert.throws(() => resolveKubiakaMediaCount(fixture(7)), /kubiaka_photo_limit_exceeded/);
  assert.equal(resolveKubiakaMediaCount(fixture(1)), 1);
  assert.equal(resolveKubiakaMediaCount(fixture(KUBIAKA_MAX_PHOTOS)), KUBIAKA_MAX_PHOTOS);
});

test("inline photo count must match the declared count", () => {
  const input = fixture(1);
  input.photos = [
    { path: "photo-1.jpg" },
    { path: "photo-2.jpg" },
  ];
  assert.throws(() => resolveKubiakaMediaCount(input), /kubiaka_photo_count_mismatch/);
});

test("rewriteKubiakaUpsertUrl preserves root and forwarded base paths", () => {
  assert.equal(rewriteKubiakaUpsertUrl(KUBIAKA_GENERIC_UPSERT_PATH), KUBIAKA_UPSERT_PATH);
  assert.equal(
    rewriteKubiakaUpsertUrl(`/preview${KUBIAKA_GENERIC_UPSERT_PATH}`),
    `/preview${KUBIAKA_UPSERT_PATH}`,
  );
  assert.equal(
    rewriteKubiakaUpsertUrl("/api/v1/observations/visit/photos/upload"),
    "/api/v1/observations/visit/photos/upload",
  );
});

test("feature flag fails closed when explicitly disabled", () => {
  assert.equal(isKubiakaFocusedExperienceEnabled(undefined), true);
  assert.equal(isKubiakaFocusedExperienceEnabled("true"), true);
  assert.equal(isKubiakaFocusedExperienceEnabled("0"), false);
  assert.equal(isKubiakaFocusedExperienceEnabled("false"), false);
  assert.equal(isKubiakaFocusedExperienceEnabled("off"), false);
});

test("enforceKubiakaVisitPrivate fixes hidden visibility and routing flags", async () => {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  const query = (async (text: string, values: unknown[]) => {
    calls.push({ text, values });
    return { rows: [{ visit_id: "visit-1" }] };
  }) as KubiakaDbQuery;

  await enforceKubiakaVisitPrivate(query, "visit-1", "user-1");
  assert.equal(calls.length, 1);
  assert.match(calls[0]!.text, /public_visibility = 'hidden'/);
  assert.match(calls[0]!.text, /public_aggregation_allowed/);
  assert.match(calls[0]!.text, /automatic_recipient_delivery_allowed/);
  assert.deepEqual(calls[0]!.values, [
    "visit-1",
    "user-1",
    KUBIAKA_EXPERIENCE_KEY,
    KUBIAKA_PROTOCOL_PROFILE,
  ]);
});

test("enforceKubiakaVisitPrivate fails closed on owner mismatch", async () => {
  const query = (async () => ({ rows: [] })) as KubiakaDbQuery;
  await assert.rejects(
    enforceKubiakaVisitPrivate(query, "visit-other", "user-1"),
    /kubiaka_private_enforcement_failed/,
  );
});

test("acknowledgement lookup requires owner, hidden scope and 1 to 6 actual photos", async () => {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  const query = (async (text: string, values: unknown[]) => {
    calls.push({ text, values });
    return { rows: [{ visit_id: "visit-1", photo_count: 2 }] };
  }) as KubiakaDbQuery;

  const result = await findOwnedKubiakaAcknowledgement(query, "occurrence-1", "user-1");
  assert.deepEqual(result, {
    recordId: "occurrence-1",
    visitId: "visit-1",
    photoCount: 2,
  });
  assert.match(calls[0]!.text, /v\.user_id = \$2/);
  assert.match(calls[0]!.text, /public_visibility = 'hidden'/);
  assert.match(calls[0]!.text, /experience_key/);
  assert.match(calls[0]!.text, /between 1 and \$4/);
  assert.deepEqual(calls[0]!.values, [
    "occurrence-1",
    "user-1",
    KUBIAKA_EXPERIENCE_KEY,
    KUBIAKA_MAX_PHOTOS,
  ]);
});

test("acknowledgement lookup does not expose another user's record", async () => {
  const query = (async () => ({ rows: [] })) as KubiakaDbQuery;
  assert.equal(
    await findOwnedKubiakaAcknowledgement(query, "occurrence-other", "user-1"),
    null,
  );
});

test("member surface is an acknowledgement, not a durable receipt claim", () => {
  assert.equal(KUBIAKA_ACKNOWLEDGEMENT_LABEL, "Private acknowledgement");
  assert.doesNotMatch(KUBIAKA_ACKNOWLEDGEMENT_LABEL, /receipt/i);
});
