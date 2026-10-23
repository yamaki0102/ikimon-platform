import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { makeGuideLiveTokenRouteHandler } from "./guideApi.js";

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
  assert.match(source, /function parseAudioMimeType\(raw: unknown\): string \| null/);
  assert.match(sceneRoute, /audioMimeType: parseAudioMimeType\(body\.audioMimeType\)/);
  assert.match(sceneRoute, /parseClientSceneId\(body\.clientSceneId\)/);
  assert.match(sceneRoute, /sceneJobs\.get\(clientSceneId\)/);
  assert.match(sceneRoute, /const sceneId = clientSceneId \?\? randomUUID\(\)/);
  assert.match(source, /const SCENE_JOB_TTL_MS = 30 \* 60 \* 1000/);
  assert.match(source, /function pruneSceneJobs\(\): void/);
  assert.match(source, /sceneJobs\.delete\(sceneId\)/);
  assert.match(source, /decideGuideAutoSave/);
  assert.match(source, /getSiteBrief/);
  assert.match(source, /clientSceneId\?: string stable client id for offline retry idempotency/);
  assert.match(normalizedSource, /Indoor\/person-only\/duplicate scenes remain transient/);
  assert.match(manualSaveRoute, /saveGuideRecord\(/);
  assert.match(source, /app\.post<\{ Params: \{ guideRecordId: string \} \}>\(\s*"\/api\/v1\/guide\/records\/:guideRecordId\/promote"/);
  assert.match(source, /assertSameOriginRequest\(request\)/);
  assert.match(source, /assertAuthRateLimit\(\["guide-promote", session\.userId, request\.ip\]/);
  assert.match(source, /promoteGuideRecordToObservation\(/);
  assert.match(source, /nextAction: guidePromotionNextAction\(message\)/);
  assert.match(source, /app\.post\("\/api\/v1\/guide\/telemetry"/);
  assert.match(source, /app\.get\("\/api\/v1\/guides\/unlocks"/);
  assert.match(source, /listMyGuideUnlocks\(session\.userId\)/);
  assert.match(source, /app\.post<\{ Params: \{ guideSpotId: string \} \}>\("\/api\/v1\/guides\/unlocks\/:guideSpotId\/listened"/);
  assert.match(source, /pointKind: "telemetry"/);
  assert.match(source, /liveCoverageCellSizeM: 10/);
  assert.match(source, /fields: \[\]/);
  assert.doesNotMatch(source, /resolveFieldsForPoint/);
  assert.doesNotMatch(source, /from observation_fields/);
  assert.match(source, /privacy: "exact_route_private_public_area_or_100m_mesh"/);
  assert.match(source, /absenceState: "non_detection_note"/);
  assert.match(source, /次に見る指示は出さず/);
  assert.match(source, /移動中の通過ログ/);
  assert.match(source, /shouldRetainSkippedGuideScene/);
  assert.match(source, /retainedForOutcomeReview/);
  assert.match(source, /deliveryState: "archived"/);
  assert.match(source, /seenState: "dismissed"/);
  assert.doesNotMatch(source, /absenceState: "confirmed_absence"/);
  assert.doesNotMatch(source, /停車後/);
});

test("guide live token rejects banned sessions before token creation", async () => {
  let tokenCalls = 0;
  let statusCode = 200;
  const handler = makeGuideLiveTokenRouteHandler({
    getSession: async () => ({
      userId: "banned-guide-user", displayName: "Banned", roleName: "Observer",
      rankLabel: null, banned: true, expiresAt: "2099-01-01T00:00:00.000Z", tokenHash: "test",
    }),
    createToken: async () => { tokenCalls += 1; return { token: "test-only", model: "test-model", expiresAt: "2099-01-01T00:00:00.000Z", newSessionExpiresAt: "2099-01-01T00:00:00.000Z" }; },
  });
  const reply = {
    status(code: number) { statusCode = code; return this; },
    send(payload: unknown) { return payload; },
  };

  const response = await handler({ headers: { cookie: "session=test" }, body: {} } as never, reply as never);
  assert.equal(statusCode, 403);
  assert.deepEqual(response, { error: "account unavailable" });
  assert.equal(tokenCalls, 0);
});

test("guide live token still mints for an active authenticated session", async () => {
  let tokenCalls = 0;
  let statusCode = 200;
  const handler = makeGuideLiveTokenRouteHandler({
    getSession: async () => ({
      userId: "active-guide-user", displayName: "Active", roleName: "Observer",
      rankLabel: null, banned: false, expiresAt: "2099-01-01T00:00:00.000Z", tokenHash: "test",
    }),
    createToken: async () => { tokenCalls += 1; return { token: "test-only", model: "test-model", expiresAt: "2099-01-01T00:00:00.000Z", newSessionExpiresAt: "2099-01-01T00:00:00.000Z" }; },
  });
  const reply = {
    status(code: number) { statusCode = code; return this; },
    send(payload: unknown) { return payload; },
  };

  const response = await handler({ headers: { cookie: "session=test" }, body: {} } as never, reply as never);
  assert.equal(statusCode, 200);
  assert.deepEqual(response, { token: "test-only", model: "test-model", expiresAt: "2099-01-01T00:00:00.000Z", newSessionExpiresAt: "2099-01-01T00:00:00.000Z" });
  assert.equal(tokenCalls, 1);
});
