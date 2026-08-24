import test from "node:test";
import assert from "node:assert/strict";
import {
  AREA_SPOT_MIN_PUBLIC_CONTRIBUTORS,
  AREA_SPOT_MIN_PUBLIC_RECORDS,
  AREA_SPOT_PUBLIC_COORDINATE_GRID_M,
  normalizeAreaEncyclopediaPayload,
  resolveAreaGuideTemplates,
  spotHasPublicCoordinates,
} from "./areaEncyclopediaPayload.js";

test("area encyclopedia payload normalizes optional P0 data safely", () => {
  const payload = normalizeAreaEncyclopediaPayload({
    area_encyclopedia: {
      page_kind: "spot",
      tags: ["水辺", "水辺", ""],
      spots: [
        {
          id: "a",
          name: "水辺入口",
          type: "water_care",
          lat: "34.700123",
          lng: "137.600456",
          public_record_count: AREA_SPOT_MIN_PUBLIC_RECORDS,
          public_contributor_count: AREA_SPOT_MIN_PUBLIC_CONTRIBUTORS,
          public_precision: "municipality",
          location_privacy: "public",
          risk_lane: "normal",
        },
        { id: "bad-type", name: "使わない", type: "ranking" },
        { id: "", name: "使わない", type: "food" },
      ],
      local_guides: [
        {
          id: "g1",
          title: "現地案内",
          status: "available",
          unlock_radius_m: "80",
          transcript_available: "true",
          audio_url: "https://example.com/private.mp3",
          transcript: "hidden",
        },
      ],
      guide_templates: ["water_edge", "seasonal_entry", "water_edge", "unknown"],
      actors: [
        { id: "org", name: "案内団体", role_label: "協力", url: "javascript:alert(1)" },
      ],
      external_links: [
        { label: "名鑑", url: "https://example.com/list" },
        { label: "危険", url: "javascript:alert(1)" },
      ],
    },
  });

  assert.equal(payload.pageKind, "spot");
  assert.deepEqual(payload.tags, ["水辺"]);
  assert.equal(payload.spots.length, 1);
  assert.equal(payload.spots[0]?.publicRecordCount, AREA_SPOT_MIN_PUBLIC_RECORDS);
  assert.equal(payload.spots[0]?.publicContributorCount, AREA_SPOT_MIN_PUBLIC_CONTRIBUTORS);
  assert.ok(payload.spots[0] && spotHasPublicCoordinates(payload.spots[0]));
  assert.notEqual(payload.spots[0]?.lat, 34.700123);
  assert.notEqual(payload.spots[0]?.lng, 137.600456);
  assert.equal(payload.localGuides[0]?.status, "available");
  assert.equal(payload.localGuides[0]?.transcriptAvailable, true);
  assert.deepEqual(payload.guideTemplates, ["water_edge", "seasonal_entry"]);
  assert.equal(payload.actors[0]?.url, "");
  assert.deepEqual(payload.externalLinks.map((link) => link.label), ["名鑑"]);
  assert.equal("audio_url" in payload.localGuides[0], false);
  assert.equal("transcript" in payload.localGuides[0], false);
});

