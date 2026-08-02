import {
  KUBIAKA_ENTRY_PATH,
  KUBIAKA_MEMBER_PATH,
  KUBIAKA_RECORD_PATH,
} from "../routes/kubiakaFocusedExperience.js";
import { SITE_PAGE_DEFINITIONS } from "../siteMap.js";
import {
  assertValidProductRegistry,
  loadProductRegistry,
  type ImplementationRouteRegistry,
} from "../productRegistry.js";

const implementationRoutes: ImplementationRouteRegistry = {
  "site-map": new Set(SITE_PAGE_DEFINITIONS.map((page) => page.path)),
  "kubiaka-focused-experience": new Set([
    KUBIAKA_ENTRY_PATH,
    KUBIAKA_RECORD_PATH,
    KUBIAKA_MEMBER_PATH,
  ]),
};

const registry = loadProductRegistry();
assertValidProductRegistry(registry, implementationRoutes);

process.stdout.write(
  `ZUKAN product registry: PASS (${registry.surfaces.length} surfaces, ${registry.capabilities.length} capabilities, ${registry.journeys.length} journeys)\n`,
);
