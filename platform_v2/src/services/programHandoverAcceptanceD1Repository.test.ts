import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { planProgramHandover, type ProgramHandoverInput } from "./programHandoverPlanner.js";
import { ProgramHandoverD1Repository } from "./programHandoverD1Repository.js";
import { ProgramHandoverOfferD1Repository } from "./programHandoverOfferD1Repository.js";
import {
  validateProgramHandoverAcceptanceBindings,
  type ProgramHandoverAcceptanceRequest,
  type ProgramHandoverOfferBinding,
  type ProgramHandoverPlanBinding,
} from "./programHandoverAcceptanceRepositoryContract.js";
import type { FoundationD1Database, FoundationD1PreparedStatement } from "./zukanFoundationV2D1Repository.js";
import type { ProgramHandoverPersistenceRequest } from "./programHandoverRepositoryContract.js";
import type { ProgramHandoverOffer, ProgramHandoverOfferRequest } from "./programHandoverOfferRepositoryContract.js";

type D1Value = string | number | null;
type SqliteStatement = ReturnType<DatabaseSync["prepare"]>;

class SqliteD1Statement implements FoundationD1PreparedStatement {
  private values: D1Value[] = [];
  constructor(private readonly statement: SqliteStatement, private readonly query: string) {}
  bind(...values: D1Value[]): FoundationD1PreparedStatement { this.values = values; return this; }
  async first<T>(): Promise<T | null> { return (this.statement.get(...this.values) ?? null) as T | null; }
  async all<T>(): Promise<{ results: T[] }> { return { results: this.statement.all(...this.values) as T[] }; }
  async run(): Promise<unknown> { return { meta: { changes: Number(this.statement.run(...this.values).changes) } }; }
  async executeBatchItem(): Promise<unknown> { return /^\s*select\b/iu.test(this.query) ? this.all() : this.run(); }
}

class SqliteD1Database implements FoundationD1Database {
  batchCalls = 0;
  private batchTail: Promise<void> = Promise.resolve();
  constructor(readonly database: DatabaseSync) {}
  prepare(query: string): FoundationD1PreparedStatement { return new SqliteD1Statement(this.database.prepare(query), query); }
  async batch(statements: FoundationD1PreparedStatement[]): Promise<unknown[]> {
    this.batchCalls += 1;
    const execute = this.batchTail.then(async () => {
      this.database.exec("BEGIN IMMEDIATE");
      try {
        const results = await Promise.all(statements.map((statement) => (statement as SqliteD1Statement).executeBatchItem()));
        this.database.exec("COMMIT");
        return results;
      } catch (error) {
        this.database.exec("ROLLBACK");
        throw error;
      }
    });
    this.batchTail = execute.then(() => undefined, () => undefined);
    return execute;
  }
}

class FailingD1Database implements FoundationD1Database {
  prepare(): FoundationD1PreparedStatement { throw new Error("database unavailable"); }
  async batch(): Promise<unknown[]> { throw new Error("database unavailable"); }
}

const migrationRoot = join(dirname(fileURLToPath(import.meta.url)), "../../cloudflare_shadow/migrations/core");

function createDatabase(): SqliteD1Database {
  const database = new DatabaseSync(":memory:");
  for (const file of readdirSync(migrationRoot).filter((name) => name.endsWith(".sql")).sort()) {
    database.exec(readFileSync(join(migrationRoot, file), "utf8"));
  }
  return new SqliteD1Database(database);
}

function baseInput(): ProgramHandoverInput {
  return {
    source: {
      programId: "program-school-2026",
      revision: "rev-2026-01",
      lifecycle: "ended",
      availableRefs: {
        placeIds: ["place-river-park"],
        recordIds: ["record-river-01"],
        questIds: ["quest-spring-walk"],
        templateIds: ["template-school-field"],
      },
    },
    target: { programId: "program-school-2027", continuationId: "continuation-school-2027" },
    selectedRefs: {
      placeIds: ["place-river-park"],
      recordIds: ["record-river-01"],
      questIds: ["quest-spring-walk"],
      templateIds: ["template-school-field"],
    },
    outgoingActor: { id: "teacher-2026", status: "active", scopeProgramId: "program-school-2026" },
    incomingActor: { id: "teacher-2027", status: "authorized", scopeProgramId: "program-school-2027" },
    idempotency: { key: "handover-school-2027-01" },
    observed: {
      observedAt: "2026-09-02T00:00:00.000Z",
      lifecycle: { sourceState: "ended", targetState: "not_created" },
      rights: { boundary: "resolved", consent: "valid", review: "approved", publicationApproval: "approved" },
    },
  };
}