test("area encyclopedia spot coordinates require k-anonymity and coarsening", () => {
  const payload = normalizeAreaEncyclopediaPayload({
    area_encyclopedia: {
      spots: [
        {
          id: "low-records",
          name: "少数記録",
          type: "observation_point",
          lat: 34.7101,
          lng: 137.7101,
          public_record_count: AREA_SPOT_MIN_PUBLIC_RECORDS - 1,
          public_contributor_count: AREA_SPOT_MIN_PUBLIC_CONTRIBUTORS,
        },
        {
          id: "low-contributors",
          name: "少数投稿者",
          type: "observation_point",
          lat: 34.7201,
          lng: 137.7201,
          public_record_count: AREA_SPOT_MIN_PUBLIC_RECORDS,
          public_contributor_count: AREA_SPOT_MIN_PUBLIC_CONTRIBUTORS - 1,
        },
        {
          id: "rare",
          name: "希少種候補",
          type: "observation_point",
          lat: 34.7301,
          lng: 137.7301,
          public_record_count: AREA_SPOT_MIN_PUBLIC_RECORDS,
          public_contributor_count: AREA_SPOT_MIN_PUBLIC_CONTRIBUTORS,
          risk_lane: "rare_sensitive",
        },
        {
          id: "exact-private",
          name: "私有詳細",
          type: "observation_point",
          lat: 34.7401,
          lng: 137.7401,
          public_record_count: AREA_SPOT_MIN_PUBLIC_RECORDS,
          public_contributor_count: AREA_SPOT_MIN_PUBLIC_CONTRIBUTORS,
          public_precision: "exact_private",
        },
        {
          id: "safe",
          name: "公開メッシュ",
          type: "observation_point",
          lat: 34.750123,
          lng: 137.750456,
          public_record_count: AREA_SPOT_MIN_PUBLIC_RECORDS,
          public_contributor_count: AREA_SPOT_MIN_PUBLIC_CONTRIBUTORS,
          public_precision: "mesh",
          location_privacy: "coarse",
          risk_lane: "normal",
        },
      ],
    },
  });

  const publicSpots = payload.spots.filter(spotHasPublicCoordinates);

  assert.deepEqual(publicSpots.map((spot) => spot.id), ["safe"]);
  assert.equal(AREA_SPOT_PUBLIC_COORDINATE_GRID_M, 500);
  assert.notEqual(publicSpots[0]?.lat, 34.750123);
  assert.notEqual(publicSpots[0]?.lng, 137.750456);
});

test("area encyclopedia spot coordinates fail closed without explicit public safety metadata", () => {
  const metadataCases = [
    {},
    { location_privacy: "public", risk_lane: "normal" },
    { public_precision: "municipality", risk_lane: "normal" },
    { public_precision: "municipality", location_privacy: "public" },
    { public_precision: "unrecognized", location_privacy: "public", risk_lane: "normal" },
    { public_precision: "municipality", location_privacy: "unrecognized", risk_lane: "normal" },
    { public_precision: "municipality", location_privacy: "public", risk_lane: "unrecognized" },
  ];
  const payload = normalizeAreaEncyclopediaPayload({
    area_encyclopedia: {
      spots: metadataCases.map((metadata, index) => ({
        id: `unsafe-${index}`,
        name: `公開制御不足${index}`,
        type: "observation_point",
        lat: 34.76 + index / 100,
        lng: 137.76 + index / 100,
        public_record_count: AREA_SPOT_MIN_PUBLIC_RECORDS,
        public_contributor_count: AREA_SPOT_MIN_PUBLIC_CONTRIBUTORS,
        ...metadata,
      })),
    },
  });

  assert.deepEqual(payload.spots.filter(spotHasPublicCoordinates).map((spot) => spot.id), []);
  assert.deepEqual(payload.spots.map((spot) => ({ lat: spot.lat, lng: spot.lng })), metadataCases.map(() => ({ lat: null, lng: null })));
});

test("area encyclopedia payload stays empty when the extension data is absent", () => {
  const payload = normalizeAreaEncyclopediaPayload({});

  assert.equal(payload.pageKind, "area");
  assert.deepEqual(payload.spots, []);
  assert.deepEqual(payload.localGuides, []);
  assert.deepEqual(payload.guideTemplates, []);
  assert.deepEqual(payload.actors, []);
  assert.deepEqual(payload.externalLinks, []);
});

test("area guide templates give ordinary parks a lightweight starting set", () => {
  const payload = normalizeAreaEncyclopediaPayload({});
  const templates = resolveAreaGuideTemplates(payload);

  assert.deepEqual(templates.map((item) => item.key), ["basic_park", "seasonal_entry", "tree_watch"]);
  assert.match(templates[0]?.summary ?? "", /普通の公園/);
});

test("area guide templates prefer water guidance when water care spots exist", () => {
  const payload = normalizeAreaEncyclopediaPayload({
    area_encyclopedia: {
      spots: [{ id: "water", name: "水辺", type: "water_care" }],
    },
  });
  const templates = resolveAreaGuideTemplates(payload);

  assert.deepEqual(templates.map((item) => item.key), ["water_edge", "seasonal_entry", "watch_material"]);
});
