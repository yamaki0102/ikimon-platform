import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Fastify from "fastify";
import { getObservationEventStrings } from "../i18n/observationEventStrings.js";
import type { ObservationEventSessionRow } from "../services/observationEventModeManager.js";
import { eventEditScript, renderEventEditBody } from "../ui/observationEventEdit.js";
import { registerObservationEventApiRoutes } from "./observationEventApi.js";

const apiSource = readFileSync(new URL("./observationEventApi.ts", import.meta.url), "utf8");
const editSource = readFileSync(new URL("../ui/observationEventEdit.ts", import.meta.url), "utf8");

const EDIT_SESSION: ObservationEventSessionRow = {
  sessionId: "session-a",
  legacyEventId: null,
  eventCode: "ACT123",
  title: "地域の記録会",
  organizerUserId: "organizer-a",
  corporationId: null,
  plan: "community",
  primaryMode: "discovery",
  activeModes: ["discovery"],
  locationLat: null,
  locationLng: null,
  locationRadiusM: 1000,
  startedAt: "2026-09-02T01:00:00.000Z",
  endedAt: null,
  targetSpecies: [],
  config: {},
  fieldId: "field-a",
  templateSourceSessionId: null,
  createdAt: "2026-09-01T05:00:00.000Z",
  updatedAt: "2026-09-01T05:00:00.000Z",
};

function routeBlock(methodPath: string): string {
  const start = apiSource.indexOf(methodPath);
  assert.notEqual(start, -1, `missing route ${methodPath}`);
  const end = apiSource.indexOf("\n  //", start);
  return apiSource.slice(start, end < 0 ? undefined : end);
}

test("activation denies cross-origin and anonymous callers, then requires its key and semantic fields", async () => {
  const previous = {
    nodeEnv: process.env.NODE_ENV,
    enabled: process.env.ENABLE_DEV_DUMMY_ADMIN,
    token: process.env.DEV_DUMMY_ADMIN_TOKEN,
  };
  process.env.NODE_ENV = "test";
  process.env.ENABLE_DEV_DUMMY_ADMIN = "1";
  process.env.DEV_DUMMY_ADMIN_TOKEN = "activation-route-test";

  const app = Fastify();
  await registerObservationEventApiRoutes(app);
  await app.ready();
  const sameOriginHeaders = {
    host: "localhost:3200",
    origin: "http://localhost:3200",
    "sec-fetch-site": "same-origin",
    "content-type": "application/json",
  };
  const organizerHeaders = {
    ...sameOriginHeaders,
    cookie: "ikimon_v2_session=activation-route-test",
  };

  try {
    const crossOrigin = await app.inject({
      method: "POST",
      url: "/api/v1/observation-events",
      headers: {
        ...organizerHeaders,
        origin: "https://attacker.example",
        "sec-fetch-site": "cross-site",
      },
      payload: {},
    });
    assert.equal(crossOrigin.statusCode, 403);
    assert.match(crossOrigin.body, /same_origin_required/);

    const anonymous = await app.inject({
      method: "POST",
      url: "/api/v1/observation-events",
      headers: sameOriginHeaders,
      payload: {},
    });
    assert.equal(anonymous.statusCode, 401);
    assert.deepEqual(anonymous.json(), { error: "login required" });

    const missingKey = await app.inject({
      method: "POST",
      url: "/api/v1/observation-events",
      headers: organizerHeaders,
      payload: {},
    });
    assert.equal(missingKey.statusCode, 400);
    assert.deepEqual(missingKey.json(), { error: "event_code activation key required" });

    const missingStart = await app.inject({
      method: "POST",
      url: "/api/v1/observation-events",
      headers: organizerHeaders,
      payload: { event_code: "ACT123" },
    });
    assert.equal(missingStart.statusCode, 400);
    assert.deepEqual(missingStart.json(), { error: "started_at required" });

    const missingTitle = await app.inject({
      method: "POST",
      url: "/api/v1/observation-events",
      headers: organizerHeaders,
      payload: { event_code: "ACT123", started_at: "2026-09-02T01:00:00.000Z" },
    });
    assert.equal(missingTitle.statusCode, 400);
    assert.deepEqual(missingTitle.json(), { error: "title required" });

    const missingPlace = await app.inject({
      method: "POST",
      url: "/api/v1/observation-events",
      headers: organizerHeaders,
      payload: {
        event_code: "ACT123",
        started_at: "2026-09-02T01:00:00.000Z",
        title: "地域の記録会",
      },
    });
    assert.equal(missingPlace.statusCode, 400);
    assert.deepEqual(missingPlace.json(), { error: "field_id or location_lat/location_lng required" });
  } finally {
    await app.close();
    if (previous.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.nodeEnv;
    if (previous.enabled === undefined) delete process.env.ENABLE_DEV_DUMMY_ADMIN;
    else process.env.ENABLE_DEV_DUMMY_ADMIN = previous.enabled;
    if (previous.token === undefined) delete process.env.DEV_DUMMY_ADMIN_TOKEN;
    else process.env.DEV_DUMMY_ADMIN_TOKEN = previous.token;
  }
});

test("activation maps semantic collisions to 409 and keeps an established invite code immutable", () => {
  const create = routeBlock('app.post("/api/v1/observation-events"');
  const update = routeBlock("// PATCH /api/v1/observation-events/:sessionId  —");

  assert.ok(create.indexOf("assertSameOriginRequest(request)") < create.indexOf("getSessionFromCookie"));
  assert.match(create, /ObservationEventActivationConflictError/);
  assert.match(create, /reply\.status\(409\)\.send\(\{ error: error\.code \}\)/);
  assert.match(update, /requestedEventCode !== session\.eventCode/);
  assert.match(update, /event_code is immutable after activation/);
  assert.match(editSource, /session\.eventCode \? ' readonly aria-readonly="true"' : ""/);
  assert.match(editSource, /招待リンクを安定させるため、作成後は変更できません/);
});

test("legacy sessions without a code remain editable while established invite codes stay immutable", () => {
  const strings = getObservationEventStrings("ja");
  const established = renderEventEditBody({
    session: { ...EDIT_SESSION, eventCode: "miyakoda-summer" },
    strings,
  });
  const legacy = renderEventEditBody({ session: { ...EDIT_SESSION, eventCode: null }, strings });
  const script = eventEditScript();

  assert.match(established, /name="event_code"[^>]*value="miyakoda-summer"[^>]*readonly aria-readonly="true"/);
  assert.doesNotMatch(legacy, /name="event_code"[^>]*readonly/);
  assert.match(legacy, /空欄のままでも他の項目を編集できます/);
  assert.match(script, /eventCodeInput && !eventCodeInput\.readOnly/);
  assert.match(script, /\.\.\.\(eventCode \? \{ event_code: eventCode \} : \{\}\)/);
});