function persistenceRequest(): ProgramHandoverPersistenceRequest {
  const plan = planProgramHandover(baseInput());
  return {
    tenantId: "tenant-school",
    workspaceId: "workspace-2026",
    acceptedPlan: plan,
    currentScope: {
      sourceProgramId: plan.provenance.source.programId,
      sourceRevision: plan.provenance.source.revision,
      targetProgramId: plan.provenance.target.programId,
      targetContinuationId: plan.provenance.target.continuationId,
    },
    idempotencyKey: "handover-school-2027-01",
    actorAuditRef: "audit:teacher-2026-to-teacher-2027",
    createdAt: "2026-09-02T00:10:00.000Z",
  };
}

async function seedPlan(database: SqliteD1Database): Promise<ProgramHandoverPersistenceRequest> {
  const request = persistenceRequest();
  const result = await new ProgramHandoverD1Repository(database).persistAcceptedPlan(request);
  assert.equal(result.status, "succeeded");
  return request;
}

function offerRequest(
  planRequest: ProgramHandoverPersistenceRequest,
  overrides: Partial<ProgramHandoverOfferRequest> = {},
): ProgramHandoverOfferRequest {
  return {
    tenantId: planRequest.tenantId,
    workspaceId: planRequest.workspaceId,
    persistedPlan: {
      logicalPlanId: planRequest.acceptedPlan.logicalPlanId!,
      planIdentity: planRequest.acceptedPlan.planIdentity,
    },
    currentSource: {
      programId: planRequest.acceptedPlan.provenance.source.programId,
      revision: planRequest.acceptedPlan.provenance.source.revision,
    },
    outgoingActor: {
      actorId: planRequest.acceptedPlan.responsibility.outgoing.actorId,
      sourceProgramId: planRequest.acceptedPlan.provenance.source.programId,
      authorized: true,
    },
    intendedIncomingActorRef: planRequest.acceptedPlan.responsibility.incoming.actorId,
    targetScope: {
      programId: planRequest.acceptedPlan.provenance.target.programId,
      continuationId: planRequest.acceptedPlan.provenance.target.continuationId,
    },
    offerIdempotencyKey: "offer-school-2027-01",
    actorAuditRef: "audit:teacher-2026-offer-2027",
    offeredAt: "2026-09-02T00:20:00.000Z",
    createdAt: "2026-09-02T00:20:00.000Z",
    ...overrides,
  };
}

async function seedOffer(database: SqliteD1Database): Promise<{ plan: ProgramHandoverPersistenceRequest; offer: ProgramHandoverOffer }> {
  const plan = await seedPlan(database);
  const outcome = await new ProgramHandoverOfferD1Repository(database).createOffer(offerRequest(plan));
  assert.equal(outcome.status, "succeeded");
  assert.ok(outcome.offer);
  return { plan, offer: outcome.offer };
}

function acceptanceRequest(
  planRequest: ProgramHandoverPersistenceRequest,
  offer: ProgramHandoverOffer,
  overrides: Partial<ProgramHandoverAcceptanceRequest> = {},
): ProgramHandoverAcceptanceRequest {
  return {
    tenantId: planRequest.tenantId,
    workspaceId: planRequest.workspaceId,
    persistedPlan: {
      logicalPlanId: planRequest.acceptedPlan.logicalPlanId!,
      planIdentity: planRequest.acceptedPlan.planIdentity,
    },
    offer: {
      logicalOfferId: offer.logicalOfferId,
      offerIdentity: offer.offerIdentity,
    },
    currentSource: {
      programId: planRequest.acceptedPlan.provenance.source.programId,
      revision: planRequest.acceptedPlan.provenance.source.revision,
    },
    targetScope: {
      programId: planRequest.acceptedPlan.provenance.target.programId,
      continuationId: planRequest.acceptedPlan.provenance.target.continuationId,
    },
    incomingActor: {
      actorId: planRequest.acceptedPlan.responsibility.incoming.actorId,
      scopeProgramId: planRequest.acceptedPlan.provenance.target.programId,
      authorized: true,
    },
    outgoingActor: {
      actorId: planRequest.acceptedPlan.responsibility.outgoing.actorId,
      scopeProgramId: planRequest.acceptedPlan.provenance.source.programId,
      authorized: true,
    },
    acceptanceIdempotencyKey: "acceptance-school-2027-01",
    actorAuditRef: "audit:teacher-2027-accept",
    acceptedAt: "2026-09-02T00:30:00.000Z",
    createdAt: "2026-09-02T00:30:00.000Z",
    ...overrides,
  };
}

