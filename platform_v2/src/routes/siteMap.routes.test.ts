import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";
import { listPagesByVisibility, listVisualQaPages, materializeSitePagePath, sitePageLayout } from "../siteMap.js";

function extractInternalHrefs(html: string): string[] {
  const hrefs = new Set<string>();
  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const href = match[1] ?? "";
    if (!href.startsWith("/") || href.startsWith("//")) continue;
    if (href.startsWith("/assets/") || href.startsWith("/uploads/") || href.startsWith("/thumb/")) continue;
    if (href.startsWith("/data/") || href.startsWith("/api/") || href === "/favicon.ico") continue;
    hrefs.add(href);
  }
  return [...hrefs];
}

test("sitemap and robots are generated from canonical v2 pages", async () => {
  const app = buildApp();
  try {
    const sitemap = await app.inject({
      method: "GET",
      url: "/sitemap.xml",
      headers: { host: "staging.ikimon.life", "x-forwarded-proto": "https" },
    });
    assert.equal(sitemap.statusCode, 200);
    assert.match(sitemap.headers["content-type"] as string, /application\/xml/);
    assert.match(sitemap.body, /https:\/\/staging\.ikimon\.life\/ja\/community/);
    assert.doesNotMatch(sitemap.body, /https:\/\/staging\.ikimon\.life\/en\/community/);
    assert.doesNotMatch(sitemap.body, /hreflang="en"/);
    assert.match(sitemap.body, /hreflang="x-default" href="https:\/\/staging\.ikimon\.life\/ja\/community"/);
    assert.match(sitemap.body, /https:\/\/staging\.ikimon\.life\/ja\/for-business/);
    assert.doesNotMatch(sitemap.body, /https:\/\/staging\.ikimon\.life\/en\/for-business/);
    assert.doesNotMatch(sitemap.body, /:id|:userId/);

    const robots = await app.inject({
      method: "GET",
      url: "/robots.txt",
      headers: { host: "staging.ikimon.life", "x-forwarded-proto": "https" },
    });
    assert.equal(robots.statusCode, 200);
    assert.match(robots.body, /Sitemap: https:\/\/staging\.ikimon\.life\/sitemap\.xml/);
    assert.match(robots.body, /LLMs: https:\/\/staging\.ikimon\.life\/llms\.txt/);
  } finally {
    await app.close();
  }
});

test("qa sitemap uses the canonical registry and legacy redirects point to v2 routes", async () => {
  const app = buildApp();
  try {
    const qa = await app.inject({ method: "GET", url: "/qa/site-map?lang=ja" });
    assert.equal(qa.statusCode, 200);
    assert.match(qa.body, /Start \/ Core Journey/);
    assert.match(qa.body, /ライブガイド/);
    assert.match(qa.body, /ガイド成果/);
    assert.match(qa.body, /みんなで調べる/);
    assert.match(qa.body, /専門家確認/);
    assert.match(qa.body, /XML sitemap/);

    const sitemapPhp = await app.inject({ method: "GET", url: "/sitemap.php?lang=ja" });
    assert.equal(sitemapPhp.statusCode, 308);
    assert.equal(sitemapPhp.headers.location, "/ja/sitemap.xml");

    const events = await app.inject({ method: "GET", url: "/events.php?lang=ja" });
    assert.equal(events.statusCode, 308);
    assert.equal(events.headers.location, "/ja/community");

    const idWorkbench = await app.inject({ method: "GET", url: "/id_workbench.php?lang=ja" });
    assert.equal(idWorkbench.statusCode, 308);
    assert.equal(idWorkbench.headers.location, "/ja/specialist/id-workbench");
  } finally {
    await app.close();
  }
});

test("reflection loop manifest exposes route registry and measurement config without personal data", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/qa/reflection-loop.json",
      headers: { host: "ikimon.life", "x-forwarded-proto": "https" },
    });
    assert.equal(response.statusCode, 200);
    assert.match(response.headers["content-type"] as string, /application\/json/);
    const manifest = JSON.parse(response.body) as {
      schema_version: number;
      origin: string;
      loop_contract: { no_personal_data: boolean; production_mutation_boundary: string };
      analytics: { ga4_measurement_id: string; clarity_project_id: string };
      coverage: { route_count: number; qa_route_count: number; visual_qa_route_count: number };
      routes: Array<{ path: string; auth: string; visualQa: boolean }>;
    };

    assert.equal(manifest.schema_version, 1);
    assert.equal(manifest.origin, "https://ikimon.life");
    assert.equal(manifest.loop_contract.no_personal_data, true);
    assert.match(manifest.loop_contract.production_mutation_boundary, /GitHub Actions/);
    assert.equal(manifest.analytics.ga4_measurement_id, "G-NCL0M1VJZ2");
    assert.equal(manifest.analytics.clarity_project_id, "wl2ezvfqbh");
    assert.equal(manifest.coverage.route_count, manifest.routes.length);
    assert.equal(manifest.coverage.qa_route_count, listPagesByVisibility("qa").length);
    assert.ok(manifest.coverage.visual_qa_route_count > 0);
    assert.ok(manifest.routes.some((route) => route.path === "/qa/reflection-loop.json" && route.auth === "system"));
    assert.ok(manifest.routes.some((route) => route.path === "/records" && route.visualQa));
  } finally {
    await app.close();
  }
});

