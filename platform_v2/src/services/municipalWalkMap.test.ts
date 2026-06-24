import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMunicipalWalkMapPublicReadModelV0,
  getStaticMunicipalWalkMapConfigV0,
  listStaticMunicipalWalkMapPublicSummariesV0,
} from "./municipalWalkMap.js";

test("static municipal walk map summaries expose source links and loose walking cues", () => {
  const summaries = listStaticMunicipalWalkMapPublicSummariesV0();

  assert.ok(summaries.length >= 3);
  assert.ok(summaries.every((summary) => summary.sourceReferences.length >= 3));
  assert.ok(summaries.every((summary) => summary.routeStyle === "loose_stops"));
  assert.match(JSON.stringify(summaries), /https:\/\/www\.city\.shizuoka\.lg\.jp\/s6347\/s001494\.html/);
});

test("static municipal walk map detail builds record links only for public stops", () => {
  const config = getStaticMunicipalWalkMapConfigV0("jp-shizuoka-asahata-waterfront-sample-v0");
  assert.ok(config);

  const publicMap = buildMunicipalWalkMapPublicReadModelV0(config);

  assert.equal(publicMap.schemaVersion, "municipal_walk_map_public/v0");
  assert.equal(publicMap.title, "麻機の水辺を歩くサンプル");
  assert.equal(publicMap.stops[0]?.accessLabel, "public_scope");
  assert.match(publicMap.stops[0]?.recordHref ?? "", /context=municipal_walk_map/);
  assert.match(publicMap.stops[0]?.recordHref ?? "", /walkMapId=jp-shizuoka-asahata-waterfront-sample-v0/);
  assert.match(publicMap.stops[0]?.recordHref ?? "", /stopId=asahata-water-edge/);
  assert.match(JSON.stringify(publicMap.sourceReferences), /本文や図版は転載せず/);
});
