import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ProgramHandoverApplyRuntime,
  type HandoverApplyInput,
} from "./programHandoverApplyRuntime.js";
import type {
  FoundationD1Database,
  FoundationD1PreparedStatement,
} from "./zukanFoundationV2D1Repository.js";

type D1Value = string | number | null;
type SqliteStatement = ReturnType<DatabaseSync["prepare"]>;

class Statement implements FoundationD1PreparedStatement {
  values: D1Value[] = [];
  constructor(readonly statement: SqliteStatement, readonly query: string) {}
  bind(...values: D1Value[]): FoundationD1PreparedStatement {
    this.values = values;
    return this;
  }
  async first<T>(): Promise<T | null> {
    return (this.statement.get(...this.values) ?? null) as T | null;
  }  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.statement.all(...this.values) as T[] };
  }
  async run(): Promise<unknown> {
    return { meta: { changes: Number(this.statement.run(...this.values).changes) } };
  }
  async execute(): Promise<unknown> {
    return /^\s*select\b/iu.test(this.query) ? this.all() : this.run();
  }
}

class Db implements FoundationD1Database {
  constructor(readonly sqlite: DatabaseSync, readonly failOnBatchIndex: number | null = null) {}
  prepare(query: string): FoundationD1PreparedStatement {
    return new Statement(this.sqlite.prepare(query), query);
  }
  async batch(statements: FoundationD1PreparedStatement[]): Promise<unknown[]> {
    this.sqlite.exec("BEGIN IMMEDIATE");
    try {
      const results: unknown[] = [];
      for (let index = 0; index < statements.length; index += 1) {
        if (this.failOnBatchIndex === index) throw new Error("injected_batch_failure");
        results.push(await (statements[index] as Statement).execute());
      }
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }
}const root = new URL("../../cloudflare_shadow/migrations/", import.meta.url);
const readMigration = (relative: string) =>
  readFileSync(new URL(relative, root), "utf8");

function setup(failOnBatchIndex: number | null = null) {
  const core = new DatabaseSync(":memory:");
  core.exec(readMigration("core/0017_zukan_program_handover_acceptances.sql"));
  const obs = new DatabaseSync(":memory:");
  obs.exec(readMigration("observations/0019_observation_event_core.sql"));
  obs.exec(readMigration("observations/0070_zukan_program_handover_runtime.sql"));

  const sourceRevision = "2026-09-19T00:00:00.000Z";
  const targetRevision = "2026-09-19T00:10:00.000Z";
  core.prepare(`INSERT INTO zukan_program_handover_acceptances(
    idempotency_key, tenant_id, workspace_id, logical_acceptance_id,
    acceptance_identity, payload_sha256, logical_plan_id, plan_identity,
    logical_offer_id, offer_identity, source_program_id, source_revision,
    target_program_id, target_continuation_id, incoming_actor_ref,
    outgoing_actor_ref, status, responsibility_transfer, actor_audit_ref,
    accepted_at, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    "accept-key", "tenant-school", "workspace-school", "accept-1",
    "a".repeat(64), "b".repeat(64), "plan-1", "c".repeat(64),
    "offer-1", "d".repeat(64), "program-2026", sourceRevision,
    "program-2027", "continuation-2027", "teacher-2027",
    "teacher-2026", "accepted_pending_apply", "pending_apply",
    "audit:accept", sourceRevision, sourceRevision,
  );  const insertSession = obs.prepare(
    "INSERT INTO observation_event_sessions(" +
    "session_id, title, organizer_user_id, started_at, template_source_session_id, updated_at" +
    ") VALUES (?, ?, ?, ?, ?, ?)",
  );
  insertSession.run(
    "program-2026",
    "2026",
    "teacher-2026",
    "2026-04-01T00:00:00.000Z",
    null,
    sourceRevision,
  );
  insertSession.run(
    "program-2027",
    "2027",
    "teacher-2026",
    "2027-04-01T00:00:00.000Z",
    "program-2026",
    targetRevision,
  );

  const runtime = new ProgramHandoverApplyRuntime(
    new Db(core),
    new Db(obs, failOnBatchIndex),
  );
  return { core, obs, runtime, sourceRevision, targetRevision };
}

function applyInput(targetRevision: string): HandoverApplyInput {
  return {
    tenantId: "tenant-school",
    workspaceId: "workspace-school",
    targetProgramId: "program-2027",
    logicalAcceptanceId: "accept-1",
    acceptanceIdentity: "a".repeat(64),
    actorUserId: "teacher-2027",
    expectedTargetRevision: targetRevision,
    idempotencyKey: "apply-key",
    actorAuditRef: "audit:apply",
    occurredAt: "2026-09-19T01:00:00.000Z",
  };
}

const organizer = (db: DatabaseSync, id = "program-2027") =>
  db.prepare("SELECT organizer_user_id, updated_at FROM observation_event_sessions WHERE session_id = ?")
    .get(id) as { organizer_user_id: string; updated_at: string };

test("M7.4 applies accepted responsibility to the rehost target only", async () => {
  const { obs, runtime, targetRevision } = setup();
  const result = await runtime.apply(applyInput(targetRevision));
  assert.equal(result.status, "succeeded");
  assert.equal(result.receipt?.outgoingActorRef, "teacher-2026");
  assert.equal(result.receipt?.incomingActorRef, "teacher-2027");
  assert.equal(organizer(obs).organizer_user_id, "teacher-2027");
  assert.equal(organizer(obs, "program-2026").organizer_user_id, "teacher-2026");
  assert.equal(
    obs.prepare("SELECT count(*) AS count FROM zukan_program_handover_runtime_applies")
      .get()!.count,
    1,
  );
  assert.equal(
    obs.prepare("SELECT count(*) AS count FROM observation_event_participants WHERE session_id = ?")
      .get("program-2027")!.count,
    0,
  );
});

test("M7.4 retry replays one logical apply", async () => {
  const { obs, runtime, targetRevision } = setup();
  const first = await runtime.apply(applyInput(targetRevision));
  assert.equal(first.status, "succeeded");
  const retry = await runtime.apply(applyInput(targetRevision));
  assert.equal(retry.status, "replayed");
  assert.equal(retry.receipt?.logicalApplyId, first.receipt?.logicalApplyId);
  assert.equal(
    obs.prepare("SELECT count(*) AS count FROM zukan_program_handover_runtime_applies")
      .get()!.count,
    1,
  );
});
test("M7.4 rejects changed replay payload and stale source revision", async () => {
  const { core, runtime, targetRevision } = setup();
  const first = await runtime.apply(applyInput(targetRevision));
  assert.equal(first.status, "succeeded");
  const changed = { ...applyInput(targetRevision), actorAuditRef: "audit:other" };
  changed.expectedTargetRevision = "different-revision";
  const conflict = await runtime.apply(changed);
  assert.equal(conflict.status, "conflict");

  const stale = setup();
  stale.core.exec("DROP TRIGGER trg_zukan_program_handover_acceptances_no_update");
  stale.core.prepare(
    "UPDATE zukan_program_handover_acceptances SET source_revision = ? WHERE logical_acceptance_id = ?",
  ).run("stale-revision", "accept-1");
  const blocked = await stale.runtime.apply(applyInput(stale.targetRevision));
  assert.equal(blocked.status, "blocked");
  assert.ok(blocked.reasons.includes("source_revision_stale"));
  assert.equal(organizer(stale.obs).organizer_user_id, "teacher-2026");
});
test("M7.4 fails closed when participation already started or actor mismatches", async () => {
  const participant = setup();
  participant.obs.prepare(
    "INSERT INTO observation_event_participants(participant_id, session_id, display_name) VALUES (?, ?, ?)",
  ).run("participant-1", "program-2027", "Participant");
  const blocked = await participant.runtime.apply(applyInput(participant.targetRevision));
  assert.equal(blocked.status, "blocked");
  assert.ok(blocked.reasons.includes("target_participation_already_started"));
  assert.equal(organizer(participant.obs).organizer_user_id, "teacher-2026");

  const actor = setup();
  const wrong = { ...applyInput(actor.targetRevision), actorUserId: "someone-else" };
  const denied = await actor.runtime.apply(wrong);
  assert.equal(denied.status, "blocked");
  assert.ok(denied.reasons.includes("incoming_actor_mismatch"));
});
test("M7.4 rollback restores outgoing responsibility with exact read-back", async () => {
  const { obs, runtime, targetRevision } = setup();
  const applied = await runtime.apply(applyInput(targetRevision));
  assert.equal(applied.status, "succeeded");
  assert.ok(applied.receipt);
  const rolledBack = await runtime.rollback({
    targetProgramId: "program-2027",
    logicalApplyId: applied.receipt!.logicalApplyId,
    applyIdentity: applied.receipt!.applyIdentity,
    actorUserId: "teacher-2027",
    expectedTargetRevision: applied.receipt!.targetRevisionAfter,
    idempotencyKey: "rollback-key",
    actorAuditRef: "audit:rollback",
    occurredAt: "2026-09-19T01:10:00.000Z",
  });
  assert.equal(rolledBack.status, "succeeded");
  assert.equal(organizer(obs).organizer_user_id, "teacher-2026");
  assert.equal(organizer(obs).updated_at, "2026-09-19T01:10:00.000Z");
});

test("M7.4 rollback fails closed after target activity begins", async () => {
  const { obs, runtime, targetRevision } = setup();
  const applied = await runtime.apply(applyInput(targetRevision));
  assert.equal(applied.status, "succeeded");
  obs.prepare(
    "INSERT INTO observation_event_participants(participant_id, session_id, display_name) VALUES (?, ?, ?)",
  ).run("participant-after-apply", "program-2027", "Participant");
  const result = await runtime.rollback({
    targetProgramId: "program-2027",
    logicalApplyId: applied.receipt!.logicalApplyId,
    applyIdentity: applied.receipt!.applyIdentity,
    actorUserId: "teacher-2027",
    expectedTargetRevision: applied.receipt!.targetRevisionAfter,
    idempotencyKey: "rollback-key",
    actorAuditRef: "audit:rollback",
    occurredAt: "2026-09-19T01:10:00.000Z",
  });
  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes("target_participation_already_started"));
  assert.equal(organizer(obs).organizer_user_id, "teacher-2027");
});
