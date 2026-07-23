import assert from "node:assert/strict";
import test from "node:test";
import { profileHeroActions, profileRegionalStoryInputForPlace, renderSelfProfileHub } from "./read.js";
import type { HomePlace, ProfileSnapshot } from "../services/readModels.js";
import type { RegionalStoryCue } from "../services/regionalStory.js";

function profileSnapshot(overrides: Partial<ProfileSnapshot> = {}): ProfileSnapshot {
  return {
    visibility: "owner",
    userId: "user-profile-test",
    displayName: "YAMAKI",
    rankLabel: null,
    avatarUrl: null,
    profileBio: null,
    expertise: null,
    publicContributionRange: null,
    stats: {
      totalObservations: 0,
      thisMonthObservations: 0,
      placeCount: 0,
      uniqueTaxaAllTime: 0,
      currentStreakDays: 0,
      tier2PlusCount: 0,
      tier3PlusCount: 0,
      firstObservedAt: null,
      latestObservedAt: null,
    },
    lifeListPreview: [],
    recentPlaces: [],
    recentObservations: [],
    ...overrides,
  };
}

function regionalStory(overrides: Partial<RegionalStoryCue> = {}): RegionalStoryCue {
  return {
    surface: "profile",
    angleKey: "history",
    angleLabel: "昔の道から見る",
    placeHook: "同じ場所を見返すなら、道の端を残す。",
    whyHere: "古い道や水路の位置が、今日見えたものの背景になります。",
    nextObservationAngle: "道の端と水辺を一緒に撮る。",
    collectiveNote: "季節を変えて比べると条件が見えます。",
    cards: [],
    usedCardIds: [],
    sourceMode: "fallback",
    ...overrides,
  };
}

function homePlace(overrides: Partial<HomePlace> = {}): HomePlace {
  return {
    placeId: "place:profile-story",
    placeName: "静岡県の草地",
    municipality: "静岡市",
    lastObservedAt: "2026-05-15T09:00:00.000Z",
    previousObservedAt: null,
    firstObservedAt: "2026-05-01T09:00:00.000Z",
    visitCount: 2,
    latestVisitId: "visit-profile-story",
    latestDisplayName: "タンポポ",
    revisitReason: null,
    nextLookFor: null,
    lastRecordMode: null,
    lastSurveyResult: null,
    absenceSemantics: null,
    latitude: 34.97,
    longitude: 138.38,
    ...overrides,
  };
}

type ProfileRecentObservation = ProfileSnapshot["recentObservations"][number];

function recentObservation(overrides: Partial<ProfileRecentObservation> = {}): ProfileRecentObservation {
  return {
    occurrenceId: "occ-profile-latest",
    visitId: "visit-profile-latest",
    displayName: "朝の水音メモ",
    observedAt: "2026-05-16T07:30:00.000Z",
    observerName: "YAMAKI",
    placeName: "静岡県の草地",
    municipality: "静岡市",
    publicLocation: {
      label: "静岡市",
      scope: "municipality",
      cellId: "3000:1:1",
      gridM: 3000,
      radiusM: 3000,
      centroidLat: 34.97,
      centroidLng: 138.38,
      displayMode: "area",
    },
    photoUrl: null,
    identificationCount: 0,
    ...overrides,
  };
}

test("profile hero actions keep the self hub focused on identity and controls", () => {
  const actions = profileHeroActions();

  assert.deepEqual(actions.map((action) => action.label), [
    "プロフィールを編集",
    "公開プロフィールを見る",
  ]);
  assert.equal(actions.filter((action) => !action.variant || action.variant === "primary").length, 1);
  assert.ok(!actions.some((action) => action.href === "/logout"));
});

