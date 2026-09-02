import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  OBSERVATION_DATA_RIGHTS_POLICY_VERSION,
  normalizeObservationDataRights,
} from "./observationDataRights.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));

test("data rights defaults keep external export disabled", () => {
  const rights = normalizeObservationDataRights({
    visitId: "visit-1",
    occurrenceId: "occ-1",
  });

  assert.equal(rights.recordConsent, "private");
  assert.equal(rights.externalExportAllowed, false);
  assert.equal(rights.areaProfileUseConsent, "none");
  assert.equal(rights.publicAggregationAllowed, false);
  assert.equal(rights.publicProfileAttributionMode, "hidden");
  assert.equal(rights.consentSource, "default");
  assert.equal(rights.rightsPolicyVersion, OBSERVATION_DATA_RIGHTS_POLICY_VERSION);
  assert.equal(rights.datasetLicense, null);
});

test("direct external publication consent does not grant research use or an open license", () => {
  const rights = normalizeObservationDataRights({
    visitId: "visit-direct-external",
    recordConsent: "external_export",
    researchUseConsent: "none",
    externalExportAllowed: true,
    consentSource: "user_selected",
    rightsPolicyVersion: OBSERVATION_DATA_RIGHTS_POLICY_VERSION,
    sourcePayload: { source: "record_capture_publication_choices" },
  });

  assert.equal(rights.externalExportAllowed, true);
  assert.equal(rights.researchUseConsent, "none");
  assert.equal(rights.datasetLicense, null);
  assert.equal(rights.mediaLicense, null);
  assert.equal(rights.consentSource, "user_selected");
  assert.equal(rights.sourcePayload.publicationConsentVersion, "external_publication_consent_v2");
});

test("data rights only allow export when consent, licenses, and active status align", () => {
  const rights = normalizeObservationDataRights({
    visitId: "visit-1",
    occurrenceId: "occ-1",
    recordConsent: "external_export",
    researchUseConsent: "public_export",
    datasetLicense: "CC-BY-4.0",
    mediaLicense: "CC-BY-4.0",
    externalExportAllowed: true,
    withdrawalStatus: "active",
  });

  assert.equal(rights.externalExportAllowed, true);

  const withdrawn = normalizeObservationDataRights({
    ...rights,
    withdrawalStatus: "withdrawn",
  });
  assert.equal(withdrawn.externalExportAllowed, false);
});

test("area profile aggregation is separate from external export and requires explicit public consent", () => {
  const rights = normalizeObservationDataRights({
    visitId: "visit-1",
    occurrenceId: "occ-1",
    recordConsent: "public_summary",
    researchUseConsent: "public_export",
    datasetLicense: "CC-BY-4.0",
    mediaLicense: "CC-BY-4.0",
    externalExportAllowed: true,
    areaProfileUseConsent: "none",
    publicAggregationAllowed: true,
    publicProfileAttributionMode: "credited",
    consentSource: "user_selected",
  });

  assert.equal(rights.externalExportAllowed, false);
  assert.equal(rights.publicAggregationAllowed, false);
  assert.equal(rights.publicProfileAttributionMode, "hidden");

  const aggregation = normalizeObservationDataRights({
    ...rights,
    areaProfileUseConsent: "aggregated_public",
    publicAggregationAllowed: true,
    publicProfileAttributionMode: "credited",
  });

  assert.equal(aggregation.externalExportAllowed, false);
  assert.equal(aggregation.publicAggregationAllowed, true);
  assert.equal(aggregation.publicProfileAttributionMode, "credited");
});

test("withdrawn or private records cannot contribute to public area aggregation", () => {
  const publicAggregation = normalizeObservationDataRights({
    visitId: "visit-1",
    recordConsent: "public_summary",
    areaProfileUseConsent: "aggregated_public",
    publicAggregationAllowed: true,
  });

  assert.equal(publicAggregation.publicAggregationAllowed, true);

  const privateRecord = normalizeObservationDataRights({
    ...publicAggregation,
    recordConsent: "private",
  });
  assert.equal(privateRecord.publicAggregationAllowed, false);

  const withdrawn = normalizeObservationDataRights({
    ...publicAggregation,
    withdrawalStatus: "withdrawn",
  });
  assert.equal(withdrawn.publicAggregationAllowed, false);
});

test("observation data rights migration adds area profile rights fail-closed", () => {
  const sql = readFileSync(
    path.join(dirname, "..", "..", "db", "migrations", "0126_observation_area_profile_rights.sql"),
    "utf8",
  );

  assert.match(sql, /ADD COLUMN IF NOT EXISTS area_profile_use_consent TEXT NOT NULL DEFAULT 'none'/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS public_aggregation_allowed BOOLEAN NOT NULL DEFAULT FALSE/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS public_profile_attribution_mode TEXT NOT NULL DEFAULT 'hidden'/);
  assert.match(sql, /area_profile_use_consent IN \('none', 'internal', 'aggregated_public', 'manager_report', 'external_export'\)/);
  assert.doesNotMatch(sql, /^\s*(DROP|TRUNCATE|DELETE)\b/im);
});

test("native rights projection records consent provenance without changing legacy rows", () => {
  const sql = readFileSync(
    path.join(dirname, "..", "..", "cloudflare_shadow", "migrations", "observations", "0071_publication_consent_metadata.sql"),
    "utf8",
  );

  assert.match(sql, /ADD COLUMN consent_source TEXT NOT NULL DEFAULT 'default'/);
  assert.match(sql, /ADD COLUMN rights_policy_version TEXT NOT NULL DEFAULT 'site_intelligence_p0_v2'/);
  assert.doesNotMatch(sql, /^\s*(DROP|TRUNCATE|DELETE)\b/im);
});
