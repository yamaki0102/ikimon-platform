import assert from "node:assert/strict";
import test from "node:test";
import worker from "./index";
import {
  handleCreatePlaceProposal,
  handlePlaceNearbyApi,
  handlePlaceProposeOrNearbyRoute,
} from "./zukanPlaceProposalsAndNearby";

test("POST /api/v1/places/:id/proposals enforces 401 and ignores client proposer/status", async () => {
  const unauthRes = await worker.fetch(
    new Request("https://shadow.test/api/v1/places/place_1/proposals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ field: "public_summary", proposedValue: "新しい紹介文" }),
    }),
    {} as any
  );
  assert.equal(unauthRes.status, 401);

  const r2Store = new Map<string, string>();
  const fakeEnv = {
    OBS_DB: {
      prepare() {
        return {
          bind() {
            return {
              async first() {
                return {
                  place_id: "place_1",
                  canonical_name: "佐鳴湖公園",
                  public_profile_status: "published",
                };
              },
            };
          },
        };
      },
    },
    ASSET_BUCKET: {
      async get(key: string) {
        const val = r2Store.get(key);
        return val ? { body: new Response(val).body } : null;
      },
      async put(key: string, val: string) {
        r2Store.set(key, val);
      },
    },
  };

  const okRes = await handleCreatePlaceProposal(
    "place_1",
    new Request("https://shadow.test/api/v1/places/place_1/proposals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        proposerUserId: "spoofed",
        status: "approved",
        field: "public_summary",
        proposedValue: "新しい紹介文です",
        reason: "案内板を確認",
      }),
    }),
    { userId: "user_1", banned: false },
    fakeEnv as any
  );
  assert.equal(okRes.status, 201);
  const body = (await okRes.json()) as {
    ok: boolean;
    proposal: { proposerUserId: string; status: string };
  };
  assert.equal(body.ok, true);
  assert.equal(body.proposal.proposerUserId, "user_1");
  assert.equal(body.proposal.status, "pending");
});

test("GET /api/v1/places/:id/nearby and E9/E10 pages work for public places", async () => {
  const fakeDb = {
    prepare(sql: string) {
      return {
        bind() {
          return {
            async first() {
              if (sql.includes("place_boundaries")) {
                return { bbox_west: 137.68, bbox_east: 137.70, bbox_south: 34.70, bbox_north: 34.72 };
              }
              return {
                place_id: "place_sanaru",
                canonical_name: "佐鳴湖公園",
                public_profile_status: "published",
              };
            },
            async all() {
              return {
                results: [
                  {
                    place_id: "place_hamamatsu",
                    canonical_name: "浜松城公園",
                    locality_label: "浜松市",
                    bbox_west: 137.72,
                    bbox_east: 137.73,
                    bbox_south: 34.71,
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

  const nearbyApi = await handlePlaceNearbyApi("place_sanaru", fakeDb as any);
  assert.equal(nearbyApi.status, 200);
  const body = (await nearbyApi.json()) as { ok: boolean; places: Array<{ placeId: string; distanceKm?: number }> };
  assert.equal(body.ok, true);
  assert.equal(body.places[0]?.placeId, "place_hamamatsu");
  assert.equal(typeof body.places[0]?.distanceKm, "number");

  const proposePage = await handlePlaceProposeOrNearbyRoute(
    "place_sanaru",
    "propose",
    "ja",
    { userId: "user_1", displayName: "テスター", banned: false },
    fakeDb as any
  );
  assert.equal(proposePage.status, 200);
  assert.match(await proposePage.text(), /data-place-propose="e9"/);

  const nearbyPage = await handlePlaceProposeOrNearbyRoute(
    "place_sanaru",
    "nearby",
    "ja",
    null,
    fakeDb as any
  );
  assert.equal(nearbyPage.status, 200);
  const nearbyHtml = await nearbyPage.text();
  assert.match(nearbyHtml, /data-place-nearby="e10"/);
  assert.match(nearbyHtml, /浜松城公園/);
});
