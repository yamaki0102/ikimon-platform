import assert from "node:assert/strict";
import test from "node:test";
import {
  createAndSendNocosilExport,
  type NocosilExportRepositoryPort,
  type NocosilExportRequest,
  type NocosilExportServiceDependencies,
} from "./nocosilExportService.js";
import type { NocosilExportObservationInput } from "./nocosilExportPayload.js";
import type { NocosilExportCreateInput, NocosilExportRecord } from "./nocosilExportRepository.js";

const RIGHTS = {
  recordConsent: "external_export" as const,
  researchUseConsent: "public_export" as const,
  datasetLicense: "CC-BY-4.0" as const,
  mediaLicense: "CC-BY-4.0" as const,
  externalExportAllowed: true,
  consentSource: "user_selected" as const,
  withdrawalStatus: "active" as const,
  sourcePayload: { privateNote: "do not persist" },
};

function observation(overrides: Partial<NocosilExportObservationInput> = {}): NocosilExportObservationInput {
  return {
    id: "obs-1",
    taxon: "Rana japonica",
    date: "2026-05-01",
    latitude: 35.12345,
    longitude: 138.98765,
    photoUrl: null,
    sensitive: true,
    rights: RIGHTS,
    ...overrides,
  };
}

function request(overrides: Partial<NocosilExportRequest> = {}): NocosilExportRequest {
  return {
    actorUserId: "owner-1",
    siteId: "site-1",
    period: { start: "2026-05-01", end: "2026-05-31" },
    selectedObservationIds: ["obs-1"],
    idempotencyKey: "request-1",
    allowExactCoordinates: false,
    ...overrides,
  };
}

function memoryRepository(): NocosilExportRepositoryPort & {
  records: Map<string, NocosilExportRecord>;
  claims: Array<{ leaseDurationMs: number }>;
  failures: string[];
} {
  const records = new Map<string, NocosilExportRecord>();
  const keys = new Map<string, string>();
  const states = new Map<string, "pending" | "processing" | "failed" | "sent">();
  const leases = new Map<string, string>();
  const claims: Array<{ leaseDurationMs: number }> = [];
  const failures: string[] = [];
  let sequence = 0;
  return {
    records,
    claims,
    failures,
    async createOrGet(input: NocosilExportCreateInput) {
      const key = `${input.siteId}\0${input.idempotencyKey}`;
      const existingId = keys.get(key);
      if (existingId) {
        const existing = records.get(existingId)!;
        if (existing.requestDigest !== input.requestDigest) throw new Error("idempotency_key_conflict");
        if (existing.ownerUserId !== input.ownerUserId) throw new Error("export_owner_conflict");
        return { ...existing, replayed: true };
      }
      const exportId = `export-${++sequence}`;
      const created: NocosilExportRecord = { ...input, exportId, state: "pending", replayed: false };
      keys.set(key, exportId);
      records.set(exportId, created);
      states.set(exportId, "pending");
      return created;
    },
    async claim({ exportId, leaseOwner, leaseDurationMs }) {
      claims.push({ leaseDurationMs });
      const state = states.get(exportId);
      if (state === "sent") return { status: "sent" as const, result: { status: 200 } };
      if (state === "processing") return { status: "busy" as const };
      if (!state || !leaseOwner) throw new Error("invalid claim");
      states.set(exportId, "processing");
      leases.set(exportId, leaseOwner);
      const record = records.get(exportId)!;
      return { status: "claimed" as const, exportId, leaseOwner, bodySnapshot: record.bodySnapshot, consentSnapshot: record.consentSnapshot };
    },
    async markSent({ exportId, leaseOwner }) {
      if (leases.get(exportId) !== leaseOwner) throw new Error("export_lease_lost");
      states.set(exportId, "sent");
    },
    async markFailed({ exportId, leaseOwner, error }) {
      if (leases.get(exportId) !== leaseOwner) throw new Error("export_lease_lost");
      states.set(exportId, "failed");
      failures.push(error);
      leases.delete(exportId);
    },
  };
}

