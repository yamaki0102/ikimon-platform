import assert from "node:assert/strict";
import test from "node:test";
import { getShortCopy, renderLongformPage } from "../content/index.js";
import { renderMarkdown } from "../content/markdown.js";
import { listSitePages, type SitePageDefinition } from "../siteMap.js";
import { buildLearnCatalog, learnHeadingsFromHtml } from "./catalog.js";
import { createLearnSearch } from "./search.js";

function page(overrides: Partial<SitePageDefinition> = {}): SitePageDefinition {
  return {
    path: "/learn/example",
    lane: "learn",
    layout: "reading",
    auth: "public",
    audience: "public",
    navVisibility: ["xml"],
    title: { ja: "記事タイトル", en: "Article" },
    summary: { ja: "記事の要約", en: "Summary" },
    marketing: { pageKey: "example" },
    ...overrides,
  };
}

const metadata = { title: "文書の題名 | ZUKAN", heading: "画面の見出し", lead: "補足の説明", bodyPageId: "example" };

test("catalogue covers every registered Japanese public learn longform, beyond the twenty-term introduction", () => {
  const registered = listSitePages().filter((entry) => entry.path === "/learn" || entry.path.startsWith("/learn/"));
  const expectedArticles = registered.filter((entry) => entry.path !== "/learn" && entry.marketing);
  const catalog = buildLearnCatalog();
  assert.deepEqual(catalog.map((entry) => entry.path), expectedArticles.map((entry) => entry.path));
  assert.equal(new Set(catalog.map((entry) => entry.path)).size, catalog.length);
  assert.ok(catalog.filter((entry) => entry.kind === "term").length > 20);
  assert.ok(catalog.some((entry) => entry.path === "/learn/updates"), "consumer-facing update longform remains included");
  assert.ok(catalog.some((entry) => entry.path === "/learn/glossary"), "existing glossary longform remains included");
  assert.deepEqual(registered.filter((entry) => !expectedArticles.includes(entry)).map((entry) => entry.path), [
    "/learn", "/learn/invasive-species",
  ], "hub and specialist catalogue are navigation surfaces, not registered marketing articles");
  assert.ok(!catalog.some((entry) => entry.path.startsWith("/learn/invasive-species/")), "specialist species details use their own catalogue, not marketing article registration");

  for (const entry of catalog) {
    const canonical = expectedArticles.find((candidate) => candidate.path === entry.path)!;
    const meta = getShortCopy<{ bodyPageId: string }>("ja", "public", `marketing.pages.${canonical.marketing!.pageKey}`);
    assert.ok(renderLongformPage("ja", meta.bodyPageId).trim(), `${entry.path} has a real Japanese body`);
    assert.equal(entry.title, canonical.title.ja);
    assert.equal(entry.summary, canonical.summary.ja);
    assert.ok(entry.headings.length > 0, `${entry.path} indexes body headings`);
  }
});

test("new entries flow from the existing route and content registrations without another inventory", () => {
  const articles = [page()];
  const content = new Map([
    ["example", "# 既存の記事\n\n## 既存の見出し"],
    ["new-article", "# 次の記事\n\n## 新しい登録だけにある言葉"],
  ]);
  const source = {
    pages: articles,
    readMetadata: (key: string) => ({ ...metadata, bodyPageId: key }),
    renderContent: (key: string) => content.has(key) ? renderMarkdown(content.get(key)!) : undefined,
  };
  assert.equal(buildLearnCatalog(source).length, 1);
  articles.push(page({ path: "/learn/new-article", marketing: { pageKey: "new-article" } }));
  const catalog = buildLearnCatalog(source);
  assert.equal(catalog.length, 2);
  assert.equal(createLearnSearch().search(catalog, { q: "新しい登録だけにある言葉", kind: "all" })[0]?.path, "/learn/new-article");
});

