import assert from "node:assert/strict";
import test from "node:test";
import worker, { renderCloudflareRecordHtml } from "./index";
import {
  ZUKAN_RECORD_PLACE_TIME_STYLES,
  handleCreateRecordPlace,
  handleSearchNearbyRecordPlaces,
  renderRecordPlaceAndTimeHtml,
} from "./zukanRecordPlaceAndTime";

test("zukanRecordPlaceAndTime renders C4 nearby places, C5 new place, and C6 datetime editor", () => {
  const html = renderRecordPlaceAndTimeHtml({
    lang: "ja",
    initialPlaceId: "place_park_1",
    defaultObservedAtLocal: "2026-11-25T14:00",
  });
  assert.match(html, /data-record-place-time="c4-c5-c6"/);
  assert.match(html, /id="record-find-nearby-places"/);
  assert.match(html, /id="record-new-place-name"/);
  assert.match(html, /id="record-create-place-btn"/);
  assert.match(html, /type="datetime-local"[^>]*id="record-observed-at"/);
  assert.match(ZUKAN_RECORD_PLACE_TIME_STYLES, /min-height:\s*44px/);
  assert.match(ZUKAN_RECORD_PLACE_TIME_STYLES, /prefers-reduced-motion:\s*reduce/);
});

test("GET /api/v1/record/places/nearby and POST /api/v1/record/places require auth (401)", async () => {
  const nearbyRes = await worker.fetch(
    new Request("https://shadow.test/api/v1/record/places/nearby?lat=35.0&lng=139.0"),
    {} as any
  );
  assert.equal(nearbyRes.status, 401);

  const createRes = await worker.fetch(
    new Request("https://shadow.test/api/v1/record/places", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "裏庭の池" }),
    }),
    {} as any
  );
  assert.equal(createRes.status, 401);
});

test("handleCreateRecordPlace ignores client-supplied id/visibility/officialStatus and validates name", async () => {
  const inserted: any[] = [];
  const fakeDb = {
    prepare(_sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async run() {
              inserted.push(args);
              return { success: true };
            },
            async all() {
              return { results: [] };
            },
          };
        },
      };
    },
  };

  const badRes = await handleCreateRecordPlace(
    new Request("https://shadow.test/api/v1/record/places", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "   " }),
    }),
    "user_1",
    fakeDb as any
  );
  assert.equal(badRes.status, 400);

  const okRes = await handleCreateRecordPlace(
    new Request("https://shadow.test/api/v1/record/places", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        placeId: "evil_id",
        public_profile_status: "public",
        official_status: "official",
        name: "テスト観察池",
        localityLabel: "静岡県浜松市",
      }),
    }),
    "user_1",
    fakeDb as any
  );
  assert.equal(okRes.status, 201);
  const body = (await okRes.json()) as { ok: boolean; place: { placeId: string; name: string } };
  assert.equal(body.ok, true);
  assert.match(body.place.placeId, /^place_user_/);
  assert.notEqual(body.place.placeId, "evil_id");
  assert.equal(body.place.name, "テスト観察池");
  assert.equal(inserted.length, 1);
  assert.match(String(inserted[0][5]), /"createdBy":"user_1"/);
});

test("handleSearchNearbyRecordPlaces validates coordinates and returns matching places", async () => {
  const fakeDb = {
    prepare(_sql: string) {
      return {
        bind() {
          return {
            async all() {
              return {
                results: [
                  {
                    place_id: "place_1",
                    canonical_name: "佐鳴湖公園",
                    locality_label: "浜松市",
                    place_kind: "park",
                    bbox_west: 137.68,
                    bbox_east: 137.70,
                    bbox_south: 34.70,
                    bbox_north: 34.72,
                  },
                ],
              };
            },
          };
        },
      };
    },
  };

  const badLat = await handleSearchNearbyRecordPlaces(
    new URL("https://shadow.test/api/v1/record/places/nearby?lat=999&lng=137.7"),
    fakeDb as any
  );
  assert.equal(badLat.status, 400);

  const ok = await handleSearchNearbyRecordPlaces(
    new URL("https://shadow.test/api/v1/record/places/nearby?lat=34.71&lng=137.69"),
    fakeDb as any
  );
  assert.equal(ok.status, 200);
  const body = (await ok.json()) as { ok: boolean; places: Array<{ placeId: string; name: string }> };
  assert.equal(body.ok, true);
  assert.equal(body.places.length, 1);
  assert.equal(body.places[0]?.placeId, "place_1");
});

test("renderCloudflareRecordHtml includes C4-C6 place and datetime controls", () => {
  const html = renderCloudflareRecordHtml(
    { userId: "user_c4_c6", displayName: "テスター", banned: false } as any,
    new URL("https://ikimon.life/ja/record"),
    "test-nonce"
  );
  assert.match(html, /data-record-place-time="c4-c5-c6"/);
  assert.match(html, /\/api\/v1\/record\/places\/nearby/);
  assert.match(html, /id="record-observed-at"/);
});
