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
    assert.match(html, /me-map-kicker">探索する/);
    assert.doesNotMatch(html, /class="me-map-cues"/);
    assert.match(html, /class="me-map-role-strip"/);
    assert.match(html, /近くを探索する/);
    assert.match(html, /記録・ガイド・散策候補を見ながら/);
    assert.match(html, /\.site-shell\.is-map-surface \.global-record-launcher \{\s*display: grid;/);
    assert.match(html, /\.me-map-status \{[\s\S]*?bottom: 18px;/);
    assert.match(html, /me-detail-panel/);
    assert.match(html, /me-detail-actions/);
    assert.match(html, /me-bottom-sheet--detail/);
    assert.match(html, /id="me-bottom-grip"/);
    assert.match(html, /data-snap/);
    assert.match(html, /me-discovery-preview/);
    assert.match(html, /pickDiscoveryPreviewRecords/);
    assert.match(html, /<title>ZUKAN - 撮ると、まちの今が図鑑になる。<\/title>/);
    assert.match(html, /<meta name="description" content="近くの記録を、場所から見返す地図。"/);
    assert.doesNotMatch(html, /地域図鑑マップ/);
    assert.match(html, /aria-label="近くの記録"/);
    assert.match(html, /aria-label="季節"/);
    assert.match(html, /aria-label="現地ガイド"/);
    assert.match(html, /aria-label="記録の空白"/);
    assert.match(html, /aria-label="雨雲"/);
    assert.doesNotMatch(html, /class="me-tab me-tab-link"/);
    assert.doesNotMatch(html, /写真カード = 最近の発見/);
    assert.match(html, /\.me-map-role-strip/);
    assert.doesNotMatch(html, /\.me-map-cues/);
    assert.match(html, /id="me-contribution-panel"/);
    assert.match(html, /\.me-side\[data-tab="results"\] \.me-contribution-panel \{ display: none; \}/);
    assert.match(html, /この場所/);
    assert.doesNotMatch(html, /場所ストーリー/);
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
    assert.match(html, /renderAreaPositiveFeedback/);
    assert.match(html, /me-area-positive/);
    assert.match(html, /あなたの視点/);
    assert.doesNotMatch(html, /あなたのおかげで/);
    assert.match(html, /みんなの視点/);
    assert.match(html, /重なると見えること/);
    assert.match(html, /記録の手応え/);
    assert.match(html, /このエリアで観察されたもの/);
    assert.match(html, /今の季節/);
    assert.match(html, /代表種/);
    assert.match(html, /最近増えた/);
    assert.match(html, /未記録季節/);
    assert.match(html, /エリア図鑑を見る/);
    assert.match(html, /エリア種別/);
    assert.match(html, /自然共生サイト/);
    assert.match(html, /学校・キャンパス/);
    assert.match(html, /このエリアの活動・ラリー/);
    assert.match(html, /主催者の方へ/);
    assert.doesNotMatch(html, /\/community\/events\/new/);
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
    assert.match(html, /'repeatable', 0\.30/);
    assert.match(html, /'fill-outline-color': 'rgba\(15,118,110,0\.30\)'/);
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

test("map read route stays in its route lane module", () => {
  const readRoute = readFileSync(new URL("./read.ts", import.meta.url), "utf8");
  const mapReadRoute = readFileSync(new URL("./mapRead.ts", import.meta.url), "utf8");

  assert.match(readRoute, /registerMapReadRoutes\(app\)/);
  assert.doesNotMatch(readRoute, /app\.get\("\/map"/);
  assert.match(mapReadRoute, /app\.get\("\/map"/);
  assert.match(mapReadRoute, /renderMapExplorer/);
  assert.match(mapReadRoute, /mapExplorerBootScript/);
});

test("guide read routes stay in the guide route lane module", () => {
  const readRoute = readFileSync(new URL("./read.ts", import.meta.url), "utf8");
  const guideReadRoute = readFileSync(new URL("./guideRead.ts", import.meta.url), "utf8");

  assert.match(readRoute, /registerGuideReadRoutes\(app\)/);
  assert.doesNotMatch(readRoute, /app\.get\("\/guide"/);
  assert.doesNotMatch(readRoute, /app\.get\("\/my-guides"/);
  assert.doesNotMatch(readRoute, /app\.get\("\/guide-programs"/);
  assert.match(guideReadRoute, /export async function registerGuideReadRoutes/);
  assert.match(guideReadRoute, /app\.get\("\/guide"/);
  assert.match(guideReadRoute, /app\.get\("\/my-guides"/);
  assert.match(guideReadRoute, /app\.get\("\/guide-programs"/);
  assert.match(guideReadRoute, /app\.get<\{ Params: \{ slug: string \} \}>\("\/guide-programs\/:slug"/);
});

test("place station read route stays in its route lane module", () => {
  const readRoute = readFileSync(new URL("./read.ts", import.meta.url), "utf8");
  const placeStationReadRoute = readFileSync(new URL("./placeStationRead.ts", import.meta.url), "utf8");

  assert.match(readRoute, /registerPlaceStationReadRoutes\(app\)/);
  assert.doesNotMatch(readRoute, /app\.get<\{ Params: \{ placeId: string \} \}>\("\/places\/:placeId\/station"/);
  assert.doesNotMatch(readRoute, /renderFixedPointStationBody/);
  assert.match(placeStationReadRoute, /export async function registerPlaceStationReadRoutes/);
  assert.match(placeStationReadRoute, /app\.get<\{ Params: \{ placeId: string \} \}>\("\/places\/:placeId\/station"/);
  assert.match(placeStationReadRoute, /getFixedPointStation/);
  assert.match(placeStationReadRoute, /renderFixedPointStationBody/);
});

test("place station read route returns fixed point empty state from its lane", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/places/__missing_station__/station?lang=ja",
      headers: { accept: "text/html" },
    });

    assert.equal(response.statusCode, 404);
    assert.match(response.body, /<title>定点ページ \| ZUKAN<\/title>/);
    assert.match(response.body, /定点ページが見つかりません/);
    assert.match(response.body, /この場所の記録をまだ束ねられません/);
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

test("my guides page exposes unlocked guide replay and map return", () => {
  const source = readFileSync(new URL("./guideRead.ts", import.meta.url), "utf8");

  assert.match(source, /app\.get\("\/my-guides"/);
  assert.match(source, /listMyGuideUnlocks\(session\.userId\)/);
  assert.match(source, /解放した現地ガイド/);
  assert.match(source, /公開投稿や正確な位置共有を条件にしない/);
  assert.match(source, /data-my-guide-play/);
  assert.match(source, /\/api\/v1\/guides\/unlocks\/__GUIDE_SPOT_ID__\/listened/);
  assert.match(source, /\/guide-programs\/\$\{guide\.programSlug\}/);
});

test("guide relay program pages expose public detail and private progress", () => {
  const source = readFileSync(new URL("./guideRead.ts", import.meta.url), "utf8");
  const staticMapSource = readFileSync(new URL("../services/guideProgramStaticMap.ts", import.meta.url), "utf8");

  assert.match(source, /app\.get\("\/guide-programs"/);
  assert.match(source, /app\.get<\{ Params: \{ slug: string \} \}>\("\/guide-programs\/:slug"/);
  assert.match(source, /listPublishedGuideProgramsForPublic\(session\?\.userId \?\? null\)/);
  assert.match(source, /For participants/);
  assert.match(source, /近くで記録すると、現地ガイドが開く/);
  assert.match(source, /\/for-business\/field-programs/);
  assert.match(source, /getPublishedGuideProgramDetail\(request\.params\.slug, session\?\.userId \?\? null\)/);
  assert.match(source, /guide-program-progress/);
  assert.match(source, /renderProgramActionDeck/);
  assert.match(source, /参加者の次の行動/);
  assert.match(source, /地点を地図で確認/);
  assert.match(source, /あとからMy Guide/);
  assert.match(source, /renderGuideProgramMap/);
  assert.match(source, /buildGuideProgramStaticMapLayout/);
  assert.match(source, /guide-program-map-static/);
  assert.match(source, /data-guide-static-map="gsi-std"/);
  assert.match(source, /data-guide-static-tile="true"/);
  assert.match(staticMapSource, /cyberjapandata\.gsi\.go\.jp\/xyz\/std/);
  assert.match(staticMapSource, /guideProgramWorldPixel/);
  assert.doesNotMatch(source, /tile\.openstreetmap\.org/);
  assert.match(source, /isAdminOrAnalystRole/);
  assert.match(source, /運営recap/);
  assert.match(source, /\/admin\/guide-programs\/\$\{program\.programId\}\/recap/);
  assert.match(source, /ガイドの来訪地点/);
  assert.match(source, /実際の地図上に表示しています/);
  assert.match(source, /あなたの記録位置や解放地点は公開しません。/);
  assert.match(source, /国土地理院「地理院タイル（標準地図）」/);
  assert.match(source, /自由参加/);
  assert.match(source, /任意/);
  assert.match(source, /進捗は本人用です。正確な記録位置は公開しません。/);
});
