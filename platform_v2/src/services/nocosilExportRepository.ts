import { createHash, randomUUID } from "node:crypto";
import { canonicalFoundationJson } from "./zukanFoundationV2RepositoryContract.js";

export interface NocosilExportQueryable {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<{ rows: T[]; rowCount?: number | null }>;
}

export interface NocosilExportRepositoryPort {
  createOrGet(input: NocosilExportCreateInput): Promise<NocosilExportRecord>;
  claim(input: { exportId: string; leaseOwner?: string; now?: string; leaseDurationMs: number }): Promise<NocosilExportClaim>;
  markSent(input: { exportId: string; leaseOwner: string; result: unknown }): Promise<void>;
  markFailed(input: { exportId: string; leaseOwner: string; error: string }): Promise<void>;
}

export type NocosilExportState = "pending" | "processing" | "failed" | "sent";

export interface NocosilExportCreateInput {
  siteId: string;
  ownerUserId: string;
  idempotencyKey: string;
  requestDigest: string;
  bodySnapshot: unknown;
  consentSnapshot: unknown;
}

export interface NocosilExportRecord {
  exportId: string;
  siteId: string;
  ownerUserId: string;
  idempotencyKey: string;
  requestDigest: string;
  bodySnapshot: unknown;
  consentSnapshot: unknown;
  state: NocosilExportState;
  replayed: boolean;
}

export type NocosilExportClaim =
  | { status: "claimed"; exportId: string; leaseOwner: string; bodySnapshot: unknown; consentSnapshot: unknown }
  | { status: "sent"; result: unknown }
  | { status: "busy" }
  | { status: "failed" };

type ExportRow = Record<string, unknown> & {
  export_id: string;
  site_id: string;
  owner_user_id: string;
  idempotency_key: string;
  request_digest: string;
  body_snapshot: unknown;
  consent_snapshot: unknown;
  state: NocosilExportState;
  result: unknown;
};

function jsonValue(value: unknown): unknown {
  if (typeof value !== "string") return value ?? null;
  try { return JSON.parse(value); } catch { return value; }
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalFoundationJson(value), "utf8").digest("hex");
}

function toRecord(row: ExportRow, replayed: boolean): NocosilExportRecord {
  return {
    exportId: String(row.export_id),
    siteId: String(row.site_id),
    ownerUserId: String(row.owner_user_id),
    idempotencyKey: String(row.idempotency_key),
    requestDigest: String(row.request_digest),
    bodySnapshot: jsonValue(row.body_snapshot),
    consentSnapshot: jsonValue(row.consent_snapshot),
    state: row.state,
    replayed,
  };
}

export class NocosilExportRepository implements NocosilExportRepositoryPort {
  constructor(private readonly db: NocosilExportQueryable) {}

  async createOrGet(input: NocosilExportCreateInput): Promise<NocosilExportRecord> {
    if (!input.siteId.trim() || !input.ownerUserId.trim()) throw new Error("export_owner_scope_required");
    if (!input.idempotencyKey.trim() || input.idempotencyKey.length > 200) throw new Error("idempotency_key_invalid");
    if (!/^[a-f0-9]{64}$/i.test(input.requestDigest)) throw new Error("request_digest_invalid");
    const bodyJson = canonicalFoundationJson(input.bodySnapshot);
    const bodyDigest = digest(input.bodySnapshot);
    const consentJson = canonicalFoundationJson(input.consentSnapshot);
    const inserted = await this.db.query<ExportRow>(
      `INSERT INTO zukan_nocosil_exports
         (export_id, site_id, owner_user_id, idempotency_key, request_digest,
          body_digest, body_snapshot, consent_snapshot, state)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, 'pending')
       ON CONFLICT (site_id, idempotency_key) DO NOTHING
       RETURNING export_id, site_id, owner_user_id, idempotency_key,
                 request_digest, body_snapshot, consent_snapshot, state, result`,
      [randomUUID(), input.siteId, input.ownerUserId, input.idempotencyKey,
        input.requestDigest.toLowerCase(), bodyDigest, bodyJson, consentJson],
    );
    let row = inserted.rows[0];
    let replayed = false;
    if (!row) {
      const existing = await this.db.query<ExportRow>(
        `SELECT export_id, site_id, owner_user_id, idempotency_key,
                request_digest, body_snapshot, consent_snapshot, state, result
           FROM zukan_nocosil_exports
          WHERE site_id = $1 AND idempotency_key = $2`,
        [input.siteId, input.idempotencyKey],
      );
      row = existing.rows[0];
      if (!row) throw new Error("export_idempotency_row_missing");
      replayed = true;
    }
    if (String(row.request_digest).toLowerCase() !== input.requestDigest.toLowerCase()) {
      throw new Error("idempotency_key_conflict");
    }
    if (String(row.owner_user_id) !== input.ownerUserId) throw new Error("owner_conflict");
    // The stored snapshot is returned even on a replay; callers must never send the new body.
    return toRecord(row, replayed);
  }

