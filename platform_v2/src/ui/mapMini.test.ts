import assert from "node:assert/strict";
import test from "node:test";
import { renderMapMini, toMapMiniCells } from "./mapMini.js";

test("toMapMiniCells and renderMapMini use cell payloads instead of exact points", () => {
  const cells = toMapMiniCells([
    {
      cellId: "3000:1:2",
      label: "浜松市",
      count: 3,
      gridM: 3000,
      centroidLat: 34.71,
      centroidLng: 137.72,
      polygon: [
        [137.70, 34.70],
        [137.74, 34.70],
        [137.74, 34.73],
        [137.70, 34.73],
        [137.70, 34.70],
      ],
    },
  ], "/map");

  assert.equal(cells[0]?.href.includes("cell=3000%3A1%3A2"), true);

  const html = renderMapMini({
    cells,
    mapHref: "/map",
    mapCtaLabel: "マップを開く",
    emptyLabel: "empty",
  });

  assert.match(html, /data-cells=/);
  assert.doesNotMatch(html, /data-points=/);
  assert.match(html, /map-mini-fallback-cell/);
});

test("renderMapMini aggregates duplicate locality badges", () => {
  const cells = toMapMiniCells([
    {
      cellId: "3000:1:2",
      label: "浜松市",
      count: 7,
      gridM: 3000,
      centroidLat: 34.71,
      centroidLng: 137.72,
      polygon: [
        [137.70, 34.70],
        [137.74, 34.70],
        [137.74, 34.73],
        [137.70, 34.73],
        [137.70, 34.70],
      ],
    },
    {
      cellId: "3000:2:3",
      label: "浜松市",
      count: 3,
      gridM: 3000,
      centroidLat: 34.75,
      centroidLng: 137.76,
      polygon: [
        [137.74, 34.73],
        [137.78, 34.73],
        [137.78, 34.77],
        [137.74, 34.77],
        [137.74, 34.73],
      ],
    },
  ], "/map");

  const html = renderMapMini({
    cells,
    mapHref: "/map",
    mapCtaLabel: "マップを開く",
    emptyLabel: "empty",
  });

  assert.equal((html.match(/<strong>浜松市<\/strong>/g) ?? []).length, 1);
  assert.match(html, /10件/);
});
