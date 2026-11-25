import assert from "node:assert/strict";
import test from "node:test";
import worker from "./index";
import {
  aggregatePlaceSeasons,
  handlePlaceAboutOrSeasonsRoute,
  handlePlaceSeasonsApi,
} from "./zukanPlaceAboutAndSeasons";

test("aggregatePlaceSeasons groups public observations into 4 seasons comparing last year vs this year", () => {
  const summary = aggregatePlaceSeasons(
    [
      { observed_at: "2026-04-10T09:00:00Z" },
      { observed_at: "2026-04-15T09:00:00Z" },
      { observed_at: "2025-04-12T09:00:00Z" },
      { observed_at: "2025-10-03T09:00:00Z" },
    ],
    2026
  );

  const spring = summary.seasons.find((s) => s.key === "spring");
  const autumn = summary.seasons.find((s) => s.key === "autumn");
  assert.equal(spring?.thisYearCount, 2);
  assert.equal(spring?.lastYearCount, 1);
  assert.equal(autumn?.thisYearCount, 0);
  assert.equal(autumn?.lastYearCount, 1);
});

test("GET /api/v1/places/:id/seasons returns 404 for private/missing place and 200 for public place", async () => {
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
    new Request("https://shadow.test/api/v1/places/missing_place/seasons"),
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
                locality_label: "浜松市",
                place_kind: "park",
                public_summary: "水辺と森の公園です。",
                public_profile_status: "published",
              };
            },
            async all() {
              return {
                results: [{ observed_at: "2026-07-05T09:00:00Z" }],
              };
            },
          };
        },
      };
    },
  };

  const apiRes = await handlePlaceSeasonsApi("place_sanaru", pubDb as any, 2026);
  assert.equal(apiRes.status, 200);
  const body = (await apiRes.json()) as { ok: boolean; seasons: Array<{ key: string; thisYearCount: number }> };
  assert.equal(body.ok, true);
  assert.equal(body.seasons.find((s) => s.key === "summer")?.thisYearCount, 1);

  const aboutPage = await handlePlaceAboutOrSeasonsRoute("place_sanaru", "about", "ja", null, pubDb as any);
  assert.equal(aboutPage.status, 200);
  const aboutHtml = await aboutPage.text();
  assert.match(aboutHtml, /data-place-about="e6"/);
  assert.match(aboutHtml, /水辺と森の公園です。/);
  assert.ok(aboutHtml.includes("<dt>所在地</dt><dd>浜松市</dd>"));
  assert.ok(aboutHtml.includes("<dt>記録</dt><dd>1件（2026年から）</dd>"));

  const seasonsPage = await handlePlaceAboutOrSeasonsRoute("place_sanaru", "seasons", "ja", null, pubDb as any);
  assert.equal(seasonsPage.status, 200);
  assert.match(await seasonsPage.text(), /data-place-seasons="e7"/);
});
