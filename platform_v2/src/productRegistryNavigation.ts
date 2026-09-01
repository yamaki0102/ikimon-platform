import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type NavigationMilestone = {
  id: string;
  rank: number;
  scope: string;
  target_requirements: string[];
  readiness?: string;
  implementation_allowed?: boolean;
};

type DependencyEdge = { requirement: string; depends_on: string[] };
type ImplementationTask = {
  id: string;
  milestone_id: string;
  state: "implemented" | "planned" | "deferred";
  readiness?: string;
  implementation_allowed?: boolean;
  requirement_ids: string[];
  source_locators: string[];
  negative_eval_ids: string[];
};

type RollingFrontier = {
  active: string;
  ready_next: string;
  shaped_next: string;
  dependency_shaped: string[];
  deferred: string[];
  max_executor_implementation_tasks: number;
  profile_horizon: string;
};

export type ProductRegistryNavigation = {
  authority: { resolved_status: string; forbidden_local_state: string[] };
  dependency_graph: { edges: DependencyEdge[] };
  rolling_frontier: RollingFrontier;
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
    "milestone.m6.self-serve-program-activation",
    "milestone.m7.program-continuity-handover",
    "milestone.m8.operational-summary-raw-portability",
    "milestone.m9.regional-program-profiles",
    "milestone.m10.regional-publication-profiles",
    "milestone.m11.source-public-projection-exchange",
    "milestone.m12.professional-managed-outcomes",
  ];
  if (JSON.stringify(navigation.roadmap.slice().sort((a, b) => a.rank - b.rank).map((item) => item.id)) !== JSON.stringify(expectedMilestones)) {
    errors.push("roadmap must preserve the canonical M1-M12 order with live-camera as deferred M5");
  }
  for (const requirementId of requirementIds) {
    if (!roadmapRequirements.has(requirementId)) errors.push(`${requirementId} is absent from roadmap`);
  }

  const frontier = navigation.rolling_frontier;
  if (!frontier) {
    errors.push("rolling_frontier is required");
  } else {
    if (frontier.active !== "milestone.m7.program-continuity-handover") errors.push("current ACTIVE frontier must be M7 Program Continuity & Handover");
    if (frontier.ready_next !== "milestone.m8.operational-summary-raw-portability") errors.push("current READY_NEXT frontier must be M8 Operational Summary & Raw Portability");
    if (frontier.shaped_next !== "milestone.m9.regional-program-profiles") errors.push("current SHAPED_NEXT frontier must be M9 Regional Program Profiles");
    if (frontier.max_executor_implementation_tasks !== 1) errors.push("rolling frontier must allow at most one executor implementation task");
    if (!frontier.deferred.includes("milestone.m5.live-camera-poc")) errors.push("M5 live-camera must remain deferred");
    if (frontier.profile_horizon !== "docs/spec/zukan-product-architecture/PROFILE_HORIZON.md") errors.push("rolling frontier must reference the canonical profile horizon");
    for (const milestoneId of [...frontier.dependency_shaped, ...frontier.deferred]) {
      if (!roadmapIds.has(milestoneId)) errors.push(`rolling frontier references unknown milestone ${milestoneId}`);
    }
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
  const futureMilestones = new Set([
    "milestone.m9.regional-program-profiles",
    "milestone.m10.regional-publication-profiles",
    "milestone.m11.source-public-projection-exchange",
    "milestone.m12.professional-managed-outcomes",
  ]);
  for (const task of navigation.implementation_tasks) {
    if (taskIds.has(task.id)) errors.push(`duplicate implementation task ${task.id}`);
    taskIds.add(task.id);
    if (!roadmapIds.has(task.milestone_id)) errors.push(`${task.id} references unknown milestone ${task.milestone_id}`);
    if (task.requirement_ids.length === 0 || task.requirement_ids.some((id) => !requirementIds.has(id))) errors.push(`${task.id} has invalid requirement_ids`);
    if (task.source_locators.length === 0 || task.negative_eval_ids.length === 0) errors.push(`${task.id} requires source and negative Eval locators`);
    for (const locator of task.source_locators) {
      if (!repositoryFileExists(locator)) errors.push(`${task.id} source locator does not exist: ${locator}`);
    }
    if (futureMilestones.has(task.milestone_id)) {
      errors.push(`${task.id} must not exist before M9-M12 frontier promotion and Requirement/Eval shaping`);
    }
  }
  if (navigation.implementation_tasks.some((task) => task.milestone_id === "milestone.m5.live-camera-poc" && task.state === "planned")) {
    errors.push("live-camera POC must remain deferred until explicitly promoted by product evidence");
  }
  return errors;
}
