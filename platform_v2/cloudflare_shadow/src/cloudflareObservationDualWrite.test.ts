import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  buildHumanObservationEditPlan,
  buildIdentificationAcceptancePlan,
  buildIdentificationClaimDualWritePlan,
  buildMediaReassignmentDualWritePlan,
  buildObservationAddPlan,
  buildObservationLifecyclePlan,
  buildOwnerObservationUpsertPlan,
  buildRecordProposalPolicyPlan,
  buildRecordVisibilityPlan,
} from "./cloudflareObservationDualWrite.js";

const applyPlan = (db: DatabaseSync, plan: { mutations: Array<{ sql: string; values: Array<string | number | null> }> }): void => {
  for (const mutation of plan.mutations) db.prepare(mutation.sql).run(...mutation.values);
};

test("record, human edit, identification and media dual-write is replay-safe and keeps acceptance human-decision-only", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(readFileSync(path.join(process.cwd(), "migrations", "observations", "0067_record_observation_foundation.sql"), "utf8"));

  const owner = await buildOwnerObservationUpsertPlan({
    recordId: "record-1",
    ownerUserId: "owner-1",
    visibility: "private",
    subjectType: "group",
    individualCertainty: "group",
    captiveContext: "pet",
    sourceSnapshot: { taxonLabel: "不明な小鳥", note: "2羽" },
  });
  const edit = await buildHumanObservationEditPlan({
    recordId: "record-1",
    actorUserId: "owner-1",
    editKind: "origin",
    captiveContext: "pet",
    payload: { organismOrigin: "captive" },
  });
  const identification = await buildIdentificationClaimDualWritePlan({
    recordId: "record-1",
    legacyIdentificationId: "legacy-identification-1",
    actorUserId: "community-1",
    actorKind: "community_member",
    proposedName: "スズメ",
    proposedRank: "species",
    sourcePayload: { source: "community" },
  });
  const media = await buildMediaReassignmentDualWritePlan({
    recordId: "record-1",
    mediaId: "asset-1",
    actorUserId: "owner-1",
    sourcePayload: { objectKey: "private/path/omitted" },
  });

  for (const plan of [owner, edit, identification, media]) {
    applyPlan(db, plan);
    applyPlan(db, plan);
  }

  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM record_observations").get()?.count, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM observation_identification_claims").get()?.count, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM record_observation_media WHERE active = 1").get()?.count, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM occurrence_projection_versions").get()?.count, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM record_observation_consistency_ledger").get()?.count, 4);

  const observationRow = db.prepare(`
    SELECT origin, assertion_status, verification_status, lifecycle_status, data_use_scope,
           accepted_identification_id, subject_type, individual_certainty, captive_context
      FROM record_observations
  `).get() as Record<string, unknown>;
  assert.deepEqual(Object.fromEntries(Object.entries(observationRow)), {
    origin: "owner",
    assertion_status: "human_asserted",
    verification_status: "owner_confirmed",
    lifecycle_status: "active",
    data_use_scope: "personal_only",
    accepted_identification_id: null,
    subject_type: "group",
    individual_certainty: "group",
    captive_context: "pet",
  });
  const claimRow = db.prepare("SELECT claim_status, actor_kind FROM observation_identification_claims").get() as Record<string, unknown>;
  assert.deepEqual(Object.fromEntries(Object.entries(claimRow)), {
    claim_status: "candidate",
    actor_kind: "community_member",
  });
  assert.equal(db.prepare("SELECT accepts_identification_proposals FROM record_observation_policies").get()?.accepts_identification_proposals, 0);
  db.close();
});

