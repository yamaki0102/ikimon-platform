import assert from "node:assert/strict";
import test from "node:test";
import {
  reconcileSelectedCellAfterCellsResponse,
  serializeSharedMapState,
} from "./mapExplorerState.js";

test("stale cells response keeps the selected cell intact", () => {
  const result = reconcileSelectedCellAfterCellsResponse({
    selectedCellId: "3000:5121:1377",
    availableCellIds: ["3000:9999:1111"],
    responseSeq: 2,
    latestRequestSeq: 3,
  });

  assert.deepEqual(result, {
    apply: false,
    selectedCellId: "3000:5121:1377",
    clearSelectedPoint: false,
  });
});

test("latest cells response clears the selected cell only when it is truly gone", () => {
  const result = reconcileSelectedCellAfterCellsResponse({
    selectedCellId: "3000:5121:1377",
    availableCellIds: ["3000:9999:1111"],
    responseSeq: 4,
    latestRequestSeq: 4,
  });

  assert.deepEqual(result, {
    apply: true,
    selectedCellId: null,
    clearSelectedPoint: true,
  });
});

test("serializeSharedMapState keeps share-critical params including cell", () => {
  const serialized = serializeSharedMapState({
    tab: "frontier",
    taxonGroup: "bird",
    basemap: "gsi",
    selectedCellId: "3000:5121:1377",
    center: { lng: 137.8589, lat: 34.7219 },
    zoom: 10.6,
  });
  const params = new URLSearchParams(serialized);

  assert.equal(params.get("tab"), "frontier");
  assert.equal(params.get("taxon"), "bird");
  assert.equal(params.get("bm"), "gsi");
  assert.equal(params.get("cell"), "3000:5121:1377");
  assert.equal(params.get("lng"), "137.8589");
  assert.equal(params.get("lat"), "34.7219");
  assert.equal(params.get("z"), "10.6");
});
