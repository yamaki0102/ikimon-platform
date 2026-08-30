import { SITE_PAGE_DEFINITIONS } from "../siteMap.js";
import {
  assertValidProductRegistry,
  loadProductRegistry,
  type ImplementationRouteRegistry,
} from "../productRegistry.js";

const implementationRoutes: ImplementationRouteRegistry = {
  "site-map": new Set(SITE_PAGE_DEFINITIONS.map((page) => page.path)),
};

const registry = loadProductRegistry();
assertValidProductRegistry(registry, implementationRoutes);

process.stdout.write(
  `ZUKAN product registry: PASS (${registry.surfaces.length} surfaces, ${registry.capabilities.length} capabilities, ${registry.journeys.length} journeys)\n`,
);
