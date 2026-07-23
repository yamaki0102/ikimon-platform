import assert from "node:assert/strict";
import test from "node:test";
import { getStrings } from "../i18n/index.js";
import type { SiteLang } from "../i18n.js";
import type { LandingObservation, LandingSnapshot } from "../services/readModels.js";
import { LANDING_TOP_STYLES, renderLandingTopSections } from "./landingTop.js";

function observation(id: string, overrides: Partial<LandingObservation> = {}): LandingObservation {
  return {
    occurrenceId: `occ-${id}`,
    visitId: id,
    detailId: id,
    displayName: `record-${id}`,
    observedAt: "2026-07-19T08:30:00.000Z",
    observerName: "viewer",
    placeName: "private source place",
    municipality: "浜松市",
    publicLocation: { label: "浜松市", scope: "municipality", cellId: null, gridM: null, radiusM: null, centroidLat: null, centroidLng: null, displayMode: "area" },
    photoUrl: `/media/${id}.jpg`,
    identificationCount: 0,
    latitude: null,
    longitude: null,
    observerUserId: "other-user",
    observerAvatarUrl: null,
    entryType: "observation",
    publicFeedEligible: true,
    librarySourceKind: "photo",
    ...overrides,
  };
}

function snapshot(overrides: Partial<LandingSnapshot> = {}): LandingSnapshot {
  return {
    viewerUserId: null,
    stats: { observationCount: 0, speciesCount: 0, placeCount: 0 },
    feed: [], myFeed: [], myPlaces: [], nearbyFields: [], nearbyEvents: [], mapPreviewCells: [], ambient: [], habit: null, dailyDashboard: null,
    ...overrides,
  };
}

function render(lang: SiteLang, data: LandingSnapshot, isLoggedIn = Boolean(data.viewerUserId)): string {
  const strings = getStrings(lang);
  const result = renderLandingTopSections({ basePath: "", lang, copy: strings.landing, fieldLoop: strings.fieldLoop, snapshot: data, isLoggedIn });
  return `${result.heroHtml}${result.dailyDashboardHtml}`;
}

test("guest home has a dedicated value-first layout and one hero primary action", () => {
  const html = render("ja", snapshot({ feed: [observation("public-1")] }));
  assert.match(html, /data-home-contract="state-split-v1"/);
  assert.match(html, /data-home-auth-state="guest"/);
  assert.match(html, /記録から、場所の今が見えてくる/);
  assert.match(html, /地域に残っている記録/);
  assert.match(html, /正確な位置は公開しません/);
  assert.match(html, /ikimon-home-slot:guest-hero:start/);
  assert.match(html, /home-guest-hero-visual/);
  assert.match(html, /fetchpriority="high"/);
  assert.equal((html.match(/class="home-primary-button"/g) || []).length, 2, "one hero CTA plus a restrained final CTA/member hidden template");
  assert.doesNotMatch(html, /今日のおすすめ|人気ランキング|前回から続ける|同じ場所をもう一度/);
});

test("guest empty public state uses a route link and never invents cards", () => {
  const html = render("ja", snapshot());
  assert.match(html, /records\?view=public/);
  assert.doesNotMatch(html, /class="home-public-card"/);
  assert.doesNotMatch(html, /sample|placeholder\.jpg/);
});

test("member home shows latest own record, a distinct discovery, and other public records", () => {
  const latest = observation("mine-latest", { observerUserId: "viewer", displayName: "川沿いの夕景" });
  const discovery = observation("mine-discovery", { observerUserId: "viewer", aiCandidateName: "ツバメ", isAiCandidate: true });
  const nearby = observation("nearby-public", { observerUserId: "neighbor", displayName: "水辺の記録" });
  const html = render("ja", snapshot({ viewerUserId: "viewer", myFeed: [latest, discovery], feed: [latest, nearby] }), true);
  const member = html.match(/<div class="home-state-view is-member"[\s\S]*?<\/div><\/div>$/)?.[0] || html;
  assert.match(member, /気になったものを残してみよう/);
  assert.match(member, /最近の記録/);
  assert.match(member, /写真からわかったこと/);
  assert.match(member, /ツバメ かもしれません/);
  assert.match(member, /近くで残された記録/);
  assert.equal((member.match(/data-home-record-id="mine-latest"/g) || []).length, 1);
  assert.equal((member.match(/data-home-record-id="mine-discovery"/g) || []).length, 1);
  assert.equal((member.match(/data-home-record-id="nearby-public"/g) || []).length, 1);
  assert.doesNotMatch(member, /monitoring|モニタリング|継続調査|再訪/);
});

