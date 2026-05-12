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
