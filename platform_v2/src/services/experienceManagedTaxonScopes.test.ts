import assert from "node:assert/strict";
import test from "node:test";
import {
  EXPERIENCE_MANAGED_TAXON_SCOPES,
  findExperienceManagedTaxon,
  isExperienceManagedTaxonRoutingEnabled,
  normalizeManagedScientificName,
  type ExperienceManagedTaxonScope,
} from "./experienceManagedTaxonScopes.js";

test("normalizeManagedScientificName normalizes width, case, and whitespace", () => {
  assert.equal(
    normalizeManagedScientificName("  Ａｒｏｍｉａ　Ｂｕｎｇｉｉ  "),
    "aromia bungii",
  );
});

test("findExperienceManagedTaxon matches canonical name with authorship", () => {
  const match = findExperienceManagedTaxon("Aromia bungii(Faldermann, 1835)");
  assert.equal(match?.scope.scopeKey, "kubiaka-watch");
  assert.equal(match?.matchedNormalizedScientificName, "aromia bungii");
});

test("findExperienceManagedTaxon matches an approved synonym with authorship", () => {
  const match = findExperienceManagedTaxon("Callichroma ruficolle Redtenbacher, 1868");
  assert.equal(match?.scope.scopeKey, "kubiaka-watch");
  assert.equal(match?.matchedNormalizedScientificName, "callichroma ruficolle");
});

test("findExperienceManagedTaxon leaves unmanaged taxa unchanged", () => {
  assert.equal(findExperienceManagedTaxon("Procyon lotor"), null);
});

test("built-in Kubiaka scope denies external routing", () => {
  const scope = EXPERIENCE_MANAGED_TAXON_SCOPES[0];
  assert.ok(scope);
  assert.equal(isExperienceManagedTaxonRoutingEnabled(scope), false);
});

test("routing_enabled status alone cannot bypass Gate 0", () => {
  const scope: ExperienceManagedTaxonScope = {
    scopeKey: "fixture",
    acceptedNormalizedScientificNames: ["fixture species"],
    status: "routing_enabled",
    policyVersion: "v2",
  };
  assert.equal(isExperienceManagedTaxonRoutingEnabled(scope), false);
});

test("mismatched policy approval cannot bypass Gate 0", () => {
  const scope: ExperienceManagedTaxonScope = {
    scopeKey: "fixture",
    acceptedNormalizedScientificNames: ["fixture species"],
    status: "routing_enabled",
    policyVersion: "v2",
    routingApproval: {
      allowExternalRouting: true,
      approvedPolicyVersion: "v1",
      approvalRef: "decision:fixture",
    },
  };
  assert.equal(isExperienceManagedTaxonRoutingEnabled(scope), false);
});

test("version-matched explicit approval is required to enable routing", () => {
  const scope: ExperienceManagedTaxonScope = {
    scopeKey: "fixture",
    acceptedNormalizedScientificNames: ["fixture species"],
    status: "routing_enabled",
    policyVersion: "v2",
    routingApproval: {
      allowExternalRouting: true,
      approvedPolicyVersion: "v2",
      approvalRef: "decision:fixture",
    },
  };
  assert.equal(isExperienceManagedTaxonRoutingEnabled(scope), true);
});
