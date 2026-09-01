import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { planProgramHandover, type ProgramHandoverInput } from "./programHandoverPlanner.js";
import {
  ProgramHandoverD1Repository,
} from "./programHandoverD1Repository.js";
import type {
  FoundationD1Database,
  FoundationD1PreparedStatement,
} from "./zukanFoundationV2D1Repository.js";
import type {
  ProgramHandoverPersistenceRequest,
  ProgramHandoverScope,
} from "./programHandoverRepositoryContract.js";

type D1Value = string | number | null;
type SqliteStatement = ReturnType<DatabaseSync["prepare"]>;

class SqliteD1Statement implements FoundationD1PreparedStatement {
  private values: D1Value[] = [];

  constructor(
    private readonly statement: SqliteStatement,
    private readonly query: string,
  ) {}

  bind(...values: D1Value[]): FoundationD1PreparedStatement {
    this.values = values;
    return this;
  }

  async first<T>(): Promise<T | null> {
    return (this.statement.get(...this.values) ?? null) as T | null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.statement.all(...this.values) as T[] };
  }

  async run(): Promise<unknown> {
    const result = this.statement.run(...this.values);
    return { meta: { changes: Number(result.changes) } };
  }

  async executeBatchItem(): Promise<unknown> {
    if (/^\s*select\b/iu.test(this.query)) return this.all();
    return this.run();
  }
}

class SqliteD1Database implements FoundationD1Database {
  batchCalls = 0;
  private batchTail: Promise<void> = Promise.resolve();

  constructor(readonly database: DatabaseSync) {}

  prepare(query: string): FoundationD1PreparedStatement {
    return new SqliteD1Statement(this.database.prepare(query), query);
  }

  async batch(statements: FoundationD1PreparedStatement[]): Promise<unknown[]> {
    this.batchCalls += 1;
    const execute = this.batchTail.then(async () => {
      this.database.exec("BEGIN IMMEDIATE");
      try {
        const results = await Promise.all(
          statements.map((statement) => (statement as SqliteD1Statement).executeBatchItem()),
        );
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

class FailingD1Statement implements FoundationD1PreparedStatement {
  bind(): FoundationD1PreparedStatement { return this; }
  async first<T>(): Promise<T | null> { return null; }
  async all<T>(): Promise<{ results: T[] }> { return { results: [] }; }
  async run(): Promise<unknown> { return { meta: { changes: 0 } }; }
}

class FailingD1Database implements FoundationD1Database {
  prepare(): FoundationD1PreparedStatement { return new FailingD1Statement(); }
  async batch(): Promise<unknown[]> { throw new Error("synthetic_write_failure"); }
}

const migrationRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../cloudflare_shadow/migrations/core",
);

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
        recordIds: ["record-river-01", "record-river-02"],
        questIds: ["quest-spring-walk"],
        templateIds: ["template-school-field"],
      },
    },
    target: {
      programId: "program-school-2027",
      continuationId: "continuation-school-2027",
    },
    selectedRefs: {
      placeIds: ["place-river-park"],
      recordIds: ["record-river-01"],
      questIds: ["quest-spring-walk"],
      templateIds: ["template-school-field"],
    },
    outgoingActor: {
      id: "teacher-2026",
      status: "active",
      scopeProgramId: "program-school-2026",
    },
    incomingActor: {
      id: "teacher-2027",
      status: "authorized",
      scopeProgramId: "program-school-2027",
    },
    idempotency: { key: "handover-school-2027-01" },
    observed: {
      observedAt: "2026-09-02T00:00:00.000Z",
      lifecycle: { sourceState: "ended", targetState: "not_created" },
      rights: {
        boundary: "resolved",
        consent: "valid",
        review: "approved",
        publicationApproval: "approved",
      },
    },
  };
}

function persistenceRequest(overrides: Partial<ProgramHandoverPersistenceRequest> = {}): ProgramHandoverPersistenceRequest {
  const acceptedPlan = planProgramHandover(baseInput());
  const currentScope: ProgramHandoverScope = {
    sourceProgramId: acceptedPlan.provenance.source.programId,
    sourceRevision: acceptedPlan.provenance.source.revision,
    targetProgramId: acceptedPlan.provenance.target.programId,
    targetContinuationId: acceptedPlan.provenance.target.continuationId,
  };
  return {
    tenantId: "tenant-school",
    workspaceId: "workspace-2026",
    acceptedPlan,
    currentScope,
    idempotencyKey: "handover-school-2027-01",
    actorAuditRef: "audit:teacher-2026-to-teacher-2027",
    createdAt: "2026-09-02T00:10:00.000Z",
    ...overrides,
  };
}

function count(database: SqliteD1Database): number {
  const row = database.database.prepare(
    "SELECT count(*) AS count FROM zukan_program_handover_plan_receipts",
  ).get() as { count: number };
  return Number(row.count);
}

test("persists one accepted immutable plan snapshot", async () => {
  const database = createDatabase();
  const request = persistenceRequest();
  const outcome = await new ProgramHandoverD1Repository(database).persistAcceptedPlan(request);
  assert.equal(outcome.status, "succeeded");
  assert.equal(outcome.receiptId, request.idempotencyKey);
  assert.equal(count(database), 1);
  database.database.close();
});

