import { createHash } from "node:crypto";
import type {
  FoundationD1Database,
} from "./zukanFoundationV2D1Repository.js";
import {
  canonicalFoundationJson,
} from "./zukanFoundationV2RepositoryContract.js";
import type {
  FoundationDualWriteAuditEvent,
  FoundationDualWriteAuditSink,
} from "./zukanFoundationV2Rollout.js";

const FOUNDATION_DUAL_WRITE_AUDIT_OPERATION_TYPE =
  "zukan_foundation_v2_dual_write";

type FoundationAuditRow = {
  operation_type: string;
  target_id: string;
  payload_json: string;
  created_at: string;
};

function foundationAuditId(event: FoundationDualWriteAuditEvent): string {
  const digest = createHash("sha256")
    .update(`${event.attemptId}\0${event.phase}`, "utf8")
    .digest("hex");
  return `zukan-foundation-v2:${digest}`;
}

function foundationAuditTargetId(event: FoundationDualWriteAuditEvent): string {
  return `${event.tenantId}:${event.idempotencyKey}`;
}

export class CloudflareD1FoundationAuditSink implements FoundationDualWriteAuditSink {
  constructor(private readonly database: FoundationD1Database) {}

  async appendDurable(event: FoundationDualWriteAuditEvent): Promise<void> {
    const auditId = foundationAuditId(event);
    const targetId = foundationAuditTargetId(event);
    const payloadJson = canonicalFoundationJson(event);
    await this.database.prepare(
      `INSERT OR IGNORE INTO operation_audit(
         audit_id, operation_type, target_id, payload_json, created_at
       ) VALUES (?, ?, ?, ?, ?)`,
    ).bind(
      auditId,
      FOUNDATION_DUAL_WRITE_AUDIT_OPERATION_TYPE,
      targetId,
      payloadJson,
      event.recordedAt,
    ).run();
    const stored = await this.database.prepare(
      `SELECT operation_type, target_id, payload_json, created_at
         FROM operation_audit
        WHERE audit_id = ?`,
    ).bind(auditId).first<FoundationAuditRow>();
    if (!stored) {
      throw new Error("foundation_dual_write_audit_insert_not_confirmed");
    }
    if (
      stored.operation_type !== FOUNDATION_DUAL_WRITE_AUDIT_OPERATION_TYPE
      || stored.target_id !== targetId
      || stored.payload_json !== payloadJson
      || stored.created_at !== event.recordedAt
    ) {
      throw new Error("foundation_dual_write_audit_conflict");
    }
  }
}
