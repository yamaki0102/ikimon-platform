import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadProductRegistry, validateProductRegistry } from "./productRegistry.js";
import { loadProductRegistryNavigation, validateProductRegistryNavigation } from "./productRegistryNavigation.js";

const registry = loadProductRegistry();

test("M7 is executor-ready as a side-effect zero handover planner only", () => {
  const journey = registry.journeys.find((item) => item.id === "journey.zukan.program-handover");
  const task = loadProductRegistryNavigation().implementation_tasks.find((item) => item.id === "task.zukan.m7.program-handover-planner") as any;
  assert.ok(journey);
  assert.equal(task?.state, "planned");
  assert.equal(task?.readiness, "executor-ready");
  assert.equal(task?.implementation_allowed, false);
  assert.equal(task?.source_delta_done?.delta, "side-effect 0 deterministic ProgramHandover planner");
});

test("M8 is shaped as separate operational summary and raw portability contracts", () => {
  const navigation = loadProductRegistryNavigation() as any;
  assert.equal(navigation.implementation_tasks.find((item: any) => item.id === "task.zukan.m8.operational-summary")?.readiness, "shaped");
  assert.equal(navigation.implementation_tasks.find((item: any) => item.id === "task.zukan.m8.raw-record-portability")?.readiness, "shaped");
  assert.equal(navigation.implementation_tasks.find((item: any) => item.id === "task.zukan.m8.operational-summary")?.implementation_allowed, false);
  const contract = readFileSync(new URL("../../docs/spec/programs/ZUKAN_FREE_ORGANIZATIONAL_CORE_CONTRACT.md", import.meta.url), "utf8");
  assert.match(contract, /OperationalActivitySummary/);
  assert.match(contract, /RawRecordPortabilityArchive/);
  assert.match(contract, /taxon inventory/);
});

test("M7/M8 design stays traceable without claiming implementation", () => {
  const routes = { "site-map": new Set(["/", "/record", "/records", "/map", "/home", "/community/events", "/community/events/new", "/community/events/:eventCode/join", "/events/:sessionId/console", "/events/:sessionId/recap"]) };
  assert.deepEqual(validateProductRegistry(registry, routes), []);
  assert.deepEqual(validateProductRegistryNavigation(loadProductRegistryNavigation(), new Set(registry.requirements.map((item) => item.id))), []);
});
