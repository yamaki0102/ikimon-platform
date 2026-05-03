import assert from "node:assert/strict";
import test from "node:test";
import { renderFixedPointStationBody } from "./fixedPointStation.js";

test("renderFixedPointStationBody shows revisit timeline, environment clues, and stewardship actions", () => {
  const html = renderFixedPointStationBody({
    place: {
      placeId: "geo:34.696:137.703",
      name: "水辺の定点",
      localityLabel: "橋の北側",
      municipality: "浜松市",
      prefecture: "静岡県",
      latitude: 34.696,
      longitude: 137.703,
    },
    environmentEvidence: [{
      kind: "vegetation",
      label: "植生指数 平均",
      value: "0.42",
      source: "Planetary Computer",
      capturedAt: "2026-05-01",
      limitation: "雲の影響あり",
    }],
    visits: [{
      visitId: "visit-1",
      observedAt: "2026-05-01T00:00:00Z",
      note: "前回と比べる",
      visitMode: "survey",
      revisitReason: "同じ構図で比べる",
      taxa: ["スズメ"],
      photoCount: 2,
      videoCount: 1,
      contextLabel: "再記録",
      activityIntent: "revisit",
      participantRole: "finder",
    }],
    stewardshipActions: [{
      actionId: "act-1",
      occurredAt: "2026-04-20T00:00:00Z",
      actionKind: "mowing",
      description: "草刈り",
      linkedVisitId: null,
    }],
  }, "");

  assert.match(html, /定点ページ/);
  assert.match(html, /衛星・地図で見える変化/);
  assert.match(html, /植生指数 平均/);
  assert.match(html, /同じ場所の記録/);
  assert.match(html, /写真2 · 動画1 · しっかり記録 · 再記録/);
  assert.match(html, /管理行為と前後比較/);
  assert.match(html, /activityIntent=revisit/);
});
