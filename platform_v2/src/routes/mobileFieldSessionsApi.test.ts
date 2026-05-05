import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const routePath = fileURLToPath(new URL("./mobileFieldSessionsApi.ts", import.meta.url));
const servicePath = fileURLToPath(new URL("../services/mobileFieldSessions.ts", import.meta.url));
const migrationPath = fileURLToPath(new URL("../../db/migrations/0090_mobile_field_session_receipts.sql", import.meta.url));

test("mobile field session API stores digest-only monitoring context with idempotent receipts", () => {
  const routeSource = readFileSync(routePath, "utf8");
  const serviceSource = readFileSync(servicePath, "utf8");
  const migrationSource = readFileSync(migrationPath, "utf8");

  assert.match(routeSource, /\/api\/v1\/mobile\/field-sessions\/:sessionId\/scene-digest/);
  assert.match(routeSource, /\/api\/v1\/mobile\/field-sessions\/:sessionId\/audio-events/);
  assert.match(routeSource, /\/api\/v1\/mobile\/field-sessions\/:sessionId\/end/);
  assert.match(routeSource, /\/api\/v1\/mobile\/field-sessions\/:sessionId\/recap/);
  assert.match(routeSource, /getSessionFromMobileAuth\(request\)/);
  assert.match(serviceSource, /saveGuideRecord\(/);
  assert.match(serviceSource, /upsertGuideEnvironmentMeshFromRecord\(/);
  assert.match(serviceSource, /recordGuideRoutePoint\(/);
  assert.match(serviceSource, /monitoringContext: normalizeObject\(body\.monitoring_context\)/);
  assert.match(serviceSource, /monitoringContext: input\.monitoringContext \?\? null/);
  assert.match(migrationSource, /unique \(install_id, client_scene_id\)/i);
  assert.doesNotMatch(routeSource + serviceSource, /raw_audio|raw_video|video_blob|audio_blob/);
});
