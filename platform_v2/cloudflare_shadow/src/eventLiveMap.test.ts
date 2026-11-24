import assert from "node:assert/strict";
import test from "node:test";
import { compute25mGridCell, isEventActiveWindow, renderEventLiveMapPage } from "./eventLiveMap";

test("compute25mGridCell maps coordinates inside event radius to 25m cells and rejects outside coordinates", () => {
  const inside = compute25mGridCell(35.68, 139.76, 35.6801, 139.7601, 500);
  assert.ok(inside !== null);
  const outside = compute25mGridCell(35.68, 139.76, 35.72, 139.80, 500);
  assert.equal(outside, null);
});

test("renderEventLiveMapPage renders cooperative progress, badge-only first discovery, offline queue, and frozen takeaway when ended", () => {
  const activeHtml = renderEventLiveMapPage(
    {
      sessionId: "evt_live_1",
      title: "朝の観察会",
      isActive: true,
      totalCells: 40,
      filledCellsCount: 12,
      filledCellKeys: ["2,4", "2,5"],
      firstDiscoveries: [
        { entryId: "e1", taxonLabel: "カワセミ", summaryText: "橋の下", badgeNumber: 3, cellKey: "2,4" }
      ]
    },
    { bigScreen: true, cspNonce: "n1" }
  );
  assert.match(activeHtml, /12\/40マス/);
  assert.match(activeHtml, /カワセミ（名札 #3）/);
  assert.match(activeHtml, /zukan_live_map_queue_/);
  assert.match(activeHtml, /class="elm-cell is-filled" data-cell-key="2,4"/);

  assert.equal(isEventActiveWindow({ started_at: "2026-11-23T00:00:00Z", ended_at: "2026-11-23T02:00:00Z" }), false);
  const endedHtml = renderEventLiveMapPage(
    {
      sessionId: "evt_live_1",
      title: "朝の観察会",
      isActive: false,
      totalCells: 40,
      filledCellsCount: 12,
      filledCellKeys: ["2,4"],
      firstDiscoveries: []
    },
    { cspNonce: "n1" }
  );
  assert.match(endedHtml, /この日埋まった地図/);
  assert.doesNotMatch(endedHtml, /setInterval/);
});
