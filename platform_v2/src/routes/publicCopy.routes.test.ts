import assert from "node:assert/strict";
import test from "node:test";
import { JA_PUBLIC_INTERNAL_JARGON } from "../copy/jaPublic.js";
import { buildApp } from "../app.js";
import { renderHomePageHtml } from "./read.js";
import type { HomeSnapshot } from "../services/readModels.js";

async function withEnv(
  overrides: Record<string, string | undefined>,
  run: () => Promise<void>,
): Promise<void> {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    await run();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

const shallowJaRoutes = [
  "/?lang=ja",
  "/records?lang=ja",
  "/guide?lang=ja",
  "/lens?lang=ja",
  "/map?lang=ja",
  "/community?lang=ja",
  "/about?lang=ja",
  "/faq?lang=ja",
  "/contact?lang=ja",
];

test("shallow public ja routes avoid internal jargon", async () => {
  const app = buildApp();
  try {
    for (const url of shallowJaRoutes) {
      const response = await app.inject({ method: "GET", url, headers: { accept: "text/html" } });
      assert.equal(response.statusCode, 200, `${url} should render`);
      const visibleBody = response.body.replace(/href="[^"]+"/g, 'href=""');
      for (const jargon of JA_PUBLIC_INTERNAL_JARGON) {
        assert.doesNotMatch(visibleBody, new RegExp(jargon, "i"), `${url} should not include ${jargon}`);
      }
      assert.doesNotMatch(visibleBody, /AI が自動で(決め|確定)/, `${url} should keep AI as a hint`);
    }
  } finally {
    await app.close();
  }
});

test("general and group-help pages use the updated ja entry copy", async () => {
  const app = buildApp();
  try {
    const about = await app.inject({ method: "GET", url: "/about?lang=ja" });
    assert.equal(about.statusCode, 200);
    assert.match(about.body, /生きものを楽しむことから始める/);
    assert.match(about.body, /記録の信頼性を見る/);

    const business = await app.inject({ method: "GET", url: "/for-business?lang=ja" });
    assert.equal(business.statusCode, 200);
    assert.match(business.body, /楽しんで続く観察を、地域のアクションへ/);
    assert.match(business.body, /企業で活用する/);

    const businessDemo = await app.inject({ method: "GET", url: "/for-business/demo?lang=ja" });
    assert.equal(businessDemo.statusCode, 200);
    assert.doesNotMatch(businessDemo.body, /ops\/readiness/i);

    const businessStatus = await app.inject({ method: "GET", url: "/for-business/status?lang=ja" });
    assert.equal(businessStatus.statusCode, 200);
    assert.doesNotMatch(businessStatus.body, /readiness/i);
    assert.doesNotMatch(businessStatus.body, /rollback/i);
  } finally {
    await app.close();
  }
});

test("community route replaces the legacy event rail on the public shell", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/community?lang=ja" });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /小さな発見を、みんなで残す/);
    assert.match(response.body, /みんなで調べる/);

    const redirect = await app.inject({ method: "GET", url: "/events.php?lang=ja" });
    assert.equal(redirect.statusCode, 308);
    assert.equal(redirect.headers.location, "/ja/community");
  } finally {
    await app.close();
  }
});

test("updates page keeps the full release history on the v2 public shell", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/learn/updates?lang=ja" });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /バージョンの見方/);
    assert.match(response.body, /v0\.11\.7/);
    assert.match(response.body, /トップ、記録一覧、ガイド/);
    assert.match(response.body, /v0\.11\.6/);
    assert.match(response.body, /現地で記録し、観察会で場所を扱い/);
    assert.match(response.body, /v0\.11\.3/);
    assert.match(response.body, /観察会・音声記録・投稿の安全性/);
    assert.match(response.body, /AI考察 全面強化/);
    assert.match(response.body, /センサースキャン Perch v2/);
    assert.match(response.body, /プロトタイプ版スタート/);
    assert.match(response.body, /2025年11月1日/);

    const redirect = await app.inject({ method: "GET", url: "/updates.php?lang=ja" });
    assert.equal(redirect.statusCode, 308);
    assert.equal(redirect.headers.location, "/ja/learn/updates");
  } finally {
    await app.close();
  }
});

