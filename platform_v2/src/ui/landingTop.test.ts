import assert from "node:assert/strict";
import test from "node:test";
import { getStrings } from "../i18n/index.js";
import type { LandingObservation, LandingSnapshot, LandingTopGuideItem } from "../services/readModels.js";
import { LANDING_TOP_STYLES, renderLandingTopSections } from "./landingTop.js";
import { RECORD_CARD_SIZING_TOKENS } from "./recordCardSizing.js";

function renderTop(snapshot: LandingSnapshot, lang: "ja" | "en" = "ja"): string {
  const strings = getStrings(lang);
  return Object.values(renderLandingTopSections({
    basePath: "",
    lang,
    copy: strings.landing,
    fieldLoop: strings.fieldLoop,
    snapshot,
    isLoggedIn: Boolean(snapshot.viewerUserId),
  })).join("\n");
}

function extractBetween(html: string, start: string, end: string): string {
  const startIndex = html.indexOf(start);
  if (startIndex === -1) {
    return "";
  }
  const endIndex = html.indexOf(end, startIndex);
  return endIndex === -1 ? html.slice(startIndex) : html.slice(startIndex, endIndex);
}

function extractContentWall(html: string): string {
  return extractBetween(html, '<section class="prototype-content-wall"', '<section class="prototype-monitoring-areas"');
}

const emptySnapshot: LandingSnapshot = {
  viewerUserId: null,
  stats: { observationCount: 0, speciesCount: 0, placeCount: 0 },
  feed: [],
  myFeed: [],
  myPlaces: [],
  nearbyFields: [],
  nearbyEvents: [],
  mapPreviewCells: [],
  ambient: [],
  habit: null,
  dailyDashboard: {
    dateKey: "2026-04-25",
    updatedAt: "2026-04-25T00:00:00.000Z",
    featuredObservation: null,
    dailyCards: [
      { kind: "recordToday", href: "/record", primaryText: null, secondaryText: null, metricValue: null },
      { kind: "revisitPlace", href: "/map", primaryText: null, secondaryText: null, metricValue: null },
      { kind: "nearbyPulse", href: "/map", primaryText: null, secondaryText: null, metricValue: null },
      { kind: "needsId", href: "/records?view=needs_id", primaryText: null, secondaryText: null, metricValue: null },
    ],
    seasonalStrip: [],
  },
};

const photoObservation: LandingObservation = {
  occurrenceId: "occ-1",
  visitId: "visit-1",
  displayName: "モンシロチョウ",
  observedAt: "2026-04-08T09:00:00.000Z",
  observerName: "テスト観察者",
  placeName: "浜松城公園 共生エリア",
  municipality: "浜松市",
  publicLocation: {
    label: "浜松市",
    scope: "municipality",
    cellId: "3000:1:2",
    gridM: 3000,
    radiusM: 2121,
    centroidLat: 34.71,
    centroidLng: 137.72,
    displayMode: "area",
  },
  photoUrl: "/uploads/real-observation.jpg",
  identificationCount: 2,
  latitude: 34.7116,
  longitude: 137.7274,
  observerUserId: "user-1",
  observerAvatarUrl: null,
  entryType: "observation",
};

const photoSnapshot: LandingSnapshot = {
  ...emptySnapshot,
  viewerUserId: "viewer-1",
  stats: { observationCount: 1, speciesCount: 1, placeCount: 1 },
  feed: [photoObservation],
  dailyDashboard: {
    dateKey: "2026-04-25",
    updatedAt: "2026-04-25T00:00:00.000Z",
    featuredObservation: {
      ...photoObservation,
      score: 84,
      reasonKey: "vividPhoto",
      scoreBreakdown: {
        season: 8,
        region: 9,
        photo: 20,
        evidence: 17,
        freshness: 18,
        dailyVariation: 12,
        total: 84,
      },
    },
    dailyCards: [
      { kind: "recordToday", href: "/record", primaryText: null, secondaryText: null, metricValue: 0 },
      { kind: "revisitPlace", href: "/map", primaryText: "浜松市", secondaryText: "モンシロチョウ", metricValue: 1 },
      { kind: "nearbyPulse", href: "/map", primaryText: "浜松市", secondaryText: null, metricValue: 1 },
      { kind: "needsId", href: "/records?view=needs_id", primaryText: "モンシロチョウ", secondaryText: "浜松市", metricValue: 2, observation: photoObservation },
    ],
    seasonalStrip: [{ observation: photoObservation, score: 84, reasonKey: "vividPhoto" }],
  },
};

const alternatePhotoObservation: LandingObservation = {
  ...photoObservation,
  occurrenceId: "occ-2",
  visitId: "visit-2",
  displayName: "ナナホシテントウ",
  photoUrl: "/uploads/alternate-observation.jpg",
  identificationCount: 0,
};

const guideItem: LandingTopGuideItem = {
  topItemType: "guide",
  guideRecordId: "guide-record-1",
  sessionId: "guide-session-1",
  displayName: "街路樹の若葉",
  summary: "ガイドが街路樹と草地の手がかりを残しました",
  observedAt: "2026-04-09T10:00:00.000Z",
  observerName: "ガイド利用者",
  observerUserId: "guide-user-1",
  observerAvatarUrl: null,
  placeName: "位置をぼかしています",
  municipality: null,
  publicLocation: {
    label: "位置をぼかしています",
    scope: "blurred",
    cellId: "3000:1:3",
    gridM: 3000,
    radiusM: 2121,
    centroidLat: 34.72,
    centroidLng: 137.73,
    displayMode: "area",
  },
  photoUrl: "/uploads/guide-frame.jpg",
  latitude: 34.72,
  longitude: 137.73,
  librarySourceKind: "guide",
  detectedSpecies: ["街路樹"],
  identificationCount: 0,
  isAiCandidate: false,
  href: "/guide/outcomes",
};

