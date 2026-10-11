import assert from "node:assert/strict";
import test from "node:test";
import { appendLangToHref } from "../i18n.js";
import { listSitePages, localizedPageLangs, type SitePageDefinition } from "../siteMap.js";
import { buildLearnCatalog } from "./catalog.js";
import { listLearnMaterializationPaths } from "./materialization.js";

function article(overrides: Partial<SitePageDefinition> = {}): SitePageDefinition {
  return {
    path: "/learn/example",
    lane: "learn",
    layout: "reading",
    auth: "public",
    audience: "public",
    navVisibility: ["xml"],
    title: { ja: "登録した記事", en: "Registered article" },
    summary: { ja: "記事の要約", en: "Article summary" },
    marketing: { pageKey: "example" },
    ...overrides,
  };
}

const metadata = { title: "記事", heading: "見出し", lead: "説明", bodyPageId: "example" };
const hubPaths = () => listSitePages()
  .filter((page) => page.path === "/learn" && page.auth === "public")
  .flatMap((page) => localizedPageLangs(page).map((lang) => appendLangToHref(page.path, lang)));

test("Learn core delivery covers the canonical Japanese catalogue and existing localized hubs only", (t) => {
  const articles = buildLearnCatalog();
  const hubs = hubPaths();
  const paths = listLearnMaterializationPaths();

  assert.deepEqual(paths, [...hubs, ...articles.map((entry) => appendLangToHref(entry.path, "ja"))]);
  assert.deepEqual(hubs, ["/ja/learn", "/en/learn", "/es/learn", "/pt-br/learn"]);
  assert.equal(new Set(paths).size, paths.length);
  assert.equal(paths.length, articles.length + hubs.length);
  assert.equal(paths.some((path) => /\/(?:en|es|pt-br)\/learn\//u.test(path)), false);
  for (const excluded of ["/ja/privacy", "/ja/terms", "/ja/for-business/pricing", "/ja/learn/invasive-species"]) {
    assert.equal(paths.includes(excluded), false, `${excluded} stays outside this Learn delivery projection`);
  }
  t.diagnostic(`${articles.length} Japanese articles + ${hubs.length} existing localized hubs = ${paths.length} delivery paths`);
});

test("a new canonical registration enters Learn delivery without a second article list", () => {
  const pages = [article()];
  const content = new Map([
    ["example", "<h1>既存の記事</h1>"],
    ["new-article", "<h1>新しい記事</h1>"],
  ]);
  const source = {
    pages,
    readMetadata: (key: string) => ({ ...metadata, bodyPageId: key }),
    renderContent: (key: string) => content.get(key),
  };
  assert.deepEqual(listLearnMaterializationPaths(source), [...hubPaths(), "/ja/learn/example"]);

  const registered = article({ path: "/learn/new-article", marketing: { pageKey: "new-article" } });
  pages.push(registered, { ...registered });
  const paths = listLearnMaterializationPaths(source);
  assert.deepEqual(paths, [...hubPaths(), "/ja/learn/example", "/ja/learn/new-article"]);
  assert.equal(new Set(paths).size, paths.length, "repeated canonical registrations do not produce duplicate objects");
});

test("missing, private, noindex and non-article registrations never become Learn delivery objects", () => {
  const source = {
    pages: [
      article(),
      article({ path: "/learn/private", auth: "session" }),
      article({ path: "/learn/admin", auth: "admin" }),
      article({ path: "/learn/noindex", navVisibility: ["qa"] }),
      article({ path: "/learn/developer-notes", audience: "operator", lane: "ops" }),
      article({ path: "/privacy", lane: "trust" }),
      article({ path: "/for-business/example", lane: "business" }),
      article({ path: "/learn/invasive-species", marketing: undefined, htmlMaterialization: "fastify" }),
      article({ path: "/en/learn/example" }),
      article({ path: "/learn/missing-meta", marketing: { pageKey: "missing-meta" } }),
      article({ path: "/learn/missing-body", marketing: { pageKey: "missing-body" } }),
    ],
    readMetadata: (key: string) => key === "missing-meta" ? undefined : { ...metadata, bodyPageId: key },
    renderContent: (key: string) => key === "missing-body" ? undefined : "<h1>公開記事</h1>",
  };
  assert.deepEqual(listLearnMaterializationPaths(source), [...hubPaths(), "/ja/learn/example"]);
});
