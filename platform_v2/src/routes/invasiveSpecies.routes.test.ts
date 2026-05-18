import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";
import { listInvasiveSpecies } from "../services/invasiveSpeciesCatalog.js";
import { buildXmlSitemap } from "../siteMap.js";

test("invasive species list renders all catalog records and featured links", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/learn/invasive-species?lang=ja" });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /外来種を見つけたときの安全メモ/);
    assert.match(response.body, /触らず、写真と場所を残す/);
    assert.match(response.body, /環境省 特定外来生物等一覧/);
    for (const item of listInvasiveSpecies()) {
      assert.match(response.body, new RegExp(item.vernacularName));
      assert.match(response.body, new RegExp(`/ja/learn/invasive-species/${item.slug}`));
    }
    assert.equal(listInvasiveSpecies().length, 26);
  } finally {
    await app.close();
  }
});

test("invasive species detail renders legal caution and source link", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/learn/invasive-species/coreopsis-lanceolata?lang=ja" });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /オオキンケイギク/);
    assert.match(response.body, /Coreopsis lanceolata/);
    assert.match(response.body, /生きた状態での運搬・栽培・譲渡/);
    assert.match(response.body, /触らず、運ばず/);
    assert.match(response.body, /出典を開く/);
    assert.match(response.body, /まずは国のルールと、地域の案内を見る/);
    assert.match(response.body, /国のルール/);
    assert.match(response.body, /地域の相談先/);
    assert.match(response.body, /関係ない団体へ勝手に送ることはありません/);
    assert.match(response.body, /届く可能性がある団体/);
    assert.match(response.body, /地域を入れると確認できます/);
    assert.match(response.body, /投稿地点で確認する/);
    assert.match(response.body, /data-inv-reporting-check/);
    assert.match(response.body, /\/api\/v1\/invasive-reporting\/recipients/);
    assert.match(response.body, /data-inv-partner-form/);
    assert.match(response.body, /\/api\/v1\/contact\/submit/);
    assert.match(response.body, /この内容で相談する/);
    assert.match(response.body, /対象地域、対象種、受け取りたい情報をこの場で送れます/);
    assert.doesNotMatch(response.body, /\/ja\/for-business\/invasive-reporting/);
  } finally {
    await app.close();
  }
});

test("nutria detail uses the species-level NIES source instead of the retired Env list URL", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/learn/invasive-species/myocastor-coypus?lang=ja" });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /ヌートリア/);
    assert.match(response.body, /https:\/\/www\.nies\.go\.jp\/biodiversity\/invasive\/DB\/detail\/10140\.html/);
    assert.doesNotMatch(response.body, /https:\/\/www\.env\.go\.jp\/nature\/intro\/4control\/list\.html/);
  } finally {
    await app.close();
  }
});

test("invasive reporting recipients API validates required species query", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/api/v1/invasive-reporting/recipients?invasiveStatus=iaspecified" });
    assert.equal(response.statusCode, 400);
    assert.match(response.body, /bad_request/);
  } finally {
    await app.close();
  }
});

test("unknown invasive species slug returns a friendly 404", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/learn/invasive-species/not-real?lang=ja" });
    assert.equal(response.statusCode, 404);
    assert.match(response.body, /外来種ページは見つかりません/);
    assert.match(response.body, /外来種一覧を見る/);
  } finally {
    await app.close();
  }
});

test("invasive species sitemap includes list and generated detail URLs", () => {
  const sitemap = buildXmlSitemap("https://ikimon.life", new Date("2026-05-16T00:00:00.000Z"));
  assert.match(sitemap, /https:\/\/ikimon\.life\/ja\/learn\/invasive-species/);
  assert.match(sitemap, /https:\/\/ikimon\.life\/ja\/learn\/invasive-species\/coreopsis-lanceolata/);
  assert.match(sitemap, /https:\/\/ikimon\.life\/ja\/learn\/invasive-species\/alternanthera-philoxeroides/);
  assert.match(sitemap, /https:\/\/ikimon\.life\/ja\/learn\/invasive-species\/solenopsis-invicta/);
  assert.match(sitemap, /https:\/\/ikimon\.life\/ja\/learn\/invasive-species\/myocastor-coypus/);
});