test("landing top empty state does not render sample images", () => {
  const html = renderTop(emptySnapshot);

  assert.doesNotMatch(html, /sample_/);
  assert.doesNotMatch(html, /\/uploads\/sample_/);
  assert.doesNotMatch(html, /prototype-topa" aria-labelledby="prototype-topa-heading"/);
  assert.doesNotMatch(html, /<h1 id="prototype-topa-heading">みんなで作る地域図鑑<\/h1>/);
  assert.doesNotMatch(html, /今日のikimon\.life/);
  assert.doesNotMatch(html, /今日見つけた生きものを、名前が分からなくても残せる。/);
  assert.doesNotMatch(html, /散歩中でも旅先でも、写真・動画・音・場所・ひとこと/);
  assert.doesNotMatch(html, /landing:topA:primary:record/);
  assert.doesNotMatch(html, /ぽち/);
  assert.doesNotMatch(html, /名前が分からなくても始められます。/);
  assert.match(html, /data-record-feed/);
  assert.match(html, /prototype-guest-home/);
  assert.match(html, /<h1 id="prototype-guest-home-heading">地域の記録から始める<\/h1>/);
  assert.match(html, /data-kpi-action="landing:guest_home:records">みんなの記録<\/a>/);
  assert.match(html, /data-kpi-action="landing:guest_home:map"/);
  assert.match(html, /data-kpi-action="landing:guest_home:fields"/);
  assert.match(html, /フィールドを探す/);
  assert.match(html, /prototype-record-feed[^"]*is-guest/);
  assert.match(html, /prototype-record-feed-card is-preview is-guest-preview/);
  assert.doesNotMatch(html, /prototype-record-feed-badges"><span>地域の記録<\/span>/);
  assert.doesNotMatch(html, /prototype-record-feed-badges"><span>季節の記録<\/span>/);
  assert.doesNotMatch(html, /prototype-record-feed-badges"><span>同じ地域<\/span>/);
  assert.doesNotMatch(html, /近くの記録/);
  assert.match(html, /prototype-record-feed-media-icons/);
  assert.doesNotMatch(html, /<h1>記録を見る<\/h1>/);
  assert.match(html, /みんなの記録/);
  assert.doesNotMatch(html, /ログイン/);
  assert.doesNotMatch(html, /data-kpi-action="landing:record_feed:weak_record"/);
  assert.doesNotMatch(html, /写真・動画/);
  assert.doesNotMatch(html, /写真、動画、音、短いメモ/);
  assert.doesNotMatch(html, /地域の記録を探す/);
  assert.doesNotMatch(html, /日常でいい/);
  assert.doesNotMatch(html, /分類は後でいい/);
  assert.doesNotMatch(html, /マップは道具/);
  assert.doesNotMatch(html, /prototype-topa-trust/);
  assert.doesNotMatch(html, /prototype-topa-metrics/);
  assert.doesNotMatch(html, /prototype-topa-actions/);
  assert.doesNotMatch(html, /aria-label="育つ観察エリア"/);
  assert.doesNotMatch(html, /地域マップ/);
  assert.doesNotMatch(html, /<section class="prototype-content-wall" aria-label="場所の記録">/);
  assert.doesNotMatch(html, /prototype-content-wall-heading/);
  assert.doesNotMatch(html, /WATCH/);
  assert.doesNotMatch(html, /すべて見る/);
  assert.doesNotMatch(html, /<h3>場所の今を残す記録<\/h3>/);
  assert.doesNotMatch(html, /まだ少ない場所ほど、次に見に行く楽しみがあります。/);
  assert.doesNotMatch(html, /この場所の余白を見つける/);
  assert.doesNotMatch(html, /記録がないことも、季節や場所を知る手がかりです。/);
  assert.doesNotMatch(html, /href="\/ja\/map" data-kpi-action="landing:content_wall:empty"/);
  assert.doesNotMatch(html, />近くを見る<\/em>/);
  assert.match(LANDING_TOP_STYLES, /\.prototype-content-empty \{\s+grid-column: 1 \/ -1;/);
  assert.doesNotMatch(html, /最初の投稿が入ると/);
  assert.doesNotMatch(html, /ここから地域の記録が育ちます/);
  assert.doesNotMatch(html, />PLACE MEMORY<\/span>/);
  assert.doesNotMatch(html, /<h3>自分の記録<\/h3>/);
  assert.doesNotMatch(html, /prototype-content-grid/);
  assert.doesNotMatch(html, /音の標本棚/);
  assert.doesNotMatch(html, /写真と動画/);
  assert.doesNotMatch(html, /みんなの発見/);
  assert.doesNotMatch(html, /data-kpi-action="landing:topA:primary:record"/);
  assert.doesNotMatch(html, /data-kpi-event="primary_cta_click"/);
  assert.doesNotMatch(html, /data-kpi-funnel="landing_record"/);
  assert.doesNotMatch(html, /data-kpi-action="landing:topA:shelf:localMap"/);
  assert.match(LANDING_TOP_STYLES, /\.prototype-record-feed\.is-guest \.prototype-record-feed-card\.is-guest-preview \.prototype-record-feed-media-wrap \{[\s\S]*height: clamp\(160px, 24vh, 220px\);[\s\S]*min-height: 160px;/);
  assert.match(LANDING_TOP_STYLES, /@media \(max-width: 720px\) \{[\s\S]*\.prototype-record-feed\.is-guest \.prototype-record-feed-card\.is-guest-preview \.prototype-record-feed-media-wrap \{ height: 180px; min-height: 180px; \}/);
  assert.match(LANDING_TOP_STYLES, /\.prototype-record-feed\.is-guest \{[\s\S]*width: min\(100%, 680px\);/);
  assert.match(LANDING_TOP_STYLES, /\.prototype-record-feed\.is-guest \.prototype-record-feed-media-wrap \{[\s\S]*height: clamp\(300px, 48vh, 460px\);[\s\S]*min-height: 300px;/);
  assert.match(LANDING_TOP_STYLES, /@media \(max-width: 720px\) \{[\s\S]*\.prototype-record-feed\.is-guest \.prototype-record-feed-media-wrap \{ height: 48vh; min-height: 320px; \}/);
});

test("guide outcome section groups full guide outcome pool instead of the shelf subset", () => {
  const hiddenGuide: LandingTopGuideItem = {
    ...guideItem,
    guideRecordId: "guide-record-hidden",
    sessionId: "guide-session-hidden",
    displayName: "水辺の草",
    summary: "水路と湿地のまわりで草のまとまりが見えた",
    detectedSpecies: ["水辺の草"],
    href: "/guide/outcomes?session=guide-session-hidden",
  };
  const html = renderTop({
    ...emptySnapshot,
    viewerUserId: "guide-user-1",
    guideOutcomes: [hiddenGuide],
    topShelves: [{
      kind: "guide",
      title: "ガイド",
      eyebrow: "GUIDE",
      href: "/guide/outcomes",
      items: [guideItem],
    }],
  });

  assert.match(html, /水辺の草が見えてきた|水辺の気配が見えてきた/);
  assert.doesNotMatch(html, /街路樹の若葉が見えてきた/);
});

test("guide outcome fallback links to the guide session outcome page", () => {
  const unsummarizedGuide: LandingTopGuideItem = {
    ...guideItem,
    guideRecordId: "guide-record-photo",
    sessionId: "home-guide-shelf-session",
    promotionAction: "add_photo",
    href: "/record?source=guide&guideRecordId=guide-record-photo",
  };
  const html = renderTop({
    ...emptySnapshot,
    viewerUserId: "guide-user-1",
    guideOutcomes: [unsummarizedGuide],
  });

  assert.match(html, /\/guide\/outcomes\?session=home-guide-shelf-session/);
  assert.doesNotMatch(html, /\/record\?source=guide&amp;guideRecordId=guide-record-photo/);
});

test("guide outcome section prefers public session summaries when available", () => {
  const html = renderTop({
    ...emptySnapshot,
    viewerUserId: "guide-user-1",
    guideOutcomeSummaries: [{
      sessionId: "guide-session-summary",
      observerName: "YAMAKI",
      observerAvatarUrl: null,
      recordCount: 12,
      headline: "身近な緑の重なりが見えてきた",
      body: "12シーンで、草地・樹木が同じ流れの中に残っています。",
      evidenceLine: "草地・樹木を、時刻と場所つきのまとまりとして残せました。",
      motivationLine: "草地や樹木の状態を、種名だけに寄せず残せました。",
      claimBoundary: "AIガイドの未検証サマリーです。増減・不在・保全効果は断言しません。",
      primaryTheme: "green",
      featuredSubjects: ["草地", "樹木"],
      publicLocationLabel: "浜松市",
      mediaThumbUrl: null,
      href: "/guide/outcomes?session=guide-session-summary",
    }],
    guideOutcomes: [guideItem],
  });

  assert.match(html, /身近な緑の重なりが見えてきた/);
  assert.match(html, /ガイドの記録/);
  assert.match(html, /YAMAKI/);
  assert.doesNotMatch(html, /街路樹の若葉が見えてきた/);
});

test("guide outcome section shows up to four public summaries", () => {
  const summaries = Array.from({ length: 5 }, (_, index) => ({
    sessionId: `guide-session-summary-${index}`,
    observerName: "YAMAKI",
    observerAvatarUrl: null,
    recordCount: 12,
    headline: `ガイド記録${index}`,
    body: `具体的な成果${index}`,
    evidenceLine: `確認できたもの${index}`,
    motivationLine: `記録の意味${index}`,
    claimBoundary: "AIガイドの未検証サマリーです。",
    primaryTheme: "green" as const,
    featuredSubjects: ["草地"],
    publicLocationLabel: "浜松市",
    mediaThumbUrl: null,
    href: `/guide/outcomes?session=guide-session-summary-${index}`,
  }));
  const html = renderTop({
    ...emptySnapshot,
    viewerUserId: "guide-user-1",
    guideOutcomeSummaries: summaries,
  });

  assert.equal((html.match(/data-kpi-action="landing:guide-outcomes:summary"/g) ?? []).length, 4);
  assert.match(html, /ガイド記録3/);
  assert.doesNotMatch(html, /ガイド記録4/);
});

test("landing top localizes the content-first shelves in English", () => {
  const html = renderTop(emptySnapshot, "en");

  assert.doesNotMatch(html, /Save what you found today/);
  assert.match(html, /data-record-feed/);
  assert.doesNotMatch(html, /<section class="prototype-content-wall" aria-label="Place records">/);
  assert.doesNotMatch(html, /WATCH/);
  assert.doesNotMatch(html, /<h3>Everyone&#39;s records<\/h3>/);
  assert.doesNotMatch(html, /Names can come later/);
  assert.doesNotMatch(html, /AI stays as a hint/);
  assert.doesNotMatch(html, /いま見えている自然/);
  assert.doesNotMatch(html, /みんなの発見/);
  assert.doesNotMatch(html, /Photos and videos/);
});

test("landing top states the nature capital OS goal without overclaiming", () => {
  const html = renderTop(photoSnapshot);

  assert.match(html, /NATURE CAPITAL OS/);
  assert.match(html, /自然資本を、地図で見て終わりにしない。/);
  assert.match(html, /管理行為/);
  assert.match(html, /効果検証/);
  assert.match(html, /data-kpi-action="landing:nature-os:business"/);
  assert.doesNotMatch(html, /TNFD準拠を証明|自然共生サイト認定を保証|保全効果を自動判定|Google Earth AIで確定/);
});

test("landing top renders real observation photos and detail CTAs", () => {
  const html = renderTop(photoSnapshot);

  assert.doesNotMatch(html, /sample_/);
  assert.match(html, /<img src="\/thumb\/md\/real-observation\.jpg" alt="モンシロチョウ" loading="eager"/);
  assert.match(html, /\/observations\/visit-1/);
  assert.match(html, /data-kpi-action="landing:content_wall:community"/);
  assert.match(html, /data-media-kind="photo"/);
  assert.match(html, /prototype-content-thumb is-media-photo/);
  assert.match(html, /prototype-content-icon is-image/);
  assert.match(html, /今日も記録が届いています。/);
  assert.match(html, /prototype-record-feed-media-icons/);
  assert.doesNotMatch(html, /prototype-content-icon is-globe/);
  assert.doesNotMatch(html, /prototype-content-icon is-user/);
  assert.doesNotMatch(html, /写真と動画/);
  assert.match(html, /<section class="prototype-content-wall" aria-label="場所の記録">/);
  assert.match(html, /prototype-content-card/);
  assert.doesNotMatch(html, /data-kpi-action="landing:library:identification"/);
});

test("landing top uses public registered area labels in card metadata", () => {
  const areaObservation: LandingObservation = {
    ...photoObservation,
    fieldRefs: [{
      fieldId: "field-1",
      name: "浜松城公園",
      source: "user_defined",
      adminLevel: "osm_park",
    }],
  };
  const html = renderTop({
    ...photoSnapshot,
    feed: [areaObservation],
    dailyDashboard: {
      ...photoSnapshot.dailyDashboard!,
      featuredObservation: {
        ...areaObservation,
        score: 84,
        reasonKey: "vividPhoto",
        scoreBreakdown: photoSnapshot.dailyDashboard!.featuredObservation!.scoreBreakdown,
      },
      seasonalStrip: [{ observation: areaObservation, score: 84, reasonKey: "vividPhoto" }],
    },
  });

  const contentWall = extractContentWall(html);
  assert.match(contentWall, /<span class="prototype-content-meta">\s*<small>浜松市<\/small><small>4月8日<\/small>/);
  assert.doesNotMatch(html, /浜松城公園 共生エリア/);
  assert.doesNotMatch(contentWall, /浜松城公園/);
});

test("landing top keeps observer identity out of public content cards", () => {
  const html = renderTop({
    ...photoSnapshot,
    feed: [{ ...photoObservation, observerAvatarUrl: "/uploads/avatar.jpg" }],
  });
  const contentWall = extractContentWall(html);

  assert.match(contentWall, /prototype-content-meta/);
  assert.match(contentWall, /prototype-content-reaction/);
  assert.doesNotMatch(contentWall, /prototype-content-author/);
  assert.doesNotMatch(contentWall, /prototype-content-avatar/);
  assert.doesNotMatch(contentWall, /テスト観察者/);
  assert.doesNotMatch(contentWall, /uploads\/avatar/);
});

test("landing top renders signed-in public posts as thumbnail content with a my-record chip", () => {
  const communityObservation: LandingObservation = {
    ...photoObservation,
    occurrenceId: "occ-community",
    visitId: "visit-community",
    displayName: "ナナホシテントウ",
    observerUserId: "user-2",
    observerName: "別の観察者",
    observerAvatarUrl: "/uploads/community-avatar.jpg",
    photoUrl: "/uploads/community.jpg",
  };
  const html = renderTop({
    ...photoSnapshot,
    viewerUserId: "user-1",
    myFeed: [{ ...photoObservation, observerAvatarUrl: "/uploads/my-avatar.jpg" }],
    feed: [{ ...photoObservation, observerAvatarUrl: "/uploads/my-avatar.jpg" }, communityObservation],
  });

  const contentWall = extractContentWall(html);
  assert.match(html, /<section class="prototype-content-wall" aria-label="場所の記録">/);
  assert.doesNotMatch(contentWall, /prototype-content-lanes is-split/);
  assert.doesNotMatch(contentWall, /prototype-content-lane is-mine/);
  assert.match(html, /prototype-content-lane is-community/);
  assert.match(html, /<h3>場所の今を残す記録<\/h3>/);
  assert.doesNotMatch(contentWall, /<h3>自分の記録<\/h3>/);
  assert.doesNotMatch(contentWall, />MY RECORDS<\/span>/);
  assert.match(html, />PLACE MEMORY<\/span>/);
  assert.match(html, /class="prototype-content-filter-chip is-my" href="\/ja\/records\?view=mine" data-media-filter="mine"/);
  assert.match(html, /class="prototype-content-lane-more" href="\/ja\/records\?view=public" aria-label="場所の今を残す記録をもっと見る"/);
  assert.doesNotMatch(html, /data-kpi-action="landing:content_wall:mine:more"/);
  assert.match(html, /data-kpi-action="landing:content_wall:community:more"/);
  assert.doesNotMatch(contentWall, /data-kpi-action="landing:content_wall:mine"/);
  assert.match(html, /data-kpi-action="landing:content_wall:community"/);
  assert.doesNotMatch(contentWall, /prototype-content-avatar/);
  assert.doesNotMatch(contentWall, /my-avatar/);
  assert.doesNotMatch(contentWall, /community-avatar/);
  assert.doesNotMatch(html, /prototype-content-icon is-user/);
  assert.doesNotMatch(html, /prototype-content-icon is-globe/);
  assert.doesNotMatch(contentWall, /モンシロチョウ/);
  assert.match(contentWall, /ナナホシテントウ/);
  assert.doesNotMatch(contentWall, /テスト観察者/);
  assert.doesNotMatch(contentWall, /別の観察者/);
  assert.match(contentWall, /<section class="prototype-content-lane is-community" aria-label="場所の今を残す記録">[\s\S]*?<small>浜松市<\/small><small>4月8日<\/small>/);
});

test("landing top keeps guide and scan outputs out of the photo-first content wall", () => {
  const scanObservation: LandingObservation = {
    ...photoObservation,
    occurrenceId: "occ-scan",
    visitId: "visit-scan",
    displayName: "スキャンだけの候補",
    photoUrl: "/uploads/scan-output.jpg",
    librarySourceKind: "scan",
  };
  const guideObservation: LandingObservation = {
    ...photoObservation,
    occurrenceId: "occ-guide",
    visitId: "visit-guide",
    displayName: "ガイドだけの候補",
    photoUrl: "/uploads/guide-output.jpg",
    librarySourceKind: "guide",
  };
  const html = renderTop({
    ...photoSnapshot,
    viewerUserId: "user-1",
    myFeed: [scanObservation, { ...photoObservation, observerAvatarUrl: "/uploads/my-avatar.jpg" }],
    feed: [guideObservation, { ...alternatePhotoObservation, observerUserId: "user-2" }],
  });

  const contentWall = extractContentWall(html);

  assert.match(contentWall, /ナナホシテントウ/);
  assert.doesNotMatch(contentWall, /スキャンだけの候補/);
  assert.doesNotMatch(contentWall, /ガイドだけの候補/);
  assert.doesNotMatch(contentWall, /scan-output/);
  assert.doesNotMatch(contentWall, /guide-output/);
});

test("landing top gives signed-in public posts two desktop rows and a my-record chip", () => {
  const makeObservation = (index: number, observerUserId: string): LandingObservation => ({
    ...photoObservation,
    occurrenceId: `occ-balanced-${observerUserId}-${index}`,
    visitId: `visit-balanced-${observerUserId}-${index}`,
    displayName: `投稿${index}`,
    observedAt: `2026-04-${String(20 - index).padStart(2, "0")}T09:00:00.000Z`,
    observerUserId,
    observerName: observerUserId === "user-1" ? "テスト観察者" : `みんな${index}`,
    photoUrl: `/uploads/balanced-${observerUserId}-${index}.jpg`,
  });
  const html = renderTop({
    ...photoSnapshot,
    viewerUserId: "user-1",
    myFeed: Array.from({ length: 14 }, (_, index) => makeObservation(index, "user-1")),
    feed: Array.from({ length: 12 }, (_, index) => makeObservation(index, `user-${index + 2}`)),
  });

  const contentWall = extractContentWall(html);
  assert.equal((contentWall.match(/data-kpi-action="landing:content_wall:mine"/g) ?? []).length, 0);
  assert.equal((html.match(/data-kpi-action="landing:content_wall:community"/g) ?? []).length, 12);
  assert.doesNotMatch(contentWall, /<section class="prototype-content-lane is-mine" aria-label="自分の記録">/);
  assert.match(html, /<section class="prototype-content-lane is-community" aria-label="場所の今を残す記録">[\s\S]*?<h3>場所の今を残す記録<\/h3>/);
  assert.doesNotMatch(html, /prototype-content-lane-title">[\s\S]*?<span>\d+<\/span>/);
  assert.match(html, /class="prototype-content-filter-chip is-my" href="\/ja\/records\?view=mine" data-media-filter="mine"/);
  assert.match(html, /href="\/ja\/records\?view=public"[^>]*>もっと見る<\/a>/);
});

test("landing top keeps guest community posts in the short record feed", () => {
  const makeObservation = (index: number): LandingObservation => ({
    ...photoObservation,
    occurrenceId: `occ-guest-balanced-${index}`,
    visitId: `visit-guest-balanced-${index}`,
    displayName: `みんなの投稿${index}`,
    observedAt: `2026-04-${String(20 - index).padStart(2, "0")}T09:00:00.000Z`,
    observerUserId: `user-${index + 1}`,
    observerName: `みんな${index}`,
    photoUrl: `/uploads/guest-balanced-${index}.jpg`,
  });
  const html = renderTop({
    ...photoSnapshot,
    viewerUserId: null,
    myFeed: [],
    feed: Array.from({ length: 18 }, (_, index) => makeObservation(index)),
  });

  assert.equal((html.match(/data-record-feed-card/g) ?? []).length, 12);
  assert.match(html, /data-record-feed/);
  assert.match(html, /prototype-record-feed[^"]*is-guest/);
  assert.doesNotMatch(html, /<h1>記録を見る<\/h1>/);
  assert.doesNotMatch(html, /prototype-content-wall/);
  assert.doesNotMatch(html, /みんなの投稿12/);
  assert.doesNotMatch(html, /もっと見る<\/a>/);
});

test("landing top surfaces available media states before photo overflow", () => {
  const makePhoto = (index: number): LandingObservation => ({
    ...photoObservation,
    occurrenceId: `occ-media-photo-${index}`,
    visitId: `visit-media-photo-${index}`,
    displayName: `写真の記録${index}`,
    observedAt: `2026-04-${String(24 - index).padStart(2, "0")}T09:00:00.000Z`,
    photoUrl: `/uploads/media-photo-${index}.jpg`,
    librarySourceKind: "photo",
  });
  const videoObservation: LandingObservation = {
    ...photoObservation,
    occurrenceId: "occ-media-video",
    visitId: "visit-media-video",
    displayName: "夕方の動き",
    photoUrl: null,
    mediaUrl: "/uploads/media-video.mp4",
    hasVideo: true,
    librarySourceKind: "video",
  };
  const audioObservation: LandingObservation = {
    ...photoObservation,
    occurrenceId: "occ-media-audio",
    visitId: "visit-media-audio",
    displayName: "水路の音",
    photoUrl: null,
    mediaUrl: null,
    hasAudio: true,
    librarySourceKind: "audio",
  };
  const memoObservation: LandingObservation = {
    ...photoObservation,
    occurrenceId: "occ-media-memo",
    visitId: "visit-media-memo",
    displayName: "朝の水路",
    photoUrl: null,
    mediaUrl: null,
    librarySourceKind: "note",
  };
  const html = renderTop({
    ...photoSnapshot,
    viewerUserId: null,
    feed: [
      ...Array.from({ length: 10 }, (_, index) => makePhoto(index)),
      audioObservation,
      memoObservation,
      videoObservation,
    ],
  });
  const cardKinds = Array.from(html.matchAll(/data-record-feed-card data-media-kind="([^"]+)"/g), (match) => match[1]);

  assert.equal(cardKinds.length, 12);
  assert.deepEqual(cardKinds.slice(0, 4), ["photo", "video", "audio", "memo"]);
  assert.doesNotMatch(html, /媒体の違い|音声あり|動画あり|メモあり/);
  assert.doesNotMatch(html, /prototype-record-feed-badges"><span>地域の記録<\/span>/);
  assert.doesNotMatch(html, /prototype-record-feed-badges"><span>季節の記録<\/span>/);
  assert.doesNotMatch(html, /prototype-record-feed-badges"><span>同じ地域<\/span>/);
});

test("landing top keeps signed-in fallback records public-first", () => {
  const ownObservation: LandingObservation = {
    ...photoObservation,
    occurrenceId: "occ-fallback-own",
    visitId: "visit-fallback-own",
    displayName: "自分のfallback記録",
    observerUserId: "user-1",
    observerName: "テスト観察者",
    photoUrl: "/uploads/fallback-own.jpg",
  };
  const communityObservation: LandingObservation = {
    ...photoObservation,
    occurrenceId: "occ-fallback-community",
    visitId: "visit-fallback-community",
    displayName: "みんなのfallback記録",
    observerUserId: "user-2",
    observerName: "別の観察者",
    photoUrl: "/uploads/fallback-community.jpg",
  };
  const html = renderTop({
    ...photoSnapshot,
    viewerUserId: "user-1",
    myFeed: [],
    feed: [ownObservation, communityObservation],
  });

  const contentWall = extractContentWall(html);
  assert.doesNotMatch(contentWall, /prototype-content-lanes is-split/);
  assert.doesNotMatch(contentWall, /<section class="prototype-content-lane is-mine" aria-label="自分の記録">/);
  assert.match(html, /class="prototype-content-filter-chip is-my" href="\/ja\/records\?view=mine" data-media-filter="mine"/);
  assert.doesNotMatch(contentWall, /自分のfallback記録/);
  assert.match(html, /<section class="prototype-content-lane is-community" aria-label="場所の今を残す記録">[\s\S]*?みんなのfallback記録/);
});

test("landing top does not show contentless own records in the signed-in public wall", () => {
  const contentlessOwnObservation: LandingObservation = {
    ...photoObservation,
    occurrenceId: "occ-contentless-own",
    visitId: "visit-contentless-own",
    displayName: "同定待ち",
    observerUserId: "user-1",
    observerName: "テスト観察者",
    photoUrl: null,
    photoUrls: [],
    photoCount: 0,
    placeName: "",
    municipality: null,
    publicLocation: {
      label: "",
      scope: "blurred",
      cellId: null,
      gridM: null,
      radiusM: null,
      centroidLat: null,
      centroidLng: null,
      displayMode: "area",
    },
    identificationCount: 0,
    librarySourceKind: "note",
  };
  const namedOwnObservation: LandingObservation = {
    ...contentlessOwnObservation,
    occurrenceId: "occ-named-own",
    visitId: "visit-named-own",
    displayName: "朝の水音メモ",
    observedAt: "2026-04-09T09:00:00.000Z",
  };

  const html = renderTop({
    ...photoSnapshot,
    viewerUserId: "user-1",
    myFeed: [contentlessOwnObservation, namedOwnObservation],
    feed: [],
  });

  const contentWall = extractContentWall(html);
  assert.match(html, /class="prototype-content-filter-chip is-my" href="\/ja\/records\?view=mine" data-media-filter="mine"/);
  assert.doesNotMatch(contentWall, /<section class="prototype-content-lane is-mine" aria-label="自分の記録">/);
  assert.doesNotMatch(contentWall, /朝の水音メモ/);
  assert.doesNotMatch(contentWall, /visit-contentless-own/);
  assert.doesNotMatch(contentWall, /occ-contentless-own/);
  assert.equal((contentWall.match(/data-kpi-action="landing:content_wall:mine"/g) ?? []).length, 0);
});

test("landing top groups multiple occurrences from the same visit into one content card", () => {
  const sameVisitSecondOccurrence: LandingObservation = {
    ...photoObservation,
    occurrenceId: "occ-1-second",
    displayName: "カタバミ",
    confidenceScore: 0.92,
  };
  const sameVisitThirdOccurrence: LandingObservation = {
    ...photoObservation,
    occurrenceId: "occ-1-third",
    displayName: "ツユクサ属",
    confidenceScore: 0.31,
  };
  const html = renderTop({
    ...photoSnapshot,
    feed: [{ ...photoObservation, confidenceScore: 0.64 }, sameVisitSecondOccurrence, sameVisitThirdOccurrence],
  });

  assert.equal((html.match(/prototype-content-card/g) ?? []).length, 1);
  assert.equal((html.match(/\/thumb\/md\/real-observation\.jpg/g) ?? []).length, 1);
  assert.match(html, /<strong>カタバミ<\/strong>/);
  assert.match(html, /class="prototype-content-subjects"[^>]*><span>モンシロチョウ<\/span><em>\+1<\/em><\/span>/);
  assert.doesNotMatch(html, /prototype-content-subject-stack/);
  assert.doesNotMatch(html, /aria-label="複数の観察レコード"/);
  assert.doesNotMatch(html, /複数観察/);
  assert.doesNotMatch(html, /prototype-content-record-count/);
  assert.doesNotMatch(html, /観察レコード2件/);
  assert.doesNotMatch(html, /<time>/);
});

test("landing top keeps signed-in continuation without making record the primary hero action", () => {
  const html = renderTop({
    ...photoSnapshot,
    viewerUserId: "user-1",
    myFeed: [photoObservation],
    myPlaces: [{
      placeId: "place-1",
      placeName: "浜松城公園",
      municipality: "浜松市",
      lastObservedAt: "2026-04-08T09:00:00.000Z",
      previousObservedAt: null,
      firstObservedAt: "2026-04-08T09:00:00.000Z",
      visitCount: 1,
      latestDisplayName: "モンシロチョウ",
      revisitReason: null,
      nextLookFor: null,
      lastRecordMode: null,
      lastSurveyResult: null,
      absenceSemantics: null,
      latitude: 34.7116,
      longitude: 137.7274,
    }],
    habit: {
      todayCount: 0,
      thisWeekCount: 2,
      activeDaysLast60: 4,
      daysSinceLast: 1,
      streak: 1,
    },
  });

  assert.doesNotMatch(html, /前回の自分から続ける/);
  assert.doesNotMatch(html, /直近の発見/);
  assert.match(html, /モンシロチョウ/);
  assert.match(html, /data-record-feed/);
  assert.match(html, /自分の記録/);
  assert.doesNotMatch(html, /前回の記録を見る/);
  assert.doesNotMatch(html, /同じ場所でもう1件/);
  assert.doesNotMatch(html, /landing:topA:primary:record/);
  assert.match(html, /class="prototype-content-filter-chip is-my" href="\/ja\/records\?view=mine" data-media-filter="mine"/);
  assert.doesNotMatch(extractContentWall(html), /data-kpi-action="landing:content_wall:mine"/);
});

test("landing top renders video items as icon-marked thumbnail content", () => {
  const videoObservation: LandingObservation = {
    ...photoObservation,
    occurrenceId: "occ-video",
    visitId: "visit-video",
    displayName: "鳴く鳥の記録",
    photoUrl: null,
    mediaUrl: "/uploads/video-thumb.jpg",
    hasVideo: true,
    librarySourceKind: "video",
  };
  const html = renderTop({
    ...photoSnapshot,
    viewerUserId: "viewer-1",
    feed: [videoObservation, photoObservation],
    dailyDashboard: {
      ...photoSnapshot.dailyDashboard!,
      featuredObservation: photoSnapshot.dailyDashboard!.featuredObservation,
    },
  });

  assert.match(html, /<img src="\/thumb\/md\/video-thumb\.jpg" alt="鳴く鳥の記録"/);
  assert.match(html, /data-media-kind="video"/);
  assert.match(html, /prototype-content-thumb is-media-video/);
  assert.match(html, /prototype-content-icon is-video/);
  assert.doesNotMatch(html, /動画あり/);
});

test("landing top gives audio and memo records distinct card states without visible explanations", () => {
  const audioObservation: LandingObservation = {
    ...photoObservation,
    occurrenceId: "occ-audio",
    visitId: "visit-audio",
    displayName: "水路の音",
    photoUrl: null,
    mediaUrl: null,
    hasAudio: true,
    librarySourceKind: "audio",
  };
  const memoObservation: LandingObservation = {
    ...photoObservation,
    occurrenceId: "occ-memo",
    visitId: "visit-memo",
    displayName: "朝の水路",
    photoUrl: null,
    mediaUrl: null,
    librarySourceKind: "note",
  };
  const html = renderTop({
    ...photoSnapshot,
    viewerUserId: "viewer-1",
    feed: [audioObservation, memoObservation],
    dailyDashboard: {
      ...photoSnapshot.dailyDashboard!,
      featuredObservation: photoSnapshot.dailyDashboard!.featuredObservation,
    },
  });

  assert.match(html, /data-media-kind="audio"/);
  assert.match(html, /data-media-kind="memo"/);
  assert.match(html, /prototype-content-thumb is-media-audio/);
  assert.match(html, /prototype-content-thumb is-media-memo/);
  assert.match(html, /prototype-content-icon is-audio/);
  assert.match(html, /prototype-content-icon is-memo/);
  assert.match(html, /aria-label="音"/);
  assert.match(html, /aria-label="短いメモ"/);
  assert.doesNotMatch(html, /音声あり|メモあり|説明を追加|媒体の違い/);
});

test("landing top keeps multiple video thumbnails in the content wall", () => {
  const videoOne: LandingObservation = {
    ...photoObservation,
    occurrenceId: "occ-video-1",
    visitId: "visit-video-1",
    displayName: "鳴く鳥の記録",
    photoUrl: null,
    mediaUrl: "/uploads/video-thumb-1.jpg",
    hasVideo: true,
    librarySourceKind: "video",
  };
  const videoTwo: LandingObservation = {
    ...videoOne,
    occurrenceId: "occ-video-2",
    visitId: "visit-video-2",
    displayName: "歩く虫の記録",
    mediaUrl: "/uploads/video-thumb-2.jpg",
  };
  const html = renderTop({
    ...photoSnapshot,
    viewerUserId: "viewer-1",
    feed: [videoOne, videoTwo, photoObservation],
    dailyDashboard: {
      ...photoSnapshot.dailyDashboard!,
      featuredObservation: photoSnapshot.dailyDashboard!.featuredObservation,
    },
  });

  assert.match(html, /<img src="\/thumb\/md\/video-thumb-1\.jpg" alt="鳴く鳥の記録"/);
  assert.match(html, /<img src="\/thumb\/md\/video-thumb-2\.jpg" alt="歩く虫の記録"/);
  assert.ok((html.match(/prototype-content-icon is-video/g) ?? []).length >= 2);
  assert.doesNotMatch(html, /動画あり/);
});

test("landing top does not render opaque overflow summary cards", () => {
  const html = renderTop({
    ...photoSnapshot,
    overflowSummaries: [{
      observerUserId: "user-1",
      observerName: "Nats",
      count: 83,
      latestObservedAt: photoObservation.observedAt,
      sampleObservation: photoObservation,
    }],
  });

  assert.doesNotMatch(html, /今日のまとめ/);
  assert.doesNotMatch(html, /トップでは個別カードを並べすぎず/);
});

test("landing top keeps local map shelf visible without turning the hero into action copy", () => {
  const html = renderTop({
    ...photoSnapshot,
    viewerUserId: "user-1",
    stats: { observationCount: 2, speciesCount: 2, placeCount: 1 },
    feed: [photoObservation, alternatePhotoObservation],
    dailyDashboard: {
      ...photoSnapshot.dailyDashboard!,
      featuredObservation: photoSnapshot.dailyDashboard!.featuredObservation,
      seasonalStrip: [
        { observation: photoObservation, score: 84, reasonKey: "vividPhoto" },
        { observation: alternatePhotoObservation, score: 72, reasonKey: "seasonal" },
      ],
    },
  });

  assert.match(html, /id="topa-local-map"/);
  assert.match(html, /<h2>育つ観察エリア<\/h2>/);
  assert.match(html, /MONITORING AREA/);
  assert.doesNotMatch(html, /BioMonWeek/);
  assert.match(html, /地図で見る/);
  assert.doesNotMatch(html, /地図から探す。/);
  assert.doesNotMatch(html, /landing:topA:primary:record/);
  assert.doesNotMatch(html, /landing:topA:primary:revisit/);
  assert.doesNotMatch(html, /prototype-topa-actions/);
  assert.match(html, /data-record-feed/);
  assert.match(html, /自分の記録/);
});

test("landing top surfaces active registered places before area map links", () => {
  const html = renderTop({
    ...photoSnapshot,
    viewerUserId: "user-1",
    nearbyFields: [{
      fieldId: "11111111-1111-4111-8111-111111111111",
      name: "佐鳴湖公園",
      source: "user_defined",
      adminLevel: "osm_park",
      city: "浜松市",
      prefecture: "静岡県",
      localityLabel: "浜松市西区",
      observationCount: 7,
      speciesCount: 4,
      observerCount: 2,
      latestDisplayName: "カワラヒワ",
      signatureDisplayName: "カワラヒワ",
      latestObservedAt: "2026-04-25T09:00:00.000Z",
      latestPhotoUrl: "/uploads/nearby-field.jpg",
    }],
  });

  assert.match(html, /prototype-monitoring-card is-feature is-field/);
  assert.match(html, /prototype-monitoring-thumb/);
  assert.match(html, /src="\/thumb\/md\/nearby-field\.jpg"/);
  assert.match(html, />公園<\/span>/);
  assert.match(html, /浜松市西区/);
  assert.match(html, /佐鳴湖公園/);
  assert.match(html, /カワラヒワなど4種を確認済み/);
  assert.match(html, /確認済みの種を基準に、次回の変化を見られます/);
  assert.doesNotMatch(html, /投稿で育っています/);
  assert.match(html, /7記録 ・ 4種 ・ 2人/);
  assert.match(html, /href="\/ja\/places\/11111111-1111-4111-8111-111111111111\/snapshot"/);
});

test("landing top adds local invasive watch and resilient empty nearby events", () => {
  const html = renderTop({
    ...photoSnapshot,
    viewerUserId: "user-1",
    nearbyFields: [{
      fieldId: "11111111-1111-4111-8111-111111111111",
      name: "佐鳴湖公園",
      source: "user_defined",
      adminLevel: "osm_park",
      city: "浜松市",
      prefecture: "静岡県",
      localityLabel: "浜松市中央区",
      observationCount: 7,
      speciesCount: 4,
      observerCount: 2,
      latestDisplayName: "カワラヒワ",
      signatureDisplayName: "カワラヒワ",
      latestObservedAt: "2026-04-25T09:00:00.000Z",
      latestPhotoUrl: "/uploads/nearby-field.jpg",
    }],
    nearbyEvents: [],
  });

  assert.match(html, /INVASIVE SIGNALS/);
  assert.match(html, /近くの外来種メモ/);
  assert.doesNotMatch(html, /近くで見つかりやすい対象/);
  assert.match(html, /ヒアリ/);
  assert.doesNotMatch(html, /ヒアリ・アカカミアリ/);
  assert.match(html, /オオキンケイギク/);
  assert.match(html, /ナガエツルノゲイトウ/);
  assert.match(html, /ヌートリア/);
  assert.doesNotMatch(html, /ガビチョウ/);
  assert.doesNotMatch(html, /カミツキガメ/);
  assert.doesNotMatch(html, /オオクチバス/);
  assert.doesNotMatch(html, /手がかり:/);
  assert.match(html, /道路脇・空き地の黄色い群落/);
  assert.match(html, /在来の野草の場所を奪う/);
  assert.match(html, /生きたまま運ばない/);
  assert.match(html, /水路・湿地に広がる草のマット/);
  assert.match(html, /水辺や農地へ切れ端から広がる/);
  assert.match(html, /切れ端を流さない/);
  assert.match(html, /刺される被害や定着リスク/);
  assert.match(html, /毒針がある。触らない/);
  assert.match(html, /農作物や希少植物を食べる/);
  assert.match(html, /許可なく捕獲しない/);
  assert.doesNotMatch(html, /カミツキガメ・ゴケグモ類/);
  assert.match(html, /prototype-invasive-thumb/);
  assert.match(html, /\/assets\/img\/invasive\/invasive-plant-thumb\.webp/);
  assert.match(html, /\/assets\/img\/invasive\/invasive-mammal-thumb\.webp/);
  assert.match(html, /fetchpriority="low"/);
  assert.match(html, /href="\/ja\/learn\/invasive-species"/);
  assert.match(html, /href="\/ja\/learn\/invasive-species\/coreopsis-lanceolata"/);
  assert.match(html, /href="\/ja\/learn\/invasive-species\/alternanthera-philoxeroides"/);
  assert.match(html, /href="\/ja\/learn\/invasive-species\/solenopsis-invicta"/);
  assert.match(html, /href="\/ja\/learn\/invasive-species\/myocastor-coypus"/);
  assert.match(html, /FIELD EVENTS/);
  assert.match(html, /近くの観察会/);
  assert.match(html, /近くの予定はまだありません/);
  assert.match(html, /href="\/ja\/community\/events"/);
});

test("landing top limits nearby event cards before rendering", () => {
  const html = renderTop({
    ...photoSnapshot,
    viewerUserId: "user-1",
    nearbyEvents: Array.from({ length: 5 }, (_, index) => ({
      sessionId: `session-${index}`,
      eventCode: `event-${index}`,
      title: `観察会 ${index}`,
      startedAt: `2026-05-${String(20 + index).padStart(2, "0")}T09:00:00.000Z`,
      endedAt: null,
      fieldId: "11111111-1111-4111-8111-111111111111",
      fieldName: "佐鳴湖公園",
      city: "浜松市",
      prefecture: "静岡県",
      participantCount: index,
    })),
  });

  assert.match(html, /観察会 0/);
  assert.match(html, /観察会 2/);
  assert.doesNotMatch(html, /観察会 3/);
});

test("landing top keeps nature symbiosis site labels and trims company prefixes", () => {
  const html = renderTop({
    ...photoSnapshot,
    viewerUserId: "user-1",
    nearbyFields: [{
      fieldId: "22222222-2222-4222-8222-222222222222",
      name: "愛管株式会社 連理の木の下で",
      source: "nature_symbiosis_site",
      adminLevel: "symbiosis",
      city: "浜松市",
      prefecture: "静岡県",
      localityLabel: "静岡県浜松市中央区",
      observationCount: 33,
      speciesCount: 27,
      observerCount: 3,
      latestDisplayName: "ノゲシ属",
      signatureDisplayName: "ノゲシ属",
      latestObservedAt: "2026-05-15T09:00:00.000Z",
      latestPhotoUrl: "/uploads/renri.jpg",
    }],
  });

  assert.match(html, />自然共生サイト<\/span>/);
  assert.match(html, /浜松市浜名区/);
  assert.doesNotMatch(html, /浜松市中央区/);
  assert.match(html, />連理の木の下で<\/strong>/);
  assert.doesNotMatch(html, /愛管株式会社 連理の木の下で/);
});

test("landing top hides municipality-only nearby place cards", () => {
  const html = renderTop({
    ...photoSnapshot,
    viewerUserId: "user-1",
    myPlaces: [{
      placeId: "place-1",
      placeName: "浜松市",
      municipality: "浜松市",
      lastObservedAt: "2026-04-25T09:00:00.000Z",
      previousObservedAt: null,
      firstObservedAt: "2026-04-01T09:00:00.000Z",
      visitCount: 8,
      latestDisplayName: "浜松市",
      revisitReason: null,
      nextLookFor: null,
      lastRecordMode: "manual",
      lastSurveyResult: null,
      absenceSemantics: null,
      latitude: 34.71,
      longitude: 137.72,
    }],
    nearbyFields: [],
  });

  assert.doesNotMatch(html, /prototype-monitoring-card/);
  assert.doesNotMatch(html, /<strong>浜松市<\/strong>/);
});

test("landing top has medium desktop width relief", () => {
  assert.match(LANDING_TOP_STYLES, /--ikimon-landing-effective-w: min\(var\(--ikimon-page-max\), calc\(var\(--ikimon-landing-available-w\) - max\(var\(--ikimon-page-inline\), 32px\)\)\);/);
  assert.match(LANDING_TOP_STYLES, /@media \(min-width: 1161px\) \{[\s\S]*\.shell\.shell-bleed\.prototype-shell \{[\s\S]*width: var\(--ikimon-landing-effective-w\);[\s\S]*margin-left: var\(--ikimon-shell-margin-left\);/);
  assert.match(LANDING_TOP_STYLES, /\.shell\.shell-bleed\.prototype-shell \{[\s\S]*padding-top: clamp\(34px, 3\.4vw, 48px\);/);
  assert.match(LANDING_TOP_STYLES, /@media \(min-width: 1161px\) and \(max-width: 1380px\) \{[\s\S]*\.shell\.shell-bleed\.prototype-shell \{[\s\S]*padding-top: clamp\(34px, 3vw, 44px\);/);
  assert.match(LANDING_TOP_STYLES, /@media \(max-width: 720px\) \{[\s\S]*\.shell\.shell-bleed\.prototype-shell \{ padding-top: 36px; \}/);
  assert.doesNotMatch(LANDING_TOP_STYLES, /\.prototype-topa h1/);
  assert.match(LANDING_TOP_STYLES, /\.prototype-topa-card-grid,\s*\.prototype-topa-card-grid\.is-primary \{[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(RECORD_CARD_SIZING_TOKENS, /--ikimon-record-card-grid-desktop: repeat\(6, minmax\(0, 1fr\)\);/);
  assert.match(RECORD_CARD_SIZING_TOKENS, /--ikimon-record-card-thumb-ratio: 4 \/ 5;/);
  assert.match(LANDING_TOP_STYLES, /@media \(min-width: 1161px\) \{[\s\S]*\.prototype-content-grid \{[\s\S]*grid-template-columns: var\(--ikimon-record-card-grid-desktop\);/);
  assert.match(LANDING_TOP_STYLES, /\.prototype-content-thumb \{[\s\S]*aspect-ratio: var\(--ikimon-record-card-thumb-ratio\);/);
  assert.match(LANDING_TOP_STYLES, /@media \(max-width: 480px\) \{[\s\S]*\.prototype-content-grid \{ grid-template-columns: var\(--ikimon-record-card-grid-mobile\); gap: var\(--ikimon-record-card-grid-gap-compact\);/);
});

test("landing top no longer renders separate guide shelf blocks", () => {
  const html = renderTop({
    ...photoSnapshot,
    viewerUserId: "viewer-1",
    topShelves: [
      {
        kind: "guide",
        title: "ガイド",
        eyebrow: "GUIDE",
        href: "/guide",
        items: [guideItem],
        cta: { title: "観察ガイドから歩く", body: "場所や季節に合わせた見どころをたどれます。", href: "/guide", actionLabel: "ガイドを見る" },
      },
    ],
  });

  assert.doesNotMatch(html, /未検証候補/);
  assert.doesNotMatch(html, /対象ごとの記録にする/);
  assert.doesNotMatch(html, /prototype-topa-shelf-guide/);
  assert.match(html, /GUIDE OUTCOMES/);
  assert.match(html, /ガイドの記録/);
  assert.match(html, /ガイド利用者 がガイドを使って/);
  assert.match(html, /街路樹の若葉が見えてきた/);
  assert.doesNotMatch(html, /達成したことだけを、言い過ぎずに/);
  assert.doesNotMatch(html, /次は/);
});

test("landing top hides personal guide shelf labels from the compact top", () => {
  const html = renderTop({
    ...photoSnapshot,
    topShelves: [
      {
        kind: "guide",
        title: "自分のガイド成果",
        eyebrow: "MY GUIDE",
        href: "/guide/outcomes",
        items: [guideItem],
      },
    ],
  });

  assert.doesNotMatch(html, /自分のガイド成果/);
  assert.doesNotMatch(html, /MY GUIDE/);
});

test("landing top avoids guide action copy in the compact content wall", () => {
  const promotedGuide: LandingTopGuideItem = {
    ...guideItem,
    promotedOccurrenceId: "occ-visit-guide-1:0",
    promotionAction: "view_observation",
    href: "/observations/visit-guide-1?occurrence=occ-visit-guide-1%3A0",
  };
  const photoRequiredGuide: LandingTopGuideItem = {
    ...guideItem,
    guideRecordId: "guide-record-photo",
    promotionAction: "add_photo",
    href: "/record?source=guide&guideRecordId=guide-record-photo",
  };
  const html = renderTop({
    ...photoSnapshot,
    topShelves: [{
      kind: "guide",
      title: "自分のガイド成果",
      eyebrow: "MY GUIDE",
      href: "/guide/outcomes",
      items: [promotedGuide, photoRequiredGuide],
    }],
  });

  assert.doesNotMatch(html, /対象ごとの記録/);
  assert.doesNotMatch(html, /観察レコードを見る/);
  assert.doesNotMatch(html, /写真を追加して記録する/);
});
