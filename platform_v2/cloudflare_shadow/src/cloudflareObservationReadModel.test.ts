import assert from "node:assert/strict";
import test from "node:test";
import {
  buildObservationFirstRecordDetail,
  compareLegacyAndObservationFirstRecord,
  publicRecordDetailPrivacyFindings,
  summarizeRecordShadowComparison,
  type RecordObservationReadSnapshot,
} from "./cloudflareObservationReadModel";

const snapshot = (overrides: Partial<RecordObservationReadSnapshot> = {}): RecordObservationReadSnapshot => ({
  recordId: "record-1",
  ownerUserId: "owner-1",
  visibility: "public",
  policy: { visibility: "public", accepts_identification_proposals: 1, accepts_media_proposals: 1 },
  observations: [],
  media: [],
  claims: [],
  aiSuggestions: [],
  ...overrides,
});

const observation = (id: string, origin: "owner" | "ai" = "owner", subject: "organism" | "pet" | "unknown_subject" | "group" = "organism") => ({
  observation_id: id,
  source_key: `source:${id}`,
  record_id: "record-1",
  owner_user_id: "owner-1",
  origin,
  assertion_status: origin === "ai" ? "provisional" as const : "human_asserted" as const,
  verification_status: "unreviewed",
  lifecycle_status: "active" as const,
  data_use_scope: "personal_only" as const,
  accepted_identification_id: null,
  subject_type: subject === "pet" ? "organism" as const : subject,
  captive_context: subject === "pet" ? "pet" as const : "unknown" as const,
  display_order: origin === "owner" ? 0 : 1,
  context_json: "{}",
  provenance_json: "{}",
});

test("record container supports zero, one and many observation cards", () => {
  assert.equal(buildObservationFirstRecordDetail(snapshot(), "owner-1")?.observationCount, 0);
  assert.equal(buildObservationFirstRecordDetail(snapshot({ observations: [observation("o1")] }), null)?.observationCount, 1);
  assert.equal(buildObservationFirstRecordDetail(snapshot({ observations: [observation("o1"), observation("o2", "ai")] }), null)?.observationCount, 2);
});

test("AI remains provisional and cannot become a community vote or accepted decision", () => {
  const detail = buildObservationFirstRecordDetail(snapshot({
    observations: [observation("o1"), observation("o2", "ai")],
    aiSuggestions: [{ suggestion_id: "ai-1", observation_id: "o2", proposed_name: "アブラゼミ", proposed_scientific_name: null, proposed_rank: null, rationale_json: JSON.stringify({ visualEvidence: ["透明な翅"], needsMoreEvidence: ["腹側も撮る"] }), suggestion_status: "active" }],
  }), null)!;
  const ai = detail.observations[1]!;
  assert.equal(ai.assertionStatus, "provisional");
  assert.equal(ai.acceptedIdentification, null);
  assert.equal(ai.communityIdentifications.length, 0);
  assert.equal(ai.aiSuggestions[0]?.provisional, true);
  assert.deepEqual(ai.aiSuggestions[0]?.visualEvidence, ["透明な翅"]);
  assert.deepEqual(ai.aiSuggestions[0]?.shootingAdvice, ["腹側も撮る"]);
  assert.equal(ai.provenance.ai, true);
});

test("accepted identification requires an explicit accepted human claim", () => {
  const row = { ...observation("o1"), accepted_identification_id: "claim-1" };
  const detail = buildObservationFirstRecordDetail(snapshot({
    observations: [row],
    claims: [{ claim_id: "claim-1", observation_id: "o1", actor_type: "community_member", actor_id: "community-1", proposed_name: "セミ", proposed_scientific_name: "Graptopsaltria nigrofuscata", proposed_rank: "genus", stance: "support", claim_status: "accepted", accepted_name: "アブラゼミ", accepted_rank: "species", decided_by_actor_kind: "curator", decided_by_actor_id: "curator-1", decided_at: "2026-07-22T00:01:00Z", created_at: "2026-07-22T00:00:00Z" }],
  }), null)!;
  assert.equal(detail.observations[0]?.acceptedIdentification?.humanDecision, true);
  assert.equal(detail.observations[0]?.acceptedIdentification?.actorType, "curator");
  assert.equal(detail.observations[0]?.acceptedIdentification?.actorId, "curator-1");
  assert.equal(detail.observations[0]?.acceptedIdentification?.proposalActorType, "community_member");
  assert.equal(detail.observations[0]?.acceptedIdentification?.proposedName, "アブラゼミ");
  assert.equal(detail.observations[0]?.acceptedIdentification?.proposedRank, "species");
});

test("an accepted label without decision provenance is not presented as a human decision", () => {
  const row = { ...observation("o1"), accepted_identification_id: "claim-unsafe" };
  const detail = buildObservationFirstRecordDetail(snapshot({
    observations: [row],
    claims: [{ claim_id: "claim-unsafe", observation_id: "o1", actor_type: "community_member", actor_id: "community-1", proposed_name: "セミ", proposed_scientific_name: null, proposed_rank: "genus", stance: "support", claim_status: "accepted", created_at: "2026-07-22T00:00:00Z" }],
  }), null)!;
  assert.equal(detail.observations[0]?.acceptedIdentification, null);
});

