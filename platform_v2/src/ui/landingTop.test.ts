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
    publicFeedGateStatus: "public_eligible",
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

test("guest Top leads with an invited-member promise and concrete actions", () => {
  const html = render("ja", snapshot({ feed: [observation("public-1")] }));
  assert.match(html, /data-home-contract="state-split-v1"/);
  assert.match(html, /data-home-auth-state="guest"/);
  assert.match(html, /<span class="home-hero-phrase">招待された方へ。見つけたことを、<\/span><span class="home-hero-phrase">写真1枚から。<\/span>/);
  assert.match(html, /ZUKANは、写真や出来事を場所と一緒に残すサービスです。/);
  assert.match(html, /現在は、招待された方をご案内しています。/);
  assert.doesNotMatch(html, /何を残せるか|記録が育つ流れ|home-category-index|home-value-icon/);
  assert.match(html, /場所から見る/);
  assert.match(html, /href="\/ja\/community"/);
  assert.match(html, /みんなの活動を見る/);
  assert.match(html, /正確な位置は公開しません/);
  assert.match(html, /ikimon-home-slot:guest-hero:start/);
  assert.match(html, /home-guest-hero-visual/);
  assert.match(html, /fetchpriority="high"/);
  assert.match(html, /data-global-record-trigger="photo"/);
  assert.match(html, /data-kpi-event="top_place_tap"/);
  assert.ok((html.match(/\/media\/public-1\.jpg/g) || []).length >= 1);
  assert.match(html, /home-guest-proof is-count-1/);
  assert.doesNotMatch(html, /home-generated-badge|home-daily-place\.webp|home-community-hero\.webp|home-school-learning\.webp/);
  assert.doesNotMatch(html, /地方創生|ウェルビーイング|Place Intelligence OS|ENJOY NATURE/);
});

test("guest Top stays useful without public data and never invents record cards", () => {
  const html = render("ja", snapshot());
  assert.match(html, /map\?tab=places/);
  assert.match(html, /home-guest-hero-visual/);
  assert.match(html, /home-guest-proof is-count-0 is-empty/);
  assert.match(html, /<strong>公開できる記録は、まだありません。<\/strong>/);
  assert.match(html, /data-home-empty-illustration="true"/);
  assert.match(html, /\/assets\/img\/landing\/zukan-empty-illustration\.webp/);
  assert.match(html, /home-place-visual is-placeholder/);
  assert.match(html, /この絵は記録ではなく、表示例です。/);
  assert.doesNotMatch(html, /home-generated-badge|home-daily-place\.webp|home-community-hero\.webp|home-school-learning\.webp/);
  assert.doesNotMatch(html, /class="home-public-card"/);
  assert.doesNotMatch(html, /sample|placeholder\.jpg|0件|未記録|場所から見る<\/p>/);
});

test("guest empty visual is explicitly non-record content and keeps its copy readable", () => {
  const html = render("ja", snapshot());
  assert.match(html, /<div class="home-guest-proof is-count-0 is-empty"[^>]*data-home-empty-proof="true"/);
  assert.match(html, /<img[^>]+alt=""[^>]+data-home-empty-illustration="true"/);
  assert.match(html, /公開できる記録は、まだありません。/);
  assert.match(html, /この絵は記録ではなく、表示例です。/);
  assert.match(LANDING_TOP_STYLES, /\.home-empty-proof-copy\{display:grid;grid-template-columns:1fr/);
  assert.doesNotMatch(html, /data-home-public-record=/);
});

test("member Home shows only the viewer's recent records as its main record section", () => {
  const latest = observation("mine-latest", { observerUserId: "viewer", displayName: "川沿いの夕景" });
  const discovery = observation("mine-discovery", { observerUserId: "viewer", aiCandidateName: "ツバメ", isAiCandidate: true });
  const nearby = observation("nearby-public", { observerUserId: "neighbor", displayName: "水辺の記録" });
  const html = render("ja", snapshot({ viewerUserId: "viewer", myFeed: [latest, discovery], feed: [latest, nearby] }), true);
  const member = html.match(/<div class="home-state-view is-member"[\s\S]*?<\/div><\/div>$/)?.[0] || html;
  assert.match(member, /data-home-primary-state="recent_memory"/);
  assert.match(member, /川沿いの夕景/);
  assert.doesNotMatch(member, /今日は何を残しますか？/);
  assert.match(member, /最近の記録/);
  assert.equal((member.match(/data-home-record-id="mine-latest"/g) || []).length, 1);
  assert.equal((member.match(/data-home-record-id="mine-discovery"/g) || []).length, 1);
  assert.equal((member.match(/data-home-record-id="nearby-public"/g) || []).length, 0);
  assert.equal((member.match(/class="home-member-primary(?: |")/g) || []).length, 2);
  assert.doesNotMatch(member, /ツバメ かもしれません|近くで残された記録|monitoring|モニタリング/);
});