function dependencies(overrides: Partial<NocosilExportServiceDependencies> = {}) {
  const repository = memoryRepository();
  let currentObservations = [observation()];
  const calls = { getSite: 0, loadObservations: 0, send: 0 };
  const deps: NocosilExportServiceDependencies = {
    config: { enabled: true, signingSecret: "test-secret" },
    source: {
      async getSite(siteId, actorUserId) {
        calls.getSite += 1;
        return siteId === "site-1" && actorUserId === "owner-1" ? { id: siteId, ownerUserId: actorUserId } : null;
      },
      async loadObservations({ siteId, actorUserId, observationIds, period }) {
        calls.loadObservations += 1;
        assert.equal(siteId, "site-1");
        assert.equal(actorUserId, "owner-1");
        assert.deepEqual(period, { start: "2026-05-01", end: "2026-05-31" });
        return currentObservations.filter((item) => observationIds.includes(item.id));
      },
    },
    repository,
    async send() {
      calls.send += 1;
      return { ok: true, status: 200, attempts: 1 };
    },
    ...overrides,
  };
  return {
    deps,
    repository,
    calls,
    setObservations(next: NocosilExportObservationInput[]) { currentObservations = next; },
  };
}

test("feature is off unless explicitly enabled and performs no source or delivery work", async () => {
  const { deps, calls } = dependencies({ config: { signingSecret: "test-secret" } });
  assert.deepEqual(await createAndSendNocosilExport(request(), deps), { status: "disabled" });
  assert.deepEqual(calls, { getSite: 0, loadObservations: 0, send: 0 });
});

test("requires OWNER authorization before loading or exporting selected observations", async () => {
  const { deps, calls } = dependencies({
    source: {
      async getSite() { calls.getSite += 1; return null; },
      async loadObservations() { calls.loadObservations += 1; return [observation()]; },
    },
  });
  assert.deepEqual(await createAndSendNocosilExport(request({ actorUserId: "member-2" }), deps), { status: "denied" });
  assert.equal(calls.loadObservations, 0);
  assert.equal(calls.send, 0);
});

test("fails closed when a selected observation loses or changes export consent on retry", async () => {
  const h = dependencies();
  assert.equal((await createAndSendNocosilExport(request(), h.deps)).status, "sent");
  h.setObservations([observation({ rights: { ...RIGHTS, mediaLicense: "CC-BY-NC-4.0" } })]);
  const retry = await createAndSendNocosilExport(request(), h.deps);
  assert.equal(retry.status, "idempotency_conflict");
  assert.equal(h.calls.send, 1);
  const stored = [...h.repository.records.values()][0]!;
  assert.equal(JSON.stringify(stored.consentSnapshot).includes("privateNote"), false);
});

test("exact coordinates require the authorized owner's explicit request and otherwise stay generalized", async () => {
  const coarse = dependencies();
  const coarseResult = await createAndSendNocosilExport(request(), coarse.deps);
  assert.equal(coarseResult.status, "sent");
  const coarseBody = [...coarse.repository.records.values()][0]!.bodySnapshot as { observations: Array<{ location: { precision: string } }> };
  assert.equal(coarseBody.observations[0]!.location.precision, "grid_10km");

  const exact = dependencies();
  await createAndSendNocosilExport(request({ allowExactCoordinates: true }), exact.deps);
  const exactBody = [...exact.repository.records.values()][0]!.bodySnapshot as { observations: Array<{ location: { precision: string } }> };
  assert.equal(exactBody.observations[0]!.location.precision, "exact");
});

test("stable idempotency key replays a sent result without sending again", async () => {
  const h = dependencies();
  const first = await createAndSendNocosilExport(request(), h.deps);
  const replay = await createAndSendNocosilExport(request(), h.deps);
  assert.equal(first.status, "sent");
  assert.deepEqual(replay, { status: "sent", exportId: "export-1", replayed: true });
  assert.equal(h.calls.send, 1);
});

test("same idempotency key rejects changed request content", async () => {
  const h = dependencies();
  await createAndSendNocosilExport(request(), h.deps);
  h.setObservations([observation({ taxon: "Rana temporaria" })]);
  assert.equal((await createAndSendNocosilExport(request(), h.deps)).status, "idempotency_conflict");
  assert.equal(h.calls.send, 1);
});

