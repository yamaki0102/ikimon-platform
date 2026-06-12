import assert from "node:assert/strict";
import test from "node:test";
import { profileHeroActions, renderSelfProfileHub } from "./read.js";
import type { ProfileSnapshot } from "../services/readModels.js";
import type { RegionalStoryCue } from "../services/regionalStory.js";

function profileSnapshot(overrides: Partial<ProfileSnapshot> = {}): ProfileSnapshot {
  return {
    userId: "user-profile-test",
    displayName: "YAMAKI",
    rankLabel: null,
    avatarUrl: null,
    profileBio: null,
    expertise: null,
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

test("profile hero actions focus on continuation instead of account utilities", () => {
  const actions = profileHeroActions();

  assert.deepEqual(actions.map((action) => action.label), [
    "記録一覧を見る",
    "場所を見る",
    "ガイド成果を見る",
  ]);
  assert.equal(actions.filter((action) => !action.variant || action.variant === "primary").length, 1);
  assert.ok(!actions.some((action) => action.href === "/logout" || action.href === "/profile/settings"));
});

test("self profile hub compacts an empty bio and keeps account utilities separate", () => {
  const html = renderSelfProfileHub("", "ja", profileSnapshot());

  assert.match(html, /プロフィールメモは未設定です。/);
  assert.doesNotMatch(html, /自己紹介はまだありません。/);
  assert.match(html, /data-testid="profile-account-utilities"/);
  assert.match(html, /ログアウト/);
});

test("self profile hub deduplicates repeated regional story cards before rendering", () => {
  const duplicate = regionalStory();
  const distinct = regionalStory({
    placeHook: "別の場所を見返すなら、草地の境目を残す。",
    whyHere: "草地と舗装の境目が、見えた生きものの条件になります。",
  });
  const html = renderSelfProfileHub("", "ja", profileSnapshot(), null, [duplicate, regionalStory(), distinct]);

  assert.equal((html.match(/data-testid="regional-story"/g) ?? []).length, 2);
  assert.equal((html.match(/同じ場所を見返すなら、道の端を残す。/g) ?? []).length, 1);
  assert.equal((html.match(/別の場所を見返すなら、草地の境目を残す。/g) ?? []).length, 1);
});