function acceptanceCount(database: SqliteD1Database): number {
  const row = database.database.prepare("SELECT count(*) AS count FROM zukan_program_handover_acceptances").get() as { count: number };
  return Number(row.count);
}

function acceptanceRow(database: SqliteD1Database): Record<string, unknown> {
  return database.database.prepare("SELECT * FROM zukan_program_handover_acceptances").get() as Record<string, unknown>;
}

test("intended incoming actor appends one accepted_pending_apply receipt", async () => {
  const database = createDatabase();
  const { plan, offer } = await seedOffer(database);
  const outcome = await new (await import("./programHandoverAcceptanceD1Repository.js")).ProgramHandoverAcceptanceD1Repository(database)
    .createAcceptance(acceptanceRequest(plan, offer));
  assert.equal(outcome.status, "succeeded");
  assert.equal(outcome.acceptance?.status, "accepted_pending_apply");
  assert.equal(outcome.acceptance?.planRef.planIdentity, plan.acceptedPlan.planIdentity);
  assert.equal(outcome.acceptance?.offerRef.offerIdentity, offer.offerIdentity);
  assert.equal(outcome.acceptance?.incomingActorRef, "teacher-2027");
  assert.equal(outcome.acceptance?.outgoingActorRef, "teacher-2026");
  assert.equal(acceptanceCount(database), 1);
  database.database.close();
});

test("wrong incoming actor is rejected without an acceptance", async () => {
  const database = createDatabase();
  const { plan, offer } = await seedOffer(database);
  const { ProgramHandoverAcceptanceD1Repository } = await import("./programHandoverAcceptanceD1Repository.js");
  const request = acceptanceRequest(plan, offer, {
    incomingActor: { actorId: "teacher-other", scopeProgramId: "program-school-2027", authorized: true },
  });
  const outcome = await new ProgramHandoverAcceptanceD1Repository(database).createAcceptance(request);
  assert.equal(outcome.status, "blocked");
  assert.ok(outcome.reasons.includes("incoming_actor_mismatch"));
  assert.equal(acceptanceCount(database), 0);
  database.database.close();
});

test("unknown, revoked or scope-mismatched incoming actor fails closed", async () => {
  const cases: Array<{ name: string; actor: ProgramHandoverAcceptanceRequest["incomingActor"]; reason: string }> = [
    { name: "unknown", actor: { actorId: "teacher-2027", scopeProgramId: "program-school-2027", authorized: false }, reason: "incoming_actor_unauthorized" },
    { name: "scope", actor: { actorId: "teacher-2027", scopeProgramId: "program-other", authorized: true }, reason: "incoming_actor_scope_mismatch" },
  ];
  for (const item of cases) {
    const database = createDatabase();
    const { plan, offer } = await seedOffer(database);
    const { ProgramHandoverAcceptanceD1Repository } = await import("./programHandoverAcceptanceD1Repository.js");
    const outcome = await new ProgramHandoverAcceptanceD1Repository(database).createAcceptance(acceptanceRequest(plan, offer, { incomingActor: item.actor }));
    assert.equal(outcome.status, "blocked", item.name);
    assert.ok(outcome.reasons.includes(item.reason), item.name);
    assert.equal(acceptanceCount(database), 0, item.name);
    database.database.close();
  }
});

test("outgoing actor revoked before acceptance fails closed", async () => {
  const database = createDatabase();
  const { plan, offer } = await seedOffer(database);
  const { ProgramHandoverAcceptanceD1Repository } = await import("./programHandoverAcceptanceD1Repository.js");
  const request = acceptanceRequest(plan, offer, {
    outgoingActor: { actorId: "teacher-2026", scopeProgramId: "program-school-2026", authorized: false },
  });
  const outcome = await new ProgramHandoverAcceptanceD1Repository(database).createAcceptance(request);
  assert.equal(outcome.status, "blocked");
  assert.ok(outcome.reasons.includes("outgoing_actor_unauthorized"));
  assert.equal(acceptanceCount(database), 0);
  database.database.close();
});

