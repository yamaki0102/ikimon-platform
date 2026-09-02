import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { planProgramHandover, type ProgramHandoverInput } from "./programHandoverPlanner.js";
import { ProgramHandoverD1Repository } from "./programHandoverD1Repository.js";
import { ProgramHandoverOfferD1Repository } from "./programHandoverOfferD1Repository.js";
import type { FoundationD1Database, FoundationD1PreparedStatement } from "./zukanFoundationV2D1Repository.js";
import type { ProgramHandoverPersistenceRequest } from "./programHandoverRepositoryContract.js";
import type { ProgramHandoverOfferRequest } from "./programHandoverOfferRepositoryContract.js";

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

function offerRequest(planRequest: ProgramHandoverPersistenceRequest, overrides: Partial<ProgramHandoverOfferRequest> = {}): ProgramHandoverOfferRequest {
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

function offerCount(database: SqliteD1Database): number {
  const row = database.database.prepare("SELECT count(*) AS count FROM zukan_program_handover_offers").get() as { count: number };
  return Number(row.count);
}

function planRow(database: SqliteD1Database): Record<string, unknown> {
  return database.database.prepare("SELECT * FROM zukan_program_handover_plan_receipts").get() as Record<string, unknown>;
}

test("authorized outgoing actor can append one pending_acceptance offer", async () => {
  const database = createDatabase();
  const plan = await seedPlan(database);
  const outcome = await new ProgramHandoverOfferD1Repository(database).createOffer(offerRequest(plan));
  assert.equal(outcome.status, "succeeded");
  assert.equal(outcome.offer?.status, "pending_acceptance");
  assert.equal(outcome.offer?.planRef.planIdentity, plan.acceptedPlan.planIdentity);
  assert.equal(offerCount(database), 1);
  database.database.close();
});

test("retry of the same offer converges to one logical offer", async () => {
  const database = createDatabase();
  const plan = await seedPlan(database);
  const repository = new ProgramHandoverOfferD1Repository(database);
  const first = await repository.createOffer(offerRequest(plan));
  const retry = await repository.createOffer(offerRequest(plan));
  assert.equal(first.status, "succeeded");
  assert.equal(retry.status, "replayed");
  assert.equal(retry.offer?.logicalOfferId, first.offer?.logicalOfferId);
  assert.equal(offerCount(database), 1);
  database.database.close();
});

test("concurrent offer retries converge to one logical offer", async () => {
  const database = createDatabase();
  const plan = await seedPlan(database);
  const repository = new ProgramHandoverOfferD1Repository(database);
  const outcomes = await Promise.all(Array.from({ length: 8 }, () => repository.createOffer(offerRequest(plan))));
  assert.ok(outcomes.every((outcome) => outcome.status === "succeeded" || outcome.status === "replayed"));
  assert.equal(new Set(outcomes.map((outcome) => outcome.offer?.logicalOfferId)).size, 1);
  assert.equal(offerCount(database), 1);
  database.database.close();
});

test("same key with a different offer payload fails closed", async () => {
  const database = createDatabase();
  const plan = await seedPlan(database);
  const repository = new ProgramHandoverOfferD1Repository(database);
  await repository.createOffer(offerRequest(plan));
  const changed = await repository.createOffer(offerRequest(plan, { intendedIncomingActorRef: "teacher-other" }));
  assert.equal(changed.status, "conflict");
  assert.equal(offerCount(database), 1);
  database.database.close();
});

test("missing plan or stale source revision is rejected without an offer", async () => {
  const database = createDatabase();
  const plan = persistenceRequest();
  const repository = new ProgramHandoverOfferD1Repository(database);
  const missing = await repository.createOffer(offerRequest(plan));
  assert.equal(missing.status, "blocked");
  assert.ok(missing.reasons.includes("persisted_plan_missing"));
  const seeded = await seedPlan(database);
  const stale = await repository.createOffer(offerRequest(seeded, { currentSource: { ...offerRequest(seeded).currentSource, revision: "rev-stale" } }));
  assert.equal(stale.status, "blocked");
  assert.ok(stale.reasons.includes("source_revision_stale"));
  assert.equal(offerCount(database), 0);
  database.database.close();
});

test("unauthorized or revoked outgoing actor is rejected", async () => {
  const database = createDatabase();
  const plan = await seedPlan(database);
  const repository = new ProgramHandoverOfferD1Repository(database);
  const unauthorized = await repository.createOffer(offerRequest(plan, { outgoingActor: { ...offerRequest(plan).outgoingActor, authorized: false } }));
  assert.equal(unauthorized.status, "blocked");
  assert.ok(unauthorized.reasons.includes("outgoing_actor_unauthorized"));
  const revoked = await repository.createOffer(offerRequest(plan, { outgoingActor: { ...offerRequest(plan).outgoingActor, actorId: "teacher-2026-revoked", authorized: true }, offerIdempotencyKey: "offer-revoked" }));
  assert.equal(revoked.status, "blocked");
  assert.ok(revoked.reasons.includes("outgoing_actor_scope_mismatch"));
  assert.equal(offerCount(database), 0);
  database.database.close();
});

test("offer remains pending_acceptance and never accepts or transfers responsibility", async () => {
  const database = createDatabase();
  const plan = await seedPlan(database);
  database.database.exec("CREATE TABLE target_programs(program_id TEXT PRIMARY KEY, state TEXT NOT NULL, incoming_actor TEXT)");
  database.database.exec("INSERT INTO target_programs VALUES ('program-school-2027', 'not_created', NULL)");
  const outcome = await new ProgramHandoverOfferD1Repository(database).createOffer(offerRequest(plan));
  assert.equal(outcome.offer?.status, "pending_acceptance");
  assert.equal(outcome.offer?.incomingAcceptance, "not_started");
  assert.equal(outcome.offer?.responsibilityTransfer, "not_started");
  const target = database.database.prepare("SELECT state, incoming_actor FROM target_programs").get() as { state: string; incoming_actor: string | null };
  assert.equal(target.state, "not_created");
  assert.equal(target.incoming_actor, null);
  database.database.close();
});

test("offer references the persisted plan without rewriting selected refs or reset state", async () => {
  const database = createDatabase();
  const plan = await seedPlan(database);
  const before = planRow(database);
  await new ProgramHandoverOfferD1Repository(database).createOffer(offerRequest(plan));
  const after = planRow(database);
  assert.deepEqual(after, before);
  assert.throws(() => database.database.exec("UPDATE zukan_program_handover_plan_receipts SET source_revision='rewritten'"), /zukan_program_handover_plan_immutable/u);
  database.database.close();
});

test("target Program is unchanged and no forbidden state is stored in the offer", async () => {
  const database = createDatabase();
  const plan = await seedPlan(database);
  const outcome = await new ProgramHandoverOfferD1Repository(database).createOffer(offerRequest(plan));
  const row = database.database.prepare("SELECT * FROM zukan_program_handover_offers").get() as Record<string, unknown>;
  assert.equal(outcome.offer?.status, "pending_acceptance");
  assert.deepEqual(Object.keys(row).sort(), [
    "actor_audit_ref", "created_at", "idempotency_key", "incoming_acceptance", "intended_incoming_actor_ref",
    "logical_offer_id", "logical_plan_id", "offer_identity", "offered_at", "outgoing_actor_ref", "payload_sha256",
    "plan_identity", "responsibility_transfer", "source_program_id", "source_revision", "status", "target_continuation_id",
    "target_program_id", "tenant_id", "workspace_id",
  ].sort());
  assert.equal(Object.keys(row).some((key) => /participant|consent|review|publication|visibility|selected_refs|reset_state/iu.test(key)), false);
  database.database.close();
});

test("plan identity mismatch and invalid target scope fail closed", async () => {
  const database = createDatabase();
  const plan = await seedPlan(database);
  const repository = new ProgramHandoverOfferD1Repository(database);
  const mismatch = await repository.createOffer(offerRequest(plan, { persistedPlan: { ...offerRequest(plan).persistedPlan, planIdentity: "f".repeat(64) } }));
  assert.equal(mismatch.status, "blocked");
  assert.ok(mismatch.reasons.includes("plan_identity_mismatch"));
  const scope = await repository.createOffer(offerRequest(plan, { targetScope: { programId: "other-program", continuationId: "continuation-school-2027" }, offerIdempotencyKey: "offer-scope" }));
  assert.equal(scope.status, "blocked");
  assert.ok(scope.reasons.includes("target_scope_mismatch"));
  assert.equal(offerCount(database), 0);
  database.database.close();
});
