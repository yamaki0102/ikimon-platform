import assert from "node:assert/strict";
import test from "node:test";
import { getStrings } from "../i18n/index.js";
import type { LandingObservation, LandingSnapshot, LandingTopGuideItem } from "../services/readModels.js";
import { renderLandingTopSections } from "./landingTop.js";

function renderTop(snapshot: LandingSnapshot): string {
  const strings = getStrings("ja");
  return Object.values(renderLandingTopSections({
    basePath: "",
    lang: "ja",
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
      { kind: "needsId", href: "/explore", primaryText: null, secondaryText: null, metricValue: null },
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
      { kind: "needsId", href: "/explore", primaryText: "モンシロチョウ", secondaryText: "浜松市", metricValue: 2, observation: photoObservation },
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
  assert.match(html, /観察する/);
  assert.match(html, /同定する/);
  assert.match(html, /地域マップ/);
  assert.match(html, /今日の発見/);
  assert.match(html, /写真/);
  assert.match(html, /動画/);
  assert.match(html, /ガイド/);
  assert.match(html, /スキャン/);
  assert.match(html, /まだ公開できる観察がありません/);
  assert.match(html, /\/observations\?filter=needs_id/);
  assert.match(html, /data-kpi-action="landing:topA:primary:record"/);
  assert.match(html, /data-kpi-action="landing:topA:shelf:localMap"/);
});

test("landing top renders real observation photos and detail CTAs", () => {
  const html = renderTop(photoSnapshot);

  assert.doesNotMatch(html, /sample_/);
  assert.match(html, /<img src="\/thumb\/md\/real-observation\.jpg" alt="モンシロチョウ" loading="eager"/);
  assert.match(html, /\/observations\/visit-1/);
  assert.match(html, /data-kpi-action="landing:topA:shelf:today"/);
  assert.match(html, /data-kpi-action="landing:topA:shelf:needsId:all"/);
  assert.ok((html.match(/prototype-topa-card-grid/g) ?? []).length >= 6);
  assert.match(html, /動きのある記録を増やす/);
  assert.doesNotMatch(html, /新着投稿/);
  assert.doesNotMatch(html, /data-kpi-action="landing:library:identification"/);
});

test("landing top A renders local map shelf without making revisit the primary action", () => {
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
  assert.doesNotMatch(html, /landing:topA:primary:revisit/);
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
  assert.match(html, /ガイド記録/);
  assert.match(html, /ガイド成果を見る/);
  assert.match(html, /href="\/ja\/guide\/outcomes"/);
  assert.match(html, /<img src="\/thumb\/md\/guide-frame\.jpg" alt="街路樹の若葉"/);
});
