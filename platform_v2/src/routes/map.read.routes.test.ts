import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildApp } from "../app.js";

test("map route keeps share-state plumbing in the shell", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/map?lang=ja",
    });

    assert.equal(response.statusCode, 200);
    const html = response.body;
    assert.match(html, /id="me-share-state"/);
    assert.match(html, /MapExplorerStateHelpers/);
    assert.match(html, /MAP_STATE_KEYS = \[[^\]]*"cell"/);
    assert.match(html, /serializeSharedMapState/);
    assert.match(html, /source: 'map'/);
    assert.match(html, /id: 'map:state'/);
    assert.match(html, /class="me-map-cues"/);
    assert.match(html, /Enjoy Nature Map/);
    assert.match(html, />見つける</);
    assert.match(html, />行きたい場所</);
    assert.match(html, />役立っている</);
    assert.match(html, /写真カード = 最近の発見/);
    assert.match(html, /id="me-contribution-panel"/);
    assert.match(html, /場所ストーリー/);
    assert.match(html, /representativePhoto/);
    assert.match(html, /me-area-cover/);
    assert.match(html, /最近の発見から自動選定/);
    assert.match(html, /admin_curated/);
    assert.match(html, /community_curated/);
    assert.match(html, /auto_observation/);
    assert.match(html, /キミの記録が役立っていること/);
    assert.doesNotMatch(html, />記録のある場所</);
    assert.doesNotMatch(html, />発見の多さ</);
    assert.doesNotMatch(html, />記録が少ない場所</);
    assert.doesNotMatch(html, /class="me-map-command-deck"/);
    assert.match(html, /data-tab="frontier"/);
    assert.match(html, /name="me-basemap" value="esri"/);
    assert.match(html, /\.me-map-panel-selection \{\s*top: 148px;/);
    assert.match(html, /'repeatable', 0\.09/);
    assert.match(html, /data-api-area-follow="\/api\/v1\/me\/area-subscriptions"/);
    assert.match(html, /data-area-follow-button/);
    assert.match(html, /me-area-follow-btn/);
    assert.match(html, /observation-cell-bloom/);
    assert.match(html, /observation-centroids/);
    assert.match(html, /dominantTaxonGroup/);
  } finally {
    await app.close();
  }
});

test("record upload flow lets 60 second videos continue when browser duration metadata is unreadable", () => {
  const source = readFileSync(new URL("./read.ts", import.meta.url), "utf8");

  assert.match(source, /isVideoDurationReadError/);
  assert.match(source, /サーバー側の上限で確認します/);
  assert.match(source, /端末で秒数を読めませんでした。60秒以内の動画ならこのまま投稿できます。/);
});
