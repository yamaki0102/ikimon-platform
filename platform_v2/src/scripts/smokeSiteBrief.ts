/**
 * Smoke: verify the deterministic Site Brief rule engine.
 *
 * Skips network (Overpass / GSI) and feeds synthetic SiteSignals so we
 * can run in CI / locally without egress. The goal is to catch rule
 * regressions, not to validate the live fetchers.
 *
 * Run: `tsx src/scripts/smokeSiteBrief.ts`
 */
import { composeSiteBrief, type SiteSignals } from "../services/siteBrief.js";

type Case = {
  name: string;
  signals: SiteSignals;
  expectId: string;
};

const CASES: Case[] = [
  {
    name: "wet forest edge (forest + water nearby)",
    signals: { landcover: ["tree_cover"], nearbyLandcover: ["tree_cover", "water"], waterDistanceM: 50, elevationM: 12 },
    expectId: "wetland_edge",
  },
  {
    name: "pure forest interior",
    signals: { landcover: ["tree_cover"], nearbyLandcover: ["tree_cover"], waterDistanceM: 800, elevationM: 420 },
    expectId: "forest_interior",
  },
  {
    name: "forest-open boundary (forest + grass)",
    signals: { landcover: ["tree_cover"], nearbyLandcover: ["tree_cover", "grassland"], waterDistanceM: null, elevationM: 200 },
    expectId: "forest_edge_open",
  },
  {
    name: "grassland succession",
    signals: { landcover: ["grassland"], nearbyLandcover: ["grassland"], waterDistanceM: null, elevationM: 80 },
    expectId: "grassland_succession",
  },
  {
    name: "cropland",
    signals: { landcover: ["cropland"], nearbyLandcover: ["cropland"], waterDistanceM: null, elevationM: 15 },
    expectId: "farmland",
  },
  {
    name: "urban seam",
    signals: { landcover: ["built_up"], nearbyLandcover: ["built_up"], waterDistanceM: null, elevationM: 10 },
    expectId: "urban_seam",
  },
  {
    name: "urban seam with unknown water distance stays urban",
    signals: { landcover: ["built_up"], nearbyLandcover: ["built_up"], waterDistanceM: null, elevationM: 24 },
    expectId: "urban_seam",
  },
  {
    name: "on water",
    signals: { landcover: ["water"], nearbyLandcover: ["water"], waterDistanceM: 0, elevationM: 0 },
    expectId: "water_body",
  },
  {
    name: "cropland without water distance stays farmland",
    signals: { landcover: ["cropland"], nearbyLandcover: ["cropland", "built_up"], waterDistanceM: null, elevationM: 14 },
    expectId: "farmland",
  },
  {
    name: "high elevation and far from water becomes alpine",
    signals: { landcover: ["bare"], nearbyLandcover: ["bare"], waterDistanceM: 420, elevationM: 2310 },
    expectId: "alpine_subalpine",
  },
  {
    name: "far from water but low elevation does not become alpine",
    signals: { landcover: [], nearbyLandcover: [], waterDistanceM: 420, elevationM: 18 },
    expectId: "generic",
  },
  {
    name: "no signals → generic",
    signals: { landcover: [], nearbyLandcover: [], waterDistanceM: null, elevationM: null },
    expectId: "generic",
  },
];

let failed = 0;
for (const c of CASES) {
  const brief = composeSiteBrief(c.signals, "ja");
  const ok = brief.hypothesis.id === c.expectId;
  const status = ok ? "ok " : "FAIL";
  console.log(
    `[${status}] ${c.name} → got "${brief.hypothesis.id}" (${brief.hypothesis.label}) expected "${c.expectId}"`,
  );
  if (!ok) failed += 1;
}

if (failed > 0) {
  console.error(`${failed} / ${CASES.length} cases failed`);
  process.exit(1);
}
console.log(`All ${CASES.length} site-brief cases passed.`);