test("owner lifecycle actions split, exclude, restore and merge without destructive deletion", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(readFileSync(path.join(process.cwd(), "migrations", "observations", "0067_record_observation_foundation.sql"), "utf8"));
  const owner = await buildOwnerObservationUpsertPlan({ recordId: "record-life", ownerUserId: "owner-1", visibility: "public", sourceSnapshot: {} });
  applyPlan(db, owner);
  const split = await buildObservationLifecyclePlan({ recordId: "record-life", actorUserId: "owner-1", action: "split", sourceObservationId: owner.observationId, operationId: "split-1" });
  applyPlan(db, split);
  applyPlan(db, split);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM record_observations").get()?.count, 2);
  const splitMedia = await buildMediaReassignmentDualWritePlan({ recordId: "record-life", targetObservationId: split.observationId, mediaId: "asset-split", actorUserId: "owner-1", sourcePayload: {} });
  const splitClaim = await buildIdentificationClaimDualWritePlan({ recordId: "record-life", targetObservationId: split.observationId, legacyIdentificationId: "claim-split", actorUserId: "community-1", actorKind: "community_member", proposedName: "アマガエル", sourcePayload: {} });
  applyPlan(db, splitMedia);
  applyPlan(db, splitClaim);

  const deniedMerge = await buildObservationLifecyclePlan({ recordId: "record-life", actorUserId: "intruder", action: "merge", sourceObservationId: split.observationId, targetObservationId: owner.observationId, operationId: "merge-denied" });
  applyPlan(db, deniedMerge);
  assert.equal(db.prepare("SELECT lifecycle_status FROM record_observations WHERE observation_id = ?").get(split.observationId)?.lifecycle_status, "active");
  assert.equal(db.prepare("SELECT observation_id FROM record_observation_media WHERE media_id = 'asset-split'").get()?.observation_id, split.observationId);
  assert.equal(db.prepare("SELECT observation_id FROM observation_identification_claims WHERE proposed_name = 'アマガエル'").get()?.observation_id, split.observationId);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM observation_lifecycle_events WHERE source_key = 'record_observation_lifecycle:merge:merge-denied'").get()?.count, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM record_observation_consistency_ledger WHERE operation_key = 'record_observation_lifecycle:merge:merge-denied'").get()?.count, 0);

  const exclude = await buildObservationLifecyclePlan({ recordId: "record-life", actorUserId: "owner-1", action: "exclude", sourceObservationId: split.observationId, operationId: "exclude-1", reason: "別の対象だった" });
  applyPlan(db, exclude);
  applyPlan(db, exclude);
  assert.equal(db.prepare("SELECT lifecycle_status FROM record_observations WHERE observation_id = ?").get(split.observationId)?.lifecycle_status, "excluded");

  const restore = await buildObservationLifecyclePlan({ recordId: "record-life", actorUserId: "owner-1", action: "restore", sourceObservationId: split.observationId, operationId: "restore-1" });
  applyPlan(db, restore);
  applyPlan(db, restore);
  assert.equal(db.prepare("SELECT lifecycle_status FROM record_observations WHERE observation_id = ?").get(split.observationId)?.lifecycle_status, "active");

  const merge = await buildObservationLifecyclePlan({ recordId: "record-life", actorUserId: "owner-1", action: "merge", sourceObservationId: split.observationId, targetObservationId: owner.observationId, operationId: "merge-1" });
  applyPlan(db, merge);
  applyPlan(db, merge);
  const merged = db.prepare("SELECT lifecycle_status, superseded_by_observation_id FROM record_observations WHERE observation_id = ?").get(split.observationId) as Record<string, unknown>;
  assert.deepEqual(Object.fromEntries(Object.entries(merged)), { lifecycle_status: "superseded", superseded_by_observation_id: owner.observationId });
  assert.equal(db.prepare("SELECT observation_id FROM record_observation_media WHERE media_id = 'asset-split' AND active = 1").get()?.observation_id, owner.observationId);
  assert.equal(db.prepare("SELECT observation_id FROM observation_identification_claims WHERE proposed_name = 'アマガエル'").get()?.observation_id, owner.observationId);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM record_observation_consistency_ledger WHERE operation_kind = 'human_edit'").get()?.count, 4);
  db.close();
});

test("owner can add a distinct observation and explicitly accept a human claim", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(readFileSync(path.join(process.cwd(), "migrations", "observations", "0067_record_observation_foundation.sql"), "utf8"));
  const owner = await buildOwnerObservationUpsertPlan({ recordId: "record-add", ownerUserId: "owner-1", visibility: "public", sourceSnapshot: {} });
  applyPlan(db, owner);
  const add = await buildObservationAddPlan({ recordId: "record-add", actorUserId: "owner-1", operationId: "add-1", subjectType: "group", captiveContext: "pet", displayName: "庭の小鳥たち" });
  applyPlan(db, add);
  applyPlan(db, add);
  const added = db.prepare("SELECT subject_type, captive_context, context_json FROM record_observations WHERE observation_id = ?").get(add.observationId) as Record<string, unknown>;
  assert.equal(added.subject_type, "group");
  assert.equal(added.captive_context, "pet");
  assert.equal(JSON.parse(String(added.context_json)).displayName, "庭の小鳥たち");

  const claim = await buildIdentificationClaimDualWritePlan({ recordId: "record-add", targetObservationId: add.observationId, legacyIdentificationId: "claim-owner-accept", actorUserId: "community-1", actorKind: "community_member", proposedName: "スズメ", proposedRank: "species", sourcePayload: {} });
  applyPlan(db, claim);
  const identificationId = String(db.prepare("SELECT identification_id FROM observation_identification_claims WHERE observation_id = ?").get(add.observationId)?.identification_id);
  const accept = await buildIdentificationAcceptancePlan({ recordId: "record-add", observationId: add.observationId, identificationId, actorUserId: "owner-1", actorKind: "owner", acceptedName: "スズメ", acceptedRank: "species", operationId: "accept-1" });
  applyPlan(db, accept);
  applyPlan(db, accept);
  const accepted = db.prepare("SELECT claim_status, decided_by_actor_kind, decided_by_actor_id, accepted_name FROM observation_identification_claims WHERE identification_id = ?").get(identificationId) as Record<string, unknown>;
  assert.deepEqual(Object.fromEntries(Object.entries(accepted)), { claim_status: "accepted", decided_by_actor_kind: "owner", decided_by_actor_id: "owner-1", accepted_name: "スズメ" });
  assert.equal(db.prepare("SELECT accepted_identification_id FROM record_observations WHERE observation_id = ?").get(add.observationId)?.accepted_identification_id, identificationId);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  db.close();
});

