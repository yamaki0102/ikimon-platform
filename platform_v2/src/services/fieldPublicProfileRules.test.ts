import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  FIELD_PUBLIC_PROFILE_RULESET_VERSION,
  evaluateFieldPublicProfileReadiness,
  normalizeFieldPublicProfileRules,
} from "./fieldPublicProfileRules.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));

test("field public profile rules default to suppressing thin aggregates", () => {
  const rules = normalizeFieldPublicProfileRules({});

  assert.equal(rules.minObservationCount, 5);
  assert.equal(rules.minObserverCount, 3);
  assert.equal(rules.minTimeSpanDays, 14);
  assert.equal(rules.suppressIfSingleSource, true);
  assert.equal(rules.suppressSensitiveContext, true);
  assert.equal(rules.rulesetVersion, FIELD_PUBLIC_PROFILE_RULESET_VERSION);
});

test("field public profile readiness blocks one or two record aggregates", () => {
  const rules = normalizeFieldPublicProfileRules({});

  const thin = evaluateFieldPublicProfileReadiness(rules, {
    observationCount: 2,
    observerCount: 2,
    timeSpanDays: 30,
    sourceRecordCount: 2,
    sensitiveContextCount: 0,
  });

  assert.equal(thin.canPublishDetails, false);
  assert.equal(thin.suppressionReason, "min_observation_count");
  assert.match(thin.displaySuppressionReason ?? "", /確認記録が少ない/);
});

test("field public profile readiness requires observer diversity and time span", () => {
  const rules = normalizeFieldPublicProfileRules({});

  const singleObserver = evaluateFieldPublicProfileReadiness(rules, {
    observationCount: 8,
    observerCount: 1,
    timeSpanDays: 30,
    sourceRecordCount: 8,
    sensitiveContextCount: 0,
  });
  assert.equal(singleObserver.suppressionReason, "min_observer_count");

  const shortSpan = evaluateFieldPublicProfileReadiness(rules, {
    observationCount: 8,
    observerCount: 4,
    timeSpanDays: 1,
    sourceRecordCount: 8,
    sensitiveContextCount: 0,
  });
  assert.equal(shortSpan.suppressionReason, "min_time_span_days");
});

test("field public profile readiness blocks single source and sensitive contexts", () => {
  const rules = normalizeFieldPublicProfileRules({});

  const singleSource = evaluateFieldPublicProfileReadiness(rules, {
    observationCount: 8,
    observerCount: 4,
    timeSpanDays: 30,
    sourceRecordCount: 1,
    sensitiveContextCount: 0,
  });
  assert.equal(singleSource.suppressionReason, "single_source");

  const sensitive = evaluateFieldPublicProfileReadiness(rules, {
    observationCount: 8,
    observerCount: 4,
    timeSpanDays: 30,
    sourceRecordCount: 8,
    sensitiveContextCount: 1,
  });
  assert.equal(sensitive.suppressionReason, "sensitive_context");
});

test("field public profile readiness allows details once thresholds are met", () => {
  const readiness = evaluateFieldPublicProfileReadiness(normalizeFieldPublicProfileRules({}), {
    observationCount: 8,
    observerCount: 4,
    timeSpanDays: 30,
    sourceRecordCount: 8,
    sensitiveContextCount: 0,
  });

  assert.equal(readiness.canPublishDetails, true);
  assert.equal(readiness.suppressionReason, null);
});

test("field public profile rules migration is additive and fail-closed", () => {
  const sql = readFileSync(
    path.join(dirname, "..", "..", "db", "migrations", "0128_field_public_profile_rules.sql"),
    "utf8",
  );

  assert.match(sql, /CREATE TABLE IF NOT EXISTS field_public_profile_rules/);
  assert.match(sql, /min_observation_count INTEGER NOT NULL DEFAULT 5/);
  assert.match(sql, /min_observer_count INTEGER NOT NULL DEFAULT 3/);
  assert.match(sql, /suppress_if_single_source BOOLEAN NOT NULL DEFAULT TRUE/);
  assert.doesNotMatch(sql, /^\s*(DROP|TRUNCATE|DELETE)\b/im);
});
