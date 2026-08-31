import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildLunaTask,
  deriveRequirementProgression,
  loadProductDeliveryRegistry,
  selectNextImplementationSlice,
  validateProductDeliveryRegistry,
} from "./productRegistryDelivery.js";

type Requirement = {
  id: string;
  quality_contract: string;
  title: string;
  acceptance: string;
  environments: string[];
  evidence_lanes: Array<"machine" | "design" | "human">;
  verification_levels: string[];
  invalidation_keys: string[];
  status: "partial" | "planned" | "implemented";
};
type QualityContract = { id: string; requirement_refs?: string[] };
type Journey = { id: string; golden?: boolean; requirement_refs?: string[] };

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(new URL(`../product-registry/${name}`, import.meta.url), "utf8")) as T;
}

const productDocument = readJson<{ schema_version: string; product_id: string; registries: Record<string, string>; canonical_chain: string[] }>("product.json");
const requirementDocument = readJson<{ requirements: Requirement[] }>("requirements.json");
const qualityDocument = readJson<{ contracts: QualityContract[]; negative_property_tests: Array<{ id: string; requirements: string[] }> }>("quality.json");
const journeyDocument = readJson<{ journeys: Journey[] }>("journeys.json");

test("product root registers the complete outcome-to-learning chain", () => {
  assert.equal(productDocument.schema_version, "1.0.0");
  assert.equal(productDocument.product_id, "zukan");
  for (const key of ["outcomes", "surfaces", "capabilities", "journeys", "requirements", "design", "quality", "delivery", "evidence", "learning"]) {
    assert.ok(productDocument.registries[key], `missing registry ${key}`);
  }
  assert.deepEqual(productDocument.canonical_chain, ["Outcome", "Golden Journey", "Capability", "Requirement", "Design", "Dependency", "Roadmap", "Task", "Acceptance/Eval", "Runtime Evidence", "Learning"]);
});

test("stable requirements are unique, evidence-addressable, and fully traced", () => {
  const ids = requirementDocument.requirements.map((requirement) => requirement.id);
  assert.equal(ids.length, 28);
  assert.equal(new Set(ids).size, ids.length);
  const known = new Set(ids);
  const qualityIds = new Set(qualityDocument.contracts.map((contract) => contract.id));
  const referenced = new Set<string>();

  for (const requirement of requirementDocument.requirements) {
    assert.match(requirement.id, /^quality\.zukan\.[a-z0-9.-]+$/u);
    assert.ok(qualityIds.has(requirement.quality_contract));
    assert.ok(requirement.title.trim());
    assert.ok(requirement.acceptance.trim());
    assert.ok(requirement.environments.length > 0);
    assert.ok(requirement.evidence_lanes.length > 0);
    assert.ok(requirement.verification_levels.length > 0);
    assert.ok(requirement.invalidation_keys.length > 0);
    assert.equal("claim_id" in requirement, false);
  }
  for (const quality of qualityDocument.contracts) {
    for (const ref of quality.requirement_refs ?? []) {
      assert.ok(known.has(ref), `${quality.id} references unknown ${ref}`);
      referenced.add(ref);
    }
  }
  for (const journey of journeyDocument.journeys) {
    assert.equal(journey.golden, true, `${journey.id} must be a Golden Journey`);
    for (const ref of journey.requirement_refs ?? []) {
      assert.ok(known.has(ref), `${journey.id} references unknown ${ref}`);
      referenced.add(ref);
    }
  }
  assert.deepEqual([...referenced].sort(), [...known].sort());
});

test("negative/property contracts reference stable requirements only", () => {
  const known = new Set(requirementDocument.requirements.map((requirement) => requirement.id));
  assert.ok(qualityDocument.negative_property_tests.length >= 10);
  for (const contract of qualityDocument.negative_property_tests) {
    assert.ok(contract.requirements.length > 0);
    for (const ref of contract.requirements) assert.ok(known.has(ref), `${contract.id} references unknown ${ref}`);
  }
});

test("dependency graph and roadmap are complete and acyclic", () => {
  const registry = loadProductDeliveryRegistry();
  assert.deepEqual(validateProductDeliveryRegistry(registry), []);
});

test("progression is derived from qualifying evidence, not legacy status", () => {
  const registry = loadProductDeliveryRegistry();
  const requirementId = "quality.zukan.capture.idempotent-save";
  assert.equal(deriveRequirementProgression(requirementId, registry.evidence.current_observations), "planned");
  assert.equal(deriveRequirementProgression(requirementId, [{
    id: "source-pass",
    requirement_ids: [requirementId],
    kind: "source-test",
    environment: "source",
    source_revision: "abc",
    result: "pass",
  }]), "source-only");
  assert.equal(deriveRequirementProgression(requirementId, [{
    id: "staging-pass",
    requirement_ids: [requirementId],
    kind: "journey",
    environment: "staging",
    source_revision: "abc",
    runtime_revision: "abc",
    result: "pass",
  }]), "staging-verified");
});

test("unmet requirements and dependencies select the first coherent slice deterministically", () => {
  const registry = loadProductDeliveryRegistry();
  assert.deepEqual(selectNextImplementationSlice(registry), ["quality.zukan.capture.idempotent-save"]);
});

test("Luna task generator emits strategy-free Source / Delta / Done", () => {
  const registry = loadProductDeliveryRegistry();
  const task = buildLunaTask(registry, "2127282dd6031afcc7a1710878b1d1d578a30525", "quality.zukan.capture.idempotent-save");
  assert.deepEqual(Object.keys(task), ["Source", "Delta", "Done"]);
  assert.ok(task.Source.some((line) => line.includes("quality.zukan.capture.idempotent-save")));
  assert.ok(task.Delta.some((line) => line.includes("再試行")));
  assert.ok(task.Done.some((line) => line.includes("Staging runtime identity")));
});
