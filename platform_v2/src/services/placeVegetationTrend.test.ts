import assert from "node:assert/strict";
import test from "node:test";

import { summarizePlaceVegetationTrend, type PlaceVegetationTrendInput } from "./placeVegetationTrend.js";

const now = new Date("2026-05-15T00:00:00Z");

function record(daysAgo: number, actionKind: PlaceVegetationTrendInput["managementActionCandidates"][number]["actionKind"]): PlaceVegetationTrendInput {
  return {
    visitId: `visit-${daysAgo}`,
    observedAt: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
    areaInference: null,
    managementActionCandidates: [{
      actionKind,
      label: actionKind,
      why: "草管理の対象が写る",
      confidence: 0.7,
      source: "photo",
      sourceAssetId: null,
      confirmState: "suggested",
    }],
  };
}

test("place vegetation trend marks repeated recent pressure as high priority", () => {
  const trend = summarizePlaceVegetationTrend(
    [record(4, "invasive_removal"), record(15, "mowing"), record(100, "unknown")],
    0,
    {
      placeId: "place-1",
      userId: "user-1",
      managementGoal: "invasive_watch",
      weedTolerance: "medium",
      invasiveResponse: "controlled_removal",
      mowingFrequency: "as_needed",
      notes: "",
      updatedAt: null,
    },
    now,
  );

  assert.equal(trend.status, "increasing");
  assert.equal(trend.priority, "high");
  assert.match(trend.headline, /草の圧/);
});

test("place vegetation trend recognizes recent stewardship as suppression signal", () => {
  const trend = summarizePlaceVegetationTrend(
    [record(5, "mowing"), record(80, "invasive_removal"), record(100, "mowing")],
    2,
    null,
    now,
  );

  assert.equal(trend.status, "suppressed");
  assert.equal(trend.priority, "medium");
  assert.match(trend.summary, /抑えられて/);
});
