import assert from "node:assert/strict";
import test from "node:test";
import worker from "./index";
import {
  handlePlaceFixedPointTimelineApi,
  handlePlaceTimelinePageRoute,
} from "./zukanPlaceShareAndTimeline";

test("GET /api/v1/places/:id/fixed-point-timeline returns 404 for private/missing place and chronological frames for public place", async () => {
  const missingDb = {
    prepare() {
      return {
        bind() {
          return {
            async first() {
              return null;
            },
            async all() {
              return { results: [] };
            },
          };
        },
      };
    },
  };
  const notFound = await worker.fetch(
    new Request("https://shadow.test/api/v1/places/missing_place/fixed-point-timeline"),
    { OBS_DB: missingDb } as any
  );
  assert.equal(notFound.status, 404);

  const pubDb = {
    prepare() {
      return {
        bind() {
          return {
            async first() {
              return {
                place_id: "place_sanaru",
                canonical_name: "佐鳴湖公園",
                public_profile_status: "published",
              };
            },
            async all() {
              return {
                results: [
                  { observation_id: "obs_1", asset_id: "asset_1", observed_at: "2025-05-01T09:00:00Z" },
                  { observation_id: "obs_2", asset_id: "asset_2", observed_at: "2026-05-01T09:00:00Z" },
                ],
              };
            },
          };
        },
      };
    },
  };

  const apiRes = await handlePlaceFixedPointTimelineApi("place_sanaru", pubDb as any);
  assert.equal(apiRes.status, 200);
  const body = (await apiRes.json()) as {
    ok: boolean;
    frames: Array<{ observationId: string; thumbUrl: string }>;
  };
  assert.equal(body.ok, true);
  assert.equal(body.frames.length, 2);
  assert.equal(body.frames[0]?.thumbUrl, "/thumb/400/asset_1");

  const pageRes = await handlePlaceTimelinePageRoute("place_sanaru", "ja", null, pubDb as any);
  assert.equal(pageRes.status, 200);
  const html = await pageRes.text();
  assert.match(html, /data-place-share-timeline="e12-e13-e1b"/);
  assert.match(html, /id="place-timeline-slider"/);
  assert.match(html, /placeId=place_sanaru/);
  assert.match(html, /2025年〜2026年/);
  assert.match(html, /data-testid="timeline-count">同じ場所で撮られた公開の記録 2件/);
  assert.match(html, /年ごとの記録/);
  assert.match(html, /2026年5月/);
  assert.match(html, /id="place-timeline-hero" src="\/thumb\/600\/asset_2"/);
  assert.match(html, /navigator\.clipboard\.writeText/);
  assert.match(html, /id="place-share-status"[^>]*aria-live="polite"/);
  assert.match(html, /この場所の URLをコピー|この場所のURLをコピー/);
  assert.match(html, /slider\.addEventListener\("input"/);
});