test("home hero uses the senior-friendly top A action surface", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/?lang=ja", headers: { accept: "text/html" } });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /Enjoy Life/);
    assert.match(response.body, /今日見つけた生きものを、名前が分からなくても残せる。/);
    assert.match(response.body, /散歩中でも旅先でも、写真・動画・音・場所・ひとこと/);
    assert.match(response.body, /記録する/);
    assert.match(response.body, /近くを見る/);
    assert.match(response.body, /名前を確かめる/);
    assert.match(response.body, /名前は後でいい/);
    assert.match(response.body, /マイページ/);
    assert.match(response.body, /みんなの発見/);
    assert.match(response.body, /写真/);
    assert.match(response.body, /動画/);
    assert.match(response.body, /ガイド/);
    assert.match(response.body, /同定待ち/);
    assert.match(response.body, /getElementById\("ikimon-topa-map-mini"\)/);
    assert.doesNotMatch(response.body, /今日は、どこを見に行く？/);
    assert.doesNotMatch(response.body, /見つける、確かめる、地図で見る。/);
    assert.doesNotMatch(response.body, /フィールドループ/);
    assert.doesNotMatch(response.body, /今日のikimon\.life/);
    assert.doesNotMatch(response.body, /信頼と安全/);
  } finally {
    await app.close();
  }
});

test("home page gives guests a clear first-record path", () => {
  const html = renderHomePageHtml("", "ja", {
    viewerUserId: null,
    recentObservations: [],
    myPlaces: [],
  } satisfies HomeSnapshot);

  assert.match(html, /data-testid="home-channel"/);
  assert.match(html, /記録する/);
  assert.match(html, /場所を探す/);
  assert.match(html, /写真と場所を残す/);
  assert.match(html, /最近の観察/);
  assert.match(html, /<link rel="canonical" href="https:\/\/ikimon\.life\/ja\/home" \/>/);
  assert.doesNotMatch(html, /前回より、少し見えるようになる/);
});

test("home page keeps the signed-in desktop dashboard compact", () => {
  const html = renderHomePageHtml("", "ja", {
    viewerUserId: "user-1",
    recentObservations: [],
    myPlaces: [],
  } satisfies HomeSnapshot);

  assert.match(html, /data-testid="home-channel"/);
  assert.match(html, /記録する/);
  assert.match(html, /前回を見る/);
  assert.match(html, /最近の観察/);
  assert.match(html, /\.home-grid \{ display: grid; grid-template-columns: repeat\(auto-fill, minmax\(230px, 1fr\)\);/);
  assert.doesNotMatch(html, /前回より、少し見えるようになる/);
  assert.doesNotMatch(html, /今日の作業台/);
});

test("records workbench unifies personal library and public observations", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/records?lang=ja", headers: { accept: "text/html" } });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /data-testid="records-workbench"/);
    assert.match(response.body, /記録を見る/);
    assert.match(response.body, /自分/);
    assert.match(response.body, /近く/);
    assert.match(response.body, /確認待ち/);
    assert.match(response.body, /動画\/ガイド/);
    assert.match(response.body, /場所/);
    assert.match(response.body, /data-library-search/);
    assert.match(response.body, /records-view-tabs/);
    assert.doesNotMatch(response.body, /data-testid="observations-index"/);
  } finally {
    await app.close();
  }
});

test("records workbench localizes the unified chrome in English", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/en/records", headers: { accept: "text/html" } });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /<html lang="en">/);
    assert.match(response.body, /Records/);
    assert.match(response.body, /Mine/);
    assert.match(response.body, /Nearby/);
    assert.match(response.body, /Needs ID/);
    assert.match(response.body, /Search by name or place/);
    assert.doesNotMatch(response.body, /記録を見る/);
    assert.doesNotMatch(response.body, /確認待ち/);
  } finally {
    await app.close();
  }
});

