import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAreaEncyclopediaPayload, resolveAreaGuideTemplates, spotHasPublicCoordinates } from "./areaEncyclopediaPayload.js";

test("area encyclopedia payload normalizes optional P0 data safely", () => {
  const payload = normalizeAreaEncyclopediaPayload({
    area_encyclopedia: {
      page_kind: "spot",
      tags: ["水辺", "水辺", ""],
      spots: [
        { id: "a", name: "水辺入口", type: "water_care", lat: "34.7", lng: "137.6", public_record_count: 3.9 },
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
  assert.equal(payload.spots[0]?.publicRecordCount, 3);
  assert.ok(payload.spots[0] && spotHasPublicCoordinates(payload.spots[0]));
  assert.equal(payload.localGuides[0]?.status, "available");
  assert.equal(payload.localGuides[0]?.transcriptAvailable, true);
  assert.deepEqual(payload.guideTemplates, ["water_edge", "seasonal_entry"]);
  assert.equal(payload.actors[0]?.url, "");
  assert.deepEqual(payload.externalLinks.map((link) => link.label), ["名鑑"]);
  assert.equal("audio_url" in payload.localGuides[0], false);
  assert.equal("transcript" in payload.localGuides[0], false);
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
