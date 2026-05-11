import assert from "node:assert/strict";
import test from "node:test";
import { getStrings } from "../i18n/index.js";
import type { LandingObservation, LandingSnapshot, LandingTopGuideItem } from "../services/readModels.js";
import { LANDING_TOP_STYLES, renderLandingTopSections } from "./landingTop.js";

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

const emptySnapshot: LandingSnapshot = {
  viewerUserId: null,
  stats: { observationCount: 0, speciesCount: 0, placeCount: 0 },
  feed: [],
  myFeed: [],
  myPlaces: [],
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
  assert.match(html, /prototype-topa/);
  assert.doesNotMatch(html, /今日のikimon\.life/);
  assert.match(html, /いま見えている自然/);
  assert.match(html, /みんなが残した写真、動画、ガイド、同定待ち/);
  assert.match(html, /記録する/);
  assert.match(html, /同定待ち/);
  assert.match(html, /地域マップ/);
  assert.match(html, /音の標本棚/);
  assert.match(html, /鳴き声と環境音を、楽しい記録から研究データへ。/);
  assert.match(html, /自然音だけを短く残す/);
  assert.match(html, /似た音を束ねて仕訳する/);
  assert.match(html, /AI候補を人が確かめる/);
  assert.match(html, /研究で読める形にする/);
  assert.match(html, /data-kpi-action="landing:sound:guide"/);
  assert.match(html, /みんなの発見/);
  assert.match(html, /写真と動画/);
  assert.doesNotMatch(html, /id="topa-video"/);
  assert.match(html, /ガイド/);
  assert.match(html, /スキャン/);
  assert.match(html, /最初の発見を残す/);
  assert.match(html, /写真や動画で始める/);
  assert.match(html, /名前が分からなくても大丈夫/);
  assert.match(html, /\/records\?view=needs_id/);
  assert.match(html, /data-kpi-action="landing:topA:primary:record"/);
  assert.match(html, /data-kpi-action="landing:topA:shelf:localMap"/);
});

test("landing top localizes the content-first shelves in English", () => {
  const html = renderTop(emptySnapshot, "en");

  assert.match(html, /Nature people are finding now/);
  assert.match(html, /Everyone&#39;s finds/);
  assert.match(html, /Photos and videos/);
  assert.match(html, /Found with guides/);
  assert.match(html, /Make the first find/);
  assert.match(html, /Start with media/);
  assert.match(html, /Names can come later/);
  assert.doesNotMatch(html, /いま見えている自然/);
  assert.doesNotMatch(html, /みんなの発見/);
});

test("landing top renders real observation photos and detail CTAs", () => {
  const html = renderTop(photoSnapshot);

  assert.doesNotMatch(html, /sample_/);
  assert.match(html, /<img src="\/thumb\/md\/real-observation\.jpg" alt="モンシロチョウ" loading="eager"/);
  assert.match(html, /\/observations\/visit-1/);
  assert.match(html, /data-kpi-action="landing:topA:shelf:today"/);
  assert.match(html, /data-kpi-action="landing:topA:shelf:needsId:all"/);
  assert.ok((html.match(/prototype-topa-card-grid/g) ?? []).length >= 5);
  assert.match(html, /写真と動画/);
  assert.match(html, /prototype-topa-evidence-badge/);
  assert.doesNotMatch(html, /新着投稿/);
  assert.doesNotMatch(html, /data-kpi-action="landing:library:identification"/);
});

test("landing top folds video items into the evidence shelf with visible video badges", () => {
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
    feed: [videoObservation, photoObservation],
    dailyDashboard: {
      ...photoSnapshot.dailyDashboard!,
      featuredObservation: photoSnapshot.dailyDashboard!.featuredObservation,
    },
  });

  assert.match(html, /写真と動画/);
  assert.doesNotMatch(html, /id="topa-video"/);
  assert.match(html, /<img src="\/thumb\/md\/video-thumb\.jpg" alt="鳴く鳥の記録"/);
  assert.match(html, /動画あり/);
});

test("landing top keeps video evidence in the evidence shelf even when multiple videos exist", () => {
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
    feed: [videoOne, videoTwo, photoObservation],
    dailyDashboard: {
      ...photoSnapshot.dailyDashboard!,
      featuredObservation: photoSnapshot.dailyDashboard!.featuredObservation,
    },
  });

  assert.match(html, /写真と動画/);
  assert.doesNotMatch(html, /id="topa-video"/);
  assert.match(html, /<img src="\/thumb\/md\/video-thumb-1\.jpg" alt="鳴く鳥の記録"/);
  assert.match(html, /<img src="\/thumb\/md\/video-thumb-2\.jpg" alt="歩く虫の記録"/);
  assert.ok((html.match(/動画あり/g) ?? []).length >= 2);
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

test("landing top A keeps revisit as a daily action while local map shelf stays visible", () => {
  const html = renderTop({
    ...photoSnapshot,
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
  assert.match(html, /地図から探す。/);
  assert.match(html, /landing:topA:primary:revisit/);
});

test("landing top has medium desktop width relief", () => {
  assert.match(LANDING_TOP_STYLES, /--ikimon-landing-effective-w: min\(var\(--ikimon-page-max\), calc\(var\(--ikimon-landing-available-w\) - max\(var\(--ikimon-page-inline\), 32px\)\)\);/);
  assert.match(LANDING_TOP_STYLES, /@media \(min-width: 1161px\) \{[\s\S]*\.shell\.shell-bleed\.prototype-shell \{[\s\S]*width: var\(--ikimon-landing-effective-w\);[\s\S]*margin-left: var\(--ikimon-shell-margin-left\);/);
  assert.match(LANDING_TOP_STYLES, /@media \(min-width: 1161px\) and \(max-width: 1380px\) \{[\s\S]*\.prototype-topa h1 \{[\s\S]*max-width: none;[\s\S]*white-space: normal;/);
  assert.match(LANDING_TOP_STYLES, /\.prototype-topa-card-grid,\s*\.prototype-topa-card-grid\.is-primary \{[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
});

test("landing top renders guide shelf items from guide records", () => {
  const html = renderTop({
    ...photoSnapshot,
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

  assert.match(html, /街路樹の若葉/);
  assert.match(html, /未検証候補/);
  assert.match(html, /対象ごとの記録にする/);
  assert.match(html, /href="\/ja\/guide\/outcomes"/);
  assert.match(html, /<img src="\/thumb\/md\/guide-frame\.jpg" alt="街路樹の若葉"/);
});

test("landing top labels the outcomes-linked guide shelf as personal", () => {
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

  assert.match(html, /自分のガイド成果/);
  assert.match(html, /MY GUIDE/);
  assert.match(html, /href="\/ja\/guide\/outcomes"/);
});

test("landing top guide cards link to promoted observations or photo recovery actions", () => {
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

  assert.match(html, /対象ごとの記録/);
  assert.match(html, /観察レコードを見る/);
  assert.match(html, /href="\/ja\/observations\/visit-guide-1\?occurrence=occ-visit-guide-1%3A0"/);
  assert.match(html, /写真を追加して記録する/);
  assert.match(html, /href="\/ja\/record\?source=guide&amp;guideRecordId=guide-record-photo"/);
});
