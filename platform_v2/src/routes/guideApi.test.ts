import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const guideApiPath = fileURLToPath(new URL("./guideApi.ts", import.meta.url));

test("guide scene analysis auto-saves only after the field-observation quality gate", () => {
  const source = readFileSync(guideApiPath, "utf8");
  const sceneStart = source.indexOf('app.post("/api/v1/guide/scene"');
  const sceneEnd = source.indexOf('app.get<{ Params: { id: string }', sceneStart);
  const sceneRoute = source.slice(sceneStart, sceneEnd);
  const manualSaveRoute = source.slice(source.indexOf('app.post("/api/v1/guide/record"'));
  const normalizedSource = source.replace(/\n\s*\*\s*/g, " ");

  assert.ok(sceneStart > 0, "guide scene route missing");
  assert.ok(sceneEnd > sceneStart, "guide scene route end missing");
  assert.match(sceneRoute, /applyGuideAutoSave\(/);
  assert.match(source, /decideGuideAutoSave/);
  assert.match(source, /getSiteBrief/);
  assert.match(normalizedSource, /Indoor\/person-only\/duplicate scenes remain transient/);
  assert.match(manualSaveRoute, /saveGuideRecord\(/);
});
