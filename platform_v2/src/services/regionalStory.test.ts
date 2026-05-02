import assert from "node:assert/strict";
import test from "node:test";
import { getRegionalStoryCue } from "./regionalStory.js";

test("regional story returns sourced Hamamatsu cards without requiring the database", async () => {
  const story = await getRegionalStoryCue({
    surface: "observation",
    viewerUserId: null,
    recordExposure: false,
    place: {
      placeId: "place:hamamatsu",
      placeName: "浜松市中央区の公園",
      municipality: "浜松市",
      publicLabel: "浜松市",
      allowPrecisePlaceLabel: true,
    },
    observation: {
      observationId: "occ-1",
      displayName: "タンポポ",
      observedAt: "2026-04-20T10:00:00Z",
    },
    maxCards: 2,
  });

  assert.ok(story);
  assert.ok(story.cards.length >= 1);
  assert.ok(story.cards.every((card) => card.sourceUrl.startsWith("https://")));
  assert.notEqual(story.cards[0]?.cardId, "hamamatsu-adeac-castle");
  assert.equal(story.cards[0]?.cardId, "hamamatsu-environment-biodiversity");
  assert.match(story.placeHook, /再訪|変化|見る|揃える/);
  assert.match(story.nextObservationAngle, /見る|残す|撮る|比べ|追う|並べ|入れる|揃える/);
  assert.match(story.collectiveNote, /重ね|季節|時刻|条件|読め|分かる|見える|比較/);
  assert.doesNotMatch(story.whyHere, /この地域には、昔の写真や文化誌/);
  // 春のタンポポ → 春の植物向けヒントが含まれること
  assert.match(story.whyHere, /つぼみ|花|葉|株|日当たり/);
});

test("regional story only uses specific heritage cards when the place actually matches", async () => {
  const story = await getRegionalStoryCue({
    surface: "observation",
    viewerUserId: null,
    recordExposure: false,
    place: {
      placeId: "place:castle",
      placeName: "浜松城公園",
      municipality: "浜松市",
      publicLabel: "浜松市",
      allowPrecisePlaceLabel: true,
    },
    observation: {
      observationId: "occ-2",
      displayName: "タンポポ",
      observedAt: "2026-04-20T10:00:00Z",
    },
    maxCards: 2,
  });

  assert.ok(story);
  assert.ok(story.cards.some((card) => card.cardId === "hamamatsu-adeac-castle"));
});

test("regional story has a safe fallback for unknown regions", async () => {
  const story = await getRegionalStoryCue({
    surface: "profile",
    viewerUserId: null,
    recordExposure: false,
    place: {
      placeId: "place:unknown",
      placeName: "まだ地域カードがない場所",
      municipality: "未登録市",
      allowPrecisePlaceLabel: false,
    },
    maxCards: 1,
  });

  assert.ok(story);
  assert.equal(story.cards.length, 0);
  assert.equal(story.sourceMode, "fallback");
  assert.match(story.collectiveNote, /記録|見返|比べ|比較|重ね|条件/);
});