test("publication, route and content boundaries exclude private, legal, ops, non-Japanese and unavailable entries", () => {
  const excluded = [
    page({ path: "/learn" }),
    page({ path: "/learn/private", auth: "session" }),
    page({ path: "/learn/admin", auth: "admin" }),
    page({ path: "/learn/operator", audience: "operator" }),
    page({ path: "/learn/legal", lane: "trust" }),
    page({ path: "/learn/development", lane: "ops" }),
    page({ path: "/learn/not-for-indexing", navVisibility: ["qa"] }),
    page({ path: "/en/learn/english" }),
    page({ path: "/privacy", lane: "trust" }),
    page({ path: "/terms", lane: "trust" }),
    page({ path: "/admin/docs", lane: "ops" }),
    page({ path: "/learn/invasive-species", marketing: undefined, htmlMaterialization: "fastify" }),
    page({ path: "/learn/:article" }),
    page({ path: "/learn/../privacy" }),
    page({ path: "/learn/%2e%2e/privacy" }),
    page({ path: "/learn//ambiguous" }),
    page({ path: "/learn/article?private=1" }),
    page({ path: "/learn/article#section" }),
    page({ path: "//example.test/learn/article" }),
    page({ path: "https://example.test/learn/article" }),
    page({ path: "/learn/missing-meta", marketing: { pageKey: "missing" } }),
    page({ path: "/learn/missing-body", marketing: { pageKey: "missing-body" } }),
    page({ path: "/learn/read-error", marketing: { pageKey: "read-error" } }),
    page({ path: "/learn/empty-body", marketing: { pageKey: "empty" } }),
  ];
  const read = new Set<string>();
  const catalog = buildLearnCatalog({
    pages: [page(), ...excluded],
    readMetadata: (key) => {
      read.add(key);
      if (key === "missing") return undefined;
      return { ...metadata, bodyPageId: key };
    },
    renderContent: (key) => {
      if (key === "missing-body") return undefined;
      if (key === "read-error") throw new Error("content unavailable");
      if (key === "empty") return "  ";
      return "<h1>公開記事</h1><h2>見出し</h2>";
    },
  });
  assert.deepEqual(catalog.map((entry) => entry.path), ["/learn/example"]);
  assert.deepEqual([...read], ["example", "missing", "missing-body", "read-error", "empty"], "nonpublic routes are rejected before reading content");
});

test("duplicate route registrations create one stable result and broken registrations do not shadow a valid one", () => {
  const catalog = buildLearnCatalog({
    pages: [page({ marketing: { pageKey: "missing" } }), page(), page({ title: { ja: "重複", en: "Duplicate" } })],
    readMetadata: (key) => key === "missing" ? undefined : metadata,
    renderContent: () => "<h2>見出し</h2>",
  });
  assert.equal(catalog.length, 1);
  assert.equal(catalog[0]?.title, "記事タイトル");
});

test("headings are plain text from all rendered heading levels, not paragraph text or link destinations", () => {
  const html = renderMarkdown("# 最初の見出し\n\n## **強調**と[出典](https://example.test/hidden-url)\n\n### A & B\n\n#### <script>alert(1)</script>\n\n##### 環境DNA\n\n###### 末尾の見出し\n\n本文だけにある言葉");
  assert.deepEqual(learnHeadingsFromHtml(html), [
    "最初の見出し", "強調と出典", "A & B", "<script>alert(1)</script>", "環境DNA", "末尾の見出し",
  ]);
  assert.deepEqual(learnHeadingsFromHtml('<h2 id="named">同じ見出し</h2><h3>同じ見出し</h3><h4>&#x1F333; &#26408; &nbsp;木</h4>'), ["同じ見出し", "🌳 木 木"]);
});

test("different canonical document titles and leads remain searchable without handwritten keywords", () => {
  const catalog = buildLearnCatalog({ pages: [page()], readMetadata: () => metadata, renderContent: () => "<h2>本文にある見出し</h2>" });
  const search = createLearnSearch();
  for (const q of ["記事タイトル", "記事の要約", "文書の題名", "画面の見出し", "補足の説明", "本文にある見出し"]) {
    assert.equal(search.search(catalog, { q, kind: "all" }).length, 1, q);
  }
  assert.equal(search.search(catalog, { q: "example", kind: "all" }).length, 0, "routing identifiers are not search keywords");
});