test("atomic claim permits one concurrent send and makes the other call report in progress", async () => {
  const h = dependencies();
  let finishFirst!: () => void;
  const started = new Promise<void>((resolve) => { finishFirst = resolve; });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  h.deps.send = async () => {
    h.calls.send += 1;
    if (h.calls.send === 1) {
      finishFirst();
      await gate;
    }
    return { ok: true, status: 200, attempts: 1 };
  };
  const firstPromise = createAndSendNocosilExport(request(), h.deps);
  await started;
  const concurrent = await createAndSendNocosilExport(request(), h.deps);
  assert.equal(concurrent.status, "in_progress");
  release();
  assert.equal((await firstPromise).status, "sent");
  assert.equal(h.calls.send, 1);
});

test("refuses partial source results and never sends an incomplete selected set", async () => {
  const h = dependencies({
    source: {
      async getSite() { return { id: "site-1", ownerUserId: "owner-1" }; },
      async loadObservations() { return []; },
    },
  });
  assert.equal((await createAndSendNocosilExport(request(), h.deps)).status, "selection_unavailable");
  assert.equal(h.calls.send, 0);
});

test("exports only eligible records from a mixed selection", async () => {
  const h = dependencies();
  h.setObservations([
    observation(),
    observation({ id: "obs-2", rights: { ...RIGHTS, consentSource: "default" } }),
  ]);
  const result = await createAndSendNocosilExport(request({ selectedObservationIds: ["obs-1", "obs-2"] }), h.deps);
  assert.equal(result.status, "sent");
  const body = [...h.repository.records.values()][0]!.bodySnapshot as { observations: Array<{ id: string }> };
  assert.deepEqual(body.observations.map(({ id }) => id), ["obs-1"]);
});

test("sends nothing when every selected observation is denied by current rights", async () => {
  const h = dependencies();
  h.setObservations([observation({ rights: { ...RIGHTS, withdrawalStatus: "withdrawn" } })]);
  assert.equal((await createAndSendNocosilExport(request(), h.deps)).status, "no_eligible_observations");
  assert.equal(h.calls.send, 0);
  assert.equal(h.repository.records.size, 0);
});

test("delivery exceptions persist a sanitized failure and clamp the lease for bounded retries", async () => {
  const h = dependencies({ config: { enabled: true, signingSecret: "secret-value", leaseDurationMs: 1 } });
  h.deps.send = async () => { throw new Error("secret-value must not be persisted"); };
  const result = await createAndSendNocosilExport(request(), h.deps);
  assert.deepEqual(result, { status: "delivery_failed", exportId: "export-1", reason: "delivery_exception" });
  assert.deepEqual(h.repository.failures, ["delivery_exception"]);
  assert.equal(h.repository.claims[0]?.leaseDurationMs, 120_000);
});

test('empty periods and selections beyond the source bound fail validation before source reads', async () => {
  let reads = 0;
  const dependencies = {
    config: { enabled: true, signingSecret: 'test-only-key' },
    source: {
      async getSite() { reads += 1; return null; },
      async loadObservations() { reads += 1; return []; },
    },
    repository: {} as NocosilExportRepositoryPort,
  };
  assert.deepEqual(await createAndSendNocosilExport(request({ period: { start: '2026-05-01', end: '2026-05-01' } }), dependencies), { status: 'invalid_request' });
  assert.deepEqual(await createAndSendNocosilExport(request({ selectedObservationIds: Array.from({ length: 501 }, (_, i) => `obs-${i}`) }), dependencies), { status: 'invalid_request' });
  assert.equal(reads, 0);
});

test('refuses to sign a claimed body altered after rights screening', async () => {
  const fixture = dependencies();
  const originalClaim = fixture.deps.repository.claim.bind(fixture.deps.repository);
  fixture.deps.repository.claim = async (input) => {
    const claim = await originalClaim(input);
    if (claim.status !== 'claimed') return claim;
    return { ...claim, bodySnapshot: { ...(claim.bodySnapshot as object), privateExtra: 'unexpected source data' } };
  };
  const result = await createAndSendNocosilExport(request(), fixture.deps);
  assert.equal(result.status, 'delivery_failed');
  assert.equal(fixture.calls.send, 0);
  assert.deepEqual(fixture.repository.failures, ['snapshot_mismatch']);
});