test("owner override proposal policy survives record-save replay", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(readFileSync(path.join(process.cwd(), "migrations", "observations", "0067_record_observation_foundation.sql"), "utf8"));
  const plan = await buildOwnerObservationUpsertPlan({
    recordId: "record-policy",
    ownerUserId: "owner-1",
    visibility: "public",
    sourceSnapshot: {},
  });
  applyPlan(db, plan);
  const policy = await buildRecordProposalPolicyPlan({ recordId: "record-policy", ownerUserId: "owner-1", acceptsIdentificationProposals: false, operationId: "policy-off-1" });
  applyPlan(db, policy);
  applyPlan(db, policy);
  applyPlan(db, plan);
  const policyRow = db.prepare(`SELECT accepts_identification_proposals, default_source
    FROM record_observation_policies WHERE record_id = 'record-policy'`).get() as Record<string, unknown>;
  assert.deepEqual(Object.fromEntries(Object.entries(policyRow)), {
    accepts_identification_proposals: 0,
    default_source: "owner_override",
  });
  db.close();
});

test("owner visibility changes are replay-safe and keep canonical rights aligned", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(readFileSync(path.join(process.cwd(), "migrations", "observations", "0067_record_observation_foundation.sql"), "utf8"));
  db.exec(`
    CREATE TABLE observations (observation_id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, visibility TEXT NOT NULL, public_area_label TEXT);
    CREATE TABLE asset_ledger (asset_id TEXT PRIMARY KEY, observation_id TEXT NOT NULL, owner_user_id TEXT NOT NULL, visibility TEXT NOT NULL);
    CREATE TABLE observation_data_rights (visit_id TEXT PRIMARY KEY, record_consent TEXT NOT NULL, updated_at TEXT);
    CREATE TABLE readmodel_public_observations (observation_id TEXT PRIMARY KEY);
    CREATE TABLE public_map_snapshot_records_v1 (snapshot_key TEXT NOT NULL, occurrence_id TEXT NOT NULL, PRIMARY KEY (snapshot_key, occurrence_id));
    INSERT INTO observations VALUES ('record-visibility', 'owner-1', 'private', NULL);
    INSERT INTO asset_ledger VALUES ('asset-visibility', 'record-visibility', 'owner-1', 'private');
    INSERT INTO observation_data_rights VALUES ('record-visibility', 'private', CURRENT_TIMESTAMP);
  `);
  const owner = await buildOwnerObservationUpsertPlan({ recordId: "record-visibility", ownerUserId: "owner-1", visibility: "private", sourceSnapshot: {} });
  applyPlan(db, owner);

  const publish = await buildRecordVisibilityPlan({ recordId: "record-visibility", ownerUserId: "owner-1", previousVisibility: "private", visibility: "public", operationId: "visibility-public-1" });
  applyPlan(db, publish);
  applyPlan(db, publish);
  assert.equal(db.prepare("SELECT visibility FROM observations").get()?.visibility, "public");
  assert.equal(db.prepare("SELECT visibility FROM asset_ledger").get()?.visibility, "public");
  assert.equal(db.prepare("SELECT record_consent FROM observation_data_rights").get()?.record_consent, "public");
  assert.deepEqual(Object.fromEntries(Object.entries(db.prepare("SELECT visibility, accepts_identification_proposals, default_source FROM record_observation_policies").get() ?? {})), {
    visibility: "public",
    accepts_identification_proposals: 0,
    default_source: "owner_override",
  });
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM observation_lifecycle_events WHERE reason_code = 'visibility_changed'").get()?.count, 1);
  db.prepare("INSERT INTO readmodel_public_observations VALUES (?)").run("record-visibility");
  db.prepare("INSERT INTO public_map_snapshot_records_v1 VALUES ('public-map:v1:global', ?)").run("occ:record-visibility:0");

  const privatize = await buildRecordVisibilityPlan({ recordId: "record-visibility", ownerUserId: "owner-1", previousVisibility: "public", visibility: "private", operationId: "visibility-private-1" });
  applyPlan(db, privatize);
  assert.equal(db.prepare("SELECT visibility FROM observations").get()?.visibility, "private");
  assert.equal(db.prepare("SELECT visibility FROM asset_ledger").get()?.visibility, "private");
  assert.equal(db.prepare("SELECT record_consent FROM observation_data_rights").get()?.record_consent, "private");
  assert.equal(db.prepare("SELECT visibility FROM record_observation_policies").get()?.visibility, "private");
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM readmodel_public_observations").get()?.count, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM public_map_snapshot_records_v1").get()?.count, 0);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  db.close();
});
