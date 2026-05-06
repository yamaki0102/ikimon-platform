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
  assert.match(sceneRoute, /const frames = parseFrameBundle\(body\)/);
  assert.match(sceneRoute, /frames,/);
  assert.match(sceneRoute, /frameBundleSummary/);
  assert.match(sceneRoute, /visualCandidate/);
  assert.match(sceneRoute, /parseClientSceneId\(body\.clientSceneId\)/);
  assert.match(sceneRoute, /sceneJobs\.get\(clientSceneId\)/);
  assert.match(sceneRoute, /const sceneId = clientSceneId \?\? randomUUID\(\)/);
  assert.match(source, /decideGuideAutoSave/);
  assert.match(source, /getSiteBrief/);
  assert.match(source, /clientSceneId\?: string stable client id for offline retry idempotency/);
  assert.match(normalizedSource, /Indoor\/person-only\/duplicate scenes remain transient/);
  assert.match(manualSaveRoute, /saveGuideRecord\(/);
  assert.match(source, /app\.post\("\/api\/v1\/guide\/telemetry"/);
  assert.match(source, /pointKind: "telemetry"/);
  assert.match(source, /liveCoverageCellSizeM: 10/);
  assert.match(source, /geometry: row\.polygon/);
  assert.match(source, /bbox_min_lat/);
  assert.match(source, /privacy: "exact_route_private_public_area_or_100m_mesh"/);
  assert.match(source, /absenceState: "non_detection_note"/);
  assert.doesNotMatch(source, /absenceState: "confirmed_absence"/);
});
