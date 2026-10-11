import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";
import { buildLearnCatalog, type LearnCatalogEntry } from "./catalog.js";
import { renderLearnCatalog } from "./view.js";

test("catalogue markup preserves all ordinary Japanese links and escaped data without JavaScript", () => {
  const entries = buildLearnCatalog();
  const html = renderLearnCatalog("", entries, '<p><a href="/ja/learn/field-loop">テーマの入口</a></p>');
  for (const entry of entries) {
    assert.ok(html.includes(`href="/ja${entry.path}"`), entry.path);
  }
  assert.equal([...html.matchAll(/data-learn-entry=/g)].length, entries.length);
  assert.match(html, /<details[^>]+data-learn-results>/);
  assert.match(html, /<noscript>/);
  assert.match(html, /for="learn-query"/);
  assert.match(html, /role="status" aria-live="polite" aria-atomic="true"/);
  assert.doesNotMatch(html, /__name|new Function|eval\(/);
});

test("titles, summaries, headings and script terminators stay inert across HTML and JSON contexts", () => {
  const attack = '</script><script>globalThis.pwned=true</script><img src=x onerror="alert(1)">&\u2028';
  const entry: LearnCatalogEntry = { path: "/learn/safe", kind: "reading", title: attack, summary: attack, headings: [attack], searchAliases: [attack] };
  const html = renderLearnCatalog("", [entry], "");
  assert.equal([...html.matchAll(/<script\b/g)].length, 2);
  assert.equal([...html.matchAll(/<\/script>/g)].length, 2);
  assert.doesNotMatch(html, /<img|<script>globalThis/);
  assert.match(html, /&lt;\/script&gt;/);
  const data = html.match(/<script type="application\/json" data-learn-data>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(data);
  assert.deepEqual(JSON.parse(data), [entry]);
});

test("the real routes serve every catalogue URL and preserve Japanese canonical and non-Japanese/staging noindex", async () => {
  const app = buildApp();
  const headers = { host: "zukan.earth", "x-forwarded-proto": "https" };
  try {
    const initial = await app.inject({ method: "GET", url: "/ja/learn", headers });
    const query = await app.inject({ method: "GET", url: "/ja/learn?q=%3Cscript%3E&kind=term", headers });
    assert.equal(initial.statusCode, 200);
    assert.equal(query.statusCode, 200);
    assert.match(query.body, /<link rel="canonical" href="https:\/\/zukan\.earth\/ja\/learn"/);
    assert.equal(initial.body.match(/<script[^>]+data-learn-data>([\s\S]*?)<\/script>/)?.[1], query.body.match(/<script[^>]+data-learn-data>([\s\S]*?)<\/script>/)?.[1], "materialized HTML carries the same index; browser URL restores the query");
    for (const entry of buildLearnCatalog()) {
      const response = await app.inject({ method: "GET", url: `/ja${entry.path}`, headers });
      assert.equal(response.statusCode, 200, entry.path);
      assert.ok(response.body.includes(`rel="canonical" href="https://zukan.earth/ja${entry.path}"`), entry.path);
      assert.equal(/<meta name="robots" content="noindex/.test(response.body), false, `${entry.path} is Japanese and public`);
    }
    const english = await app.inject({ method: "GET", url: "/en/learn?q=TNFD&kind=term", headers });
    assert.ok(/<meta name="robots" content="noindex,follow"/.test(english.body), "non-Japanese learn preserves the production noindex policy");
    assert.equal(english.body.includes("data-learn-catalog"), false, "Japanese catalogue does not change the English page");
    const staging = await app.inject({ method: "GET", url: "/ja/learn", headers: { host: "staging.zukan.earth", "x-forwarded-proto": "https" } });
    assert.equal(staging.headers["x-robots-tag"], "noindex, nofollow");
  } finally {
    await app.close();
  }
});
