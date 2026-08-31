import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type RegistryRouteSource = "site-map";
export type ImplementationStatus = "implemented" | "partial" | "planned";
export type TransitionStatus = "implemented" | "candidate" | "planned";

type ProductRoot = {
  schema_version: string;
  product_id: string;
  registries: Record<string, string>;
  status_authority: { kind: string; locator: string; version: string };
  canonical_chain: string[];
  required_surface_ids: string[];
  rules: Record<string, boolean>;
};

type Outcome = { id: string; statement: string; journey_refs: string[] };

type CapabilityMatrixEntry = {
  domain: string;
  outcome_ref: string;
  capability_refs: string[];
  requirement_refs: string[];
};

type Capability = {
  id: string;
  operation: "read" | "write";
  failure_contract?: string;
  retry_contract?: string;
};

type SurfaceTransition = {
  action: string;
  target: string;
  status: TransitionStatus;
};

type Surface = {
  id: string;
  route: string;
  route_source: RegistryRouteSource;
  auth: string;
  privacy: string;
  implementation_status: ImplementationStatus;
  known_gaps: string[];
  implementation_candidates?: string[];
  capabilities: string[];
  entry_points: string[];
  transitions: SurfaceTransition[];
  states: string[];
  design_contract: string;
  content_contract: string;
  quality_contract: string;
  implementation_ref: string;
};

type Journey = {
  id: string;
  outcome_refs: string[];
  capability_refs: string[];
  start_surface: string;
  success_surface: string;
  steps: Array<{ surface: string; action: string }>;
  required_states: string[];
  requirement_refs?: string[];
};

type DesignFoundation = { id: string };
type DesignBrand = { id: string; foundation: string };
type DesignArchetype = { id: string };

type DesignContract = {
  id: string;
  surface: string;
  brand: string;
  archetype: string;
  state_presentations: string[];
};

type DesignException = {
  id: string;
  surfaces: string[];
  rule: string;
  reason: string;
  owner: string;
  expires_at: string;
};

type ContentContract = {
  id: string;
  surface: string;
  audience: string;
  user_intent: string;
  primary_message: string;
  primary_cta: string;
  prohibited_claims: string[];
  seo: { index: boolean; canonical_path: string };
  analytics: { primary_event: string };
};

type QualityContract = {
  id: string;
  surface: string;
  required_states: string[];
  tests: Array<{ locator: string; kind: string; status: "canonical" | "candidate" | "planned" }>;
  requirement_refs?: string[];
};

export type EvidenceLane = "machine" | "design" | "human";
export type VerificationLevel = "contract" | "source" | "deterministic" | "integration" | "staging" | "design" | "human";

export type ProductRequirement = {
  id: string;
  quality_contract: string;
  title: string;
  acceptance: string;
  environments: Array<"source" | "staging" | "production" | "operation">;
  evidence_lanes: EvidenceLane[];
  verification_levels: VerificationLevel[];
  invalidation_keys: string[];
};

export type ProductRegistry = {
  product: ProductRoot;
  outcomes: Outcome[];
  capabilityMatrix: CapabilityMatrixEntry[];
  capabilities: Capability[];
  surfaces: Surface[];
  journeys: Journey[];
  designFoundations: DesignFoundation[];
  designBrands: DesignBrand[];
  designArchetypes: DesignArchetype[];
  designContracts: DesignContract[];
  designExceptions: DesignException[];
  contentContracts: ContentContract[];
  qualityContracts: QualityContract[];
  requirements: ProductRequirement[];
};

export type ImplementationRouteRegistry = Record<RegistryRouteSource, ReadonlySet<string>>;

