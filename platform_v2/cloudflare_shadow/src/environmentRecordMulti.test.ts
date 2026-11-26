import assert from "node:assert/strict";
import test from "node:test";
import {
  compatibleEnvironmentRecordValues,
  mergeCompatibleUserEnvironmentRecordValues,
  normalizeCompatibleEnvironmentRecordInput,
  parseCompatibleStructuredJson,
  publicCompatibleEnvironmentRecord,
  serializeCompatibleStructuredJson,
} from "./environmentRecordMulti";

test("input: array, single string and legacy string all normalize to a list", () => {
  assert.deepEqual(normalizeCompatibleEnvironmentRecordInput("contact_surface", ["soil", "plant"]), ["soil", "plant"]);
  assert.deepEqual(normalizeCompatibleEnvironmentRecordInput("contact_surface", "soil"), ["soil"]);
  assert.deepEqual(normalizeCompatibleEnvironmentRecordInput("contact_surface", [" soil ", "soil", "plant"]), ["soil", "plant"]);
  assert.deepEqual(normalizeCompatibleEnvironmentRecordInput("place_type", "water_edge"), ["water_edge"]);
});

test("input: invalid values, empty lists and multi values for the single field are rejected", () => {
  assert.equal(normalizeCompatibleEnvironmentRecordInput("contact_surface", ["soil", "nope"]), null);
  assert.equal(normalizeCompatibleEnvironmentRecordInput("contact_surface", []), null);
  assert.equal(normalizeCompatibleEnvironmentRecordInput("contact_surface", ""), null);
  assert.equal(normalizeCompatibleEnvironmentRecordInput("contact_surface", null), null);
  assert.equal(normalizeCompatibleEnvironmentRecordInput("contact_surface", [{}]), null);
  assert.equal(normalizeCompatibleEnvironmentRecordInput("place_type", ["urban", "coast"]), null);
  assert.deepEqual(normalizeCompatibleEnvironmentRecordInput("place_type", ["urban"]), ["urban"]);
  assert.equal(normalizeCompatibleEnvironmentRecordInput("contact_surface", Array.from({ length: 40 }, () => "soil")), null);
});

test("input: unknown and none_visible never combine with other values", () => {
  assert.deepEqual(normalizeCompatibleEnvironmentRecordInput("contact_surface", ["unknown", "soil"]), ["soil"]);
  assert.deepEqual(normalizeCompatibleEnvironmentRecordInput("human_change", ["none_visible", "mowing", "unknown"]), ["mowing"]);
  assert.deepEqual(normalizeCompatibleEnvironmentRecordInput("human_change", ["none_visible", "unknown"]), ["none_visible"]);
  assert.deepEqual(normalizeCompatibleEnvironmentRecordInput("human_change", ["unknown"]), ["unknown"]);
});

test("merge writes primary plus _values and keeps other fields untouched", () => {
  const base = mergeCompatibleUserEnvironmentRecordValues({}, { contact_surface: ["soil", "plant"], surrounding_cover: ["low_grass", "water"] }, "u1");
  assert.equal(base.contact_surface, "soil");
  assert.equal(base.contact_surface_values, "soil,plant");
  assert.equal(base.contact_surface_source, "user");
  assert.equal(base.environment_record_status, "user_edited");
  const partial = mergeCompatibleUserEnvironmentRecordValues(base, { environment_condition: ["sunny", "windy"] }, "u1");
  assert.equal(partial.contact_surface_values, "soil,plant");
  assert.equal(partial.surrounding_cover_values, "low_grass,water");
  assert.equal(partial.environment_condition_values, "sunny,windy");
  const single = mergeCompatibleUserEnvironmentRecordValues(partial, { place_type: ["water_edge"] }, "u1");
  assert.equal(single.place_type, "water_edge");
  assert.equal("place_type_values" in single, false);
  assert.equal(single.contact_surface_values, "soil,plant");
  const replaced = mergeCompatibleUserEnvironmentRecordValues(single, { contact_surface: ["rock"] }, "u1");
  assert.equal(replaced.contact_surface, "rock");
  assert.equal(replaced.contact_surface_values, "rock");
  assert.equal(replaced.surrounding_cover_values, "low_grass,water");
});

test("serialize stores _values as arrays and parse reads them back as comma strings", () => {
  const merged = mergeCompatibleUserEnvironmentRecordValues({}, { contact_surface: ["soil", "plant"] }, "u1");
  const stored = JSON.parse(serializeCompatibleStructuredJson(merged)) as Record<string, unknown>;
  assert.deepEqual(stored.contact_surface_values, ["soil", "plant"]);
  assert.equal(stored.contact_surface, "soil");
  const parsed = parseCompatibleStructuredJson(JSON.stringify(stored));
  assert.equal(parsed.contact_surface_values, "soil,plant");
  assert.equal(parsed.contact_surface, "soil");
  const again = JSON.parse(serializeCompatibleStructuredJson(mergeCompatibleUserEnvironmentRecordValues(parsed, { human_change: ["mowing"] }, "u1"))) as Record<string, unknown>;
  assert.deepEqual(again.contact_surface_values, ["soil", "plant"]);
  assert.deepEqual(again.human_change_values, ["mowing"]);
});

test("parse drops non-string values except the known _values arrays", () => {
  const parsed = parseCompatibleStructuredJson(JSON.stringify({ contact_surface: "soil", contact_surface_values: ["soil", "", "plant", 3], other: ["x"], blank: "  ", n: 1, place_type_values: ["urban"] }));
  assert.deepEqual(parsed, { contact_surface: "soil", contact_surface_values: "soil,plant" });
  assert.deepEqual(parseCompatibleStructuredJson("not json"), {});
  assert.deepEqual(parseCompatibleStructuredJson(null), {});
});

test("values reader: _values, comma string and legacy single value", () => {
  assert.deepEqual(compatibleEnvironmentRecordValues({ contact_surface: "soil", contact_surface_values: "soil,plant" }, "contact_surface"), ["soil", "plant"]);
  assert.deepEqual(compatibleEnvironmentRecordValues({ contact_surface_values: ["rock", "plant"] }, "contact_surface"), ["rock", "plant"]);
  assert.deepEqual(compatibleEnvironmentRecordValues({ contact_surface: "soil" }, "contact_surface"), ["soil"]);
  assert.deepEqual(compatibleEnvironmentRecordValues({ contact_surface: "bogus", contact_surface_values: "bogus,plant" }, "contact_surface"), ["plant"]);
  assert.deepEqual(compatibleEnvironmentRecordValues({ contact_surface_values: "unknown,soil,soil" }, "contact_surface"), ["soil"]);
  assert.deepEqual(compatibleEnvironmentRecordValues({}, "contact_surface"), []);
  assert.deepEqual(compatibleEnvironmentRecordValues(null, "human_change"), []);
  assert.deepEqual(compatibleEnvironmentRecordValues({ place_type: "urban", place_type_values: "urban,coast" }, "place_type"), ["urban"]);
});

test("public record converts _values back to arrays", () => {
  assert.deepEqual(publicCompatibleEnvironmentRecord({ contact_surface: "soil", contact_surface_values: "soil,plant", place_type: "urban" }), {
    contact_surface: "soil",
    contact_surface_values: ["soil", "plant"],
    place_type: "urban",
  });
  assert.deepEqual(publicCompatibleEnvironmentRecord(null), {});
});
