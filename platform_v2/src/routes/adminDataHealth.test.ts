import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const adminDataHealthPath = fileURLToPath(new URL("./adminDataHealth.ts", import.meta.url));

test("admin data health separates Guide visual and text model stages", () => {
  const source = readFileSync(adminDataHealthPath, "utf8");

  assert.match(source, /stage_name: string/);
  assert.match(source, /WHEN endpoint = 'guide_scene_visual_extract' THEN 'visual_extract_model'/);
  assert.match(source, /WHEN endpoint = 'guide_scene_text' THEN 'text_model'/);
  assert.match(source, /GROUP BY chain_name, stage_name, layer/);
  assert.match(source, />stage<\/th>/);
});

test("admin data health surfaces AI candidate scientific name gaps", () => {
  const source = readFileSync(adminDataHealthPath, "utf8");

  assert.match(source, /type AiCandidateNameHealthSummaryRow/);
  assert.match(source, /fetchAiCandidateNameHealth/);
  assert.match(source, /raw_json\.candidate_readings/);
  assert.match(source, /raw_json\.coexisting_taxa/);
  assert.match(source, /observation_ai_subject_candidates/);
  assert.match(source, /missing_scientific_7d/);
  assert.match(source, /invalid_scientific_30d/);
  assert.match(source, /AI候補 scientific_name 欠落率/);
});
