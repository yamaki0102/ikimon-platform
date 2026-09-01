import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadProductRegistry, validateProductRegistry } from "./productRegistry.js";
import { loadProductRegistryNavigation, validateProductRegistryNavigation } from "./productRegistryNavigation.js";

const registry = loadProductRegistry();
const root = fileURLToPath(new URL("../../", import.meta.url));
const m3RequirementIds = [
  "quality.zukan.program-event-quest.lifecycle",
  "quality.zukan.workspace.membership-authorization",
  "quality.zukan.workspace.contribution",
  "quality.zukan.workspace.review",
  "quality.zukan.workspace.explicit-publish",
];

test("M3 keeps existing Program/Event/Quest/Workspace implementation locators and shared Eval bindings", () => {
  const navigation = loadProductRegistryNavigation();
  const task = navigation.implementation_tasks.find((item) => item.id === "task.zukan.m3.collaboration");
  assert.equal(task?.state, "implemented");
  assert.deepEqual(task?.requirement_ids, m3RequirementIds);
  for (const locator of task?.source_locators ?? []) assert.equal(existsSync(`${root}/${locator}`), true, locator);

  const evals = registry.evalContracts.filter((item) => m3RequirementIds.includes(item.requirement_ref));
  assert.equal(evals.length, m3RequirementIds.length * 2);
  for (const requirementId of m3RequirementIds) {
    const bound = evals.filter((item) => item.requirement_ref === requirementId);
    assert.deepEqual(bound.map((item) => item.environment).sort(), ["source", "staging"]);
    assert.ok(bound.every((item) => item.lane && item.evaluator_version && item.negative_eval_ids.length > 0));
  }
});

test("M3 negative Eval locators are real and cover authz, membership, review, retry, and private/public boundaries", () => {
  const quality = JSON.parse(readFileSync(new URL("../product-registry/quality.json", import.meta.url), "utf8")) as {
    negative_property_tests: Array<{ id: string; current_test: string }>;
  };
  const ids = new Set(quality.negative_property_tests.map((item) => item.id));
  for (const id of [
    "prop.workspace.authz-fail-closed",
    "prop.workspace.membership-role-fail-closed",
    "prop.workspace.review-before-public",
    "prop.workspace.private-public-separation",
    "prop.workspace.retry-converges",
  ]) {
    const item = quality.negative_property_tests.find((candidate) => candidate.id === id);
    assert.equal(ids.has(id), true);
    assert.ok(item?.current_test && item.current_test !== "planned");
    assert.equal(existsSync(`${root}/${item!.current_test}`), true, item!.current_test);
  }
});

test("M3 registry remains valid without introducing a local resolver or selector", () => {
  assert.deepEqual(validateProductRegistry(registry, { "site-map": new Set(["/", "/record", "/records", "/map", "/home", "/community/events", "/community/events/new", "/community/events/:eventCode/join", "/events/:sessionId/console", "/events/:sessionId/recap"]) }), []);
  assert.deepEqual(validateProductRegistryNavigation(loadProductRegistryNavigation(), new Set(registry.requirements.map((item) => item.id))), []);
});
