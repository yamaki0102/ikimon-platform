import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";
import { listMarketingPages } from "../siteMap.js";

test("field loop page ja renders the reader-facing definition without external platform names", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/learn/field-loop?lang=ja",
    });

    assert.equal(response.statusCode, 200);
    const body = response.body;
    assert.match(body, /フィールドループとは/);
    assert.match(body, /粗い衛星/);
    assert.match(body, /知の基盤/);
    assert.match(body, /循環/);
    assert.match(body, /市民の一致/);
    assert.doesNotMatch(body, /iNaturalist/i);
    assert.doesNotMatch(body, /いきものログ/);
    assert.doesNotMatch(body, /eBird/i);
    assert.doesNotMatch(body, /Pl@ntNet/i);
    assert.doesNotMatch(body, /このページについて/);
    assert.doesNotMatch(body, /このページの前提/);
    assert.doesNotMatch(body, /市民同定は価値があるが/);
    assert.ok((body.match(/https:\/\/doi\.org\//g) ?? []).length >= 10);
  } finally {
    await app.close();
  }
});

test("about page sends readers to the learn hub", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/about?lang=ja",
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.body, /使い方を見る/);
    assert.match(response.body, /研究と信頼性を見る/);
    assert.match(response.body, /\/learn\/methodology/);
  } finally {
    await app.close();
  }
});

test("learn index frames the service in plain language", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/learn?lang=ja",
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.body, /まず読むページ/);
    assert.match(response.body, /研究・データ・信頼性について/);
    assert.match(response.body, /更新を見る/);
  } finally {
    await app.close();
  }
});

test("legacy public explainer routes redirect to their canonical destinations", async () => {
  const app = buildApp();
  try {
    const scan = await app.inject({ method: "GET", url: "/scan?lang=ja" });
    assert.equal(scan.statusCode, 308);
    assert.equal(scan.headers.location, "/ja/map");

    const authority = await app.inject({ method: "GET", url: "/learn/authority-policy?lang=ja" });
    assert.equal(authority.statusCode, 308);
    assert.equal(authority.headers.location, "/ja/learn/methodology");
  } finally {
    await app.close();
  }
});

test("language-prefixed marketing pages enforce the localized fallback gate", async () => {
  const app = buildApp();
  try {
    const localized = await app.inject({
      method: "GET",
      url: "/en/community",
      headers: { accept: "text/html" },
    });
    assert.equal(localized.statusCode, 200);
    assert.match(localized.body, /<html lang="en"/);
    assert.match(localized.body, /rel="canonical" href="https:\/\/ikimon\.life\/en\/community"/);

    const missing = await app.inject({
      method: "GET",
      url: "/en/about",
      headers: { accept: "text/html" },
    });
    assert.equal(missing.statusCode, 302);
    assert.equal(missing.headers.location, "/en/");

    const legacyFallback = await app.inject({
      method: "GET",
      url: "/about?lang=en",
      headers: { accept: "text/html" },
    });
    assert.equal(legacyFallback.statusCode, 200);
    assert.match(legacyFallback.body, /name="robots" content="noindex,follow"/);
    assert.match(legacyFallback.body, /rel="canonical" href="https:\/\/ikimon\.life\/ja\/about"/);
  } finally {
    await app.close();
  }
});

test("learn methodology carries the merged trust and research framing", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/learn/methodology?lang=ja" });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /同定の信頼レーン/);
    assert.match(response.body, /quick capture と survey の違い/);
    assert.match(response.body, /言いすぎないための線引き/);
    assert.match(response.body, /分類についての合意/);
    assert.match(response.body, /反対意見が出たとき/);
    assert.match(response.body, /Tier 3\+/);
    assert.match(response.body, /研究用 API \/ DwC-A の標準公開対象/);
    assert.match(response.body, /市民記録を、分類合意・反対意見・専門確認まで追跡できる地域生物データ基盤/);
    assert.match(response.body, /1 枚の写真に複数の生物が写っている場合/);
    assert.match(response.body, /open dispute が 1 件でもある record は、Tier 3 へ昇格しません/);
    assert.match(response.body, /\/observations\/:id#identify/);
  } finally {
    await app.close();
  }
});

test("for researcher apply states the Tier 3 boundary and dispute exclusions", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/for-researcher/apply?lang=ja" });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /Evidence Tier 3\+/);
    assert.match(response.body, /open dispute/);
    assert.match(response.body, /sampling effort/);
    assert.match(response.body, /分類系列上の合意点/);
  } finally {
    await app.close();
  }
});

test("field loop keeps a minimal english fallback", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/learn/field-loop?lang=en",
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.body, /Why ikimon takes this shape/);
    assert.match(response.body, /place-first observatory/);
  } finally {
    await app.close();
  }
});

test("marketing pages are registered from the canonical sitemap registry", async () => {
  const app = buildApp();
  try {
    const marketingPages = listMarketingPages();
    assert.ok(marketingPages.length >= 18);
    for (const page of marketingPages) {
      const response = await app.inject({
        method: "GET",
        url: `${page.path}?lang=ja`,
        headers: { accept: "text/html" },
      });
      assert.equal(response.statusCode, 200, `${page.path} should render from registry`);
      assert.match(response.body, /site-shell|<main/i, `${page.path} should use the shared shell`);
    }
  } finally {
    await app.close();
  }
});