test("top-level shared navigation does not link to 404 pages", async () => {
  const app = buildApp();
  try {
    const top = await app.inject({ method: "GET", url: "/?lang=ja", headers: { accept: "text/html" } });
    assert.equal(top.statusCode, 200);
    const hrefs = extractInternalHrefs(top.body);
    assert.ok(hrefs.includes("/ja/community"), "top should expose community");

    const cloudflareNativeLinks = new Set([
      "/ja/walk-maps",
      "/ja/walk-maps/jp-shizuoka-asahata-waterfront-sample-v0",
      "/ja/walk-maps/jp-shizuoka-mariko-waterfront-sample-v0",
      "/ja/walk-maps/jp-shizuoka-yatsuyama-sample-v0",
    ]);
    for (const href of hrefs) {
      if (cloudflareNativeLinks.has(href)) continue;
      const response = await app.inject({ method: "GET", url: href, headers: { accept: "text/html" } });
      assert.notEqual(response.statusCode, 404, `${href} should not 404 from top/shared navigation`);
    }
  } finally {
    await app.close();
  }
});

test("header navigation prioritizes content-first daily discovery", () => {
  const headerPaths = listPagesByVisibility("header").map((page) => page.path);
  assert.deepEqual(headerPaths, ["/map", "/records", "/learn", "/community"]);
  assert.ok(!headerPaths.includes("/explore"), "search-oriented explore should not compete with the content feed in the header");
  assert.ok(!headerPaths.includes("/community/events"), "events should sit under community instead of duplicating the header");
});

test("visual smoke targets are generated from sitemap metadata", () => {
  const pages = listVisualQaPages();
  const paths = pages.map((page) => page.path);
  assert.ok(!paths.includes("/explore"));
  assert.ok(paths.includes("/records"));
  assert.ok(paths.includes("/guide"));
  assert.ok(paths.includes("/guide/outcomes"));
  assert.ok(paths.includes("/community/events"));
  assert.ok(paths.includes("/community/fields"));
  assert.ok(paths.includes("/home"));
  assert.ok(paths.includes("/profile/:userId"));
  assert.ok(paths.includes("/observations/:id"));
  assert.ok(paths.includes("/specialist/id-workbench"));
  assert.deepEqual(
    pages.filter((page) => !page.layout).map((page) => page.path),
    [],
    "visual QA pages must declare layout so width regressions are caught before screenshots",
  );
  assert.equal(sitePageLayout(pages.find((page) => page.path === "/guide")!), "immersive");
  assert.equal(sitePageLayout(pages.find((page) => page.path === "/community/events")!), "wide");
  assert.equal(sitePageLayout(pages.find((page) => page.path === "/community/fields")!), "wide");

  const observation = pages.find((page) => page.path === "/observations/:id");
  assert.ok(observation);
  assert.equal(
    materializeSitePagePath(observation, { visitId: "visit-1", occurrenceId: "occ:visit-1:0" }),
    "/observations/visit-1?subject=occ%3Avisit-1%3A0",
  );
});

test("visual QA route pages render their declared shell layouts", async () => {
  const app = buildApp();
  try {
    const businessDemo = await app.inject({ method: "GET", url: "/for-business/demo?lang=ja", headers: { accept: "text/html" } });
    const events = await app.inject({ method: "GET", url: "/community/events?lang=ja", headers: { accept: "text/html" } });
    const fields = await app.inject({ method: "GET", url: "/community/fields?lang=ja", headers: { accept: "text/html" } });

    assert.equal(businessDemo.statusCode, 200);
    assert.equal(events.statusCode, 200);
    assert.equal(fields.statusCode, 200);
    assert.match(businessDemo.body, /class="shell shell-layout-wide"/);
    assert.match(events.body, /class="shell shell-layout-wide"/);
    assert.match(fields.body, /class="shell shell-layout-wide"/);
  } finally {
    await app.close();
  }
});