test("private records are owner-only and external proposals stay disabled", () => {
  const input = snapshot({ visibility: "private", policy: { visibility: "private", accepts_identification_proposals: 1, accepts_media_proposals: 1 }, observations: [observation("o1")] });
  assert.equal(buildObservationFirstRecordDetail(input, null), null);
  const owner = buildObservationFirstRecordDetail(input, "owner-1")!;
  assert.equal(owner.proposalPolicy.identification, false);
  assert.equal(owner.proposalPolicy.media, false);
  assert.equal(owner.proposalPolicy.disabledReason, "record_private");
});

test("pet, unknown and group labels are natural and public output has no exact-location keys", () => {
  const detail = buildObservationFirstRecordDetail(snapshot({ observations: [observation("pet", "owner", "pet"), observation("unknown", "owner", "unknown_subject"), observation("group", "owner", "group")] }), null)!;
  assert.deepEqual(detail.observations.map((row) => row.subjectLabel).sort(), ["名前を決めていない対象", "複数の生きもの", "飼育されている生きもの"].sort());
  assert.deepEqual(publicRecordDetailPrivacyFindings(detail), []);
  assert.deepEqual(publicRecordDetailPrivacyFindings({ publicCell: "x", nested: { geohash: "y" } }), ["$.publicCell", "$.nested.geohash"]);
  assert.deepEqual(publicRecordDetailPrivacyFindings({ mediaUrl: "https://media.example/photo.jpg?lat=35.123456&lng=138.123456" }), ["$.mediaUrl"]);
});

test("shadow comparison requires at least 100 records and zero unexplained P0/P1", () => {
  const input = snapshot({ observations: [observation("o1")], media: [{ observation_id: "o1", media_id: "asset-1", media_kind: "photo", active: 1, display_order: 0 }] });
  const differences = compareLegacyAndObservationFirstRecord({
    recordId: "record-1",
    ownerUserId: "owner-1",
    visibility: "public",
    proposalPolicy: { identification: true, media: true },
    observations: [{
      sourceKey: "source:o1",
      lifecycleStatus: "active",
      dataUseScope: "personal_only",
      media: [{ mediaId: "asset-1", mediaKind: "photo" }],
      identifications: [],
      acceptedIdentification: null,
    }],
  }, input);
  assert.deepEqual(differences, []);
  assert.equal(summarizeRecordShadowComparison(differences, 99).pass, false);
  assert.equal(summarizeRecordShadowComparison(differences, 100).pass, true);
});

test("shadow comparison detects 0/1/N, media association, identification, rights and policy drift", () => {
  const input = snapshot({
    observations: [observation("o1"), { ...observation("o2", "ai"), data_use_scope: "community_observation" as const }],
    media: [
      { observation_id: "o1", media_id: "asset-2", media_kind: "photo", active: 1, display_order: 0 },
      { observation_id: "o2", media_id: "asset-1", media_kind: "photo", active: 1, display_order: 0 },
    ],
    claims: [{ claim_id: "claim-1", observation_id: "o1", actor_type: "community_member", actor_id: "community-1", proposed_name: "アマガエル", proposed_scientific_name: null, proposed_rank: "species", stance: "support", claim_status: "candidate", created_at: "2026-07-22T00:00:00Z" }],
  });
  const differences = compareLegacyAndObservationFirstRecord({
    recordId: "record-1",
    ownerUserId: "owner-1",
    visibility: "public",
    proposalPolicy: { identification: false, media: false },
    observations: [{
      sourceKey: "source:o1",
      lifecycleStatus: "active",
      dataUseScope: "research_export",
      media: [{ mediaId: "asset-1", mediaKind: "photo" }],
      identifications: [{ actorType: "community_member", proposedName: "ニホンアマガエル", proposedScientificName: "Dryophytes japonicus", proposedRank: "species", accepted: false }],
      acceptedIdentification: null,
    }],
  }, input);
  assert.deepEqual(new Set(differences.map((item) => item.code)), new Set([
    "observation_count_mismatch",
    "media_association_mismatch",
    "identification_mismatch",
    "data_use_scope_mismatch",
    "proposal_policy_mismatch",
  ]));
  const summary = summarizeRecordShadowComparison(differences, 100);
  assert.equal(summary.pass, false);
  assert.equal(summary.unexplainedP0P1, 5);
});

test("shadow comparison privacy result is derived from findings", () => {
  const summary = summarizeRecordShadowComparison([
    { severity: "P0", code: "exact_location_key_exposed", recordId: "record-private-key" },
  ], 100);
  assert.equal(summary.privacyFindings, 1);
  assert.equal(summary.containsRawLocation, true);
});
