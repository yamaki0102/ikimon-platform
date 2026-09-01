import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadProductRegistry, validateProductRegistry } from "./productRegistry.js";
import { loadProductRegistryNavigation, validateProductRegistryNavigation } from "./productRegistryNavigation.js";

const registry = loadProductRegistry();
const root = fileURLToPath(new URL("../../", import.meta.url));
const requirementId = "quality.zukan.program.self-serve-activation";

test("M6 keeps the Noah-adopted Outcome and full self-serve Journey trace", () => {
  const outcome = registry.outcomes.find((item) => item.id === "outcome.zukan.self-serve-program-activation");
  const journey = registry.journeys.find((item) => item.id === "journey.zukan.self-serve-program-activation");
  const capability = registry.capabilities.find((item) => item.id === "zukan.program.activate-self-serve");
  const requirement = registry.requirements.find((item) => item.id === requirementId);
  assert.ok(outcome);
  assert.deepEqual(outcome.journey_refs, ["journey.zukan.self-serve-program-activation"]);
  assert.ok(journey);
  assert.ok(journey.requirement_refs?.includes(requirementId));
  assert.ok(capability);
  assert.equal(requirement?.quality_contract, "quality.zukan.program-activation");
});

test("M6 first activation slice binds to the existing Event assets and shared Evals", () => {
  const navigation = loadProductRegistryNavigation();
  const task = navigation.implementation_tasks.find((item) => item.id === "task.zukan.m6.self-serve-program-activation");
  assert.equal(task?.state, "planned");
  assert.deepEqual(task?.requirement_ids, [requirementId]);
  for (const locator of task?.source_locators ?? []) assert.equal(existsSync(`${root}/${locator}`), true, locator);
  const evals = registry.evalContracts.filter((item) => item.requirement_ref === requirementId);
  assert.equal(evals.length, 2);
  assert.deepEqual(evals.map((item) => item.environment).sort(), ["source", "staging"]);
  assert.ok(evals.every((item) => item.evaluator_version === "zukan-m6-v1"));
});

test("M5 remains deferred and no local selector or status authority is introduced", () => {
  const navigation = loadProductRegistryNavigation();
  assert.equal(navigation.implementation_tasks.find((item) => item.id === "task.zukan.m5.live-camera-poc")?.state, "deferred");
  assert.equal(registry.product.status_authority.locator, "operations/ai_os/verified_outcome_status_resolver.mjs#resolveStatus");
  assert.deepEqual(validateProductRegistry(registry, { "site-map": new Set(["/", "/record", "/records", "/map", "/home", "/community/events", "/community/events/new", "/community/events/:eventCode/join", "/events/:sessionId/console", "/events/:sessionId/recap"]) }), []);
  assert.deepEqual(validateProductRegistryNavigation(navigation, new Set(registry.requirements.map((item) => item.id))), []);
});
