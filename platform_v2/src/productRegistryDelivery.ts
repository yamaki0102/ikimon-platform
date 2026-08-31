import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type DeliveryProgression = "planned" | "source-only" | "staging-verified" | "production-verified";

type Requirement = { id: string; title: string; acceptance: string; priority?: number };
type Journey = { id: string; golden?: boolean; requirement_refs?: string[] };
type EvidenceRecord = {
  id: string;
  requirement_ids: string[];
  kind: string;
  environment: string;
  source_revision: string;
  runtime_revision?: string;
  result: "pass" | "fail" | "unknown";
};
type DependencyEdge = { requirement: string; depends_on: string[] };
type Milestone = { id: string; rank: number; detail: "detailed" | "dependency-only"; target_requirements: string[] };
type DeliveryDocument = {
  dependency_graph: { edges: DependencyEdge[] };
  roadmap: Milestone[];
  next_slice_selection: { target_progression: DeliveryProgression };
  luna_task_contract: { format: string[] };
};
type EvidenceDocument = { progression: DeliveryProgression[]; current_observations: EvidenceRecord[] };

export type ProductDeliveryRegistry = {
  requirements: Requirement[];
  journeys: Journey[];
  delivery: DeliveryDocument;
  evidence: EvidenceDocument;
};

function readJson<T>(name: string): T {
  const path = fileURLToPath(new URL(`../product-registry/${name}`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function loadProductDeliveryRegistry(): ProductDeliveryRegistry {
  return {
    requirements: readJson<{ requirements: Requirement[] }>("requirements.json").requirements,
    journeys: readJson<{ journeys: Journey[] }>("journeys.json").journeys,
    delivery: readJson<DeliveryDocument>("delivery.json"),
    evidence: readJson<EvidenceDocument>("evidence.json"),
  };
}

const progressionRank: Record<DeliveryProgression, number> = {
  planned: 0,
  "source-only": 1,
  "staging-verified": 2,
  "production-verified": 3,
};

export function deriveRequirementProgression(
  requirementId: string,
  evidence: EvidenceRecord[],
): DeliveryProgression {
  let best: DeliveryProgression = "planned";
  for (const record of evidence) {
    if (record.result !== "pass" || !record.requirement_ids.includes(requirementId)) continue;
    let candidate: DeliveryProgression = "planned";
    if (record.environment === "source") candidate = "source-only";
    if (record.environment === "staging" && record.runtime_revision === record.source_revision) candidate = "staging-verified";
    if (record.environment === "production" && record.runtime_revision === record.source_revision) candidate = "production-verified";
    if (progressionRank[candidate] > progressionRank[best]) best = candidate;
  }
  return best;
}

export function validateProductDeliveryRegistry(registry: ProductDeliveryRegistry): string[] {
  const errors: string[] = [];
  const requirementIds = new Set(registry.requirements.map((item) => item.id));
  const edgeByRequirement = new Map<string, string[]>();

  for (const edge of registry.delivery.dependency_graph.edges) {
    if (!requirementIds.has(edge.requirement)) errors.push(`dependency references unknown requirement ${edge.requirement}`);
    if (edgeByRequirement.has(edge.requirement)) errors.push(`duplicate dependency edge ${edge.requirement}`);
    edgeByRequirement.set(edge.requirement, edge.depends_on);
    for (const dependency of edge.depends_on) {
      if (!requirementIds.has(dependency)) errors.push(`${edge.requirement} depends on unknown requirement ${dependency}`);
      if (dependency === edge.requirement) errors.push(`${edge.requirement} depends on itself`);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) {
      errors.push(`dependency cycle at ${id}`);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of edgeByRequirement.get(id) ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of requirementIds) visit(id);

  const roadmapRefs = new Set<string>();
  for (const milestone of registry.delivery.roadmap) {
    for (const requirement of milestone.target_requirements) {
      if (!requirementIds.has(requirement)) errors.push(`${milestone.id} references unknown requirement ${requirement}`);
      roadmapRefs.add(requirement);
    }
  }
  for (const id of requirementIds) {
    if (!roadmapRefs.has(id)) errors.push(`${id} is absent from roadmap`);
  }

  for (const record of registry.evidence.current_observations) {
    for (const requirement of record.requirement_ids) {
      if (!requirementIds.has(requirement)) errors.push(`${record.id} references unknown requirement ${requirement}`);
    }
  }
  if (new Set(registry.evidence.progression).size !== 4) errors.push("evidence progression must contain four unique stages");
  if (registry.delivery.luna_task_contract.format.join("/") !== "Source/Delta/Done") errors.push("Luna task format must be Source/Delta/Done");
  return errors;
}

export function selectNextImplementationSlice(registry: ProductDeliveryRegistry): string[] {
  const target = registry.delivery.next_slice_selection.target_progression;
  const targetRank = progressionRank[target];
  const current = new Map(registry.requirements.map((requirement) => [
    requirement.id,
    deriveRequirementProgression(requirement.id, registry.evidence.current_observations),
  ]));
  const milestone = [...registry.delivery.roadmap]
    .filter((item) => item.detail === "detailed")
    .sort((a, b) => a.rank - b.rank)
    .find((item) => item.target_requirements.some((id) => progressionRank[current.get(id) ?? "planned"] < targetRank));
  if (!milestone) return [];

  const dependencies = new Map(registry.delivery.dependency_graph.edges.map((edge) => [edge.requirement, edge.depends_on]));
  const unlockCount = new Map<string, number>();
  for (const edge of registry.delivery.dependency_graph.edges) {
    for (const dependency of edge.depends_on) unlockCount.set(dependency, (unlockCount.get(dependency) ?? 0) + 1);
  }
  const goldenCount = new Map<string, number>();
  for (const journey of registry.journeys.filter((item) => item.golden)) {
    for (const id of journey.requirement_refs ?? []) goldenCount.set(id, (goldenCount.get(id) ?? 0) + 1);
  }
  const requirements = new Map(registry.requirements.map((item) => [item.id, item]));
  const ready = milestone.target_requirements.filter((id) => {
    if (progressionRank[current.get(id) ?? "planned"] >= targetRank) return false;
    return (dependencies.get(id) ?? []).every((dependency) => progressionRank[current.get(dependency) ?? "planned"] >= targetRank);
  });
  ready.sort((a, b) =>
    (unlockCount.get(b) ?? 0) - (unlockCount.get(a) ?? 0)
    || (requirements.get(b)?.priority ?? 0) - (requirements.get(a)?.priority ?? 0)
    || (goldenCount.get(b) ?? 0) - (goldenCount.get(a) ?? 0)
    || a.localeCompare(b),
  );
  return ready.slice(0, 1);
}

export function buildLunaTask(
  registry: ProductDeliveryRegistry,
  baselineSha: string,
  requirementId: string,
): { Source: string[]; Delta: string[]; Done: string[] } {
  const requirement = registry.requirements.find((item) => item.id === requirementId);
  if (!requirement) throw new Error(`unknown requirement ${requirementId}`);
  const journeys = registry.journeys.filter((journey) => journey.requirement_refs?.includes(requirementId)).map((journey) => journey.id);
  return {
    Source: [
      `yamaki0102/ikimon-platform@${baselineSha}`,
      `platform_v2/product-registry/requirements.json#${requirementId}`,
      ...journeys.map((id) => `platform_v2/product-registry/journeys.json#${id}`),
    ],
    Delta: [requirement.acceptance, "Do not make product strategy, privacy, publication-rights, or scope-expansion decisions."],
    Done: ["Acceptance is covered by deterministic/integration tests as applicable.", "Required Golden Journey failure/recovery behavior is verified.", "Staging runtime identity matches the tested source before staging-verified is claimed."],
  };
}
