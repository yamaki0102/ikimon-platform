import assert from "node:assert/strict";
import test from "node:test";
import {
  KUBIAKA_ENTRY_PATH,
  KUBIAKA_MEMBER_PATH,
  KUBIAKA_RECORD_PATH,
} from "./routes/kubiakaFocusedExperience.js";
import { SITE_PAGE_DEFINITIONS } from "./siteMap.js";
import {
  assertValidProductRegistry,
  loadProductRegistry,
  validateProductRegistry,
  type ImplementationRouteRegistry,
  type ProductRegistry,
} from "./productRegistry.js";

function implementationRoutes(): ImplementationRouteRegistry {
  return {
    "site-map": new Set(SITE_PAGE_DEFINITIONS.map((page) => page.path)),
    "kubiaka-focused-experience": new Set([
      KUBIAKA_ENTRY_PATH,
      KUBIAKA_RECORD_PATH,
      KUBIAKA_MEMBER_PATH,
    ]),
  };
}

function cloneRegistry(): ProductRegistry {
  return structuredClone(loadProductRegistry());
}

test("ZUKAN product registry is internally consistent and matches implemented routes", () => {
  const registry = loadProductRegistry();
  assert.doesNotThrow(() => assertValidProductRegistry(registry, implementationRoutes()));
  assert.equal(registry.product.product_id, "zukan");
  assert.equal(registry.surfaces.length, registry.product.required_surface_ids.length);
});

test("registry rejects a transition to an unknown surface", () => {
  const registry = cloneRegistry();
  registry.surfaces[0]?.transitions.push({ action: "broken", target: "zukan.missing.surface" });
  const errors = validateProductRegistry(registry, implementationRoutes());
  assert.ok(errors.some((error) => error.includes("transitions to unknown surface zukan.missing.surface")));
});

test("registry rejects owner-only surfaces without an explicit denied state", () => {
  const registry = cloneRegistry();
  const ownerOnly = registry.surfaces.find((surface) => surface.id === "zukan.kubiaka.member-records");
  assert.ok(ownerOnly);
  ownerOnly.states = ownerOnly.states.filter((state) => state !== "denied");
  const errors = validateProductRegistry(registry, implementationRoutes());
  assert.ok(errors.some((error) => error.includes("is owner-only but has no denied state")));
});

test("registry rejects write capabilities without retry contracts", () => {
  const registry = cloneRegistry();
  const writeCapability = registry.capabilities.find((capability) => capability.id === "zukan.kubiaka.save-private");
  assert.ok(writeCapability);
  delete writeCapability.retry_contract;
  const errors = validateProductRegistry(registry, implementationRoutes());
  assert.ok(errors.some((error) => error.includes("write capability lacks retry_contract")));
});

test("registry rejects route drift from implementation", () => {
  const registry = cloneRegistry();
  const routes = implementationRoutes();
  routes["site-map"] = new Set([...routes["site-map"]].filter((route) => route !== "/records"));
  const errors = validateProductRegistry(registry, routes);
  assert.ok(errors.some((error) => error.includes("route /records is absent from site-map")));
});
