import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { loadProductRegistry, validateProductRegistry } from "./productRegistry.js";
import { loadProductRegistryNavigation, validateProductRegistryNavigation } from "./productRegistryNavigation.js";

const registry = loadProductRegistry();
const registryRoot = new URL("../product-registry/", import.meta.url);

test("canonical registry delegates resolved status and has no local evidence or learning projection", () => {
  assert.equal(registry.product.status_authority.locator, "operations/ai_os/verified_outcome_status_resolver.mjs#resolveStatus");
  assert.equal(registry.product.status_authority.version, "1.0.0");
  assert.equal("evidence" in registry.product.registries, false);
  assert.equal("learning" in registry.product.registries, false);
  assert.deepEqual(registry.product.canonical_chain.slice(0, 5), ["Outcome", "Golden Journey", "Capability", "Requirement", "Surface"]);
  for (const filename of ["evidence.json", "learning.json", "source-audit-2026-08-31.json"]) {
    assert.equal(existsSync(new URL(filename, registryRoot)), false, `${filename} must be removed`);
  }
});

test("requirements preserve the stable contract and cover the complete product scope", () => {
  assert.equal(registry.requirements.length, 54);
  assert.equal(new Set(registry.requirements.map((item) => item.id)).size, registry.requirements.length);
  for (const requirement of registry.requirements) {
    assert.equal("status" in requirement, false, `${requirement.id} must not carry resolved status`);
    assert.ok(requirement.invalidation_keys.length > 0);
  }
  const requiredIds = [
    "quality.zukan.record.source-reference-integrity",
    "quality.zukan.record.claim-separation",
    "quality.zukan.place.context-integrity",
    "quality.zukan.review.provenance",
    "quality.zukan.rights.consent-scope",
    "quality.zukan.rights.exif-minimization",
    "quality.zukan.rights.minor-guardian-consent",
    "quality.zukan.rights.export-withdrawal-deletion",
    "quality.zukan.rights.retention",
    "quality.zukan.publication.edition-integrity",
    "quality.zukan.publication.correction-takedown",
    "quality.zukan.program-event-quest.lifecycle",
    "quality.zukan.program.self-serve-activation",
    "quality.zukan.program.participation",
    "quality.zukan.program.closeout-rehost",
    "quality.zukan.program.free-output-boundary",
    "quality.zukan.free-core.boundary",
    "quality.zukan.handover.persistence",
    "quality.zukan.handover.outgoing-selection",
  ];
  const ids = new Set(registry.requirements.map((item) => item.id));
  for (const id of requiredIds) assert.ok(ids.has(id), `missing scope requirement ${id}`);
});

test("Outcome to Journey to Capability to Requirement to Surface trace is complete", () => {
  const errors = validateProductRegistry(registry, { "site-map": new Set(["/", "/record", "/records", "/map", "/home", "/community/events", "/community/events/new", "/community/events/:eventCode/join", "/events/:sessionId/console", "/events/:sessionId/recap"]) });
  assert.deepEqual(errors, []);
  const journeyIds = new Set(registry.journeys.map((journey) => journey.id));
  for (const outcome of registry.outcomes) {
    for (const journeyId of outcome.journey_refs) assert.ok(journeyIds.has(journeyId));
  }
});

test("every required privacy and lifecycle contract has a negative Eval", () => {
  const quality = JSON.parse(readFileSync(new URL("../product-registry/quality.json", import.meta.url), "utf8")) as { negative_property_tests: Array<{ requirements: string[] }> };
  const covered = new Set(quality.negative_property_tests.flatMap((item) => item.requirements));
  for (const id of [
    "quality.zukan.rights.exif-minimization",
    "quality.zukan.rights.minor-guardian-consent",
    "quality.zukan.rights.consent-scope",
    "quality.zukan.rights.export-withdrawal-deletion",
    "quality.zukan.rights.retention",
    "quality.zukan.publication.edition-integrity",
    "quality.zukan.publication.correction-takedown",
    "quality.zukan.free-core.boundary",
  ]) assert.ok(covered.has(id), `${id} needs a negative Eval`);
});

test("roadmap is static navigation only and defers live-camera to M5", () => {
  const navigation = loadProductRegistryNavigation();
  assert.deepEqual(validateProductRegistryNavigation(navigation, new Set(registry.requirements.map((item) => item.id))), []);
  assert.equal(navigation.roadmap.find((item) => item.id === "milestone.m5.live-camera-poc")?.rank, 5);
  const taskStates = new Map(navigation.implementation_tasks.map((item) => [item.id, item.state]));
  assert.equal(taskStates.get("task.zukan.m1.record-media-integrity"), "implemented");
  assert.equal(taskStates.get("task.zukan.m2.safe-publication"), "implemented");
  assert.equal(navigation.implementation_tasks.find((item) => item.id === "task.zukan.m5.live-camera-poc")?.state, "deferred");
  assert.equal(navigation.implementation_tasks.find((item) => item.id === "task.zukan.m6.self-serve-program-activation")?.state, "implemented");
  const source = readFileSync(new URL("./productRegistryNavigation.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /deriveRequirementProgression|selectNextImplementationSlice/u);
});
