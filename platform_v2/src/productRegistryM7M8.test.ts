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

test("M7.1 is source-verified and closed for immutable persistence/idempotency only", () => {
  const task = loadProductRegistryNavigation().implementation_tasks.find((item) => item.id === "task.zukan.m7.program-handover-persistence") as any;
  assert.equal(task?.state, "implemented");
  assert.equal(task?.readiness, "source-verified");
  assert.equal(task?.implementation_allowed, false);
  assert.ok(task?.requirement_ids?.includes("quality.zukan.handover.persistence"));
  assert.ok(task?.source_locators?.includes("platform_v2/src/services/programHandoverD1Repository.ts"));
  assert.ok(task?.source_locators?.includes("platform_v2/cloudflare_shadow/migrations/core/0015_zukan_program_handover_persistence.sql"));
  assert.ok(task?.negative_eval_ids?.includes("prop.m7.persistence-replay-one-row"));
  assert.match(task?.design_contract?.storage, /D1 first active-runtime adapter/);
  assert.match(task?.design_contract?.idempotency, /same key\+payload.*one logical stored plan/);
  assert.match(task?.design_contract?.rights, /never copy participant, consent grant, Review decision, publication approval/);
  assert.match(task?.design_contract?.failure, /no target Program side effect/);
  assert.match(task?.design_contract?.immutability, /immutable/);
  assert.ok(task?.design_contract?.fixtures?.length >= 8);
});

test("M7.1 persistence contract is source-only and has no runtime activation", () => {
  const contract = loadProductRegistry().qualityContracts.find((item: any) => item.id === "quality.zukan.m7-handover-persistence") as any;
  assert.deepEqual(contract?.requirement_refs, ["quality.zukan.handover.persistence"]);
  assert.match(contract?.acceptance?.join(" "), /immutable snapshot/);
  assert.match(contract?.acceptance?.join(" "), /target Program/);
  assert.ok(contract?.tests?.some((item: any) => item.locator.endsWith("programHandoverD1Repository.test.ts")));
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
