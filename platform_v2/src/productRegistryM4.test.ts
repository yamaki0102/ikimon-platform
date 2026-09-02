import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadProductRegistry, validateProductRegistry } from "./productRegistry.js";
import { loadProductRegistryNavigation, validateProductRegistryNavigation } from "./productRegistryNavigation.js";

const registry = loadProductRegistry();
const root = fileURLToPath(new URL("../../", import.meta.url));
const m4RequirementIds = [
  "quality.zukan.place.context-integrity",
  "quality.zukan.publication.edition-integrity",
  "quality.zukan.publication.correction-takedown",
  "quality.zukan.rights.export-withdrawal-deletion",
  "quality.zukan.rights.retention",
];
const m4NegativeIds = [
  "prop.place.unknown-provenance-is-explicit",
  "prop.publication.edition-is-reproducible",
  "prop.rights.withdrawal-revokes-derived-publication",
  "prop.retention-does-not-infer-delete",
];

test("M4 reuses existing regional and rights implementation as one canonical slice", () => {
  const navigation = loadProductRegistryNavigation();
  const task = navigation.implementation_tasks.find((item) => item.id === "task.zukan.m4.publication-portability");
  assert.equal(task?.state, "implemented");
  assert.deepEqual(task?.requirement_ids, m4RequirementIds);
  for (const locator of task?.source_locators ?? []) assert.equal(existsSync(`${root}/${locator}`), true, locator);
});

test("M4 binds every reconciled Requirement to source and staging Evals", () => {
  const evals = registry.evalContracts.filter((item) => m4RequirementIds.includes(item.requirement_ref));
  assert.equal(evals.length, m4RequirementIds.length * 2);
  for (const requirementId of m4RequirementIds) {
    const bound = evals.filter((item) => item.requirement_ref === requirementId);
    assert.deepEqual(bound.map((item) => item.environment).sort(), ["source", "staging"]);
    assert.ok(bound.every((item) => item.evaluator_version === "zukan-m4-v1"));
    for (const item of bound) {
      assert.ok(item.acceptance_clause_ids.length > 0);
      assert.ok(item.negative_eval_ids.length > 0);
      for (const locator of item.source_locators) assert.equal(existsSync(`${root}/${locator}`), true, locator);
    }
  }
});

test("M4 negative Evals are registered against real fail-closed fixtures", () => {
  const quality = JSON.parse(readFileSync(new URL("../product-registry/quality.json", import.meta.url), "utf8")) as {
    negative_property_tests: Array<{ id: string; current_test: string }>;
  };
  for (const id of m4NegativeIds) {
    const item = quality.negative_property_tests.find((candidate) => candidate.id === id);
    assert.ok(item?.current_test && item.current_test !== "planned", id);
    assert.equal(existsSync(`${root}/${item!.current_test}`), true, item!.current_test);
  }
});

test("M4 preserves the shared Resolver authority and registry trace", () => {
  assert.equal(registry.product.status_authority.locator, "operations/ai_os/verified_outcome_status_resolver.mjs#resolveStatus");
  assert.deepEqual(validateProductRegistry(registry, { "site-map": new Set(["/", "/record", "/records", "/observations/:id", "/map", "/home", "/community/events", "/community/events/new", "/community/fields/:fieldId", "/community/events/:eventCode/join", "/events/:sessionId/console", "/events/:sessionId/recap"]) }), []);
  assert.deepEqual(validateProductRegistryNavigation(loadProductRegistryNavigation(), new Set(registry.requirements.map((item) => item.id))), []);
});
