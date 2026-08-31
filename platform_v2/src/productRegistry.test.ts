import assert from "node:assert/strict";
import test from "node:test";
import { SITE_PAGE_DEFINITIONS } from "./siteMap.js";
import {
  assertValidProductRegistry,
  loadProductRegistry,
  validateProductRegistry,
  type ImplementationRouteRegistry,
  type ProductRegistry,
} from "./productRegistry.js";

function implementationRoutes(): ImplementationRouteRegistry {
  return { "site-map": new Set(SITE_PAGE_DEFINITIONS.map((page) => page.path)) };
}
function cloneRegistry(): ProductRegistry { return structuredClone(loadProductRegistry()); }

test("ZUKAN product registry is internally consistent and matches implemented routes", () => {
  const registry = loadProductRegistry();
  assert.doesNotThrow(() => assertValidProductRegistry(registry, implementationRoutes()));
  assert.equal(registry.product.product_id, "zukan");
  assert.equal(registry.surfaces.length, registry.product.required_surface_ids.length);
});

test("registry rejects a transition to an unknown surface", () => {
  const registry = cloneRegistry();
  registry.surfaces[0]?.transitions.push({ action: "broken", target: "zukan.missing.surface", status: "planned" });
  const errors = validateProductRegistry(registry, implementationRoutes());
  assert.ok(errors.some((error) => error.includes("transitions to unknown surface zukan.missing.surface")));
});

test("registry rejects entry points without a matching source transition", () => {
  const registry = cloneRegistry();
  const landing = registry.surfaces.find((surface) => surface.id === "zukan.capture.start");
  const home = registry.surfaces.find((surface) => surface.id === "zukan.home.public");
  if (!landing || !home) throw new Error("entry point fixtures are missing");
  home.transitions = home.transitions.filter((transition) => transition.target !== landing.id);
  const errors = validateProductRegistry(registry, implementationRoutes());
  assert.ok(errors.some((error) => error.includes("entry point zukan.home.public has no transition to this surface")));
});

test("registry rejects owner-only surfaces without an explicit denied state", () => {
  const registry = cloneRegistry();
  const ownerOnly = registry.surfaces.find((surface) => surface.id === "zukan.capture.start");
  if (!ownerOnly) throw new Error("owner-only fixture surface is missing");
  ownerOnly.privacy = "owner-only";
  ownerOnly.states = ownerOnly.states.filter((state) => state !== "denied");
  const errors = validateProductRegistry(registry, implementationRoutes());
  assert.ok(errors.some((error) => error.includes("is owner-only but has no denied state")));
});

test("registry rejects partial surfaces without explicit gaps and candidate refs", () => {
  const registry = cloneRegistry();
  const partial = registry.surfaces.find((surface) => surface.id === "zukan.capture.start");
  if (!partial) throw new Error("partial fixture surface is missing");
  partial.implementation_status = "partial";
  partial.known_gaps = [];
  partial.implementation_candidates = [];
  const errors = validateProductRegistry(registry, implementationRoutes());
  assert.ok(errors.some((error) => error.includes("partial surface requires known_gaps")));
  assert.ok(errors.some((error) => error.includes("partial surface requires implementation_candidates")));
});

test("registry rejects write capabilities without retry contracts", () => {
  const registry = cloneRegistry();
  const writeCapability = registry.capabilities.find((capability) => capability.id === "zukan.record.save-private");
  if (!writeCapability) throw new Error("write capability fixture is missing");
  delete writeCapability.retry_contract;
  const errors = validateProductRegistry(registry, implementationRoutes());
  assert.ok(errors.some((error) => error.includes("write capability lacks retry_contract")));
});

test("registry rejects unknown design inheritance", () => {
  const registry = cloneRegistry();
  const design = registry.designContracts.find((contract) => contract.id === "design.zukan.home-public");
  if (!design) throw new Error("design fixture is missing");
  design.brand = "brand.missing";
  const errors = validateProductRegistry(registry, implementationRoutes());
  assert.ok(errors.some((error) => error.includes("references unknown brand brand.missing")));
});

test("registry rejects content canonical drift", () => {
  const registry = cloneRegistry();
  const content = registry.contentContracts.find((contract) => contract.id === "content.zukan.records");
  if (!content) throw new Error("content fixture is missing");
  content.seo.canonical_path = "/wrong";
  const errors = validateProductRegistry(registry, implementationRoutes());
  assert.ok(errors.some((error) => error.includes("canonical path /wrong does not match /records")));
});

test("registry rejects route drift from implementation", () => {
  const registry = cloneRegistry();
  const routes = implementationRoutes();
  routes["site-map"] = new Set([...routes["site-map"]].filter((route) => route !== "/records"));
  const errors = validateProductRegistry(registry, routes);
  assert.ok(errors.some((error) => error.includes("route /records is absent from site-map")));
});

test("registry loads expanded requirement evidence contracts and rejects unsupported lanes", () => {
  const registry = cloneRegistry();
  assert.equal(registry.requirements.length, 28);
  const immediatePreview = registry.requirements.find((requirement) => requirement.id === "quality.zukan.capture.immediate-preview");
  if (!immediatePreview) throw new Error("immediate-preview requirement fixture is missing");
  assert.match(immediatePreview.acceptance, /upload完了を待たず/);
  const ownerReturn = registry.requirements.find((requirement) => requirement.id === "quality.zukan.capture.owner-return");
  if (!ownerReturn) throw new Error("owner-return requirement fixture is missing");
  assert.deepEqual(ownerReturn.evidence_lanes, ["machine", "design", "human"]);
  ownerReturn.evidence_lanes = ["machine", "unsupported" as never];
  const errors = validateProductRegistry(registry, implementationRoutes());
  assert.ok(errors.some((error) => error.includes("has invalid evidence_lanes")));
});

test("registry contains no retired focused-experience identity", () => {
  const registry = cloneRegistry();
  assert.doesNotMatch(JSON.stringify(registry), /kubiaka/iu);
});

test("registry rejects incomplete selective invalidation contracts", () => {
  const registry = cloneRegistry();
  const requirement = registry.requirements[0];
  if (!requirement) throw new Error("requirement fixture is missing");
  requirement.invalidation_keys = [];
  const errors = validateProductRegistry(registry, implementationRoutes());
  assert.ok(errors.some((error) => error.includes("has invalid invalidation_keys")));
});
