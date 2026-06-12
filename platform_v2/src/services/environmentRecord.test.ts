import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveEnvironmentRecordFromSiteBrief,
  environmentRecordFieldSource,
  environmentRecordSourceLabel,
  environmentRecordValue,
  mergeUserEnvironmentRecordValues,
  normalizeEnvironmentRecordSnapshot,
  ENVIRONMENT_RECORD_FIELDS,
} from "./environmentRecord.js";
import { composeSiteBrief, type SiteSignals } from "./siteBrief.js";

function briefFor(signals: SiteSignals) {
  return composeSiteBrief(signals, "ja");
}

test("environment record derives conservative site-signal draft with provenance", () => {
  const signals: SiteSignals = {
    landcover: ["built_up"],
    nearbyLandcover: ["grassland"],
    waterDistanceM: null,
    elevationM: null,
  };
  const record = deriveEnvironmentRecordFromSiteBrief(signals, briefFor(signals));

  assert.equal(record.place_type, "grassland_urban_edge");
  assert.equal(record.place_type_source, "derived");
  assert.equal(record.human_change, "trampling_mowing");
  assert.equal(record.human_change_source, "derived");
  assert.match(record.place_type_confidence ?? "", /^0\.\d{2}$/);
  assert.equal(record.environment_record_status, "auto_draft");
});

test("environment record keeps ambiguous contact fields unknown instead of overclaiming", () => {
  const signals: SiteSignals = {
    landcover: [],
    nearbyLandcover: [],
    waterDistanceM: 60,
    elevationM: null,
  };
  const record = deriveEnvironmentRecordFromSiteBrief(signals, briefFor(signals));

  assert.equal(record.place_type, "water_edge");
  assert.equal(record.surrounding_cover, "water");
  assert.equal(record.environment_condition, "wet");
  assert.equal(record.contact_surface, undefined);
});

test("environment record user edits override source without dropping other draft fields", () => {
  const field = ENVIRONMENT_RECORD_FIELDS.find((item) => item.field === "place_type");
  assert.ok(field);
  const previous = {
    place_type: "grassland_urban_edge",
    place_type_source: "derived",
    surrounding_cover: "low_grass",
    surrounding_cover_source: "derived",
  };
  const merged = mergeUserEnvironmentRecordValues(previous, { place_type: "urban" });

  assert.equal(merged.place_type, "urban");
  assert.equal(merged.place_type_source, "user");
  assert.equal(merged.place_type_confidence, "1.00");
  assert.equal(merged.surrounding_cover, "low_grass");
  assert.equal(environmentRecordValue(merged, field), "urban");
  assert.equal(environmentRecordFieldSource(merged, field), "user");
  assert.equal(environmentRecordSourceLabel(merged, field), "保存済み");
});

test("environment record snapshot normalization accepts nested provenance shape", () => {
  const normalized = normalizeEnvironmentRecordSnapshot({
    place_type: { value: "wetland", source: "derived", confidence: 0.52 },
  });

  assert.deepEqual(normalized, {
    place_type: "wetland",
    place_type_source: "derived",
    place_type_confidence: "0.52",
  });
});
