import { IKIMON_CLARITY_PROJECT_ID, IKIMON_GA4_MEASUREMENT_ID } from "./analyticsConfig.js";
import { PRODUCTION_PUBLIC_ORIGIN, PRODUCTION_PUBLIC_HOSTS } from "./trustedPublicOrigin.js";
import { listPagesByVisibility, listSitePages, listVisualQaPages, xmlSitemapPages } from "../siteMap.js";

type ReflectionRoute = {
  path: string;
  lane: string;
  audience: string;
  auth: string;
  layout: string;
  title: string;
  summary: string;
  nav: string[];
  visualQa: boolean;
  xml: boolean;
};

function normalizeOrigin(origin: string): string {
  return (origin || PRODUCTION_PUBLIC_ORIGIN).replace(/\/+$/, "");
}

export function buildReflectionLoopManifest(origin: string, now = new Date()) {
  const base = normalizeOrigin(origin);
  const pages = listSitePages();
  const qaPaths = new Set(listPagesByVisibility("qa").map((page) => page.path));
  const xmlPaths = new Set(xmlSitemapPages().map((page) => page.path));
  const visualQaPaths = new Set(listVisualQaPages().map((page) => page.path));
  const routes: ReflectionRoute[] = pages
    .map((page) => ({
      path: page.path,
      lane: page.lane,
      audience: page.audience,
      auth: page.auth,
      layout: page.layout,
      title: page.title.ja,
      summary: page.summary.ja,
      nav: page.navVisibility,
      visualQa: visualQaPaths.has(page.path),
      xml: xmlPaths.has(page.path),
    }))
    .sort((a, b) => a.path.localeCompare(b.path, "en"));

  const byLane = routes.reduce<Record<string, number>>((acc, route) => {
    acc[route.lane] = (acc[route.lane] ?? 0) + 1;
    return acc;
  }, {});

  return {
    schema_version: 1,
    generated_at: now.toISOString(),
    service: "ikimon.life",
    origin: base,
    loop_contract: {
      route_registry_source: "platform_v2/src/siteMap.ts",
      analytics_config_source: "platform_v2/src/services/analyticsConfig.ts",
      public_manifest_path: "/qa/reflection-loop.json",
      no_personal_data: true,
      production_mutation_boundary: "read-only manifest; deploys happen only through GitHub Actions main merge",
    },
    analytics: {
      ga4_measurement_id: IKIMON_GA4_MEASUREMENT_ID,
      clarity_project_id: IKIMON_CLARITY_PROJECT_ID,
      production_hosts: [...PRODUCTION_PUBLIC_HOSTS].filter((host) => host.endsWith("zukan.earth")),
    },
    coverage: {
      route_count: routes.length,
      qa_route_count: qaPaths.size,
      visual_qa_route_count: visualQaPaths.size,
      xml_sitemap_route_count: xmlPaths.size,
      lane_counts: byLane,
    },
    routes,
  };
}
