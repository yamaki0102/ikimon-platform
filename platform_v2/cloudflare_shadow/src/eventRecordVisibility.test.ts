import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPostEventPublishPrompt,
  canViewEventRecord,
  isSensitiveOrRareEventRecord,
  normalizeEventRecordVisibility,
} from "./programs/eventRecordVisibility";

test("eventRecordVisibility defaults to event, enforces 3-tier access, excludes rare species, and builds post-event prompt", () => {
  assert.equal(normalizeEventRecordVisibility(undefined), "event");
  assert.equal(normalizeEventRecordVisibility("private"), "private");
  assert.equal(normalizeEventRecordVisibility("event"), "event");
  assert.equal(normalizeEventRecordVisibility("public"), "public");
  assert.equal(normalizeEventRecordVisibility("invalid"), null);

  // Private record: visible only to recorder, never to other participants or organizer
  const privateRec = { visibility: "private" as const, actorUserId: "u1", actorGuestToken: null, isSensitiveOrRare: false };
  assert.equal(canViewEventRecord(privateRec, { userId: "u1", guestToken: null, isOrganizer: false, isCheckedInParticipant: true }), true);
  assert.equal(canViewEventRecord(privateRec, { userId: "u2", guestToken: null, isOrganizer: false, isCheckedInParticipant: true }), false);
  assert.equal(canViewEventRecord(privateRec, { userId: "org", guestToken: null, isOrganizer: true, isCheckedInParticipant: false }), false);

  // Event record: visible to checked-in participants and organizer, not outsiders
  const eventRec = { visibility: "event" as const, actorUserId: "u1", actorGuestToken: null, isSensitiveOrRare: false };
  assert.equal(canViewEventRecord(eventRec, { userId: "u2", guestToken: null, isOrganizer: false, isCheckedInParticipant: true }), true);
  assert.equal(canViewEventRecord(eventRec, { userId: "org", guestToken: null, isOrganizer: true, isCheckedInParticipant: false }), true);
  assert.equal(canViewEventRecord(eventRec, { userId: "outsider", guestToken: null, isOrganizer: false, isCheckedInParticipant: false }), false);

  // Rare/sensitive species is excluded from public visibility
  assert.equal(isSensitiveOrRareEventRecord({ sensitive_precheck_failed: true }), true);
  assert.equal(isSensitiveOrRareEventRecord({ red_list_rank: "VU" }), true);
  assert.equal(isSensitiveOrRareEventRecord({ taxon_label: "アオサギ" }), false);
  const rareMarkedPublic = { visibility: "public" as const, actorUserId: "u1", actorGuestToken: null, isSensitiveOrRare: true };
  assert.equal(canViewEventRecord(rareMarkedPublic, { userId: "outsider", guestToken: null, isOrganizer: false, isCheckedInParticipant: false }), false);

  // Post-event prompt: null before end, prompt after end excluding rare records
  const openSession = { endedAt: new Date(Date.now() + 60_000).toISOString() };
  const endedSession = { endedAt: new Date(Date.now() - 60_000).toISOString() };
  const myRecords = [
    { visibility: "event" as const, isSensitiveOrRare: false },
    { visibility: "event" as const, isSensitiveOrRare: false },
    { visibility: "event" as const, isSensitiveOrRare: true },
  ];
  assert.equal(buildPostEventPublishPrompt(openSession, myRecords), null);
  assert.deepEqual(buildPostEventPublishPrompt(endedSession, myRecords), {
    eligibleCount: 2,
    excludedRareCount: 1,
    message: "今日の記録2件、公開しますか？",
  });
});
