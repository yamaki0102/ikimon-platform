import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadProductRegistry, validateProductRegistry } from "./productRegistry.js";
import { loadProductRegistryNavigation, validateProductRegistryNavigation } from "./productRegistryNavigation.js";

const registry = loadProductRegistry();

test("M7.0 is source-verified and M7.1 remains outside this slice", () => {
  const journey = registry.journeys.find((item) => item.id === "journey.zukan.program-handover");
  const task = loadProductRegistryNavigation().implementation_tasks.find((item) => item.id === "task.zukan.m7.program-handover-planner") as any;
  assert.ok(journey);
  assert.equal(task?.state, "implemented");
  assert.equal(task?.readiness, "source-verified");
  assert.equal(task?.implementation_allowed, false);
  assert.equal(task?.source_delta_done?.delta, "side-effect 0 deterministic ProgramHandover planner");
  assert.ok(task?.source_locators?.includes("platform_v2/src/services/programHandoverPlanner.ts"));
  assert.ok(task?.source_locators?.includes("platform_v2/src/services/programHandoverPlanner.test.ts"));
  assert.equal(task?.negative_eval_ids?.length, 10);
  assert.equal(task?.design_contract?.terminal_verification, "deterministic replay plus all negative fixtures with zero DB/UI side effects");
});

test("M7 design contract fixes authorization, rights, failure and idempotency boundaries", () => {
  const task = loadProductRegistryNavigation().implementation_tasks.find((item) => item.id === "task.zukan.m7.program-handover-planner") as any;
  const contract = task?.design_contract;
  assert.deepEqual(contract?.inputs, [
    "source Program revision",
    "target continuation",
    "selected Place/Record/Quest/template refs",
    "outgoing/incoming actor",
    "idempotency key",
    "observed lifecycle/rights snapshot",
  ]);
  assert.match(contract?.authorization, /fail closed/);
  assert.match(contract?.rights, /never transfers as approval/);
  assert.match(contract?.failure, /no target side effect/);
  assert.match(contract?.idempotency, /same-key different-payload/);
  assert.match(contract?.terminal_verification, /zero DB\/UI side effects/);
  assert.ok(contract?.fixtures?.length >= 7);
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

test("M8 design contracts stay separate and close partial, rights and forbidden-output paths", () => {
  const tasks = loadProductRegistryNavigation().implementation_tasks as any[];
  const summary = tasks.find((item) => item.id === "task.zukan.m8.operational-summary")?.design_contract;
  const archive = tasks.find((item) => item.id === "task.zukan.m8.raw-record-portability")?.design_contract;
  assert.match(summary?.failure, /never become zero or complete/);
  assert.match(summary?.idempotency, /read-idempotent/);
  assert.match(summary?.terminal_verification, /forbidden-output assertions/);
  assert.ok(summary?.fixtures?.length >= 5);
  assert.match(archive?.authorization, /per Record and field/);
  assert.match(archive?.rights, /never becomes public/);
  assert.match(archive?.failure, /partial item failure/);
  assert.match(archive?.idempotency, /same manifest\/digest/);
  assert.ok(archive?.fixtures?.length >= 6);
});

test("M7/M8 design stays traceable without claiming implementation", () => {
  const routes = { "site-map": new Set(["/", "/record", "/records", "/map", "/home", "/community/events", "/community/events/new", "/community/events/:eventCode/join", "/events/:sessionId/console", "/events/:sessionId/recap"]) };
  assert.deepEqual(validateProductRegistry(registry, routes), []);
  assert.deepEqual(validateProductRegistryNavigation(loadProductRegistryNavigation(), new Set(registry.requirements.map((item) => item.id))), []);
});