function readJson<T>(name: string): T {
  const path = fileURLToPath(new URL(`../product-registry/${name}`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function repositoryFileExists(locator: string): boolean {
  const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
  return existsSync(fileURLToPath(new URL(locator, `file://${repositoryRoot.replaceAll("\\", "/")}/`)));
}

export function loadProductRegistry(): ProductRegistry {
  const product = readJson<ProductRoot>("product.json");
  const capabilityDocument = readJson<{ matrix: CapabilityMatrixEntry[]; capabilities: Capability[] }>("capabilities.json");
  const outcomes = readJson<{ outcomes: Outcome[] }>("outcomes.json").outcomes;
  const surfaces = readJson<{ surfaces: Surface[] }>("surfaces.json").surfaces;
  const journeys = readJson<{ journeys: Journey[] }>("journeys.json").journeys;
  const design = readJson<{
    foundations: DesignFoundation[];
    brands: DesignBrand[];
    archetypes: DesignArchetype[];
    surface_contracts: DesignContract[];
    exceptions: DesignException[];
  }>("design.json");
  const contentContracts = readJson<{ contracts: ContentContract[] }>("content.json").contracts;
  const qualityContracts = readJson<{ contracts: QualityContract[] }>("quality.json").contracts;
  const requirements = readJson<{ requirements: ProductRequirement[] }>("requirements.json").requirements;
  return {
    product,
    outcomes,
    capabilityMatrix: capabilityDocument.matrix,
    capabilities: capabilityDocument.capabilities,
    surfaces,
    journeys,
    designFoundations: design.foundations,
    designBrands: design.brands,
    designArchetypes: design.archetypes,
    designContracts: design.surface_contracts,
    designExceptions: design.exceptions,
    contentContracts,
    qualityContracts,
    requirements,
  };
}

function addUniqueIds<T extends { id: string }>(errors: string[], label: string, values: T[]): Map<string, T> {
  const result = new Map<string, T>();
  for (const value of values) {
    if (!value.id) {
      errors.push(`${label} contains an empty id`);
      continue;
    }
    if (result.has(value.id)) {
      errors.push(`${label} contains duplicate id ${value.id}`);
      continue;
    }
    result.set(value.id, value);
  }
  return result;
}

function missingValues(required: Iterable<string>, actual: ReadonlySet<string>): string[] {
  return [...required].filter((value) => !actual.has(value));
}

function nonEmptyStrings(values: unknown): values is string[] {
  return Array.isArray(values)
    && values.length > 0
    && values.every((value) => typeof value === "string" && value.trim().length > 0);
}

function validExpiry(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T23:59:59Z`));
}

function hasTransition(source: Surface | undefined, target: string): boolean {
  return Boolean(source?.transitions.some((transition) => transition.target === target));
}

export function validateProductRegistry(
  registry: ProductRegistry,
  implementationRoutes: ImplementationRouteRegistry,
): string[] {
  const errors: string[] = [];
  if (registry.product.schema_version !== "1.0.0") errors.push("product schema_version must be 1.0.0");
  if (registry.product.product_id !== "zukan") errors.push("product_id must be zukan");
  if (registry.product.status_authority?.locator !== "operations/ai_os/verified_outcome_status_resolver.mjs#resolveStatus") {
    errors.push("status authority must be the shared verified outcome resolver");
  }
  if (registry.product.registries?.evidence || registry.product.registries?.learning) {
    errors.push("registry must not contain local evidence or learning projections");
  }

  const outcomes = addUniqueIds(errors, "outcomes", registry.outcomes);
  const capabilities = addUniqueIds(errors, "capabilities", registry.capabilities);
  const surfaces = addUniqueIds(errors, "surfaces", registry.surfaces);
  const journeys = addUniqueIds(errors, "journeys", registry.journeys);
  const foundations = addUniqueIds(errors, "design foundations", registry.designFoundations);
  const brands = addUniqueIds(errors, "design brands", registry.designBrands);
  const archetypes = addUniqueIds(errors, "design archetypes", registry.designArchetypes);
  const designs = addUniqueIds(errors, "design contracts", registry.designContracts);
  const contents = addUniqueIds(errors, "content contracts", registry.contentContracts);
  const qualities = addUniqueIds(errors, "quality contracts", registry.qualityContracts);
  const requirements = addUniqueIds(errors, "requirements", registry.requirements);
  addUniqueIds(errors, "design exceptions", registry.designExceptions);

  const capabilityMatrixRequirements = new Set<string>();
  for (const entry of registry.capabilityMatrix) {
    if (!outcomes.has(entry.outcome_ref)) errors.push(`${entry.domain} references unknown outcome ${entry.outcome_ref}`);
    for (const capabilityId of entry.capability_refs) {
      if (!capabilities.has(capabilityId)) errors.push(`${entry.domain} references unknown capability ${capabilityId}`);
    }
    for (const requirementId of entry.requirement_refs) {
      if (!requirements.has(requirementId)) errors.push(`${entry.domain} references unknown requirement ${requirementId}`);
      capabilityMatrixRequirements.add(requirementId);
    }
  }

  const evidenceLanes = new Set<EvidenceLane>(["machine", "design", "human"]);
  const verificationLevels = new Set<VerificationLevel>([
    "contract", "source", "deterministic", "integration", "staging", "design", "human",
  ]);
  const referencedRequirements = new Set<string>();
  for (const outcome of registry.outcomes) {
    if (!outcome.statement?.trim() || !nonEmptyStrings(outcome.journey_refs)) {
      errors.push(`${outcome.id} requires statement and journey_refs`);
    }
    for (const journeyId of outcome.journey_refs ?? []) {
      if (!journeys.has(journeyId)) errors.push(`${outcome.id} references unknown journey ${journeyId}`);
    }
  }
  for (const requirement of registry.requirements) {
    if (!qualities.has(requirement.quality_contract)) {
      errors.push(`${requirement.id} references unknown quality contract ${requirement.quality_contract}`);
    }
    if (!requirement.title?.trim() || !requirement.acceptance?.trim()) {
      errors.push(`${requirement.id} requires title and acceptance`);
    }
    if (!nonEmptyStrings(requirement.environments)
      || new Set(requirement.environments).size !== requirement.environments.length) {
      errors.push(`${requirement.id} requires unique environments`);
    }
    if (!nonEmptyStrings(requirement.evidence_lanes)
      || new Set(requirement.evidence_lanes).size !== requirement.evidence_lanes.length
      || requirement.evidence_lanes.some((lane) => !evidenceLanes.has(lane))) {
      errors.push(`${requirement.id} has invalid evidence_lanes`);
    }
    if (!nonEmptyStrings(requirement.verification_levels)
      || new Set(requirement.verification_levels).size !== requirement.verification_levels.length
      || requirement.verification_levels.some((level) => !verificationLevels.has(level))) {
      errors.push(`${requirement.id} has invalid verification_levels`);
    }
    if (!nonEmptyStrings(requirement.invalidation_keys)
      || new Set(requirement.invalidation_keys).size !== requirement.invalidation_keys.length
      || requirement.invalidation_keys.some((key) => !/^[a-z0-9][a-z0-9._:/-]{2,199}$/u.test(key))) {
      errors.push(`${requirement.id} has invalid invalidation_keys`);
    }
  }

  const requiredSurfaceIds = new Set(registry.product.required_surface_ids);
  if (requiredSurfaceIds.size !== registry.product.required_surface_ids.length) {
    errors.push("product required_surface_ids contains duplicates");
  }
  for (const requiredSurfaceId of requiredSurfaceIds) {
    if (!surfaces.has(requiredSurfaceId)) errors.push(`required surface is missing: ${requiredSurfaceId}`);
  }

  for (const brand of registry.designBrands) {
    if (!foundations.has(brand.foundation)) errors.push(`${brand.id} references unknown foundation ${brand.foundation}`);
  }

  const usedCapabilities = new Set<string>();
  for (const surface of registry.surfaces) {
    if (!["implemented", "partial", "planned"].includes(surface.implementation_status)) {
      errors.push(`${surface.id} has unsupported implementation_status ${String(surface.implementation_status)}`);
    }
    if (!Array.isArray(surface.known_gaps)) errors.push(`${surface.id} known_gaps must be an array`);
    if (surface.implementation_status !== "implemented" && !nonEmptyStrings(surface.known_gaps)) {
      errors.push(`${surface.id} ${surface.implementation_status} surface requires known_gaps`);
    }
    if (surface.implementation_status === "partial" && !nonEmptyStrings(surface.implementation_candidates ?? [])) {
      errors.push(`${surface.id} partial surface requires implementation_candidates`);
    }

    const actualRoutes = implementationRoutes[surface.route_source];
    if (surface.implementation_status !== "planned" && !actualRoutes?.has(surface.route)) {
      errors.push(`${surface.id} route ${surface.route} is absent from ${surface.route_source}`);
    }
    if (surface.implementation_status !== "planned" && !repositoryFileExists(surface.implementation_ref)) {
      errors.push(`${surface.id} implementation_ref does not exist: ${surface.implementation_ref}`);
    }

    if (new Set(surface.capabilities).size !== surface.capabilities.length) errors.push(`${surface.id} contains duplicate capabilities`);
    for (const capabilityId of surface.capabilities) {
      usedCapabilities.add(capabilityId);
      if (!capabilities.has(capabilityId)) errors.push(`${surface.id} references unknown capability ${capabilityId}`);
    }
    if (new Set(surface.entry_points).size !== surface.entry_points.length) errors.push(`${surface.id} contains duplicate entry points`);
    for (const entry of surface.entry_points) {
      if (entry === "external") continue;
      const source = surfaces.get(entry);
      if (!source) errors.push(`${surface.id} has unknown entry point ${entry}`);
      else if (!hasTransition(source, surface.id)) errors.push(`${surface.id} entry point ${entry} has no transition to this surface`);
    }
    for (const transition of surface.transitions) {
      if (!transition.action) errors.push(`${surface.id} contains a transition without action`);
      if (!surfaces.has(transition.target)) errors.push(`${surface.id} transitions to unknown surface ${transition.target}`);
      if (!["implemented", "candidate", "planned"].includes(transition.status)) {
        errors.push(`${surface.id} transition to ${transition.target} has unsupported status`);
      }
    }

    const design = designs.get(surface.design_contract);
    const content = contents.get(surface.content_contract);
    const quality = qualities.get(surface.quality_contract);
    if (!design) errors.push(`${surface.id} references unknown design contract ${surface.design_contract}`);
    if (!content) errors.push(`${surface.id} references unknown content contract ${surface.content_contract}`);
    if (!quality) errors.push(`${surface.id} references unknown quality contract ${surface.quality_contract}`);
    if (design && design.surface !== surface.id) errors.push(`${design.id} is bound to ${design.surface}, expected ${surface.id}`);
    if (content && content.surface !== surface.id) errors.push(`${content.id} is bound to ${content.surface}, expected ${surface.id}`);
    if (quality && quality.surface !== surface.id) errors.push(`${quality.id} is bound to ${quality.surface}, expected ${surface.id}`);

    const states = new Set(surface.states);
    if (states.size !== surface.states.length) errors.push(`${surface.id} contains duplicate states`);
    if (surface.privacy.startsWith("owner-only") && !states.has("denied")) {
      errors.push(`${surface.id} is owner-only but has no denied state`);
    }
    if (design) {
      if (!brands.has(design.brand)) errors.push(`${design.id} references unknown brand ${design.brand}`);
      if (!archetypes.has(design.archetype)) errors.push(`${design.id} references unknown archetype ${design.archetype}`);
      for (const state of missingValues(states, new Set(design.state_presentations))) {
        errors.push(`${design.id} does not define presentation for state ${state}`);
      }
    }
    if (content) {
      for (const [field, value] of Object.entries({
        audience: content.audience,
        user_intent: content.user_intent,
        primary_message: content.primary_message,
        primary_cta: content.primary_cta,
        primary_event: content.analytics?.primary_event,
      })) {
        if (typeof value !== "string" || value.trim().length === 0) errors.push(`${content.id} requires ${field}`);
      }
      if (!nonEmptyStrings(content.prohibited_claims)) errors.push(`${content.id} requires prohibited_claims`);
      if (content.seo?.canonical_path !== surface.route) {
        errors.push(`${content.id} canonical path ${content.seo?.canonical_path ?? "missing"} does not match ${surface.route}`);
      }
      if ((surface.auth === "session" || surface.privacy.startsWith("owner-only")) && content.seo?.index !== false) {
        errors.push(`${content.id} private/session surface must be noindex`);
      }
    }
    if (quality) {
      for (const state of missingValues(states, new Set(quality.required_states))) {
        errors.push(`${quality.id} does not require state ${state}`);
      }
      if (!quality.tests.some((test) => test.status !== "planned")) {
        errors.push(`${quality.id} has no canonical or candidate test`);
      }
      for (const testRef of quality.tests) {
        if (!testRef.locator || !testRef.kind) errors.push(`${quality.id} contains an incomplete test reference`);
        if (testRef.status !== "planned" && !repositoryFileExists(testRef.locator)) {
          errors.push(`${quality.id} test locator does not exist: ${testRef.locator}`);
        }
      }
    }
  }

  for (const capability of registry.capabilities) {
    if (!usedCapabilities.has(capability.id)) errors.push(`${capability.id} is not assigned to any surface`);
    if (capability.operation === "write") {
      if (!capability.failure_contract) errors.push(`${capability.id} write capability lacks failure_contract`);
      if (!capability.retry_contract) errors.push(`${capability.id} write capability lacks retry_contract`);
    }
  }

  const allSurfaceStates = new Set(registry.surfaces.flatMap((surface) => surface.states));
  for (const journey of registry.journeys) {
    if (!nonEmptyStrings(journey.outcome_refs)) errors.push(`${journey.id} requires outcome_refs`);
    if (!nonEmptyStrings(journey.capability_refs)) errors.push(`${journey.id} requires capability_refs`);
    for (const outcomeId of journey.outcome_refs ?? []) {
      if (!outcomes.has(outcomeId)) errors.push(`${journey.id} references unknown outcome ${outcomeId}`);
    }
    const journeyCapabilities = new Set(journey.steps.flatMap((step) => surfaces.get(step.surface)?.capabilities ?? []));
    for (const capabilityId of journey.capability_refs ?? []) {
      if (!capabilities.has(capabilityId)) errors.push(`${journey.id} references unknown capability ${capabilityId}`);
      else if (!journeyCapabilities.has(capabilityId)) errors.push(`${journey.id} capability ${capabilityId} is absent from its surfaces`);
    }
    if (!surfaces.has(journey.start_surface)) errors.push(`${journey.id} has unknown start surface ${journey.start_surface}`);
    if (!surfaces.has(journey.success_surface)) errors.push(`${journey.id} has unknown success surface ${journey.success_surface}`);
    if (journey.steps.length < 2) errors.push(`${journey.id} must contain at least two steps`);
    if (journey.steps[0]?.surface !== journey.start_surface) errors.push(`${journey.id} first step must match start_surface`);
    if (journey.steps.at(-1)?.surface !== journey.success_surface) errors.push(`${journey.id} final step must match success_surface`);
    for (const [index, step] of journey.steps.entries()) {
      if (!surfaces.has(step.surface)) errors.push(`${journey.id} step references unknown surface ${step.surface}`);
      if (!step.action) errors.push(`${journey.id} contains a step without action`);
      const next = journey.steps[index + 1];
      if (next && next.surface !== step.surface && !hasTransition(surfaces.get(step.surface), next.surface)) {
        errors.push(`${journey.id} has no registered transition from ${step.surface} to ${next.surface}`);
      }
    }
    for (const state of journey.required_states) {
      if (!allSurfaceStates.has(state)) errors.push(`${journey.id} requires unknown state ${state}`);
    }
    for (const requirementRef of journey.requirement_refs ?? []) {
      if (!requirements.has(requirementRef)) errors.push(`${journey.id} references unknown requirement ${requirementRef}`);
      else referencedRequirements.add(requirementRef);
    }
  }

  for (const exception of registry.designExceptions) {
    if (!exception.rule || !exception.reason || !exception.owner || !validExpiry(exception.expires_at)) {
      errors.push(`${exception.id} requires rule, reason, owner, and valid expires_at`);
    } else if (Date.parse(`${exception.expires_at}T23:59:59Z`) < Date.now()) {
      errors.push(`${exception.id} expired on ${exception.expires_at}`);
    }
    for (const surfaceId of exception.surfaces) {
      if (!surfaces.has(surfaceId)) errors.push(`${exception.id} references unknown surface ${surfaceId}`);
    }
  }

  for (const [id, design] of designs) {
    if (!surfaces.has(design.surface)) errors.push(`${id} references unknown surface ${design.surface}`);
  }
  for (const [id, content] of contents) {
    if (!surfaces.has(content.surface)) errors.push(`${id} references unknown surface ${content.surface}`);
  }
  for (const [id, quality] of qualities) {
    if (!surfaces.has(quality.surface)) errors.push(`${id} references unknown surface ${quality.surface}`);
    for (const requirementRef of quality.requirement_refs ?? []) {
      const requirement = requirements.get(requirementRef);
      if (!requirement) errors.push(`${id} references unknown requirement ${requirementRef}`);
      else {
        referencedRequirements.add(requirementRef);
        if (requirement.quality_contract !== id) {
          errors.push(`${requirementRef} belongs to ${requirement.quality_contract}, not ${id}`);
        }
      }
    }
  }

  for (const requirementId of requirements.keys()) {
    if (!referencedRequirements.has(requirementId)) errors.push(`${requirementId} is not referenced by a quality contract or journey`);
    if (!capabilityMatrixRequirements.has(requirementId)) errors.push(`${requirementId} is not connected to a capability`);
  }

  if (journeys.size === 0) errors.push("at least one journey is required");
  return errors;
}

export function assertValidProductRegistry(
  registry: ProductRegistry,
  implementationRoutes: ImplementationRouteRegistry,
): void {
  const errors = validateProductRegistry(registry, implementationRoutes);
  if (errors.length > 0) {
    throw new Error(`ZUKAN product registry is invalid:\n- ${errors.join("\n- ")}`);
  }
}
