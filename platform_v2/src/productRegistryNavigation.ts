import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type NavigationMilestone = {
  id: string;
  rank: number;
  scope: string;
  target_requirements: string[];
};

type DependencyEdge = { requirement: string; depends_on: string[] };
type ImplementationTask = {
  id: string;
  milestone_id: string;
  state: "planned" | "deferred";
  requirement_ids: string[];
  source_locators: string[];
  negative_eval_ids: string[];
};

export type ProductRegistryNavigation = {
  authority: { resolved_status: string; forbidden_local_state: string[] };
  dependency_graph: { edges: DependencyEdge[] };
  roadmap: NavigationMilestone[];
  implementation_tasks: ImplementationTask[];
  luna_task_contract: { format: string[]; rules: string[] };
};

function readJson<T>(name: string): T {
  const path = fileURLToPath(new URL(`../product-registry/${name}`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function repositoryFileExists(locator: string): boolean {
  const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
  return existsSync(fileURLToPath(new URL(locator, `file://${repositoryRoot.replaceAll("\\", "/")}/`)));
}

export function loadProductRegistryNavigation(): ProductRegistryNavigation {
  return readJson<ProductRegistryNavigation>("delivery.json");
}

export function validateProductRegistryNavigation(
  navigation: ProductRegistryNavigation,
  requirementIds: ReadonlySet<string>,
): string[] {
  const errors: string[] = [];
  if (navigation.authority.resolved_status !== "operations/ai_os/verified_outcome_status_resolver.mjs#resolveStatus") {
    errors.push("navigation must point to the shared status resolver");
  }
  if (navigation.luna_task_contract.format.join("/") !== "Source/Delta/Done") {
    errors.push("Luna task contract must be Source/Delta/Done");
  }
  const roadmapIds = new Set<string>();
  const roadmapRequirements = new Set<string>();
  const ranks = new Set<number>();
  for (const milestone of navigation.roadmap) {
    if (roadmapIds.has(milestone.id)) errors.push(`duplicate milestone ${milestone.id}`);
    roadmapIds.add(milestone.id);
    if (ranks.has(milestone.rank)) errors.push(`duplicate milestone rank ${milestone.rank}`);
    ranks.add(milestone.rank);
    for (const requirementId of milestone.target_requirements) {
      if (!requirementIds.has(requirementId)) errors.push(`${milestone.id} references unknown requirement ${requirementId}`);
      roadmapRequirements.add(requirementId);
    }
  }
  const expectedMilestones = [
    "milestone.m1.personal-record-media-integrity",
    "milestone.m2.safe-publication-rights-lifecycle",
    "milestone.m3.program-event-quest-workspace",
    "milestone.m4.regional-publication-portability",
    "milestone.m5.live-camera-poc",
  ];
  if (JSON.stringify(navigation.roadmap.slice().sort((a, b) => a.rank - b.rank).map((item) => item.id)) !== JSON.stringify(expectedMilestones)) {
    errors.push("roadmap must be ordered M1 through M5 with live-camera as M5");
  }
  for (const requirementId of requirementIds) {
    if (!roadmapRequirements.has(requirementId)) errors.push(`${requirementId} is absent from roadmap`);
  }

  const edgeByRequirement = new Map<string, string[]>();
  for (const edge of navigation.dependency_graph.edges) {
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

  const taskIds = new Set<string>();
  for (const task of navigation.implementation_tasks) {
    if (taskIds.has(task.id)) errors.push(`duplicate implementation task ${task.id}`);
    taskIds.add(task.id);
    if (!roadmapIds.has(task.milestone_id)) errors.push(`${task.id} references unknown milestone ${task.milestone_id}`);
    if (task.requirement_ids.length === 0 || task.requirement_ids.some((id) => !requirementIds.has(id))) errors.push(`${task.id} has invalid requirement_ids`);
    if (task.source_locators.length === 0 || task.negative_eval_ids.length === 0) errors.push(`${task.id} requires source and negative Eval locators`);
    for (const locator of task.source_locators) {
      if (!repositoryFileExists(locator)) errors.push(`${task.id} source locator does not exist: ${locator}`);
    }
  }
  if (navigation.implementation_tasks.some((task) => task.milestone_id === "milestone.m5.live-camera-poc" && task.state === "planned")) {
    errors.push("live-camera POC must remain deferred until M5");
  }
  return errors;
}