test("self profile hub is an identity and control surface, not a duplicate record dashboard", () => {
  const html = renderSelfProfileHub("", "ja", profileSnapshot());

  assert.match(html, /data-testid="self-control-hub"/);
  assert.match(html, /プロフィールと公開ページ/);
  assert.match(html, /公開範囲と位置情報/);
  assert.match(html, /参加とフォロー/);
  assert.match(html, /アカウント設定/);
  assert.doesNotMatch(html, /data-testid="profile-channel"/);
  assert.doesNotMatch(html, /data-testid="profile-summary"/);
  assert.doesNotMatch(html, /自分の記録史|Life List|最近の記録/);
  assert.match(html, /data-testid="profile-account-utilities"/);
  assert.match(html, /ログアウト/);
  assert.match(html, /<form method="post" action="\/logout"><button class="is-danger" type="submit">ログアウト<\/button><\/form>/);
  assert.doesNotMatch(html, /href="\/logout"/);
});

test("self profile hub shows compact destinations without reproducing record cards", () => {
  const html = renderSelfProfileHub("", "ja", profileSnapshot({
    stats: {
      totalObservations: 4,
      thisMonthObservations: 1,
      placeCount: 2,
      uniqueTaxaAllTime: 3,
      currentStreakDays: 0,
      tier2PlusCount: 0,
      tier3PlusCount: 0,
      firstObservedAt: "2026-05-01T09:00:00.000Z",
      latestObservedAt: "2026-05-16T07:30:00.000Z",
    },
    recentPlaces: [homePlace({
      placeName: "静岡県の草地",
      latestDisplayName: "タンポポ",
      nextLookFor: "水辺の鳥",
    })],
    recentObservations: [recentObservation()],
    lifeListPreview: [{
      displayName: "タンポポ",
      scientificName: null,
      observationCount: 2,
      latestObservedAt: "2026-05-16T07:30:00.000Z",
      photoUrl: null,
    }],
  }));

  assert.match(html, /href="\/ja\/records\?view=mine"/);
  assert.match(html, /href="\/ja\/map\?tab=places"/);
  assert.match(html, /href="\/ja\/profile\/user-profile-test"/);
  assert.match(html, /4件の記録/);
  assert.match(html, /2か所/);
  assert.equal((html.match(/朝の水音メモ/g) || []).length, 0);
  assert.equal((html.match(/静岡県の草地/g) || []).length, 0);
});

test("self profile hub does not render regional story cards", () => {
  const duplicate = regionalStory();
  const distinct = regionalStory({
    placeHook: "別の場所を見返すなら、草地の境目を残す。",
    whyHere: "草地と舗装の境目が、見えた生きものの条件になります。",
  });
  const html = renderSelfProfileHub("", "ja", profileSnapshot(), null, [duplicate, regionalStory(), distinct]);

  assert.equal((html.match(/data-testid="regional-story"/g) ?? []).length, 0);
  assert.doesNotMatch(html, /同じ場所を見返すなら、道の端を残す。/);
  assert.doesNotMatch(html, /別の場所を見返すなら、草地の境目を残す。/);
});

test("profile regional story input carries the latest place subject and date", () => {
  const input = profileRegionalStoryInputForPlace("user-profile-test", homePlace());

  assert.equal(input.surface, "profile");
  assert.equal(input.viewerUserId, "user-profile-test");
  assert.equal(input.place.placeId, "place:profile-story");
  assert.equal(input.place.placeName, "静岡県の草地");
  assert.equal(input.place.publicLabel, "静岡市");
  assert.deepEqual(input.observation, {
    displayName: "タンポポ",
    observedAt: "2026-05-15T09:00:00.000Z",
  });
});

test("profile regional story input falls back to next-look context when latest subject is empty", () => {
  const input = profileRegionalStoryInputForPlace("user-profile-test", homePlace({
    latestDisplayName: null,
    nextLookFor: "水辺の鳥",
  }));

  assert.deepEqual(input.observation, {
    displayName: "水辺の鳥",
    observedAt: "2026-05-15T09:00:00.000Z",
  });
});