test("missing or stale plan/offer bindings are rejected", async () => {
  const database = createDatabase();
  const { plan, offer } = await seedOffer(database);
  const { ProgramHandoverAcceptanceD1Repository } = await import("./programHandoverAcceptanceD1Repository.js");
  const missing = await new ProgramHandoverAcceptanceD1Repository(database).createAcceptance(acceptanceRequest(plan, offer, {
    offer: { logicalOfferId: "missing-offer", offerIdentity: "f".repeat(64) },
  }));
  assert.equal(missing.status, "blocked");
  assert.ok(missing.reasons.includes("offer_missing"));
  const stale = await new ProgramHandoverAcceptanceD1Repository(database).createAcceptance(acceptanceRequest(plan, offer, {
    currentSource: { programId: "program-school-2026", revision: "rev-stale" },
    acceptanceIdempotencyKey: "acceptance-stale",
  }));
  assert.equal(stale.status, "blocked");
  assert.ok(stale.reasons.includes("source_revision_stale"));
  assert.equal(acceptanceCount(database), 0);
  database.database.close();
});

test("non-pending offers are rejected and a second acceptance only replays", async () => {
  const database = createDatabase();
  const { plan, offer } = await seedOffer(database);
  const request = acceptanceRequest(plan, offer);
  const { ProgramHandoverAcceptanceD1Repository } = await import("./programHandoverAcceptanceD1Repository.js");
  const repository = new ProgramHandoverAcceptanceD1Repository(database);
  const first = await repository.createAcceptance(request);
  const replay = await repository.createAcceptance(request);
  assert.equal(first.status, "succeeded");
  assert.equal(replay.status, "replayed");
  assert.equal(replay.acceptance?.logicalAcceptanceId, first.acceptance?.logicalAcceptanceId);
  assert.equal(acceptanceCount(database), 1);

  const planBinding: ProgramHandoverPlanBinding = {
    tenantId: plan.tenantId,
    workspaceId: plan.workspaceId,
    logicalPlanId: plan.acceptedPlan.logicalPlanId!,
    planIdentity: plan.acceptedPlan.planIdentity,
    sourceProgramId: "program-school-2026",
    sourceRevision: "rev-2026-01",
    targetProgramId: "program-school-2027",
    targetContinuationId: "continuation-school-2027",
    outgoingResponsibilityRef: "teacher-2026",
    incomingResponsibilityRef: "teacher-2027",
  };
  const offerBinding: ProgramHandoverOfferBinding = {
    tenantId: plan.tenantId,
    workspaceId: plan.workspaceId,
    logicalOfferId: offer.logicalOfferId,
    offerIdentity: offer.offerIdentity,
    logicalPlanId: offer.planRef.logicalPlanId,
    planIdentity: offer.planRef.planIdentity,
    sourceProgramId: offer.sourceScope.programId,
    sourceRevision: offer.sourceScope.revision,
    targetProgramId: offer.targetScope.programId,
    targetContinuationId: offer.targetScope.continuationId,
    outgoingActorRef: offer.outgoingActorRef,
    intendedIncomingActorRef: offer.intendedIncomingActorRef,
    status: "accepted",
    incomingAcceptance: "accepted",
    responsibilityTransfer: "pending_apply",
  };
  const reasons = validateProgramHandoverAcceptanceBindings(request, planBinding, offerBinding);
  assert.ok(reasons.includes("offer_not_pending"));
  assert.equal(acceptanceCount(database), 1);
  database.database.close();
});

test("concurrent acceptance retries converge to one logical receipt", async () => {
  const database = createDatabase();
  const { plan, offer } = await seedOffer(database);
  const { ProgramHandoverAcceptanceD1Repository } = await import("./programHandoverAcceptanceD1Repository.js");
  const repository = new ProgramHandoverAcceptanceD1Repository(database);
  const outcomes = await Promise.all(Array.from({ length: 8 }, () => repository.createAcceptance(acceptanceRequest(plan, offer))));
  assert.ok(outcomes.every((outcome) => outcome.status === "succeeded" || outcome.status === "replayed"));
  assert.equal(new Set(outcomes.map((outcome) => outcome.acceptance?.logicalAcceptanceId)).size, 1);
  assert.equal(acceptanceCount(database), 1);
  database.database.close();
});