  async claim(input: { exportId: string; leaseOwner?: string; now?: string; leaseDurationMs: number }): Promise<NocosilExportClaim> {
    if (!Number.isFinite(input.leaseDurationMs) || input.leaseDurationMs < 1 || input.leaseDurationMs > 15 * 60_000) {
      throw new Error("export_lease_duration_invalid");
    }
    const leaseOwner = input.leaseOwner?.trim() || randomUUID();
    const now = input.now ? new Date(input.now) : new Date();
    if (!Number.isFinite(now.getTime())) throw new Error("export_claim_time_invalid");
    const leaseExpiresAt = new Date(now.getTime() + input.leaseDurationMs).toISOString();
    const claimed = await this.db.query<ExportRow>(
      `UPDATE zukan_nocosil_exports
          SET state = 'processing', lease_owner = $2, lease_expires_at = $3::timestamptz,
              attempt_count = attempt_count + 1, updated_at = now()
        WHERE export_id = $1
          AND state <> 'sent'
          AND (state IN ('pending', 'failed') OR lease_expires_at <= $4::timestamptz)
        RETURNING export_id, body_snapshot, consent_snapshot`,
      [input.exportId, leaseOwner, leaseExpiresAt, now.toISOString()],
    );
    const row = claimed.rows[0];
    if (row) return {
      status: "claimed", exportId: input.exportId, leaseOwner,
      bodySnapshot: jsonValue(row.body_snapshot), consentSnapshot: jsonValue(row.consent_snapshot),
    };
    const current = await this.db.query<ExportRow>(
      `SELECT state, result FROM zukan_nocosil_exports WHERE export_id = $1`, [input.exportId],
    );
    const state = current.rows[0]?.state;
    if (!state) throw new Error("export_not_found");
    if (state === "sent") return { status: "sent", result: jsonValue(current.rows[0]?.result) };
    if (state === "failed") return { status: "failed" };
    return { status: "busy" };
  }

  async markSent(input: { exportId: string; leaseOwner: string; result: unknown }): Promise<void> {
    const updated = await this.db.query(
      `UPDATE zukan_nocosil_exports
          SET state = 'sent', result = $3::jsonb, sent_at = now(),
              lease_owner = NULL, lease_expires_at = NULL, last_error = NULL, updated_at = now()
        WHERE export_id = $1 AND state = 'processing' AND lease_owner = $2
       RETURNING export_id`,
      [input.exportId, input.leaseOwner, canonicalFoundationJson(input.result)],
    );
    if (!updated.rows.length) throw new Error("export_lease_lost");
  }

  async markFailed(input: { exportId: string; leaseOwner: string; error: string }): Promise<void> {
    const safeError = input.error.slice(0, 1000);
    const updated = await this.db.query(
      `UPDATE zukan_nocosil_exports
          SET state = 'failed', last_error = $3, lease_owner = NULL,
              lease_expires_at = NULL, updated_at = now()
        WHERE export_id = $1 AND state = 'processing' AND lease_owner = $2
       RETURNING export_id`,
      [input.exportId, input.leaseOwner, safeError],
    );
    if (!updated.rows.length) throw new Error("export_lease_lost");
  }
}
