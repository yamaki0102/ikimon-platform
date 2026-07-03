import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { normalizeObservationDataRights } from "./observationDataRights.js";
import { normalizeFieldProfilePolicy } from "./fieldProfilePolicy.js";
import {
  OBSERVATION_PUBLICATION_RULESET_VERSION,
  decideObservationPublicationPolicy,
} from "./observationPublicationPolicy.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));

const publicRights = normalizeObservationDataRights({
  visitId: "visit-1",
  recordConsent: "public_summary",
  areaProfileUseConsent: "aggregated_public",
  publicAggregationAllowed: true,
  publicProfileAttributionMode: "anonymous",
});

const publicField = normalizeFieldProfilePolicy({
  profileStatus: "public_summary",
  publicProfileEnabled: true,
  defaultPublicLocationMode: "site",
});

test("publication policy allows ordinary public aggregation at site level", () => {
  const policy = decideObservationPublicationPolicy({
    fieldPolicy: publicField,
    dataRights: publicRights,
    civicContext: { riskLane: "normal", publicPrecision: "site", contextKind: "ordinary" },
    identification: { aiOnly: false, confidence: 0.92, taxonSensitive: false },
  });

  assert.equal(policy.publicLocationMode, "site");
  assert.equal(policy.publicTimePrecision, "date");
  assert.equal(policy.sensitivityStatus, "none");
  assert.equal(policy.policyRulesetVersion, OBSERVATION_PUBLICATION_RULESET_VERSION);
});

test("publication policy clamps exact public location unless explicitly allowed", () => {
  const exactField = normalizeFieldProfilePolicy({
    ...publicField,
    defaultPublicLocationMode: "exact",
  });

  const clamped = decideObservationPublicationPolicy({
    fieldPolicy: exactField,
    dataRights: publicRights,
    civicContext: { riskLane: "normal", publicPrecision: "site", contextKind: "ordinary" },
    identification: { aiOnly: false, confidence: 0.9, taxonSensitive: false },
  });
  const exact = decideObservationPublicationPolicy({
    fieldPolicy: exactField,
    dataRights: publicRights,
    civicContext: { riskLane: "normal", publicPrecision: "site", contextKind: "ordinary" },
    identification: { aiOnly: false, confidence: 0.9, taxonSensitive: false },
    allowExactPublicLocation: true,
  });

  assert.equal(clamped.publicLocationMode, "site");
  assert.equal(exact.publicLocationMode, "exact");
});

test("publication policy hides withdrawn, unconsented, manager hidden, and uncertain AI records", () => {
  const withdrawn = decideObservationPublicationPolicy({
    fieldPolicy: publicField,
    dataRights: normalizeObservationDataRights({ ...publicRights, withdrawalStatus: "withdrawn" }),
    civicContext: { riskLane: "normal", publicPrecision: "site", contextKind: "ordinary" },
    identification: { aiOnly: false, confidence: 0.9, taxonSensitive: false },
  });
  assert.equal(withdrawn.publicLocationMode, "hidden");
  assert.equal(withdrawn.sensitivityReason, "rights_withdrawn");

  const managerHidden = decideObservationPublicationPolicy({
    fieldPolicy: normalizeFieldProfilePolicy({ ...publicField, profileStatus: "hidden" }),
    dataRights: publicRights,
    civicContext: { riskLane: "normal", publicPrecision: "site", contextKind: "ordinary" },
    identification: { aiOnly: false, confidence: 0.9, taxonSensitive: false },
  });
  assert.equal(managerHidden.sensitivityStatus, "manager_restricted");
  assert.equal(managerHidden.publicLocationMode, "hidden");

  const uncertainAi = decideObservationPublicationPolicy({
    fieldPolicy: publicField,
    dataRights: publicRights,
    civicContext: { riskLane: "normal", publicPrecision: "site", contextKind: "ordinary" },
    identification: { aiOnly: true, confidence: 0.64, taxonSensitive: false },
  });
  assert.equal(uncertainAi.sensitivityStatus, "uncertain");
  assert.equal(uncertainAi.publicLocationMode, "hidden");
});

test("publication policy coarsens sensitive taxa and hides sensitive context", () => {
  const taxonSensitive = decideObservationPublicationPolicy({
    fieldPolicy: publicField,
    dataRights: publicRights,
    civicContext: { riskLane: "normal", publicPrecision: "site", contextKind: "ordinary" },
    identification: { aiOnly: false, confidence: 0.93, taxonSensitive: true },
  });
  assert.equal(taxonSensitive.publicLocationMode, "grid_1km");
  assert.equal(taxonSensitive.publicTimePrecision, "month");
  assert.equal(taxonSensitive.sensitivityStatus, "taxon_sensitive");

  const contextSensitive = decideObservationPublicationPolicy({
    fieldPolicy: publicField,
    dataRights: publicRights,
    civicContext: { riskLane: "rare_sensitive", publicPrecision: "hidden", contextKind: "school" },
    identification: { aiOnly: false, confidence: 0.93, taxonSensitive: false },
  });
  assert.equal(contextSensitive.publicLocationMode, "hidden");
  assert.equal(contextSensitive.publicTimePrecision, "hidden");
  assert.equal(contextSensitive.sensitivityStatus, "human_sensitive");
});

test("observation publication policy migration is additive and versioned", () => {
  const sql = readFileSync(
    path.join(dirname, "..", "..", "db", "migrations", "0127_observation_publication_policy.sql"),
    "utf8",
  );

  assert.match(sql, /CREATE TABLE IF NOT EXISTS observation_publication_policies/);
  assert.match(sql, /public_location_mode TEXT NOT NULL DEFAULT 'hidden'/);
  assert.match(sql, /public_time_precision TEXT NOT NULL DEFAULT 'hidden'/);
  assert.match(sql, /policy_ruleset_version TEXT NOT NULL DEFAULT 'site_intelligence_p0_v1'/);
  assert.doesNotMatch(sql, /^\s*(DROP|TRUNCATE|DELETE)\b/im);
});
