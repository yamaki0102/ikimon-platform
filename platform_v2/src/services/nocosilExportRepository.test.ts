import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  NocosilExportRepository,
  type NocosilExportQueryable,
} from "./nocosilExportRepository.js";

function memoryDb() {
  const rows = new Map<string, Record<string, unknown>>();
  const byKey = new Map<string, string>();
  let sequence = 0;
  const query: NocosilExportQueryable["query"] = async (sql, params = []) => {
    if (sql.includes("INSERT INTO zukan_nocosil_exports")) {
      const siteId = String(params[1]);
      const idempotencyKey = String(params[3]);
      const key = `${siteId}\0${idempotencyKey}`;
      let rowId = byKey.get(key);
      let inserted = false;
      if (!rowId) {
        rowId = `export-${++sequence}`;
        inserted = true;
        byKey.set(key, rowId);
        rows.set(rowId, {
          export_id: rowId, site_id: siteId, idempotency_key: idempotencyKey,
          owner_user_id: params[2], request_digest: params[4], body_snapshot: JSON.parse(String(params[6])), consent_snapshot: JSON.parse(String(params[7])), state: "pending",
          lease_owner: null, lease_expires_at: null, result: null,
        });
      }
      const row = rows.get(rowId)!;
      return { rows: inserted ? [row as never] : [] };
    }
    if (sql.includes("SELECT export_id, site_id, owner_user_id, idempotency_key")) {
      const row = [...rows.values()].find((candidate) => candidate.site_id === params[0] && candidate.idempotency_key === params[1]);
      return { rows: row ? [row as never] : [] };
    }
    if (sql.includes("SET state = 'processing'")) {
      const row = rows.get(String(params[0]));
      if (!row) return { rows: [] };
      const now = Date.parse(String(params[3]));
      if (row.state === "sent" || (row.state === "processing" && Date.parse(String(row.lease_expires_at)) > now)) return { rows: [] };
      row.state = "processing";
      row.lease_owner = params[1];
      row.lease_expires_at = params[2];
      return { rows: [row as never] };
    }
    if (sql.includes("SET state = 'sent'")) {
      const row = rows.get(String(params[0]));
      if (!row || row.state !== "processing" || row.lease_owner !== params[1]) return { rows: [] };
      row.state = "sent";
      row.result = params[2];
      row.lease_owner = null;
      row.lease_expires_at = null;
      return { rows: [row as never] };
    }
    if (sql.includes("SET state = 'failed'")) {
      const row = rows.get(String(params[0]));
      if (!row || row.state !== "processing" || row.lease_owner !== params[1]) return { rows: [] };
      row.state = "failed";
      row.lease_owner = null;
      row.lease_expires_at = null;
      return { rows: [row as never] };
    }
    if (sql.includes("SELECT state, result FROM zukan_nocosil_exports")) {
      const row = rows.get(String(params[0]));
      return { rows: row ? [row as never] : [] };
    }
    throw new Error(`unexpected SQL: ${sql}`);
  };
  return { query, rows };
}

test("idempotent create preserves first body and rejects changed request", async () => {
  const db = memoryDb();
  const repo = new NocosilExportRepository(db);
  const input = { siteId: "site-1", idempotencyKey: "request-1", ownerUserId: "owner-1", consentSnapshot: { export: true }, bodySnapshot: { observations: ["a"] } };
  const request = { ...input, requestDigest: createHash("sha256").update("request-a").digest("hex") };
  const first = await repo.createOrGet(request);
  const replay = await repo.createOrGet(request);
  assert.equal(first.exportId, replay.exportId);
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.bodySnapshot, input.bodySnapshot);
  await assert.rejects(
    repo.createOrGet({ ...request, requestDigest: createHash("sha256").update("request-b").digest("hex"), bodySnapshot: { observations: ["b"] } }),
    /idempotency_key_conflict/,
  );
  assert.deepEqual(db.rows.get(first.exportId)?.body_snapshot, input.bodySnapshot);
});

test("atomic lease allows one claimant, sent result replays without another claim", async () => {
  const repo = new NocosilExportRepository(memoryDb());
  const created = await repo.createOrGet({ siteId: "site-1", ownerUserId: "owner-1", idempotencyKey: "k", requestDigest: createHash("sha256").update("k").digest("hex"), bodySnapshot: { records: [] }, consentSnapshot: { export: true } });
  const now = "2026-10-23T12:00:00.000Z";
  const [a, b] = await Promise.all([
    repo.claim({ exportId: created.exportId, leaseOwner: "worker-a", now, leaseDurationMs: 60_000 }),
    repo.claim({ exportId: created.exportId, leaseOwner: "worker-b", now, leaseDurationMs: 60_000 }),
  ]);
  assert.equal([a, b].filter((result) => result.status === "claimed").length, 1);
  const winner = a.status === "claimed" ? a : b;
  assert.equal(winner.status, "claimed");
  if (winner.status !== "claimed") throw new Error("claim_expected");
  await repo.markSent({ exportId: created.exportId, leaseOwner: winner.leaseOwner, result: { remoteId: "r1" } });
  assert.deepEqual(await repo.claim({ exportId: created.exportId, leaseOwner: "worker-c", now, leaseDurationMs: 60_000 }), {
    status: "sent", result: { remoteId: "r1" },
  });
});

test("failed or expired lease can be reclaimed; stale lease owner cannot complete", async () => {
  const repo = new NocosilExportRepository(memoryDb());
  const created = await repo.createOrGet({ siteId: "site-1", ownerUserId: "owner-1", idempotencyKey: "k", requestDigest: createHash("sha256").update("k").digest("hex"), bodySnapshot: { records: [] }, consentSnapshot: { export: true } });
  const first = await repo.claim({ exportId: created.exportId, leaseOwner: "worker-a", now: "2026-10-23T12:00:00.000Z", leaseDurationMs: 1 });
  assert.equal(first.status, "claimed");
  await assert.rejects(repo.markFailed({ exportId: created.exportId, leaseOwner: "worker-b", error: "no" }), /lease_lost/);
  await repo.markFailed({ exportId: created.exportId, leaseOwner: "worker-a", error: "temporary" });
  const retry = await repo.claim({ exportId: created.exportId, leaseOwner: "worker-b", now: "2026-10-23T12:01:00.000Z", leaseDurationMs: 1000 });
  assert.equal(retry.status, "claimed");
});
