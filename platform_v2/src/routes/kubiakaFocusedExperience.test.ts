import assert from "node:assert/strict";
import test from "node:test";
import {
  KUBIAKA_ACKNOWLEDGEMENT_LABEL,
  KUBIAKA_CONTEXT_VERSION,
  KUBIAKA_EXPERIENCE_KEY,
  KUBIAKA_GENERIC_UPSERT_PATH,
  KUBIAKA_PROTOCOL_PROFILE,
  KUBIAKA_RECORD_PATH,
  KUBIAKA_UPSERT_PATH,
  buildKubiakaObservationInput,
  rewriteKubiakaUpsertUrl,
} from "./kubiakaFocusedExperience.js";
import type { ObservationUpsertInput } from "../services/observationWrite.js";

function fixture(): ObservationUpsertInput {
  return {
    observationId: "record-fixture",
    clientSubmissionId: "submission-fixture",
    userId: "client-user",
    observedAt: "2026-07-30T00:00:00.000Z",
    latitude: 34.7108,
    longitude: 137.7261,
    note: "桜の幹",
    visitMode: "survey",
    completeChecklistFlag: true,
    sourcePayload: {
      source: "untrusted-client",
      experience_key: "other-experience",
      external_routing_allowed: true,
      client_note: "preserve-me",
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

test("buildKubiakaObservationInput fixes identity and private routing boundary", () => {
  const result = buildKubiakaObservationInput(fixture(), "session-user");

  assert.equal(result.userId, "session-user");
  assert.equal(result.visitMode, "manual");
  assert.equal(result.completeChecklistFlag, false);
  assert.deepEqual(result.sourcePayload, {
    source: "kubiaka_private_entry",
    experience_key: KUBIAKA_EXPERIENCE_KEY,
    external_routing_allowed: false,
    client_note: "preserve-me",
    experience_context_version: KUBIAKA_CONTEXT_VERSION,
    entrypoint: KUBIAKA_RECORD_PATH,
    protocol_profile: KUBIAKA_PROTOCOL_PROFILE,
    survey_non_detection_allowed: false,
  });
});

test("buildKubiakaObservationInput rejects public and external rights by construction", () => {
  const result = buildKubiakaObservationInput(fixture(), "session-user");
  assert.equal(result.dataRights?.recordConsent, "private");
  assert.equal(result.dataRights?.researchUseConsent, "none");
  assert.equal(result.dataRights?.enterpriseReportConsent, "none");
  assert.equal(result.dataRights?.externalExportAllowed, false);
  assert.equal(result.dataRights?.areaProfileUseConsent, "none");
  assert.equal(result.dataRights?.publicAggregationAllowed, false);
  assert.equal(result.dataRights?.publicProfileAttributionMode, "hidden");
  assert.deepEqual(result.dataRights?.sourcePayload, {
    experience_key: KUBIAKA_EXPERIENCE_KEY,
    enforced_by: KUBIAKA_UPSERT_PATH,
  });
});

test("buildKubiakaObservationInput preserves the observation payload needed by the shared composer", () => {
  const input = fixture();
  const result = buildKubiakaObservationInput(input, "session-user");
  assert.equal(result.observationId, input.observationId);
  assert.equal(result.clientSubmissionId, input.clientSubmissionId);
  assert.equal(result.observedAt, input.observedAt);
  assert.equal(result.latitude, input.latitude);
  assert.equal(result.longitude, input.longitude);
  assert.equal(result.note, input.note);
  assert.equal(result.taxon, input.taxon);
});

test("rewriteKubiakaUpsertUrl preserves root and forwarded base paths", () => {
  assert.equal(
    rewriteKubiakaUpsertUrl(KUBIAKA_GENERIC_UPSERT_PATH),
    KUBIAKA_UPSERT_PATH,
  );
  assert.equal(
    rewriteKubiakaUpsertUrl(`/preview${KUBIAKA_GENERIC_UPSERT_PATH}`),
    `/preview${KUBIAKA_UPSERT_PATH}`,
  );
  assert.equal(
    rewriteKubiakaUpsertUrl("/api/v1/observations/visit/photos/upload"),
    "/api/v1/observations/visit/photos/upload",
  );
});

test("member surface is an acknowledgement, not a durable receipt claim", () => {
  assert.equal(KUBIAKA_ACKNOWLEDGEMENT_LABEL, "Private acknowledgement");
  assert.doesNotMatch(KUBIAKA_ACKNOWLEDGEMENT_LABEL, /receipt/i);
});
