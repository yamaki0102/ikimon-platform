import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";
import { listVisualQaPages, materializeSitePagePath } from "../siteMap.js";

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
    assert.match(sitemap.body, /https:\/\/staging\.ikimon\.life\/en\/community/);
    assert.match(sitemap.body, /hreflang="en" href="https:\/\/staging\.ikimon\.life\/en\/community"/);
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
    assert.match(qa.body, /ガイド成果確認/);
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

test("top-level shared navigation does not link to 404 pages", async () => {
  const app = buildApp();
  try {
    const top = await app.inject({ method: "GET", url: "/?lang=ja", headers: { accept: "text/html" } });
    assert.equal(top.statusCode, 200);
    const hrefs = extractInternalHrefs(top.body);
    assert.ok(hrefs.includes("/ja/community"), "top should expose community");

    for (const href of hrefs) {
      const response = await app.inject({ method: "GET", url: href, headers: { accept: "text/html" } });
      assert.notEqual(response.statusCode, 404, `${href} should not 404 from top/shared navigation`);
    }
  } finally {
    await app.close();
  }
});

test("visual smoke targets are generated from sitemap metadata", () => {
  const pages = listVisualQaPages();
  const paths = pages.map((page) => page.path);
  assert.ok(paths.includes("/explore"));
  assert.ok(paths.includes("/guide"));
  assert.ok(paths.includes("/guide/outcomes"));
  assert.ok(paths.includes("/home"));
  assert.ok(paths.includes("/profile/:userId"));
  assert.ok(paths.includes("/observations/:id"));
  assert.ok(paths.includes("/specialist/id-workbench"));

  const observation = pages.find((page) => page.path === "/observations/:id");
  assert.ok(observation);
  assert.equal(
    materializeSitePagePath(observation, { visitId: "visit-1", occurrenceId: "occ:visit-1:0" }),
    "/observations/visit-1?subject=occ%3Avisit-1%3A0",
  );
});
