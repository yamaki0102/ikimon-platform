import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPriorityReport,
  renderMarkdown,
} from "./prioritizeMunicipalWalkMapSources.js";

test("municipal walk map source priority separates light map entries from safety-review sources", () => {
  const report = buildPriorityReport();

  assert.equal(report.schemaVersion, "municipal_walk_map_source_priority/v0");
  assert.ok(report.totalSources >= 65);
  assert.ok(report.topLightEntries.length > 0);
  assert.ok(report.topLightEntries.length <= 12);
  assert.ok(report.topLightEntries.every((entry) => entry.lane === "map_first_light_entry"));
  assert.ok(report.topLightEntries.every((entry) => entry.score >= 36));

  const topIds = new Set(report.topLightEntries.map((entry) => entry.sourceId));
  assert.ok(topIds.has("shizuoka-ikimono-walk-route"));
  assert.ok(topIds.has("funabashi-nature-walk-maps"));
  assert.ok(topIds.has("yokosuka-maedagawa-riverside-walk"));

  const shizuoka = report.candidates.find((entry) => entry.sourceId === "shizuoka-ikimono-walk-route");
  assert.equal(shizuoka?.lane, "map_first_light_entry");
  assert.match(shizuoka?.reasons.join("\n") ?? "", /loose stops|route\/species map/);

  const childOrPhotoRisk = report.candidates.find((entry) => entry.sourceId === "fukui-pref-100yobako-worksheets");
  assert.equal(childOrPhotoRisk?.lane, "defer_until_safety_review");
  assert.ok((childOrPhotoRisk?.score ?? 0) < 22);

  const external = report.candidates.find((entry) => entry.sourceId === "kobe-biome-summer-quest");
  assert.notEqual(external?.lane, "map_first_light_entry");

  const lanes = new Map(report.lanes.map((lane) => [lane.lane, lane.count]));
  assert.ok((lanes.get("map_first_light_entry") ?? 0) > 0);
  assert.ok((lanes.get("guide_or_admin_seed") ?? 0) > 0);
  assert.ok((lanes.get("defer_until_safety_review") ?? 0) > 0);
});

test("municipal walk map source priority renders a compact review table", () => {
  const markdown = renderMarkdown(buildPriorityReport());

  assert.match(markdown, /Municipal Walk Map Source Priority/);
  assert.match(markdown, /map_first_light_entry/);
  assert.match(markdown, /guide_or_admin_seed/);
  assert.match(markdown, /Top Light Entries/);
  assert.match(markdown, /shizuoka-ikimono-walk-route/);
  assert.doesNotMatch(markdown, /見返|読み返|少し厚|貢献|順番通り|育つ場所/);
});
