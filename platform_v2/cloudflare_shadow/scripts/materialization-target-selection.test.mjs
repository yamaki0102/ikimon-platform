import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { listLearnMaterializationPaths } from "../../src/learn/materialization.ts";
import { listInvasiveSpeciesMaterializationPaths } from "../../src/services/invasiveSpeciesMaterialization.ts";
import {
  LIVE_ORIGIN_SITEMAP_PATHS,
  listSitemapStaticMaterializationPaths,
} from "../../src/services/originalUiMaterializationRoutes.ts";
import { buildXmlSitemap } from "../../src/siteMap.ts";
import { selectCoreMaterializationPaths } from "./materialization-target-selection.mjs";

const workerSource = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");

function workerStringArray(name) {
  const match = workerSource.match(new RegExp(`const\\s+${name}\\s*=\\s*\\[\\s*([\\s\\S]*?)\\s*\\]\\s*as const;`));
  assert.ok(match, `${name} not found in worker source`);
  return [...match[1].matchAll(/"([^"]+)"/gu)].map((m) => m[1]);
}

function targets(overrides = {}) {
  return selectCoreMaterializationPaths({
    corePaths: ["/"],
    queryVariantPaths: ["/explore?view=grid"],
    learnPaths: listLearnMaterializationPaths(),
    invasiveSpeciesPaths: ["/ja/learn/invasive-species/example"],
    sitemapStaticPaths: listSitemapStaticMaterializationPaths(),
    ...overrides,
  });
}

function realTargets() {
  return selectCoreMaterializationPaths({
    corePaths: workerStringArray("ORIGINAL_UI_HTML_CORE_PATHS"),
    queryVariantPaths: workerStringArray("ORIGINAL_UI_HTML_QUERY_VARIANT_PATHS"),
    learnPaths: listLearnMaterializationPaths(),
    invasiveSpeciesPaths: listInvasiveSpeciesMaterializationPaths(),
    sitemapStaticPaths: listSitemapStaticMaterializationPaths(),
  });
}

function sitemapPaths() {
  const origin = "https://sitemap-contract.test";
  return [...buildXmlSitemap(origin).matchAll(/<loc>([^<]+)<\/loc>/gu)].map((m) => m[1].slice(origin.length));
}

const REQUIRED_PUBLIC_PAGES = [
  "/ja/faq", "/ja/privacy", "/ja/terms", "/ja/contact",
  "/ja/for-business", "/ja/for-business/pricing", "/ja/for-business/invasive-reporting",
  "/ja/for-business/field-programs", "/ja/for-business/demo", "/ja/for-business/status",
  "/ja/for-business/apply", "/ja/for-business/monitoring/apply",
  "/ja/impact", "/ja/cases", "/ja/for-researcher/apply",
];

test("core materialization includes the unprefixed Learn entry and Contact", () => {
  const selected = targets();
  assert.ok(selected.includes("/learn"));
  assert.ok(selected.includes("/ja/contact"));
  assert.ok(selected.includes("/ja/learn"));
  assert.ok(selected.includes("/en/learn"));
});

test("core materialization does not invent locales outside the sitemap contract", () => {
  const selected = targets();
  assert.equal(selected.includes("/contact"), false);
  assert.equal(selected.includes("/en/contact"), false);
  assert.equal(selected.includes("/en/privacy"), false);
});

test("core selection remains bounded and deduplicated", () => {
  const selected = targets({ corePaths: ["/", "/learn", "/ja/contact"] });
  assert.equal(selected.filter((path) => path === "/learn").length, 1);
  assert.equal(selected.filter((path) => path === "/ja/contact").length, 1);
  assert.equal(selected.includes("/unrelated-site-map-page"), false);
});

test("the 15 public static pages are in the core target set", () => {
  const selected = new Set(realTargets());
  assert.ok(selected.size > 0);
  for (const path of REQUIRED_PUBLIC_PAGES) assert.ok(selected.has(path), `${path} missing from core target set`);
});

test("every real sitemap URL is a materialization target unless explicitly live-origin", () => {
  const selected = new Set(realTargets());
  const live = new Set(LIVE_ORIGIN_SITEMAP_PATHS);
  const urls = sitemapPaths();
  assert.ok(urls.length > 0);
  const missing = urls.filter((path) => !selected.has(path) && !live.has(path));
  assert.deepEqual(missing, []);
});

test("live-origin exceptions stay explicit: in the sitemap, not materialized", () => {
  const selected = new Set(realTargets());
  const urls = new Set(sitemapPaths());
  assert.deepEqual([...LIVE_ORIGIN_SITEMAP_PATHS].sort(), ["/ja/biosecurity", "/ja/community/events", "/ja/walk-maps"]);
  for (const path of LIVE_ORIGIN_SITEMAP_PATHS) {
    assert.ok(urls.has(path), `${path} is not in the sitemap`);
    assert.equal(selected.has(path), false, `${path} must not be materialized`);
  }
});
