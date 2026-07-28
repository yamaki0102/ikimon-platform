import assert from "node:assert/strict";
import test from "node:test";
import {
  CloudflareD1FoundationAuditSink,
} from "./zukanFoundationV2D1AuditSink.js";
import type {
  FoundationD1Database,
  FoundationD1PreparedStatement,
} from "./zukanFoundationV2D1Repository.js";
import type {
  FoundationDualWriteAuditEvent,
} from "./zukanFoundationV2Rollout.js";

type AuditRow = {
  operation_type: string;
  target_id: string;
  payload_json: string;
  created_at: string;
};

class MemoryAuditStatement implements FoundationD1PreparedStatement {
  private values: Array<string | number | null> = [];

  constructor(
    private readonly database: MemoryAuditDatabase,
    private readonly query: string,
  ) {}

  bind(...values: Array<string | number | null>): FoundationD1PreparedStatement {
    this.values = [...values];
    return this;
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const auditId = String(this.values[0]);
    return (this.database.rows.get(auditId) as T | undefined) ?? null;
  }

  async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
    return { results: [] };
  }

  async run(): Promise<unknown> {
    if (this.database.failWrites) {
      throw new Error("database unavailable");
    }
    if (!this.query.includes("INSERT OR IGNORE INTO operation_audit")) {
      throw new Error("unexpected query");
    }
    const auditId = String(this.values[0]);
    if (!this.database.rows.has(auditId)) {
      this.database.rows.set(auditId, {
        operation_type: String(this.values[1]),
        target_id: String(this.values[2]),
        payload_json: String(this.values[3]),
        created_at: String(this.values[4]),
      });
    }
    return {};
  }
}

class MemoryAuditDatabase implements FoundationD1Database {
  readonly rows = new Map<string, AuditRow>();
  failWrites = false;

  prepare(query: string): FoundationD1PreparedStatement {
    return new MemoryAuditStatement(this, query);
  }

  async batch(): Promise<unknown[]> {
    throw new Error("not used");
  }
}

function auditEvent(
  recordedAt = "2026-07-28T00:00:00.000Z",
): FoundationDualWriteAuditEvent {
  return {
    schema: "zukan.foundation-v2-dual-write-audit/v1",
    attemptId: "foundation-source:attempt-0001",
    recordedAt,
    sourceCommitSha: "a".repeat(40),
    phase: "requested",
    tenantId: "ikimon-source-registry-canonical-v1",
    operation: "source_registry_import_v1",
    idempotencyKey: "foundation-source:apply-0001",
    payloadSha256: "b".repeat(64),
    entityCount: 54,
    retryRequired: false,
    killSwitchRecommended: false,
    outcomes: [],
  };
}

test("D1 audit sink is insert-only, confirms persistence, and permits exact replay", async () => {
  const database = new MemoryAuditDatabase();
  const sink = new CloudflareD1FoundationAuditSink(database);
  const event = auditEvent();
  await sink.appendDurable(event);
  await sink.appendDurable(event);
  assert.equal(database.rows.size, 1);
  const row = [...database.rows.values()][0]!;
  assert.equal(row.operation_type, "zukan_foundation_v2_dual_write");
  assert.equal(
    row.target_id,
    "ikimon-source-registry-canonical-v1:foundation-source:apply-0001",
  );
  assert.equal(JSON.parse(row.payload_json).phase, "requested");
  assert.equal(row.created_at, event.recordedAt);
});

test("D1 audit sink fails closed on a reused attempt/phase with different payload", async () => {
  const database = new MemoryAuditDatabase();
  const sink = new CloudflareD1FoundationAuditSink(database);
  await sink.appendDurable(auditEvent());
  await assert.rejects(
    sink.appendDurable(auditEvent("2026-07-28T00:00:01.000Z")),
    /foundation_dual_write_audit_conflict/u,
  );
  assert.equal(database.rows.size, 1);
});

test("D1 audit sink propagates insert failures", async () => {
  const database = new MemoryAuditDatabase();
  database.failWrites = true;
  await assert.rejects(
    new CloudflareD1FoundationAuditSink(database).appendDurable(auditEvent()),
    /database unavailable/u,
  );
  assert.equal(database.rows.size, 0);
});
