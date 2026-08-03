import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

type Requirement = {
  id: string;
  quality_contract: string;
  title: string;
  acceptance: string;
  environments: string[];
  evidence_lanes: Array<"machine" | "design" | "human">;
  verification_levels: Array<"contract" | "source" | "deterministic" | "integration" | "staging" | "design" | "human">;
  invalidation_keys: string[];
  status: "partial" | "planned" | "implemented";
};

type QualityContract = { id: string; requirement_refs?: string[] };
type Journey = { id: string; requirement_refs?: string[] };

function readJson<T>(name: string): T {
  return JSON.parse(
    readFileSync(new URL(`../product-registry/${name}`, import.meta.url), "utf8"),
  ) as T;
}

const productDocument = readJson<{
  schema_version: string;
  product_id: string;
  registries: Record<string, string>;
}>("product.json");
const requirementDocument = readJson<{
  schema_version: string;
  product_id: string;
  requirements: Requirement[];
}>("requirements.json");
const qualityDocument = readJson<{ contracts: QualityContract[] }>("quality.json");
const journeyDocument = readJson<{ journeys: Journey[] }>("journeys.json");

const expectedKubiakaRequirements = [
  "quality.zukan.kubiaka-capture.prohibited-side-effects",
  "quality.zukan.kubiaka-member-records.owner-isolation",
  "quality.zukan.kubiaka-member-records.owner-return",
  "quality.zukan.kubiaka-member-records.staging-identity",
].sort();

test("requirements document is registered by the product root", () => {
  assert.equal(productDocument.schema_version, "1.0.0");
  assert.equal(productDocument.product_id, "zukan");
  assert.equal(productDocument.registries.requirements, "requirements.json");
});

test("Kubiaka requirements have stable product-owned identities", () => {
  assert.equal(requirementDocument.schema_version, "1.0.0");
  assert.equal(requirementDocument.product_id, "zukan");
  const ids = requirementDocument.requirements.map((requirement) => requirement.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...ids].sort(), expectedKubiakaRequirements);

  const qualityIds = new Set(qualityDocument.contracts.map((contract) => contract.id));
  for (const requirement of requirementDocument.requirements) {
    assert.match(requirement.id, /^quality\.zukan\.[a-z0-9.-]+$/u);
    assert.ok(qualityIds.has(requirement.quality_contract));
    assert.ok(requirement.title.trim().length > 0);
    assert.ok(requirement.acceptance.trim().length > 0);
    assert.ok(requirement.environments.length > 0);
    assert.equal(new Set(requirement.environments).size, requirement.environments.length);
    assert.ok(requirement.evidence_lanes.length > 0);
    assert.equal(new Set(requirement.evidence_lanes).size, requirement.evidence_lanes.length);
    assert.ok(requirement.verification_levels.length > 0);
    assert.equal(new Set(requirement.verification_levels).size, requirement.verification_levels.length);
    assert.ok(requirement.invalidation_keys.length > 0);
    assert.equal(new Set(requirement.invalidation_keys).size, requirement.invalidation_keys.length);
    for (const key of requirement.invalidation_keys) assert.match(key, /^[a-z0-9][a-z0-9._:/-]{2,199}$/u);
    assert.ok(["partial", "planned", "implemented"].includes(requirement.status));
    assert.equal("claim_id" in requirement, false, "claim contracts belong to the central resolver binding");
  }
  const ownerReturn = requirementDocument.requirements.find(
    (requirement) => requirement.id === "quality.zukan.kubiaka-member-records.owner-return",
  );
  assert.deepEqual(ownerReturn?.evidence_lanes, ["machine", "design", "human"]);
  assert.ok(ownerReturn?.invalidation_keys.includes("design:kubiaka-owner-return"));
});

test("quality contracts and the Kubiaka journey reference only defined requirements", () => {
  const known = new Set(requirementDocument.requirements.map((requirement) => requirement.id));
  const referenced = new Set<string>();
  for (const quality of qualityDocument.contracts) {
    for (const requirementRef of quality.requirement_refs ?? []) {
      assert.ok(known.has(requirementRef), `${quality.id} references unknown requirement ${requirementRef}`);
      referenced.add(requirementRef);
    }
  }
  for (const journey of journeyDocument.journeys) {
    for (const requirementRef of journey.requirement_refs ?? []) {
      assert.ok(known.has(requirementRef), `${journey.id} references unknown requirement ${requirementRef}`);
      referenced.add(requirementRef);
    }
  }
  assert.deepEqual([...referenced].sort(), expectedKubiakaRequirements);
});
