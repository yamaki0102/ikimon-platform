import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOfficialEventReport,
  canAccessOfficialEventOutputs,
  officialSpeciesCsv,
  speciesRecordsFromOfficialEvents,
  summarizeOfficialSpecies,
  type ObservationEventOfficialReport,
} from "./observationEventOfficialReport.js";
import type { ObservationEventSessionRow } from "./observationEventModeManager.js";

const baseSession: ObservationEventSessionRow = {
  sessionId: "session-1",
  legacyEventId: null,
  eventCode: "ABC123",
  title: "Biome MVP test",
  organizerUserId: "organizer-1",
  corporationId: null,
  plan: "community",
  primaryMode: "discovery",
  activeModes: ["discovery"],
  locationLat: null,
  locationLng: null,
  locationRadiusM: 1000,
  startedAt: "2026-06-12T09:00:00.000Z",
  endedAt: null,
  targetSpecies: [],
  config: {},
  fieldId: null,
  templateSourceSessionId: null,
  createdAt: "2026-06-12T09:00:00.000Z",
  updatedAt: "2026-06-12T09:00:00.000Z",
};

test("official event species records only include explicit observation events with taxon names", () => {
  const records = speciesRecordsFromOfficialEvents([
    {
      live_event_id: "live-1",
      type: "observation_added",
      scope: "all",
      team_id: "team-a",
      payload: { taxon_name: "アカメガシワ", observation_id: "obs-1", lat: 35.1, lng: 137.1 },
      created_at: "2026-06-12T09:01:00.000Z",
    },
    {
      live_event_id: "live-2",
      type: "guide_scene_added",
      scope: "all",
      team_id: null,
      payload: { detected_species: ["カワラヒワ"] },
      created_at: "2026-06-12T09:02:00.000Z",
    },
    {
      live_event_id: "live-3",
      type: "observation_added",
      scope: "all",
      team_id: null,
      payload: { note: "taxon missing" },
      created_at: "2026-06-12T09:03:00.000Z",
    },
  ]);

  assert.deepEqual(records, [
    {
      liveEventId: "live-1",
      observedAt: "2026-06-12T09:01:00.000Z",
      teamId: "team-a",
      taxonName: "アカメガシワ",
      recordKind: "observation_added",
      matchSource: "explicit_session_event",
      evidenceRef: "obs-1",
    },
  ]);
});

test("official event output gate allows public sessions or the organizer", () => {
  assert.equal(canAccessOfficialEventOutputs(baseSession, null), false);
  assert.equal(canAccessOfficialEventOutputs(baseSession, "someone-else"), false);
  assert.equal(canAccessOfficialEventOutputs(baseSession, "organizer-1"), true);
  assert.equal(canAccessOfficialEventOutputs({ ...baseSession, plan: "public" }, null), true);
});

test("official CSV omits exact coordinates and keeps explicit match source", () => {
  const records = speciesRecordsFromOfficialEvents([
    {
      live_event_id: "live-1",
      type: "observation_added",
      scope: "all",
      team_id: "team-a",
      payload: { taxon_name: "アカメガシワ", observation_id: "obs-1", lat: 35.1, lng: 137.1 },
      created_at: "2026-06-12T09:01:00.000Z",
    },
  ]);
  const report: ObservationEventOfficialReport = {
    schemaVersion: "observation_event_official_report/v1",
    session: baseSession,
    generatedAt: "2026-06-12T10:00:00.000Z",
    claimBoundary: { canSay: [], cannotSay: [] },
    privacyBoundary: { exactCoordinatesIncluded: false, sensitiveSpeciesRequiresOrganizerReview: true },
    stats: { officialObservationCount: 1, uniqueTaxaCount: 1, guideSceneCount: 0, fieldScanCount: 0 },
    topTaxa: summarizeOfficialSpecies(records),
    speciesRecords: records,
  };
  const csv = officialSpeciesCsv(report);

  assert.match(csv, /observed_at,taxon_name,team_id,record_kind,match_source,evidence_ref/);
  assert.match(csv, /explicit_session_event/);
  assert.doesNotMatch(csv, /35\.1|137\.1|lat|lng/);
});

test("official event report rejects non UUID ids before database lookup", async () => {
  const result = await buildOfficialEventReport("not-real");
  assert.equal(result, null);
});
