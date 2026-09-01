import assert from "node:assert/strict";
import test from "node:test";
import { renderObservationEventCreatePage, renderObservationEventRecapPage } from "./index.js";

test("M3 native create surface exposes the collaboration fields and safe handoff", () => {
  const body = renderObservationEventCreatePage({
    tokenHash: "fixture",
    userId: "m3-organizer",
    displayName: "M3 Organizer",
    roleName: "Observer",
    rankLabel: null,
    banned: false,
    expiresAt: "2099-01-01T00:00:00.000Z",
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

test("M6.3 native rehost prefills configuration only and excludes lifecycle state", () => {
  const body = renderObservationEventCreatePage({
    tokenHash: "fixture",
    userId: "m6-organizer",
    displayName: "M6 Organizer",
    roleName: "Observer",
    rankLabel: null,
    banned: false,
    expiresAt: "2099-01-01T00:00:00.000Z",
  }, "", {
    sessionId: "event-source",
    eventCode: "SOURCE",
    title: "Spring walk",
    organizerUserId: "m6-organizer",
    primaryMode: "discovery",
    targetSpecies: ["bird"],
    fieldId: "field-1",
    activeModes: ["discovery"],
    config: { public_list_visibility: "private-until-explicit" },
  } as never);
  assert.match(body, /Spring walk（再開催）/);
  assert.match(body, /name="field_id" value="field-1"/);
  assert.match(body, /template_source_session_id/);
  assert.match(body, /configuration-only/);
  assert.match(body, /参加者・同意・review・公開状態は引き継ぎません/);
  assert.doesNotMatch(body, /participant_id|consent_status|review_status|publication_status/);
});

test("M6.3 native recap exposes rehost only to the organizer", () => {
  const common = {
    session: { sessionId: "event-source", title: "Spring walk" },
    highlights: { observationCount: 0, uniqueSpeciesCount: 0, participantsCount: 1 },
    photos: [],
  };
  const organizer = renderObservationEventRecapPage({ ...common, permissions: { canManage: true } });
  const participant = renderObservationEventRecapPage({ ...common, permissions: { canManage: false } });
  assert.match(organizer, /template_from=event-source/);
  assert.match(organizer, /参加者・同意・review・公開状態は引き継ぎません/);
  assert.doesNotMatch(participant, /template_from=event-source/);
});
