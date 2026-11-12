import assert from "node:assert/strict";
import test from "node:test";
import { checkSitemapLive, evaluatePage, isSitemapIndex, parseSitemapLocs, summarize, visibleTextLength } from "./check-sitemap-live.mjs";

const longHtml = `<html><head><style>.x{}</style><script>var a=1;</script></head><body><p>${"あ".repeat(600)}</p></body></html>`;

test("parseSitemapLocs extracts, unescapes and dedupes", () => {
  const xml = `<urlset><url><loc>https://zukan.earth/a?x=1&amp;y=2</loc></url><url><loc> https://zukan.earth/b </loc></url><url><loc>https://zukan.earth/b</loc></url></urlset>`;
  assert.deepEqual(parseSitemapLocs(xml), ["https://zukan.earth/a?x=1&y=2", "https://zukan.earth/b"]);
  assert.equal(isSitemapIndex(xml), false);
  assert.equal(isSitemapIndex("<sitemapindex><sitemap><loc>x</loc></sitemap></sitemapindex>"), true);
});

test("visibleTextLength ignores script, style and tags", () => {
  assert.equal(visibleTextLength("<style>aaaa</style><script>bbbb</script><p>ab  c</p>"), 4);
});

test("evaluatePage flags status, unmaterialized marker, short text and fetch errors", () => {
  assert.equal(evaluatePage({ url: "u", status: 200, body: longHtml }).ok, true);
  assert.deepEqual(evaluatePage({ url: "u", status: 404, body: longHtml }).problems, ["status_404"]);
  assert.ok(evaluatePage({ url: "u", status: 200, body: `${longHtml}html_not_materialized` }).problems.includes("html_not_materialized"));
  assert.deepEqual(evaluatePage({ url: "u", status: 404, body: '{"ok":false,"error":"html_not_materialized"}' }).problems.slice(0, 2), ["status_404", "html_not_materialized"]);
  assert.match(evaluatePage({ url: "u", status: 200, body: "<p>short</p>" }).problems[0], /^text_too_short:5$/);
  assert.match(evaluatePage({ url: "u", status: null, error: "timeout" }).problems[0], /^fetch_error:timeout$/);
  assert.equal(evaluatePage({ url: "u", status: 308, body: "" }).ok, false);
});

test("summarize requires at least one page and no failures", () => {
  assert.equal(summarize([]).ok, false);
  const s = summarize([evaluatePage({ url: "a", status: 200, body: longHtml }), evaluatePage({ url: "b", status: 404, body: "" })]);
  assert.equal(s.total, 2);
  assert.equal(s.failed, 1);
  assert.equal(s.ok, false);
  assert.equal(s.failures[0].url, "b");
});

test("checkSitemapLive walks sitemap with injected fetch and reports failures", async () => {
  const pages = { "https://z/ja/privacy": [200, longHtml], "https://z/ja/terms": [404, '{"error":"html_not_materialized"}'], "https://z/ja/boom": null };
  const fetchImpl = async (url) => {
    if (url === "https://z/sitemap.xml") return new Response(`<urlset>${Object.keys(pages).map((u) => `<url><loc>${u}</loc></url>`).join("")}</urlset>`, { status: 200 });
    const page = pages[url];
    if (!page) throw new Error("boom");
    return new Response(page[1], { status: page[0] });
  };
  const summary = await checkSitemapLive({ sitemapUrl: "https://z/sitemap.xml", fetchImpl });
  assert.equal(summary.total, 3);
  assert.equal(summary.passed, 1);
  assert.equal(summary.ok, false);
  assert.deepEqual(summary.failures.map((f) => f.url).sort(), ["https://z/ja/boom", "https://z/ja/terms"]);
});

test("checkSitemapLive follows a sitemap index and fails on sitemap errors", async () => {
  const fetchImpl = async (url) => {
    if (url === "https://z/sitemap.xml") return new Response("<sitemapindex><sitemap><loc>https://z/s1.xml</loc></sitemap></sitemapindex>", { status: 200 });
    if (url === "https://z/s1.xml") return new Response("<urlset><url><loc>https://z/p</loc></url></urlset>", { status: 200 });
    return new Response(longHtml, { status: 200 });
  };
  const summary = await checkSitemapLive({ sitemapUrl: "https://z/sitemap.xml", fetchImpl });
  assert.equal(summary.ok, true);
  assert.equal(summary.total, 1);
  await assert.rejects(checkSitemapLive({ sitemapUrl: "https://z/sitemap.xml", fetchImpl: async () => new Response("", { status: 500 }) }), /sitemap_status_500/);
});