test("member discovery is integrated into latest card when there is no second record", () => {
  const latest = observation("mine-only", { observerUserId: "viewer", aiCandidateName: "ニホンアマガエル", isAiCandidate: true });
  const html = render("ja", snapshot({ viewerUserId: "viewer", myFeed: [latest] }), true);
  assert.match(html, /ニホンアマガエル かもしれません/);
  assert.doesNotMatch(html, /home-discovery-section/);
  assert.equal((html.match(/data-home-record-id="mine-only"/g) || []).length, 1);
});

test("member empty states stay compact and processing appears only for durable status", () => {
  const emptyHtml = render("ja", snapshot({ viewerUserId: "viewer" }), true);
  assert.doesNotMatch(emptyHtml, /home-recent-section|home-discovery-section|home-nearby-section/);
  assert.doesNotMatch(emptyHtml, /まだありません/);
  const processingHtml = render("ja", snapshot({ viewerUserId: "viewer", myFeed: [observation("processing", { observerUserId: "viewer", aiAssessmentStatus: "processing" })] }), true);
  assert.match(processingHtml, /写真からわかることを調べています/);
  const completedHtml = render("ja", snapshot({ viewerUserId: "viewer", myFeed: [observation("complete", { observerUserId: "viewer", aiAssessmentStatus: "completed" })] }), true);
  assert.doesNotMatch(completedHtml, /写真からわかることを調べています/);
});

test("photo, video, audio, memo, and multiple media use static accessible card states", () => {
  const items = [
    observation("photo"),
    observation("video", { librarySourceKind: "video", hasVideo: true }),
    observation("audio", { librarySourceKind: "audio", hasAudio: true, photoUrl: null }),
    observation("memo", { librarySourceKind: "note", photoUrl: null }),
    observation("multiple", { photoCount: 3, photoUrls: ["a", "b", "c"] }),
  ];
  const html = render("ja", snapshot({ feed: items }));
  assert.match(html, /is-video/);
  assert.match(html, /is-audio/);
  assert.match(html, /is-memo/);
  assert.match(html, />3 件のメディア</);
  assert.doesNotMatch(html, /<video|autoplay/);
  assert.match(html, /loading="eager"[\s\S]*loading="lazy"/);
});

test("public privacy stays fail-closed for blocked and blurred records", () => {
  const blocked = observation("blocked", { publicFeedEligible: false, displayName: "private record" });
  const blurred = observation("blurred", {
    displayName: "protected record",
    placeName: "exact private home",
    municipality: "exact municipality",
    observedAt: "2026-07-19T08:30:00.000Z",
    publicLocation: { label: "", scope: "blurred", cellId: null, gridM: null, radiusM: null, centroidLat: null, centroidLng: null, displayMode: "area" },
  });
  const html = render("ja", snapshot({ feed: [blocked, blurred] }));
  assert.doesNotMatch(html, /private record|exact private home|exact municipality|2026-07-19/);
  assert.match(html, /protected record/);
  assert.doesNotMatch(html, /latitude|longitude|geohash|cellId|centroid/);
});

for (const lang of ["ja", "en", "es", "pt-BR"] as const) {
  test(`${lang} home copy is localized and routes retain locale`, () => {
    const html = render(lang, snapshot({ feed: [observation(`public-${lang}`)] }));
    assert.match(html, new RegExp(`/${lang === "pt-BR" ? "pt-br" : lang}/record`));
    assert.doesNotMatch(html, /undefined|\[object Object\]/);
    assert.match(html, /data-home-view="guest"/);
  });
}

test("home CSS enforces mobile card sizing, touch targets, focus and reduced motion", () => {
  assert.match(LANDING_TOP_STYLES, /grid-auto-columns:min\(78vw,310px\)/);
  assert.match(LANDING_TOP_STYLES, /min-height:54px/);
  assert.match(LANDING_TOP_STYLES, /min-height:44px/);
  assert.match(LANDING_TOP_STYLES, /focus-visible/);
  assert.match(LANDING_TOP_STYLES, /prefers-reduced-motion/);
  assert.match(LANDING_TOP_STYLES, /@media\(max-width:359px\)/);
});