test("legacy list surfaces redirect into records while preserving intent", async () => {
  const app = buildApp();
  try {
    const redirect = await app.inject({ method: "GET", url: "/explore?q=tonbo&lang=ja", headers: { accept: "text/html" } });
    assert.equal(redirect.statusCode, 308);
    assert.equal(redirect.headers.location, "/ja/records?view=public&q=tonbo");

    const legacy = await app.inject({ method: "GET", url: "/zukan.php?lang=ja", headers: { accept: "text/html" } });
    assert.equal(legacy.statusCode, 308);
    assert.equal(legacy.headers.location, "/ja/records");

    const observations = await app.inject({ method: "GET", url: "/observations?filter=needs_id&lang=ja", headers: { accept: "text/html" } });
    assert.equal(observations.statusCode, 308);
    assert.equal(observations.headers.location, "/ja/records?view=needs_id");

    const notes = await app.inject({ method: "GET", url: "/notes?lang=ja", headers: { accept: "text/html" } });
    assert.equal(notes.statusCode, 308);
    assert.equal(notes.headers.location, "/ja/records?view=mine");
  } finally {
    await app.close();
  }
});

test("map page localizes the browser title in English", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/en/map", headers: { accept: "text/html" } });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /<html lang="en">/);
    assert.match(response.body, /<title>Life map \| ikimon\.life<\/title>/);
    assert.doesNotMatch(response.body, /<title>地域のいのちマップ \| ikimon\.life<\/title>/);
  } finally {
    await app.close();
  }
});

test("identification queue is a records workbench tab", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/records?view=needs_id&lang=ja", headers: { accept: "text/html" } });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /records-view-tabs/);
    assert.match(response.body, /確認待ち/);
    assert.match(response.body, /data-library-search/);
    assert.doesNotMatch(response.body, /class="hero-panel/);
  } finally {
    await app.close();
  }
});

test("records mine tab keeps source lanes and library controls", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/records?view=mine&lang=ja", headers: { accept: "text/html" } });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /記録を見る/);
    assert.match(response.body, /場所・気づきで探す/);
    assert.match(response.body, /写真/);
    assert.match(response.body, /動画/);
    assert.match(response.body, /ガイド/);
    assert.match(response.body, /スキャン/);
    assert.match(response.body, /data-testid="records-workbench"/);
    assert.doesNotMatch(response.body, /ノートを書く/);
    assert.doesNotMatch(response.body, /最初のノートを書く/);
    assert.doesNotMatch(response.body, /notes-brief-card/);
  } finally {
    await app.close();
  }
});

test("records mine tab frames personal history as an observation story", async () => {
  await withEnv(
    {
      ALLOW_QUERY_USER_ID: "1",
    },
    async () => {
      const app = buildApp();
      try {
        const response = await app.inject({
          method: "GET",
          url: "/records?view=mine&userId=story-user&lang=ja",
          headers: { accept: "text/html" },
        });
        assert.equal(response.statusCode, 200);
        assert.match(response.body, /自分の自然観察ストーリー/);
        assert.match(response.body, /最初の章を始める。/);
        assert.match(response.body, /data-kpi-action="records:story:first_record"/);
        assert.match(response.body, /data-kpi-funnel="landing_record"/);
        assert.match(response.body, /data-testid="records-workbench"/);
      } finally {
        await app.close();
      }
    },
  );
});

test("guide route connects live use to outcomes and the next record", async () => {
  const app = buildApp();
  try {
    const guide = await app.inject({ method: "GET", url: "/guide?lang=ja", headers: { accept: "text/html" } });
    assert.equal(guide.statusCode, 200);
    assert.match(guide.body, /ライブガイド/);
    assert.match(guide.body, /ガイド成果を見る/);
    assert.match(guide.body, /\/ja\/guide\/outcomes/);
    assert.match(guide.body, /写真・動画を記録する/);

    const outcomes = await app.inject({ method: "GET", url: "/guide/outcomes?lang=ja", headers: { accept: "text/html" } });
    assert.equal(outcomes.statusCode, 401);
    assert.match(outcomes.body, /ガイド成果を見るにはログインが必要です/);
    assert.match(outcomes.body, /redirect=%2Fguide%2Foutcomes/);
    assert.match(outcomes.body, /ログインして確認する/);
    assert.match(outcomes.body, /ガイドで足跡を残す/);

    const alias = await app.inject({ method: "GET", url: "/guide/results?lang=ja" });
    assert.equal(alias.statusCode, 308);
    assert.equal(alias.headers.location, "/guide/outcomes");
  } finally {
    await app.close();
  }
});

test("contact page renders content-backed form copy", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/contact?lang=ja" });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /カテゴリ/);
    assert.match(response.body, /送信する/);
    assert.match(response.body, /受付番号/);
  } finally {
    await app.close();
  }
});
