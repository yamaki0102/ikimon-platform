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
    assert.match(body, /観察の流れ/);
    assert.match(body, /見つける、観察する、記録する、学ぶ、また歩く/);
    assert.match(body, /小さな発見を暮らしの中で続く自然記録に変えていきます/);
    assert.match(body, /循環/);
    assert.match(body, /言いすぎないために/);
    assert.doesNotMatch(body, /iNaturalist/i);
    assert.doesNotMatch(body, /いきものログ/);
    assert.doesNotMatch(body, /eBird/i);
    assert.doesNotMatch(body, /Pl@ntNet/i);
    assert.doesNotMatch(body, /このページについて/);
    assert.doesNotMatch(body, /このページの前提/);
    assert.doesNotMatch(body, /市民同定は価値があるが/);
    assert.doesNotMatch(body, /https:\/\/doi\.org\//);
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
    assert.match(response.body, /観察の始め方を見る/);
    assert.match(response.body, /記録の信頼性を見る/);
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
    assert.match(response.body, /読みもの索引/);
    assert.match(response.body, /class="learn-wiki/);
    assert.match(response.body, /class="learn-wiki-list/);
    assert.match(response.body, /はじめて使う/);
    assert.match(response.body, /記録を活かす/);
    assert.match(response.body, /生物多様性の基礎/);
    assert.match(response.body, /政策・企業活動と自然/);
    assert.match(response.body, /\/ja\/learn\/terms\/nature-connectedness/);
    assert.match(response.body, /\/ja\/learn\/biomonweek/);
    assert.match(response.body, /\/ja\/learn\/terms\/attention-restoration-theory/);
    assert.match(response.body, /記録・データ・信頼性について/);
    assert.match(response.body, /更新情報/);
    assert.doesNotMatch(response.body, /共同編集の Wiki/);
    assert.doesNotMatch(response.body, /用語のヒント/);
    assert.doesNotMatch(response.body, /class="hero-panel/);
    assert.doesNotMatch(response.body, /learn-hub-card/);
    assert.match(response.body, /class="doc-page-header"/);
    assert.match(response.body, /application\/ld\+json/);
  } finally {
    await app.close();
  }
});

test("learn index can switch UI language while keeping Japanese SEO canonical", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/en/learn",
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.body, /Reading index/);
    assert.match(response.body, /Start here/);
    assert.match(response.body, /Use records/);
    assert.match(response.body, /Find by term/);
    assert.match(response.body, /<meta name="robots" content="noindex,follow" \/>/);
    assert.match(response.body, /<link rel="canonical" href="https:\/\/ikimon\.life\/ja\/learn" \/>/);
    assert.match(response.body, /\/en\/learn\/field-loop/);
    assert.doesNotMatch(response.body, /読みもの索引/);
    assert.doesNotMatch(response.body, /用語から探す/);
    assert.doesNotMatch(response.body, /次に見るページ/);
  } finally {
    await app.close();
  }
});

