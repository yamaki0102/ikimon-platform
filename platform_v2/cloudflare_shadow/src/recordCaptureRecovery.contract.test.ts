import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const indexSource = readFileSync(
  fileURLToPath(new URL("./index.ts", import.meta.url)),
  "utf8",
);

test("native record capture persists a stable media retry draft", () => {
  assert.match(indexSource, /function renderCloudflareRecordHtml[\s\S]*indexedDB\.open\("ikimon-record-draft", 1\)/);
  assert.match(indexSource, /function renderCloudflareRecordHtml[\s\S]*async function persistRecordDraftProgress/);
  assert.match(indexSource, /function renderCloudflareRecordHtml[\s\S]*recoverySubmissionId/);
  assert.match(indexSource, /function renderCloudflareRecordHtml[\s\S]*pendingMediaRetryVisitId/);
  assert.match(indexSource, /function renderCloudflareRecordHtml[\s\S]*recordPrefix \+ "\/record"/);
  assert.match(indexSource, /function renderCloudflareRecordHtml[\s\S]*searchParams\.set\("retry", "media"\)/);
  assert.match(indexSource, /function renderCloudflareRecordHtml[\s\S]*const observationId = recoverySubmissionId/);
  assert.match(indexSource, /function renderCloudflareRecordHtml[\s\S]*let recoveryObservedAt = ""/);
  assert.match(indexSource, /if \(!recoverySubmissionId\) \{[\s\S]*recoveryObservedAt = new Date\(\)\.toISOString\(\)/);
  assert.match(indexSource, /observedAt: recoveryObservedAt/);
  assert.match(indexSource, /function renderCloudflareRecordHtml[\s\S]*location\.assign\(recordRecoveryHref\(\)\)/);
});

test("record capture keeps ZUKAN and external publication opt-ins separate and off by default", () => {
  assert.match(indexSource, /id="record-zukan-public"[^>]+name="zukan_public"[^>]+type="checkbox"/);
  assert.match(indexSource, /id="record-external-public"[^>]+name="external_public"[^>]+type="checkbox" disabled/);
  assert.match(indexSource, /recordConsent: zukanPublic \? \(externalPublic \? "external_export" : "public_summary"\) : "private"/);
  assert.match(indexSource, /researchUseConsent: "none"/);
  assert.match(indexSource, /datasetLicense: null/);
  assert.match(indexSource, /mediaLicense: null/);
  assert.match(indexSource, /consentSource: zukanPublic \? "user_selected" : "default"/);
  assert.match(indexSource, /rightsPolicyVersion: "site_intelligence_p0_v2"/);
  assert.match(indexSource, /publicationConsentVersion: "external_publication_consent_v2"/);
  assert.match(indexSource, /visibility: zukanPublic \? "public" : "private"/);
  assert.match(indexSource, /externalExportAllowed: externalPublic/);
});

test("native observation write stores the existing field association as a D1 projection", () => {
  assert.match(indexSource, /resolveFieldsForPointNative\(input\.latitude, input\.longitude, env\.OBS_DB\)/);
  assert.match(indexSource, /UPDATE observations SET resolved_field_ids_json = \?/);
  assert.match(indexSource, /resolvedFieldIds/);
});
