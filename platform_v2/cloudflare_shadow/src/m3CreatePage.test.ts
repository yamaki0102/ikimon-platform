import assert from "node:assert/strict";
import test from "node:test";
import { renderObservationEventCreatePage } from "./index.js";

test("M3 native create surface exposes the collaboration fields and safe handoff", () => {
  const body = renderObservationEventCreatePage({
    tokenHash: "fixture",
    userId: "m3-organizer",
    displayName: "M3 Organizer",
    roleName: "Observer",
    rankLabel: null,
  }, "m3-field");
  assert.match(body, /data-observation-event-create-form/);
  assert.match(body, /name="title"/);
  assert.match(body, /name="started_at"/);
  assert.match(body, /name="field_id" value="m3-field"/);
  assert.match(body, /name="event_code"/);
  assert.match(body, /\/api\/v1\/observation-events/);
  assert.match(body, /guide-programs/);
  assert.match(body, /private-until-explicit/);
});
