import assert from "node:assert/strict";
import test from "node:test";
import {
  formatActorDisplay,
  formatIdentificationCount,
  formatPlaceDisplay,
  formatTaxonDisplayName,
} from "./localizedDisplay.js";

test("formatTaxonDisplayName prefers Japanese vernacular on Japanese UI", () => {
  assert.deepEqual(
    formatTaxonDisplayName({
      vernacularName: "モンシロチョウ",
      scientificName: "Pieris rapae",
      displayName: "Pieris rapae",
    }, "ja"),
    { primaryLabel: "モンシロチョウ", qualifier: null, isAwaitingId: false },
  );
});

test("formatTaxonDisplayName marks scientific-only Japanese labels", () => {
  assert.deepEqual(
    formatTaxonDisplayName({ scientificName: "Pieris rapae", displayName: "Pieris rapae" }, "ja"),
    { primaryLabel: "Pieris rapae", qualifier: "scientific", isAwaitingId: false },
  );
});

test("formatTaxonDisplayName uses Japanese AI candidate before Latin fallback", () => {
  assert.deepEqual(
    formatTaxonDisplayName({ displayName: "Unresolved", aiCandidateName: "シロツメクサ" }, "ja"),
    { primaryLabel: "シロツメクサ", qualifier: "ai", isAwaitingId: false },
  );
});

test("formatTaxonDisplayName normalizes unresolved labels", () => {
  assert.deepEqual(
    formatTaxonDisplayName({ displayName: "Awaiting ID" }, "ja"),
    { primaryLabel: "名前待ち", qualifier: null, isAwaitingId: true },
  );
  assert.deepEqual(
    formatTaxonDisplayName({ displayName: "同定待ち", aiCandidateName: "シロツメクサ" }, "ja"),
    { primaryLabel: "シロツメクサ", qualifier: "ai", isAwaitingId: false },
  );
  assert.deepEqual(
    formatTaxonDisplayName({ displayName: "名前待ち" }, "ja"),
    { primaryLabel: "名前待ち", qualifier: null, isAwaitingId: true },
  );
});

test("formatTaxonDisplayName rejects scene labels as taxon names", () => {
  assert.deepEqual(
    formatTaxonDisplayName({ displayName: "芝生", aiCandidateName: "芝生" }, "ja"),
    { primaryLabel: "名前待ち", qualifier: null, isAwaitingId: true },
  );
  assert.deepEqual(
    formatTaxonDisplayName({ displayName: "イネ科", aiCandidateName: "芝生" }, "ja"),
    { primaryLabel: "イネ科", qualifier: null, isAwaitingId: false },
  );
  assert.deepEqual(
    formatTaxonDisplayName({ displayName: "城壁と周辺植生", aiCandidateName: "石垣・城壁の植生" }, "ja"),
    { primaryLabel: "名前待ち", qualifier: null, isAwaitingId: true },
  );
});

test("formatPlaceDisplay removes unknown fallbacks in Japanese owner and public modes", () => {
  const publicLocation = {
    label: "浜松市",
    scope: "municipality" as const,
    cellId: null,
    gridM: null,
    radiusM: null,
    centroidLat: null,
    centroidLng: null,
    displayMode: "area" as const,
  };
  assert.equal(formatPlaceDisplay({ placeName: "Unknown place", municipality: "浜松市", publicLocation }, "ja", "owner"), "浜松市");
  assert.equal(formatPlaceDisplay({ placeName: "地点未指定の記録", municipality: null, prefecture: null }, "ja", "public"), "");
});

test("formatPlaceDisplay only shows the generalized label for explicitly blurred locations", () => {
  const blurredLocation = {
    label: null,
    scope: "blurred" as const,
    cellId: null,
    gridM: null,
    radiusM: null,
    centroidLat: null,
    centroidLng: null,
    displayMode: "area" as const,
  };
  assert.equal(formatPlaceDisplay({ publicLocation: blurredLocation }, "ja", "public"), "位置をぼかしています");
  assert.equal(formatPlaceDisplay({}, "ja", "public"), "");
});

test("formatActorDisplay localizes common actor fallbacks", () => {
  assert.equal(formatActorDisplay("Guest", "ja"), "ゲスト");
  assert.equal(formatActorDisplay("Community", "ja"), "みんなの同定");
  assert.equal(formatActorDisplay("Unknown observer", "ja"), "観察者");
});

test("formatIdentificationCount localizes ids on Japanese UI", () => {
  assert.equal(formatIdentificationCount(3, "ja"), "名前確認 3 件");
  assert.equal(formatIdentificationCount(3, "en"), "3 ids");
});
