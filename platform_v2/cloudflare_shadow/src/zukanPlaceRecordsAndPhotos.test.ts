import assert from "node:assert/strict";
import test from "node:test";
import worker from "./index";
import {
  loadPlacePublicRecordsAndPhotos,
  renderPlaceRecordsAndPhotosPage,
} from "./zukanPlaceRecordsAndPhotos";

test("loadPlacePublicRecordsAndPhotos queries only public observations for the place", async () => {
  let capturedSql = "";
  const fakeDb = {
    prepare(sql: string) {
      capturedSql = sql;
      return {
        bind() {
          return {
            async all() {
              return {
                results: [
                  {
                    observation_id: "obs_pub_1",
                    taxon_label: "アゲハ",
                    observed_at: "2026-11-20T09:00:00Z",
                    asset_id: "asset_1",
                  },
                ],
              };
            },
          };
        },
      };
    },
  };

  const data = await loadPlacePublicRecordsAndPhotos(fakeDb as any, "place_sanaru", 24);
  assert.match(capturedSql, /visibility\s*=\s*'public'/);
  assert.equal(data.records.length, 1);
  assert.equal(data.photos.length, 1);
  assert.equal(data.records[0]?.observationId, "obs_pub_1");
});

test("renderPlaceRecordsAndPhotosPage renders E2 PC layout, E4 records list, and E5 photos grid", () => {
  const records = [
    {
      observationId: "obs_1",
      taxonName: "カワセミ",
      observedAt: "2026-11-20T09:00:00Z",
      photoAssetId: "asset_1",
    },
  ];
  const photos = [
    {
      observationId: "obs_1",
      assetId: "asset_1",
      taxonName: "カワセミ",
    },
  ];

  const recordsHtml = renderPlaceRecordsAndPhotosPage({
    placeId: "place_sanaru",
    placeName: "佐鳴湖公園",
    lang: "ja",
    tab: "records",
    authenticated: false,
    records,
    photos,
  });
  assert.match(recordsHtml, /data-place-view="e2-e4-e5"/);
  assert.match(recordsHtml, /カワセミ/);
  assert.match(recordsHtml, /href="\/ja\/places\/place_sanaru\/photos"/);
  assert.match(recordsHtml, /min-width:\s*960px/);

  const photosHtml = renderPlaceRecordsAndPhotosPage({
    placeId: "place_sanaru",
    placeName: "佐鳴湖公園",
    lang: "ja",
    tab: "photos",
    authenticated: false,
    records,
    photos,
  });
  assert.match(photosHtml, /data-place-tab="photos"/);
  assert.match(photosHtml, /\/thumb\/400\/asset_1/);
});

test("GET /ja/places/:id/records and /ja/places/:id/photos return 200 HTML", async () => {
  const fakeDb = {
    prepare() {
      return {
        bind() {
          return {
            async first() {
              return { place_id: "place_sanaru", canonical_name: "佐鳴湖公園", public_profile_status: "published" };
            },
            async all() {
              return { results: [] };
            },
          };
        },
      };
    },
  };

  const resRecords = await worker.fetch(
    new Request("https://shadow.test/ja/places/place_sanaru/records"),
    { OBS_DB: fakeDb } as any
  );
  assert.equal(resRecords.status, 200);
  assert.match(await resRecords.text(), /data-place-view="e2-e4-e5"/);

  const resPhotos = await worker.fetch(
    new Request("https://shadow.test/ja/places/place_sanaru/photos"),
    { OBS_DB: fakeDb } as any
  );
  assert.equal(resPhotos.status, 200);
  assert.match(await resPhotos.text(), /data-place-tab="photos"/);
});
