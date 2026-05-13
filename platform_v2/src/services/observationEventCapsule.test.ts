import test from "node:test";
import assert from "node:assert/strict";
import { buildPlaceEventCapsuleDraft } from "./observationEventCapsule.js";

const baseSession = {
  sessionId: "11111111-1111-4111-8111-111111111111",
  title: "連理の木の下 観察会",
  eventCode: "RENRI1",
  plan: "community" as const,
  locationLat: 34.7,
  locationLng: 137.7,
  locationRadiusM: 120,
  targetSpecies: ["エナガ"],
  startedAt: "2026-05-13T00:00:00.000Z",
  endedAt: "2026-05-13T02:00:00.000Z",
  config: {
    place_event: {
      place_label: "連理の木の下",
      source_modes: ["record", "guide", "field_scan"],
      ai_recap_enabled: true,
    },
  },
};

test("buildPlaceEventCapsuleDraft keeps source refs and suggested IDs", () => {
  const capsule = buildPlaceEventCapsuleDraft({
    session: baseSession,
    participants: [
      { participantId: "p1", displayName: "主催者", isMinor: false },
    ],
    liveEvents: [
      {
        liveEventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        type: "observation_added",
        teamId: null,
        createdAt: "2026-05-13T00:10:00.000Z",
        payload: { taxon_name: "エナガ", lat: 34.7, lng: 137.7 },
      },
      {
        liveEventId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        type: "guide_scene_added",
        teamId: null,
        createdAt: "2026-05-13T00:20:00.000Z",
        payload: {
          scene_summary: "樹皮の割れ目と草地の境目を観察",
          detected_species: ["アリ類"],
          primary_subject: { name: "アリ類", confidence: 0.62 },
        },
      },
      {
        liveEventId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        type: "field_scan_added",
        teamId: null,
        createdAt: "2026-05-13T00:30:00.000Z",
        payload: { scan_mode: "site_snapshot" },
      },
    ],
  });

  assert.equal(capsule.sourceCounts.observations, 1);
  assert.equal(capsule.sourceCounts.guideScenes, 1);
  assert.equal(capsule.sourceCounts.fieldScans, 1);
  assert.equal(capsule.recordCandidates[0]?.identificationStatus, "suggested");
  assert.ok(capsule.recordCandidates.some((candidate) => candidate.sourceType === "guide_scene" && candidate.taxonLabel === "アリ類"));
  assert.ok(capsule.publicStoryDraft.sections.every((section) => section.sourceRefs.length > 0 || section.heading === "場所の状態"));
  assert.ok(capsule.privateDigest.sourceRefs.includes("live:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"));
});

test("buildPlaceEventCapsuleDraft blocks public readiness for minors and faces", () => {
  const capsule = buildPlaceEventCapsuleDraft({
    session: baseSession,
    participants: [
      { participantId: "minor-1", displayName: "子ども", isMinor: true },
    ],
    liveEvents: [
      {
        liveEventId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        type: "guide_scene_added",
        teamId: null,
        createdAt: "2026-05-13T00:20:00.000Z",
        payload: {
          scene_summary: "集合写真に近い場面",
          facePrivacy: { status: "redacted", faceCount: 2 },
        },
      },
    ],
  });

  assert.equal(capsule.reviewStatus, "needs_review");
  assert.equal(capsule.readiness.publicReady, false);
  assert.ok(capsule.readiness.blockers.includes("privacy_risk_unresolved"));
  assert.ok(capsule.privacyRiskQueue.some((risk) => risk.riskType === "minor_present"));
  assert.ok(capsule.privacyRiskQueue.some((risk) => risk.riskType === "face_present"));
});