test("member Home keeps AI and internal processing labels out of recent cards", () => {
  const latest = observation("mine-only", { observerUserId: "viewer", aiCandidateName: "ニホンアマガエル", isAiCandidate: true });
  const html = render("ja", snapshot({ viewerUserId: "viewer", myFeed: [latest] }), true);
  assert.match(html, /data-home-record-id="mine-only"/);
  assert.doesNotMatch(html, /ニホンアマガエル かもしれません/);
  assert.doesNotMatch(html, /home-discovery-section/);
  assert.equal((html.match(/data-home-record-id="mine-only"/g) || []).length, 1);
});

test("member empty state stays compact and hides internal processing state", () => {
  const emptyHtml = render("ja", snapshot({ viewerUserId: "viewer" }), true);
  const member = emptyHtml.match(/<div class="home-state-view is-member"[\s\S]*?<\/div><\/div>$/)?.[0] || emptyHtml;
  assert.match(member, /最初の記録を残してみましょう/);
  assert.match(member, /data-home-primary-state="first_record"/);
  assert.equal((member.match(/data-global-record-trigger="photo"/g) || []).length, 1);
  assert.doesNotMatch(member, /home-recent-section|home-discovery-section|home-nearby-section|home-places-section|home-next-section/);
  assert.doesNotMatch(member, /まだありません|0件|未記録|名前待ち/);
  const processingHtml = render("ja", snapshot({ viewerUserId: "viewer", myFeed: [observation("processing", { observerUserId: "viewer", aiAssessmentStatus: "processing" })] }), true);
  assert.doesNotMatch(processingHtml, /写真からわかることを調べています/);
});

test("member Home exposes clear record, search, privacy, and collaboration paths", () => {
  const html = render("ja", snapshot({ viewerUserId: "viewer" }), true);
  const member = html.match(/<div class="home-state-view is-member"[\s\S]*?<\/div><\/div>$/)?.[0] || html;
  assert.match(member, /data-home-member-routes="record search privacy collaboration"/);
  assert.match(member, /href="\/ja\/record"[^>]*data-home-member-route="record"/);
  assert.match(member, /href="\/ja\/records\?view=mine"[^>]*data-home-member-route="search"/);
  assert.match(member, /href="\/ja\/profile\/settings"[^>]*data-home-member-route="privacy"/);
  assert.match(member, /href="\/ja\/community\/events"[^>]*data-home-member-route="collaboration"/);
  assert.match(member, /記録する/);
  assert.match(member, /自分の記録を探す/);
  assert.match(member, /公開範囲を確認/);
  assert.match(member, /観察会を見る/);
});

test("member recent records render photo, video, audio, memo, and multiple media accessibly", () => {
  const items = [
    observation("photo", { observerUserId: "viewer" }),
    observation("video", { observerUserId: "viewer", librarySourceKind: "video", hasVideo: true }),
    observation("audio", { observerUserId: "viewer", librarySourceKind: "audio", hasAudio: true, photoUrl: null }),
    observation("memo", { observerUserId: "viewer", librarySourceKind: "note", photoUrl: null }),
    observation("multiple", { observerUserId: "viewer", photoCount: 3, photoUrls: ["a", "b", "c"] }),
  ];
  const html = render("ja", snapshot({ viewerUserId: "viewer", myFeed: items }), true);
  assert.match(html, /is-video/);
  assert.match(html, /is-audio/);
  assert.match(html, /is-memo/);
  assert.match(html, />3 件のメディア</);
  assert.doesNotMatch(html, /<video|autoplay/);
  assert.match(html, /loading="eager"/);
});

test("guest Top media stays fail-closed for private, blocked, and blurred records", () => {
  const blocked = observation("blocked", {
    publicFeedEligible: false,
    publicFeedGateStatus: "blocked_public",
    displayName: "private record",
  });
  const blurred = observation("blurred", {
    displayName: "protected record",
    placeName: "exact private home",
    municipality: "exact municipality",
    observedAt: "2026-07-19T08:30:00.000Z",
    publicLocation: { label: "", scope: "blurred", cellId: null, gridM: null, radiusM: null, centroidLat: null, centroidLng: null, displayMode: "area" },
  });
  const html = render("ja", snapshot({ feed: [blocked, blurred] }));
  assert.doesNotMatch(html, /private record|exact private home|exact municipality|2026-07-19/);
  assert.doesNotMatch(html, /\/media\/blocked\.jpg|\/media\/blurred\.jpg/);
  assert.match(html, /home-guest-proof is-count-0 is-empty/);
  assert.doesNotMatch(html, /latitude|longitude|geohash|cellId|centroid/);
});

