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
    assert.match(html, /MAP_STATE_KEYS = \[[^\]]*"areas"/);
    assert.match(html, /serializeSharedMapState/);
    assert.match(html, /source: 'map'/);
    assert.match(html, /id: 'map:state'/);
    assert.match(html, /class="me-map-cues"/);
    assert.match(html, /\.me-enjoy-strip \{[\s\S]*?display: none;/);
    assert.match(html, /\.me-map-status \{[\s\S]*?bottom: 18px;/);
    assert.match(html, /me-detail-panel/);
    assert.match(html, /me-detail-actions/);
    assert.match(html, /me-bottom-sheet--detail/);
    assert.match(html, /id="me-bottom-grip"/);
    assert.match(html, /data-snap/);
    assert.match(html, /me-discovery-preview/);
    assert.match(html, /pickDiscoveryPreviewRecords/);
    assert.match(html, /Enjoy Nature Map/);
    assert.match(html, />最近の発見</);
    assert.match(html, />季節の気配</);
    assert.match(html, />エリア図鑑</);
    assert.match(html, />記録の余白</);
    assert.match(html, /写真カード = 最近の発見/);
    assert.match(html, /id="me-contribution-panel"/);
    assert.match(html, /\.me-side\[data-tab="results"\] \.me-contribution-panel \{ display: none; \}/);
    assert.match(html, /場所ストーリー/);
    assert.match(html, /me-detail-visit/);
    assert.match(html, /me-detail-recent/);
    assert.match(html, /me-detail-walk/);
    assert.match(html, /me-detail-panel-area/);
    assert.match(html, /renderAreaHero/);
    assert.match(html, /me-area-hero/);
    assert.match(html, /renderTransientAreaContent/);
    assert.match(html, /徒歩5分圏の発見/);
    assert.match(html, /nearbyRecordsForContext/);
    assert.match(html, /sortedDiscoveryPreviewCandidates/);
    assert.match(html, /seenGroups/);
    assert.match(html, /waterway-hints/);
    assert.match(html, /waterway-hint-line/);
    assert.match(html, /loadWaterwayHints/);
    assert.match(html, /representativePhoto/);
    assert.match(html, /me-area-cover/);
    assert.match(html, /最近の発見から自動選定/);
    assert.match(html, /observationGallery/);
    assert.match(html, /seasonalCoverage/);
    assert.match(html, /me-area-gallery/);
    assert.match(html, /me-area-story-tabs/);
    assert.match(html, /このエリアで観察されたもの/);
    assert.match(html, /今の季節/);
    assert.match(html, /代表種/);
    assert.match(html, /最近増えた/);
    assert.match(html, /未記録季節/);
    assert.match(html, /エリア図鑑を見る/);
    assert.match(html, /エリア種別/);
    assert.match(html, /自然共生サイト/);
    assert.match(html, /学校・キャンパス/);
    assert.match(html, /このエリアで観察会/);
    assert.match(html, /admin_curated/);
    assert.match(html, /community_curated/);
    assert.match(html, /auto_observation/);
    assert.doesNotMatch(html, />行きたい場所</);
    assert.doesNotMatch(html, />役立っている</);
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
  assert.match(source, /端末で秒数を読めませんでした。60秒以内の動画ならこのまま記録できます。/);
});