test("retry of the same plan returns the same stored logical plan and receipt", async () => {
  const database = createDatabase();
  const repository = new ProgramHandoverD1Repository(database);
  const request = persistenceRequest();
  const first = await repository.persistAcceptedPlan(request);
  const retry = await repository.persistAcceptedPlan(request);
  assert.equal(first.status, "succeeded");
  assert.equal(retry.status, "replayed");
  assert.equal(retry.logicalPlanId, first.logicalPlanId);
  assert.equal(retry.receiptId, first.receiptId);
  assert.equal(count(database), 1);
  database.database.close();
});

test("concurrent retries converge to one logical row", async () => {
  const database = createDatabase();
  const repository = new ProgramHandoverD1Repository(database);
  const request = persistenceRequest();
  const outcomes = await Promise.all(
    Array.from({ length: 8 }, () => repository.persistAcceptedPlan(request)),
  );
  assert.equal(count(database), 1);
  assert.ok(outcomes.every((outcome) => outcome.status === "succeeded" || outcome.status === "replayed"));
  assert.equal(new Set(outcomes.map((outcome) => outcome.logicalPlanId)).size, 1);
  database.database.close();
});

test("same key with a different payload fails closed and preserves the original row", async () => {
  const database = createDatabase();
  const repository = new ProgramHandoverD1Repository(database);
  const original = persistenceRequest();
  await repository.persistAcceptedPlan(original);
  const changedInput = baseInput();
  changedInput.selectedRefs.recordIds = ["record-river-02"];
  changedInput.idempotency.key = original.idempotencyKey;
  const changed = persistenceRequest({
    acceptedPlan: planProgramHandover(changedInput),
    currentScope: original.currentScope,
    idempotencyKey: original.idempotencyKey,
  });
  const outcome = await repository.persistAcceptedPlan(changed);
  assert.equal(outcome.status, "conflict");
  const stored = database.database.prepare(
    "SELECT selected_refs_json FROM zukan_program_handover_plan_receipts",
  ).get() as { selected_refs_json: string };
  assert.deepEqual(JSON.parse(stored.selected_refs_json), original.acceptedPlan.reuseRefs);
  assert.equal(count(database), 1);
  database.database.close();
});

test("rejected or stale plans are not persisted", async () => {
  const database = createDatabase();
  const repository = new ProgramHandoverD1Repository(database);
  const rejectedInput = baseInput();
  rejectedInput.observed.rights.consent = "withdrawn";
  const rejected = planProgramHandover(rejectedInput);
  const rejectedOutcome = await repository.persistAcceptedPlan(persistenceRequest({ acceptedPlan: rejected }));
  assert.equal(rejectedOutcome.status, "blocked");
  const stale = persistenceRequest({
    currentScope: { ...persistenceRequest().currentScope, sourceRevision: "rev-stale" },
  });
  const staleOutcome = await repository.persistAcceptedPlan(stale);
  assert.equal(staleOutcome.status, "blocked");
  assert.equal(database.batchCalls, 0);
  assert.equal(count(database), 0);
  database.database.close();
});

test("stored snapshot is immutable", async () => {
  const database = createDatabase();
  const repository = new ProgramHandoverD1Repository(database);
  await repository.persistAcceptedPlan(persistenceRequest());
  assert.throws(
    () => database.database.exec("UPDATE zukan_program_handover_plan_receipts SET source_revision='changed'"),
    /zukan_program_handover_plan_immutable/u,
  );
  assert.throws(
    () => database.database.exec("DELETE FROM zukan_program_handover_plan_receipts"),
    /zukan_program_handover_plan_immutable/u,
  );
  database.database.close();
});

test("snapshot stores reset declarations and references, never transferable state", async () => {
  const database = createDatabase();
  await new ProgramHandoverD1Repository(database).persistAcceptedPlan(persistenceRequest());
  const row = database.database.prepare("SELECT * FROM zukan_program_handover_plan_receipts").get() as Record<string, unknown>;
  assert.deepEqual(JSON.parse(String(row.reset_state_json)), {
    participant: "not_started",
    consent: "not_granted",
    review: "not_started",
    publicationApproval: "not_granted",
    visibility: "private",
  });
  assert.deepEqual(Object.keys(row).sort(), [
    "actor_audit_ref", "created_at", "idempotency_key", "incoming_responsibility_ref",
    "logical_plan_id", "observed_at", "outgoing_responsibility_ref", "payload_sha256",
    "plan_identity", "reset_state_json", "selected_refs_json", "source_program_id",
    "source_revision", "target_continuation_id", "target_program_id", "tenant_id", "workspace_id",
  ].sort());
  assert.equal(String(row.selected_refs_json).includes("copied"), false);
  database.database.close();
});

test("persisting a plan never mutates the target Program", async () => {
  const database = createDatabase();
  database.database.exec("CREATE TABLE target_programs(program_id TEXT PRIMARY KEY, state TEXT NOT NULL)");
  database.database.exec("INSERT INTO target_programs VALUES ('program-school-2027', 'not_created')");
  await new ProgramHandoverD1Repository(database).persistAcceptedPlan(persistenceRequest());
  const row = database.database.prepare("SELECT state FROM target_programs WHERE program_id='program-school-2027'").get() as { state: string };
  assert.equal(row.state, "not_created");
  database.database.close();
});

test("write failure never returns completed or persisted", async () => {
  const outcome = await new ProgramHandoverD1Repository(new FailingD1Database()).persistAcceptedPlan(persistenceRequest());
  assert.equal(outcome.status, "blocked");
  assert.ok(outcome.reasons.includes("write_failed"));
  assert.notEqual(outcome.status, "succeeded");
  assert.notEqual(outcome.status, "replayed");
});