for (const count of [0, 1, 2, 3, 5] as const) {
  test(`guest proof renders the explicit ${count}-photo mosaic contract`, () => {
    const feed = Array.from({ length: count }, (_, index) => observation(`proof-${count}-${index + 1}`));
    const html = render("ja", snapshot({ feed }));
    assert.match(html, new RegExp(`home-guest-proof is-count-${count}(?: is-empty)?`));
    assert.equal((html.match(/data-home-public-record=/g) || []).length, count);
    assert.doesNotMatch(html, /home-generated-badge|home-daily-place\.webp|home-community-hero\.webp|home-school-learning\.webp/);
  });
}

test("guest proof does not expose metadata from an ineligible record", () => {
  const privateRecord = observation("private-proof", {
    publicFeedEligible: false,
    publicFeedGateStatus: "private",
    displayName: "private display name",
    municipality: "private municipality",
    publicLocation: {
      label: "private exact label",
      scope: "municipality",
      cellId: null,
      gridM: null,
      radiusM: null,
      centroidLat: null,
      centroidLng: null,
      displayMode: "area",
    },
  });
  const html = render("ja", snapshot({ feed: [privateRecord] }));
  assert.match(html, /home-guest-proof is-count-0 is-empty/);
  assert.doesNotMatch(html, /private display name|private municipality|private exact label|private-proof/);
});

for (const lang of ["ja", "en", "es", "pt-BR"] as const) {
  test(`${lang} home copy is localized and routes retain locale`, () => {
    const html = render(lang, snapshot({ feed: [observation(`public-${lang}`)] }));
    assert.match(html, new RegExp(`/${lang === "pt-BR" ? "pt-br" : lang}/map\\?tab=places`));
    assert.doesNotMatch(html, /undefined|\[object Object\]/);
    assert.match(html, /data-home-view="guest"/);
    assert.doesNotMatch(html, /<a[^>]+data-global-record-trigger="photo"/);
  });
}