test("glossary and term pages expose one-topic SEO pages", async () => {
  const app = buildApp();
  try {
    const glossary = await app.inject({ method: "GET", url: "/learn/glossary?lang=ja" });
    assert.equal(glossary.statusCode, 200);
    assert.match(glossary.body, /用語から探す/);
    assert.match(glossary.body, /\/ja\/learn\/terms\/biomonweek/);
    assert.match(glossary.body, /\/ja\/learn\/terms\/biodiversity-monitoring/);
    assert.match(glossary.body, /\/ja\/learn\/terms\/sampling-effort/);
    assert.match(glossary.body, /\/ja\/learn\/terms\/nature-connectedness/);
    assert.match(glossary.body, /\/ja\/learn\/terms\/environmental-dna/);
    assert.match(glossary.body, /\/ja\/learn\/terms\/ai-candidate/);
    assert.match(glossary.body, /\/ja\/learn\/terms\/open-dispute/);
    assert.match(glossary.body, /\/ja\/learn\/terms\/tnfd/);

    const connectedness = await app.inject({ method: "GET", url: "/learn/terms/nature-connectedness?lang=ja" });
    assert.equal(connectedness.statusCode, 200);
    assert.match(connectedness.body, /自然とのつながりとは/);
    assert.match(connectedness.body, /自然とのつながり尺度/);
    assert.match(connectedness.body, /application\/ld\+json/);
    assert.match(connectedness.body, /\/learn\/terms\/nature-connectedness/);

    const legacy = await app.inject({
      method: "GET",
      url: "/learn/article.php?category=06_wellbeing&slug=nature-connectedness&lang=ja",
    });
    assert.equal(legacy.statusCode, 308);
    assert.equal(legacy.headers.location, "/ja/learn/terms/nature-connectedness");

    const ednaLegacy = await app.inject({
      method: "GET",
      url: "/learn/article.php?category=07_technology&slug=edna-ai&lang=ja",
    });
    assert.equal(ednaLegacy.statusCode, 308);
    assert.equal(ednaLegacy.headers.location, "/ja/learn/terms/environmental-dna");

    const biomonweek = await app.inject({ method: "GET", url: "/learn/terms/biomonweek?lang=ja" });
    assert.equal(biomonweek.statusCode, 200);
    assert.match(biomonweek.body, /BioMonWeekとは/);
    assert.match(biomonweek.body, /2026年5月4日から8日/);
    assert.match(biomonweek.body, /欧州会議/);
    assert.match(biomonweek.body, /ikimon\.life の独自イベント名ではありません/);
    assert.match(biomonweek.body, /\/ja\/learn\/biomonweek/);
    assert.match(biomonweek.body, /\/learn\/terms\/biomonweek/);
    assert.doesNotMatch(biomonweek.body, /class="hero-panel/);

    const biomonweekGuide = await app.inject({ method: "GET", url: "/learn/biomonweek?lang=ja" });
    assert.equal(biomonweekGuide.statusCode, 200);
    assert.match(biomonweekGuide.body, /BioMonWeek 2026を、生物多様性モニタリングから読む/);
    assert.match(biomonweekGuide.body, /Biodiversa\+/);
    assert.match(biomonweekGuide.body, /これは BioMonWeek の公式見解ではなく/);

    const binmonweekAlias = await app.inject({ method: "GET", url: "/learn/terms/binmonweek?lang=ja" });
    assert.equal(binmonweekAlias.statusCode, 308);
    assert.equal(binmonweekAlias.headers.location, "/ja/learn/terms/biomonweek");
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

    const legacyLearning = await app.inject({
      method: "GET",
      url: "/learn/article.php?category=04_business-economy&slug=biodiversity-credits&lang=ja",
    });
    assert.equal(legacyLearning.statusCode, 308);
    assert.equal(legacyLearning.headers.location, "/ja/learn/terms/biodiversity-credits");
  } finally {
    await app.close();
  }
});

test("language-prefixed marketing pages stay usable while SEO remains Japanese", async () => {
  const app = buildApp();
  try {
    const localized = await app.inject({
      method: "GET",
      url: "/en/community",
      headers: { accept: "text/html" },
    });
    assert.equal(localized.statusCode, 200);
    assert.match(localized.body, /<html lang="en"/);
    assert.match(localized.body, /name="robots" content="noindex,follow"/);
    assert.match(localized.body, /rel="canonical" href="https:\/\/ikimon\.life\/ja\/community"/);
    assert.doesNotMatch(localized.body, /"@type":"Article"/);

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
    assert.match(response.body, /ふだんの記録としっかり記録の違い/);
    assert.match(response.body, /言いすぎないための線引き/);
    assert.match(response.body, /分類についての合意/);
    assert.match(response.body, /反対意見が出たとき/);
    assert.match(response.body, /Tier 3\+/);
    assert.match(response.body, /研究用 API \/ DwC-A の標準公開対象/);
    assert.match(response.body, /市民記録を、分類合意・反対意見・専門確認まで追跡できる地域生物データ基盤/);
    assert.match(response.body, /企業・自治体レポートで使うとき/);
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
    assert.match(response.body, /TNFD・30by30・ネイチャーポジティブ文脈/);
    assert.match(response.body, /観察データだけで、不在、増減、改善、因果関係を自動で証明することはしません/);
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
      assert.doesNotMatch(response.body, /name="robots" content="noindex,follow"/, `${page.path} should be indexable in ja`);
    }
  } finally {
    await app.close();
  }
});
