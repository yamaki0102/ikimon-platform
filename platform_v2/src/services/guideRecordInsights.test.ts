import assert from "node:assert/strict";
import test from "node:test";
import {
  bundleGuideRecords,
  canonicalizeTaxonList,
  canonicalizeSpeciesFeatures,
  type GuideRecordInsightRow,
} from "./guideRecordInsights.js";

function row(id: string, capturedAt: string, species: string[], featureName: string): GuideRecordInsightRow {
  return {
    guide_record_id: id,
    session_id: "guide-test",
    lat: 34.813,
    lng: 137.732,
    scene_summary: `${featureName}が見える`,
    detected_species: species,
    detected_features: [{ type: "vegetation", name: featureName, confidence: 0.8 }],
    created_at: capturedAt,
    captured_at: capturedAt,
    returned_at: capturedAt,
    delivery_state: "ready",
    seen_state: "saved",
    environment_context: "管理された草地",
    seasonal_note: null,
    primary_subject: null,
    meta: { guideMode: "walk" },
  };
}

test("canonicalizeTaxonList merges common Japanese guide variants", () => {
  const taxa = canonicalizeTaxonList(["イネ科の草本", "イネ科植物", "タンポポ", "タンポポ属", "レッドロビン"]);
  assert.deepEqual(taxa.map((item) => item.canonicalName), ["イネ科草本", "タンポポ属", "ベニカナメモチ"]);
  assert.equal(taxa[0]?.rank, "family");
  assert.deepEqual(taxa[1]?.sourceNames, ["タンポポ", "タンポポ属"]);
});

test("canonicalizeSpeciesFeatures keeps the original alias in notes", () => {
  const features = canonicalizeSpeciesFeatures([{ type: "species", name: "レッドロビン", confidence: 0.9 }]);
  assert.equal(features[0]?.name, "ベニカナメモチ");
  assert.match(features[0]?.note ?? "", /canonical: レッドロビン/);
});

test("canonicalization seed demotes artificial false positives", () => {
  const taxa = canonicalizeTaxonList(["スズキ", "イネ科植物"]);
  assert.deepEqual(taxa.map((item) => item.canonicalName), ["イネ科草本"]);

  const features = canonicalizeSpeciesFeatures([{ type: "species", name: "SUZUKI", confidence: 0.77 }]);
  assert.equal(features[0]?.type, "structure");
  assert.match(features[0]?.note ?? "", /人工物/);
});

test("canonicalization seed normalizes managed-place features", () => {
  const features = canonicalizeSpeciesFeatures([{ type: "landform", name: "排水溝・グレーチング", confidence: 0.66 }]);
  assert.equal(features[0]?.type, "structure");
  assert.equal(features[0]?.name, "排水設備");
  assert.match(features[0]?.note ?? "", /canonical/);
});

test("bundleGuideRecords creates representative cards within a 30 second window", () => {
  const rows = [
    row("g1", "2026-05-01T04:00:00.000Z", ["イネ科植物"], "芝生"),
    row("g2", "2026-05-01T04:00:12.000Z", ["イネ科の草本"], "芝生"),
    row("g3", "2026-05-01T04:00:45.000Z", ["タンポポ"], "タンポポ属"),
  ];
  const bundles = bundleGuideRecords(rows);
  assert.equal(bundles.length, 2);
  assert.equal(bundles[1]?.recordCount, 2);
  assert.deepEqual(bundles[1]?.canonicalTaxa.map((item) => item.canonicalName), ["イネ科草本"]);
  assert.equal(bundles[0]?.recordCount, 1);
});
