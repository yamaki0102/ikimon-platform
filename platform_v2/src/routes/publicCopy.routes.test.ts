import assert from "node:assert/strict";
import test from "node:test";
import { JA_PUBLIC_INTERNAL_JARGON } from "../copy/jaPublic.js";
import { buildApp } from "../app.js";

const shallowJaRoutes = [
  "/?lang=ja",
  "/notes?lang=ja",
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

test("home hero and how-it-works copy match the canonical ja surface", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/?lang=ja", headers: { accept: "text/html" } });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /Enjoy Life/);
    assert.match(response.body, /生きものを楽しむ。/);
    assert.match(response.body, /地球のいのちを楽しむ。/);
    assert.match(response.body, /発見を楽しみ、地域の自然記録へ。/);
    assert.match(response.body, /地域のいのちを、地図で見る。/);
    assert.doesNotMatch(response.body, /フィールドループ/);
  } finally {
    await app.close();
  }
});

test("notes page is an observation library with separated source lanes", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/notes?lang=ja", headers: { accept: "text/html" } });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /観察ライブラリ/);
    assert.match(response.body, /自分の観察データ|公開されている観察データ/);
    assert.match(response.body, /名前・場所で探す/);
    assert.match(response.body, /写真/);
    assert.match(response.body, /動画/);
    assert.match(response.body, /ガイド/);
    assert.match(response.body, /スキャン/);
    assert.match(response.body, /場所アルバム/);
    assert.match(response.body, /近くの公開記録/);
    assert.match(response.body, /Experience loop/);
    assert.match(response.body, /記録して、読んで、成果を見て、また歩く。/);
    assert.match(response.body, /\/ja\/guide\/outcomes/);
    assert.match(response.body, /data-testid="notes-own"/);
    assert.match(response.body, /data-testid="notes-nearby"/);
    assert.doesNotMatch(response.body, /ノートを書く/);
    assert.doesNotMatch(response.body, /最初のノートを書く/);
    assert.doesNotMatch(response.body, /notes-brief-card/);
    assert.doesNotMatch(response.body, /今日読むページ/);
    assert.doesNotMatch(response.body, /学びのハイライト/);
    assert.doesNotMatch(response.body, /地域に残った手がかり/);
    assert.ok(
      response.body.indexOf("観察ライブラリ") < response.body.indexOf("近くの公開記録"),
      "library should appear before nearby public traces",
    );
  } finally {
    await app.close();
  }
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
