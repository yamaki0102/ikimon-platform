import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  buildHumanObservationEditPlan,
  buildIdentificationClaimDualWritePlan,
  buildMediaReassignmentDualWritePlan,
  buildObservationLifecyclePlan,
  buildOwnerObservationUpsertPlan,
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
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM record_observation_consistency_ledger WHERE operation_kind = 'human_edit'").get()?.count, 4);
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
  db.exec(`UPDATE record_observation_policies
    SET accepts_identification_proposals = 0, default_source = 'owner_override', updated_by_actor_id = 'owner-1'
    WHERE record_runtime = 'cloudflare_d1' AND record_id = 'record-policy'`);
  applyPlan(db, plan);
  const policyRow = db.prepare(`SELECT accepts_identification_proposals, default_source
    FROM record_observation_policies WHERE record_id = 'record-policy'`).get() as Record<string, unknown>;
  assert.deepEqual(Object.fromEntries(Object.entries(policyRow)), {
    accepts_identification_proposals: 0,
    default_source: "owner_override",
  });
  db.close();
});