test("home CSS enforces mobile card sizing, touch targets, focus and reduced motion", () => {
  assert.match(LANDING_TOP_STYLES, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(LANDING_TOP_STYLES, /min-height:52px/);
  assert.match(LANDING_TOP_STYLES, /min-height:44px/);
  assert.match(LANDING_TOP_STYLES, /focus-visible/);
  assert.match(LANDING_TOP_STYLES, /\.home-hero-phrase\{display:inline-block;max-width:100%\}/);
  assert.match(LANDING_TOP_STYLES, /word-break:auto-phrase/);
  assert.match(LANDING_TOP_STYLES, /prefers-reduced-motion/);
  assert.match(LANDING_TOP_STYLES, /@media\(max-width:359px\)/);
  assert.match(LANDING_TOP_STYLES, /\.home-guest-proof\.is-count-1 \.is-item-1\{grid-column:1\/13/);
  assert.match(LANDING_TOP_STYLES, /\.home-guest-proof\.is-count-2 \.is-item-2\{grid-column:7\/13/);
  assert.match(LANDING_TOP_STYLES, /\.home-guest-proof\.is-count-5 \.is-item-5\{grid-column:10\/13/);
});

test("guest Top explains the invited entry and starts with the shared camera action", () => {
  const html = render("ja", snapshot({ feed: [observation("public-1")] }));
  assert.match(html, /<span class="home-hero-phrase">招待された方へ。見つけたことを、<\/span><span class="home-hero-phrase">写真1枚から。<\/span>/);
  assert.match(html, /現在は、招待された方をご案内しています。/);
  assert.doesNotMatch(html, /学校・学び|地域・イベント|仕事・文化|暮らし・自然|home-category-index|home-value-icon/);
  assert.match(html, /home-community-section/);
  assert.match(html, /href="\/ja\/community"/);
  assert.doesNotMatch(html, /home-generated-badge|home-daily-place\.webp|home-community-hero\.webp|home-school-learning\.webp/);
  assert.doesNotMatch(html, /placeholder\.jpg|home-category-photo/);
  assert.match(html, /data-global-record-trigger="photo"/);
  assert.match(html, /data-kpi-event="top_place_tap"/);
  assert.doesNotMatch(html, /href="[^"]*\/record"[^>]*class="home-primary-button"/);
});

test("member Home is personal, continuation-oriented, and compact when empty", () => {
  const empty = render("ja", snapshot({ viewerUserId: "viewer" }), true);
  assert.match(empty, /最初の記録を残してみましょう/);
  assert.match(empty, /data-home-primary-state="draft_resume"/);
  assert.match(empty, /data-home-draft-owner="viewer"/);
  assert.match(empty, /data-global-record-trigger="photo"/);
  assert.match(empty, /data-global-record-gallery-select/);
  assert.match(empty, /href="\/ja\/map\?tab=places"/);
  assert.match(empty, /ikimon-home-section:member-primary:start/);
  assert.match(empty, /ikimon-home-section:member-recent:start/);
  assert.match(empty, /ikimon-home-section:member-place:start/);
  assert.doesNotMatch(empty, /今日は何を残しますか？/);
  assert.doesNotMatch(empty, /近くで残された記録|写真からわかったこと|名前待ち|0件|未記録/);

  const populated = render("ja", snapshot({
    viewerUserId: "viewer",
    myFeed: [observation("mine", { observerUserId: "viewer" })],
    myPlaces: [{
      placeId: "place-1",
      placeName: "都田",
      municipality: "浜松市",
      lastObservedAt: "2026-07-19T08:30:00.000Z",
      previousObservedAt: "2026-06-19T08:30:00.000Z",
      firstObservedAt: "2026-06-19T08:30:00.000Z",
      visitCount: 2,
      latestDisplayName: "夏祭り",
      revisitReason: null,
      nextLookFor: "祭りのあとの様子",
      lastRecordMode: null,
      lastSurveyResult: null,
      absenceSemantics: null,
      latitude: null,
      longitude: null,
    }],
    nearbyEvents: [{
      sessionId: "event-1",
      eventCode: "miyakoda-summer",
      title: "都田夏祭り",
      startedAt: "2026-08-01T09:00:00.000Z",
      endedAt: null,
      fieldId: "place-1",
      fieldName: "都田",
      city: "浜松市",
      prefecture: "静岡県",
      participantCount: 3,
    }],
  }), true);
  assert.match(populated, /この前の記録/);
  assert.match(populated, /関わっている場所の変化/);
  assert.match(populated, /次の活動/);
  assert.match(populated, /今を撮る/);
  assert.match(populated, /data-home-primary-state="recent_memory"/);
  const populatedMember = populated.match(/<div class="home-state-view is-member"[\s\S]*?<\/div><\/div>$/)?.[0] || populated;
  assert.doesNotMatch(populatedMember, /都田夏祭り|data-home-primary-state="active_context"/);
  assert.doesNotMatch(populatedMember, /近くで残された記録/);
});

test("member Home never promotes nearby Program or event context into the personal primary action", () => {
  const html = render("ja", snapshot({
    viewerUserId: "viewer",
    nearbyEvents: [{
      sessionId: "event-1",
      eventCode: "miyakoda-summer",
      title: "都田夏祭り",
      startedAt: "2026-08-01T09:00:00.000Z",
      endedAt: null,
      fieldId: "place-1",
      fieldName: "都田",
      city: "浜松市",
      prefecture: "静岡県",
      participantCount: 3,
    }],
  }), true);

  const member = html.match(/<div class="home-state-view is-member"[\s\S]*?<\/div><\/div>$/)?.[0] || html;
  assert.match(member, /data-home-primary-state="first_record"[^>]*data-home-primary-active="true"/);
  assert.doesNotMatch(member, /data-home-primary-state="active_context"|都田夏祭り|次の活動/);
});

test("member Home orders one continuation, recent records, past comparison, place change, and one next action", () => {
  const items = Array.from({ length: 8 }, (_, index) => observation(`mine-${index + 1}`, {
    observerUserId: "viewer",
    observedAt: `202${6 - Math.floor(index / 4)}-07-${String(20 - index).padStart(2, "0")}T08:30:00.000Z`,
    fieldRefs: [{ fieldId: "place-1", name: "都田", source: "observation" }],
  }));
  const html = render("ja", snapshot({
    viewerUserId: "viewer",
    myFeed: items,
    nearbyEvents: [{
      sessionId: "event-hidden",
      eventCode: "hidden-program",
      title: "表示してはいけないQuest",
      startedAt: "2026-08-01T09:00:00.000Z",
      endedAt: null,
      fieldId: "place-1",
      fieldName: "都田",
      city: "浜松市",
      prefecture: "静岡県",
      participantCount: 3,
    }],
    myPlaces: [{
      placeId: "place-1",
      placeName: "都田",
      municipality: "浜松市",
      lastObservedAt: "2026-07-20T08:30:00.000Z",
      previousObservedAt: "2025-07-18T08:30:00.000Z",
      firstObservedAt: "2025-07-18T08:30:00.000Z",
      visitCount: 8,
      latestVisitId: "mine-1",
      latestDisplayName: "夏の記録",
      revisitReason: "去年との違い",
      nextLookFor: "水辺の様子",
      lastRecordMode: "quick",
      lastSurveyResult: null,
      absenceSemantics: null,
      latitude: 34.712345,
      longitude: 137.723456,
    }],
  }), true);

  const member = html.match(/<div class="home-state-view is-member"[\s\S]*?<\/div><\/div>$/)?.[0] || html;
  const order = [
    member.indexOf("ikimon-home-section:member-primary:start"),
    member.indexOf("home-recent-section"),
    member.indexOf("home-past-section"),
    member.indexOf("home-places-section"),
    member.indexOf("home-next-section"),
  ];
  assert.ok(order.every((index) => index >= 0));
  assert.deepEqual(order.slice().sort((a, b) => a - b), order);
  assert.equal((member.match(/data-home-primary-active="true"/g) || []).length, 1);
  assert.match(member, /同じ場所の過去/);
  assert.match(member, /関わっている場所の変化/);
  assert.equal((member.match(/data-home-next-action/g) || []).length, 1);
  assert.match(member, /次は「水辺の様子」を確かめる/);
  assert.doesNotMatch(member, /表示してはいけないQuest|hidden-program|34\.712345|137\.723456|latitude|longitude/);
});

test("member Home excludes sensitive records from automatic photo surfaces", () => {
  const sensitive = observation("private-home", {
    observerUserId: "viewer",
    displayName: "自宅の記録",
    publicFeedEligible: false,
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
  });
  const html = render("ja", snapshot({ viewerUserId: "viewer", myFeed: [sensitive] }), true);

  assert.doesNotMatch(html, /\/media\/private-home\.jpg/);
  assert.doesNotMatch(html, /自宅の記録/);
  assert.match(html, /data-home-primary-state="recent_memory"/);
  assert.match(html, /href="\/ja\/records\?view=mine"/);
  assert.doesNotMatch(html, /data-home-primary-state="first_record"[^>]*data-home-primary-active="true"/);
});

test("member Home keeps a private owner photo useful without exposing its place", () => {
  const privateRecord = observation("private-owner", {
    observerUserId: "viewer",
    displayName: "家族との思い出",
    placeName: "非公開の場所",
    municipality: "浜松市",
    publicFeedEligible: false,
    publicFeedGateStatus: "pending_review",
  });
  const html = render("ja", snapshot({ viewerUserId: "viewer", myFeed: [privateRecord] }), true);

  assert.match(html, /data-home-primary-state="recent_memory"/);
  assert.match(html, /\/media\/private-owner\.jpg/);
  assert.match(html, /家族との思い出/);
  assert.doesNotMatch(html, /非公開の場所|浜松市/);
});

test("member Home never borrows media from a different same-named Place", () => {
  const recordAtOtherPlace = observation("same-name-other", {
    observerUserId: "viewer",
    placeName: "都田",
    fieldRefs: [{ fieldId: "place-other", name: "都田", source: "observation" }],
  });
  const html = render("ja", snapshot({
    viewerUserId: "viewer",
    myFeed: [recordAtOtherPlace],
    myPlaces: [{
      placeId: "place-target",
      placeName: "都田",
      municipality: "浜松市",
      lastObservedAt: "2026-07-19T08:30:00.000Z",
      previousObservedAt: "2026-06-19T08:30:00.000Z",
      firstObservedAt: "2026-06-19T08:30:00.000Z",
      visitCount: 2,
      latestDisplayName: null,
      revisitReason: null,
      nextLookFor: null,
      lastRecordMode: null,
      lastSurveyResult: null,
      absenceSemantics: null,
      latitude: null,
      longitude: null,
    }],
  }), true);

  const placeCard = html.match(/<a class="home-place-change-card"[^>]*data-home-place-change="place-target"[\s\S]*?<\/a>/)?.[0] ?? "";
  assert.match(placeCard, /data-home-place-change="place-target"/);
  assert.doesNotMatch(placeCard, /\/media\/same-name-other\.jpg|data-home-record-id="same-name-other"/);
});
