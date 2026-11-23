import assert from "node:assert/strict";
import test from "node:test";
import { renderGlobalPlaceDetailPage } from "./placeDetailPage";

test("renderGlobalPlaceDetailPage includes conditional area observations panel wired to /api/v1/areas/observations", () => {
  const html = renderGlobalPlaceDetailPage({
    lang: "ja",
    profile: {
      schema: "ikimon.place-atlas/v1",
      place: {
        placeId: "place-renri-test",
        canonicalPlaceId: "place-renri-test",
        name: "テストの森",
        localName: "テストの森",
        locality: "浜松市",
        placeKind: "park",
        latitude: 34.71,
        longitude: 137.73,
        summary: "",
        sourceCount: 1,
      },
      policy: { placeVisibility: "public" },
      provenance: { sourceCount: 1, latestCheckedAt: null, generatedAt: null },
      sections: [],
    } as unknown as Parameters<typeof renderGlobalPlaceDetailPage>[0]["profile"],
    viewerAuthenticated: false,
  });
  assert.match(html, /data-area-observations-panel/);
  assert.match(html, /\/api\/v1\/areas\/observations/);
  assert.match(html, /画像のみ/);
  assert.match(html, /音声のみ/);
  assert.match(html, /動画のみ/);
  assert.match(html, /メモ・記録のみ/);
});
