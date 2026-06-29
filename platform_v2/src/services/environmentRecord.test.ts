import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveEnvironmentRecordFromAreaInference,
  deriveEnvironmentRecordFromSiteBrief,
  environmentRecordFieldSource,
  environmentRecordSourceLabel,
  environmentRecordValue,
  mergeAutoEnvironmentRecordValues,
  mergeUserEnvironmentRecordValues,
  normalizeEnvironmentRecordDraft,
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

test("environment record normalizes photo feedback draft with provenance", () => {
  const record = normalizeEnvironmentRecordDraft({
    place_type: { value: "grassland_urban_edge", confidence: 0.61 },
    contact_surface: { value: "soil_gravel_litter", confidence: 0.58 },
    human_change: { value: "not-allowed", confidence: 0.9 },
  }, { updatedAt: "2026-06-29T00:00:00.000Z" });

  assert.equal(record.place_type, "grassland_urban_edge");
  assert.equal(record.place_type_source, "derived");
  assert.equal(record.place_type_method, "record_photo_feedback_v1");
  assert.equal(record.contact_surface, "soil_gravel_litter");
  assert.equal(record.human_change, undefined);
  assert.equal(record.environment_record_status, "auto_draft");
});

test("environment record derives draft from visual area inference", () => {
  const record = deriveEnvironmentRecordFromAreaInference({
    vegetation_structure_candidates: [
      { label: "低い草地", why: "芝や草本が周囲に見える", confidence: 0.66 },
    ],
    human_influence_candidates: [
      { label: "踏圧・草刈り跡", why: "管理された芝生の縁", confidence: 0.57 },
    ],
    moisture_regime_candidates: [
      { label: "開けて乾き気味", why: "湿り気の証拠は弱い", confidence: 0.45 },
    ],
  }, { updatedAt: "2026-06-29T00:00:00.000Z" });

  assert.equal(record.place_type, "grassland_urban_edge");
  assert.equal(record.contact_surface, "plant");
  assert.equal(record.surrounding_cover, "low_grass");
  assert.equal(record.environment_condition, "open_dry");
  assert.equal(record.human_change, "trampling_mowing");
  assert.equal(record.human_change_source, "derived");
});

test("environment record auto merge never overwrites user saved values", () => {
  const merged = mergeAutoEnvironmentRecordValues({
    place_type: "urban",
    place_type_source: "user",
    surrounding_cover: "built_surface",
    surrounding_cover_source: "derived",
    surrounding_cover_confidence: "0.30",
  }, {
    place_type: "grassland_urban_edge",
    place_type_source: "derived",
    place_type_confidence: "0.70",
    surrounding_cover: "low_grass",
    surrounding_cover_source: "derived",
    surrounding_cover_confidence: "0.62",
  }, { updatedAt: "2026-06-29T00:00:00.000Z" });

  assert.equal(merged.place_type, "urban");
  assert.equal(merged.place_type_source, "user");
  assert.equal(merged.surrounding_cover, "low_grass");
  assert.equal(merged.surrounding_cover_confidence, "0.62");
  assert.equal(merged.environment_record_status, "auto_draft");
});
