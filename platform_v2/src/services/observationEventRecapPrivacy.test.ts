import assert from "node:assert/strict";
import test from "node:test";
import {
  publicObservationEventRecapSession,
  sanitizeObservationEventTimeline,
} from "./observationEventRecap.js";
import type { ObservationEventSessionRow } from "./observationEventModeManager.js";

test("timeline sanitizer keeps only display-safe event fields", () => {
  const timeline = sanitizeObservationEventTimeline([
    {
      type: "observation_added",
      createdAt: "2026-07-19T01:00:00.000Z",
      payload: {
        taxon_name: "クスノキ",
        observation_id: "internal-observation-id",
        user_id: "user-secret",
        guest_token: "guest-secret",
        lat: 34.712345,
        lng: 137.712345,
      },
    },
    {
      type: "participant_location_ping",
      createdAt: "2026-07-19T01:01:00.000Z",
      payload: {
        participant_id: "participant-secret",
        display_name: "参加者",
        lat: 34.712345,
        lng: 137.712345,
      },
    },
    {
      type: "rally_task_submitted",
      createdAt: "2026-07-19T01:02:00.000Z",
      payload: {
        title: "樹皮を観察",
        review_status: "auto_accepted",
        count_value: 1,
        submission_id: "submission-secret",
        mission_id: "mission-secret",
        submission: { userId: "user-secret", lat: 34.7, lng: 137.7 },
      },
    },
  ]);

  assert.deepEqual(timeline, [
    {
      type: "observation_added",
      createdAt: "2026-07-19T01:00:00.000Z",
      payload: { taxon_name: "クスノキ" },
    },
    {
      type: "rally_task_submitted",
      createdAt: "2026-07-19T01:02:00.000Z",
      payload: { title: "樹皮を観察", review_status: "auto_accepted", count_value: 1 },
    },
  ]);
  assert.doesNotMatch(JSON.stringify(timeline), /secret|34\.7|137\.7|participant_location_ping/);
});

test("recap session DTO excludes exact location, organizer, config, and storage IDs", () => {
  const session: ObservationEventSessionRow = {
    sessionId: "event-public-handle",
    legacyEventId: "legacy-secret",
    eventCode: "RENRI",
    title: "連理の木の下で",
    organizerUserId: "organizer-secret",
    corporationId: "corporation-secret",
    plan: "community",
    primaryMode: "discovery",
    activeModes: ["discovery"],
    locationLat: 34.712345,
    locationLng: 137.712345,
    locationRadiusM: 50,
    startedAt: "2026-07-19T01:00:00.000Z",
    endedAt: null,
    targetSpecies: ["クスノキ"],
    config: { private_note: "secret" },
    fieldId: "field-secret",
    templateSourceSessionId: "template-secret",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-16T00:00:00.000Z",
  };

  assert.deepEqual(publicObservationEventRecapSession(session), {
    sessionId: "event-public-handle",
    eventCode: "RENRI",
    title: "連理の木の下で",
    plan: "community",
    primaryMode: "discovery",
    activeModes: ["discovery"],
    startedAt: "2026-07-19T01:00:00.000Z",
    endedAt: null,
    targetSpecies: ["クスノキ"],
  });
});
