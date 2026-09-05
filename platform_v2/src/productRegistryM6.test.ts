import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadProductRegistry, validateProductRegistry } from "./productRegistry.js";
import { loadProductRegistryNavigation, validateProductRegistryNavigation } from "./productRegistryNavigation.js";

const registry = loadProductRegistry();
const root = fileURLToPath(new URL("../../", import.meta.url));
const requirementId = "quality.zukan.program.self-serve-activation";
const participationRequirementId = "quality.zukan.program.participation";
const publicDiscoveryRequirementId = "quality.zukan.program.public-discovery";

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
  assert.equal(task?.state, "implemented");
  assert.deepEqual(task?.requirement_ids, [requirementId]);
  for (const locator of task?.source_locators ?? []) assert.equal(existsSync(`${root}/${locator}`), true, locator);
  const evals = registry.evalContracts.filter((item) => item.requirement_ref === requirementId);
  assert.equal(evals.length, 2);
  assert.deepEqual(evals.map((item) => item.environment).sort(), ["source", "staging"]);
  assert.ok(evals.every((item) => item.evaluator_version === "zukan-m6-v1"));
});

test("M6.2 participation keeps event scope and adds a distinct participant-first public Journey", () => {
  const organizerJourney = registry.journeys.find((item) => item.id === "journey.zukan.self-serve-program-activation");
  const publicJourney = registry.journeys.find((item) => item.id === "journey.zukan.public-program-participation");
  const collaborativeOutcome = registry.outcomes.find((item) => item.id === "outcome.zukan.collaborative-knowledge");
  const participation = registry.requirements.find((item) => item.id === participationRequirementId);
  const publicDiscovery = registry.requirements.find((item) => item.id === publicDiscoveryRequirementId);
  const joinCapability = registry.capabilities.find((item) => item.id === "zukan.program.invite-participate");
  const discoveryCapability = registry.capabilities.find((item) => item.id === "zukan.program.discover-public");
  const hub = registry.surfaces.find((item) => item.id === "zukan.program.hub");
  const participationSurface = registry.surfaces.find((item) => item.id === "zukan.program.participation");
  const capture = registry.surfaces.find((item) => item.id === "zukan.capture.start");
  const task = loadProductRegistryNavigation().implementation_tasks.find((item) => item.id === "task.zukan.m6.2.participation");

  assert.ok(organizerJourney?.requirement_refs?.includes(participationRequirementId));
  assert.ok(publicJourney?.requirement_refs?.includes(participationRequirementId));
  assert.ok(publicJourney?.requirement_refs?.includes(publicDiscoveryRequirementId));
  assert.ok(collaborativeOutcome?.journey_refs.includes("journey.zukan.public-program-participation"));
  assert.equal(publicDiscovery?.quality_contract, "quality.zukan.program-hub");
  assert.ok(participation);
  assert.ok(joinCapability);
  assert.ok(discoveryCapability);
  assert.ok(hub?.capabilities.includes("zukan.program.discover-public"));
  assert.ok(participationSurface?.entry_points.includes("zukan.program.hub"));
  assert.ok(capture?.entry_points.includes("zukan.program.participation"));
  assert.equal(task?.state, "implemented");
  assert.deepEqual(task?.requirement_ids, [participationRequirementId, publicDiscoveryRequirementId]);
  assert.deepEqual(registry.evalContracts.filter((item) => item.requirement_ref === participationRequirementId).map((item) => item.environment).sort(), ["source", "staging"]);
  assert.deepEqual(registry.evalContracts.filter((item) => item.requirement_ref === publicDiscoveryRequirementId).map((item) => item.environment), ["source"]);
});

test("M5 remains deferred and no local selector or status authority is introduced", () => {
  const navigation = loadProductRegistryNavigation();
  assert.equal(navigation.implementation_tasks.find((item) => item.id === "task.zukan.m5.live-camera-poc")?.state, "deferred");
  assert.equal(registry.product.status_authority.locator, "operations/ai_os/verified_outcome_status_resolver.mjs#resolveStatus");
  assert.deepEqual(validateProductRegistry(registry, { "site-map": new Set(["/", "/record", "/records", "/observations/:id", "/map", "/home", "/community/events", "/community/events/new", "/community/fields/:fieldId", "/community/events/:eventCode/join", "/events/:sessionId/console", "/events/:sessionId/recap"]) }), []);
  assert.deepEqual(validateProductRegistryNavigation(navigation, new Set(registry.requirements.map((item) => item.id))), []);
});

test("M6.3 closeout binds review, recap, and config-only rehost to existing assets", () => {
  const requirement = registry.requirements.find((item) => item.id === "quality.zukan.program.closeout-rehost");
  const task = loadProductRegistryNavigation().implementation_tasks.find((item) => item.id === "task.zukan.m6.3.closeout-rehost");
  const recap = registry.surfaces.find((item) => item.id === "zukan.program.recap");
  assert.ok(requirement);
  assert.equal(task?.state, "implemented");
  assert.ok(recap?.capabilities.includes("zukan.program.rehost-template"));
  assert.equal(registry.evalContracts.filter((item) => item.requirement_ref === requirement?.id).length, 2);
});