test("same idempotency key with a different payload conflicts without rewriting", async () => {
  const database = createDatabase();
  const { plan, offer } = await seedOffer(database);
  const { ProgramHandoverAcceptanceD1Repository } = await import("./programHandoverAcceptanceD1Repository.js");
  const repository = new ProgramHandoverAcceptanceD1Repository(database);
  const original = acceptanceRequest(plan, offer);
  await repository.createAcceptance(original);
  const changed = await repository.createAcceptance(acceptanceRequest(plan, offer, { actorAuditRef: "audit:changed" }));
  assert.equal(changed.status, "conflict");
  assert.ok(changed.reasons.includes("same_key_different_acceptance_payload"));
  assert.equal(acceptanceCount(database), 1);
  assert.equal(acceptanceRow(database).actor_audit_ref, original.actorAuditRef);
  database.database.close();
});

test("acceptance references exact plan/offer and does not mutate target or copy lifecycle state", async () => {
  const database = createDatabase();
  const { plan, offer } = await seedOffer(database);
  database.database.exec("CREATE TABLE target_programs(program_id TEXT PRIMARY KEY, state TEXT NOT NULL, incoming_actor TEXT)");
  database.database.exec("INSERT INTO target_programs VALUES ('program-school-2027', 'not_created', NULL)");
  const { ProgramHandoverAcceptanceD1Repository } = await import("./programHandoverAcceptanceD1Repository.js");
  const outcome = await new ProgramHandoverAcceptanceD1Repository(database).createAcceptance(acceptanceRequest(plan, offer));
  assert.equal(outcome.status, "succeeded");
  assert.equal(outcome.acceptance?.offerRef.logicalOfferId, offer.logicalOfferId);
  assert.equal(outcome.acceptance?.planRef.logicalPlanId, plan.acceptedPlan.logicalPlanId);
  const target = database.database.prepare("SELECT state, incoming_actor FROM target_programs").get() as { state: string; incoming_actor: string | null };
  assert.equal(target.state, "not_created");
  assert.equal(target.incoming_actor, null);
  const row = acceptanceRow(database);
  assert.equal(Object.keys(row).some((key) => /participant|consent|review|publication|visibility|selected_refs|reset_state|private_payload/iu.test(key)), false);
  assert.equal(row.status, "accepted_pending_apply");
  assert.equal(row.responsibility_transfer, "pending_apply");
  database.database.close();
});

test("acceptance receipt is append-only", async () => {
  const database = createDatabase();
  const { plan, offer } = await seedOffer(database);
  const { ProgramHandoverAcceptanceD1Repository } = await import("./programHandoverAcceptanceD1Repository.js");
  await new ProgramHandoverAcceptanceD1Repository(database).createAcceptance(acceptanceRequest(plan, offer));
  assert.throws(
    () => database.database.exec("UPDATE zukan_program_handover_acceptances SET status='changed'"),
    /zukan_program_handover_acceptance_immutable/u,
  );
  assert.throws(
    () => database.database.exec("DELETE FROM zukan_program_handover_acceptances"),
    /zukan_program_handover_acceptance_immutable/u,
  );
  database.database.close();
});

test("write failure never returns accepted or completed", async () => {
  const database = createDatabase();
  const { plan, offer } = await seedOffer(database);
  const { ProgramHandoverAcceptanceD1Repository } = await import("./programHandoverAcceptanceD1Repository.js");
  const outcome = await new ProgramHandoverAcceptanceD1Repository(new FailingD1Database()).createAcceptance(acceptanceRequest(plan, offer));
  assert.equal(outcome.status, "blocked");
  assert.ok(outcome.reasons.includes("write_failed"));
  assert.notEqual(outcome.status, "succeeded");
  assert.notEqual(outcome.status, "replayed");
  database.database.close();
});

test("acceptance migration remains source-only and constrains the terminal state", () => {
  const migration = readFileSync(join(migrationRoot, "0017_zukan_program_handover_acceptances.sql"), "utf8");
  assert.match(migration, /Definition only/u);
  assert.match(migration, /status TEXT NOT NULL CHECK \(status = 'accepted_pending_apply'\)/u);
  assert.match(migration, /CREATE TRIGGER IF NOT EXISTS trg_zukan_program_handover_acceptances_no_update/u);
  assert.match(migration, /CREATE TRIGGER IF NOT EXISTS trg_zukan_program_handover_acceptances_no_delete/u);
});
