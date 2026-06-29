import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  AreaSketchAssessmentValidationError,
  buildAreaSketchAssessmentDraft,
  isAreaSketchAssessmentVisibility,
} from "./areaSketchAssessments.js";

const migrationPath = fileURLToPath(new URL("../../db/migrations/0119_area_sketch_assessments.sql", import.meta.url));

test("area sketch assessment draft builds separated result payload without touching field payload", () => {
  const draft = buildAreaSketchAssessmentDraft({
    fieldId: "11111111-1111-4111-8111-111111111111",
    actorUserId: "user-1",
    policyVersion: "tsunag_2026_current",
    sketchPolygon: {
      type: "Polygon",
      coordinates: [[
        [137.7043, 34.6984],
        [137.706, 34.6984],
        [137.706, 34.6996],
        [137.7043, 34.6996],
        [137.7043, 34.6984],
      ]],
    },
    landCover: [
      { category: "trees_planting", ratio: 0.15 },
      { category: "building", ratio: 0.25 },
    ],
    evidencePayload: { photos: ["photo-1"] },
  });

  assert.equal(draft.insert.status, "draft");
  assert.equal(draft.insert.visibility, "private");
  assert.equal(draft.insert.estimateVersion, "area_sketch_estimate_v1");
  assert.equal(draft.insert.resultPayload.policyVersion, "tsunag_2026_current");
  assert.equal(draft.insert.claimBoundary.requiredDisclaimer.includes("正式申請"), true);
  assert.equal(draft.insert.auditPayload.generated_by, "area_sketch_assist");
  assert.ok(draft.insert.areaHa > 0);
});

test("area sketch assessment draft rejects self-intersecting sketches before DB write", () => {
  assert.throws(
    () => buildAreaSketchAssessmentDraft({
      fieldId: "11111111-1111-4111-8111-111111111111",
      actorUserId: "user-1",
      sketchPolygon: {
        type: "Polygon",
        coordinates: [[
          [137.7043, 34.6984],
          [137.706, 34.6996],
          [137.706, 34.6984],
          [137.7043, 34.6996],
          [137.7043, 34.6984],
        ]],
      },
      landCover: [],
    }),
    (error) => error instanceof AreaSketchAssessmentValidationError &&
      error.code === "invalid_sketch_polygon",
  );
});

test("area sketch assessment migration keeps draft diagnostics out of observation field payload", () => {
  const sql = readFileSync(migrationPath, "utf8");

  assert.match(sql, /CREATE TABLE IF NOT EXISTS area_sketch_assessments/);
  assert.match(sql, /field_id\s+UUID\s+NOT NULL REFERENCES observation_fields/);
  assert.match(sql, /result_payload\s+JSONB\s+NOT NULL/);
  assert.match(sql, /claim_boundary\s+JSONB\s+NOT NULL/);
  assert.doesNotMatch(sql, /ALTER TABLE observation_fields[\s\S]*payload/i);
});

test("area sketch assessment visibility is explicitly bounded", () => {
  assert.equal(isAreaSketchAssessmentVisibility("private"), true);
  assert.equal(isAreaSketchAssessmentVisibility("field_managers"), true);
  assert.equal(isAreaSketchAssessmentVisibility("public"), false);
});
