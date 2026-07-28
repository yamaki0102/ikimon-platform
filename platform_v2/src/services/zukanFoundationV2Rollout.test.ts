import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  compareFoundationShadowRead,
  FoundationDualWriteError,
  loadFoundationRolloutConfig,
  runBoundedFoundationDualWrite,
  type FoundationDualWriteAuditEvent,
} from "./zukanFoundationV2Rollout.js";
import {
  emptyFoundationSourceImportState,
  type FoundationWriteRequest,
  type ZukanFoundationV2Repository,
} from "./zukanFoundationV2RepositoryContract.js";
import { planRegionalSourceFoundationImport } from "./zukanFoundationV2SourceRegistryImport.js";
import { REGIONAL_SOURCE_ASSETS } from "./regionalSourceRegistry.js";
import { verifyFoundationEvidenceSourceSha } from "./zukanFoundationV2EvidenceSourceProvenance.js";

const VERIFIED_SOURCE_SHA = verifyFoundationEvidenceSourceSha({
  sourceSha: "a".repeat(40),
  repositoryRoot: "unused",
  readGitState: () => ({
    headSha: "a".repeat(40),
    porcelainStatus: "",
  }),
});

test("Foundation rollout defaults fail closed", () => {
  assert.deepEqual(loadFoundationRolloutConfig({}), {
    shadowReadMode: "off",
    dualWriteMode: "off",
    writeKillSwitch: true,
    allowedTenants: [],
    allowedOperations: [],
    maxEntities: 64,
    invalidValues: [],
  });
  const invalid = loadFoundationRolloutConfig({
    ZUKAN_FOUNDATION_V2_SHADOW_READ_MODE: "enabled",
    ZUKAN_FOUNDATION_V2_DUAL_WRITE_MODE: "yes",
    ZUKAN_FOUNDATION_V2_WRITE_KILL_SWITCH: "maybe",
    ZUKAN_FOUNDATION_V2_ALLOWED_OPERATIONS: "delete_all",
    ZUKAN_FOUNDATION_V2_MAX_ENTITIES: "100",
  });
  assert.equal(invalid.shadowReadMode, "off");
  assert.equal(invalid.dualWriteMode, "off");
  assert.equal(invalid.writeKillSwitch, true);
  assert.equal(invalid.maxEntities, 0);
  assert.equal(invalid.invalidValues.length, 5);
});

test("Cloudflare root, shadow, staging, and production keep Foundation writes explicitly off", () => {
  const wrangler = readFileSync(
    new URL("../../cloudflare_shadow/wrangler.jsonc", import.meta.url),
    "utf8",
  );
  assert.equal(
    (wrangler.match(/"ZUKAN_FOUNDATION_V2_SHADOW_READ_MODE": "off"/gu) ?? []).length,
    4,
  );
  assert.equal(
    (wrangler.match(/"ZUKAN_FOUNDATION_V2_DUAL_WRITE_MODE": "off"/gu) ?? []).length,
    4,
  );
  assert.equal(
    (wrangler.match(/"ZUKAN_FOUNDATION_V2_WRITE_KILL_SWITCH": "on"/gu) ?? []).length,
    4,
  );
  assert.doesNotMatch(wrangler, /"ZUKAN_FOUNDATION_V2_DUAL_WRITE_MODE": "on"/u);
});

test("shadow read stays off without a repository call and compares only digest/count", async () => {
  let calls = 0;
  const off = await compareFoundationShadowRead({
    mode: "off",
    canonical: { digest: "a", count: 11 },
    readShadow: async () => {
      calls += 1;
      return { digest: "a", count: 11 };
    },
  });
  assert.equal(off.status, "off");
  assert.equal(calls, 0);
  const match = await compareFoundationShadowRead({
    mode: "shadow",
    canonical: { digest: "a", count: 11 },
    readShadow: async () => ({ digest: "a", count: 11 }),
  });
  assert.equal(match.status, "match");
  const mismatch = await compareFoundationShadowRead({
    mode: "shadow",
    canonical: { digest: "a", count: 11 },
    readShadow: async () => ({ digest: "b", count: 11 }),
  });
  assert.equal(mismatch.status, "mismatch");
});

test("bounded dual-write is OFF by default and requires two allowlisted dialects", async () => {
  const source = REGIONAL_SOURCE_ASSETS[0];
  assert.ok(source);
  const plan = planRegionalSourceFoundationImport({
    tenantId: "tenant-a",
    sourceAssets: [source],
  });
  const calls: string[] = [];
  const auditEvents: FoundationDualWriteAuditEvent[] = [];
  const audit = (attemptId: string) => ({
    attemptId,
    sourceCommitSha: VERIFIED_SOURCE_SHA,
    sink: {
      appendDurable: async (event: FoundationDualWriteAuditEvent) => {
        auditEvents.push(event);
      },
    },
    now: () => "2026-07-28T00:00:00.000Z",
  });
  const repository = (dialect: "postgres" | "d1"): ZukanFoundationV2Repository => ({
    dialect,
    capabilities: async () => ({
      available: true,
      dialect,
      schemaVersion: dialect === "postgres"
        ? "foundation_v2_integrity_0139"
        : "foundation_v2_integrity_0014",
      readOnly: false,
      blockers: [],
    }),
    readSourceImportState: async () => emptyFoundationSourceImportState(),
    applySourceImport: async (input: FoundationWriteRequest) => {
      calls.push(dialect);
      return {
        status: "succeeded",
        dialect,
        tenantId: input.batch.tenantId,
        operation: input.batch.operation,
        idempotencyKey: input.idempotencyKey,
        payloadSha256: input.batch.payloadSha256,
        entityCount: 5,
        auditCode: "write_succeeded",
      };
    },
  });
  const disabled = await runBoundedFoundationDualWrite({
    config: loadFoundationRolloutConfig({}),
    repositories: [repository("postgres"), repository("d1")],
    request: { batch: plan.batch, idempotencyKey: "regional-source:run-0001" },
    audit: audit("audit-attempt-off-0001"),
  });
  assert.equal(disabled.status, "disabled");
  assert.deepEqual(calls, []);
  assert.deepEqual(auditEvents.map((event) => event.phase), ["requested", "disabled"]);

  const enabled = loadFoundationRolloutConfig({
    ZUKAN_FOUNDATION_V2_DUAL_WRITE_MODE: "on",
    ZUKAN_FOUNDATION_V2_WRITE_KILL_SWITCH: "off",
    ZUKAN_FOUNDATION_V2_ALLOWED_TENANTS: "tenant-a",
    ZUKAN_FOUNDATION_V2_ALLOWED_OPERATIONS: "source_registry_import_v1",
    ZUKAN_FOUNDATION_V2_MAX_ENTITIES: "16",
  });
  const result = await runBoundedFoundationDualWrite({
    config: enabled,
    repositories: [repository("postgres"), repository("d1")],
    request: { batch: plan.batch, idempotencyKey: "regional-source:run-0001" },
    audit: audit("audit-attempt-on-0001"),
  });
  assert.equal(result.status, "succeeded");
  assert.deepEqual(calls.sort(), ["d1", "postgres"]);
  assert.deepEqual(
    auditEvents.map((event) => event.phase),
    ["requested", "disabled", "requested", "succeeded"],
  );
  const succeeded = auditEvents.at(-1);
  assert.equal(succeeded?.retryRequired, false);
  assert.equal(succeeded?.killSwitchRecommended, false);
  assert.deepEqual(
    succeeded?.outcomes.map((outcome) => `${outcome.dialect}:${outcome.status}`).sort(),
    ["d1:succeeded", "postgres:succeeded"],
  );
});

test("bounded dual-write preflights both capabilities and durably records a partial failure", async () => {
  const source = REGIONAL_SOURCE_ASSETS[0];
  assert.ok(source);
  const plan = planRegionalSourceFoundationImport({
    tenantId: "tenant-a",
    sourceAssets: [source],
  });
  const config = loadFoundationRolloutConfig({
    ZUKAN_FOUNDATION_V2_DUAL_WRITE_MODE: "on",
    ZUKAN_FOUNDATION_V2_WRITE_KILL_SWITCH: "off",
    ZUKAN_FOUNDATION_V2_ALLOWED_TENANTS: "tenant-a",
    ZUKAN_FOUNDATION_V2_ALLOWED_OPERATIONS: "source_registry_import_v1",
    ZUKAN_FOUNDATION_V2_MAX_ENTITIES: "16",
  });
  const auditEvents: FoundationDualWriteAuditEvent[] = [];
  const writes: string[] = [];
  const repository = (
    dialect: "postgres" | "d1",
    options: { available?: boolean; rejectWrite?: boolean } = {},
  ): ZukanFoundationV2Repository => ({
    dialect,
    capabilities: async () => ({
      available: options.available ?? true,
      dialect,
      schemaVersion: options.available === false
        ? null
        : dialect === "postgres"
          ? "foundation_v2_integrity_0139"
          : "foundation_v2_integrity_0014",
      readOnly: false,
      blockers: options.available === false ? ["fixture_unavailable"] : [],
    }),
    readSourceImportState: async () => emptyFoundationSourceImportState(),
    applySourceImport: async (request) => {
      writes.push(dialect);
      if (options.rejectWrite) throw new Error("foundation_fixture_write_failed");
      return {
        status: "succeeded",
        dialect,
        tenantId: request.batch.tenantId,
        operation: request.batch.operation,
        idempotencyKey: request.idempotencyKey,
        payloadSha256: request.batch.payloadSha256,
        entityCount: 5,
        auditCode: "write_succeeded",
      };
    },
  });
  const audit = {
    attemptId: "audit-attempt-partial-0001",
    sourceCommitSha: VERIFIED_SOURCE_SHA,
    sink: {
      appendDurable: async (event: FoundationDualWriteAuditEvent) => {
        auditEvents.push(event);
      },
    },
    now: () => "2026-07-28T00:00:00.000Z",
  };

  await assert.rejects(
    runBoundedFoundationDualWrite({
      config,
      repositories: [
        repository("postgres"),
        repository("d1", { available: false }),
      ],
      request: { batch: plan.batch, idempotencyKey: "regional-source:run-0002" },
      audit,
    }),
    /capability_preflight_failed/,
  );
  assert.deepEqual(writes, []);
  assert.equal(auditEvents.at(-1)?.phase, "preflight_failed");
  assert.equal(auditEvents.at(-1)?.retryRequired, true);

  auditEvents.length = 0;
  await assert.rejects(
    runBoundedFoundationDualWrite({
      config,
      repositories: [
        repository("postgres"),
        repository("d1", { rejectWrite: true }),
      ],
      request: { batch: plan.batch, idempotencyKey: "regional-source:run-0003" },
      audit: { ...audit, attemptId: "audit-attempt-partial-0002" },
    }),
    (error: unknown) => {
      assert.ok(error instanceof FoundationDualWriteError);
      assert.equal(error.auditEvent.phase, "partial_failure");
      assert.equal(error.auditEvent.retryRequired, true);
      assert.equal(error.auditEvent.killSwitchRecommended, true);
      return true;
    },
  );
  assert.deepEqual(writes.sort(), ["d1", "postgres"]);
  assert.deepEqual(auditEvents.map((event) => event.phase), ["requested", "partial_failure"]);
  assert.deepEqual(
    auditEvents.at(-1)?.outcomes.map((outcome) => `${outcome.dialect}:${outcome.status}`).sort(),
    ["d1:rejected", "postgres:succeeded"],
  );
  assert.equal(
    auditEvents.at(-1)?.outcomes.find((outcome) => outcome.dialect === "d1")?.errorCode,
    "foundation_dual_write_repository_rejected",
  );
});

test("partial retry reuses the idempotency key and turns the committed side into a replay", async () => {
  const source = REGIONAL_SOURCE_ASSETS[0];
  assert.ok(source);
  const plan = planRegionalSourceFoundationImport({
    tenantId: "tenant-a",
    sourceAssets: [source],
  });
  const config = loadFoundationRolloutConfig({
    ZUKAN_FOUNDATION_V2_DUAL_WRITE_MODE: "on",
    ZUKAN_FOUNDATION_V2_WRITE_KILL_SWITCH: "off",
    ZUKAN_FOUNDATION_V2_ALLOWED_TENANTS: "tenant-a",
    ZUKAN_FOUNDATION_V2_ALLOWED_OPERATIONS: "source_registry_import_v1",
    ZUKAN_FOUNDATION_V2_MAX_ENTITIES: "16",
  });
  let postgresCommitted = false;
  let d1Attempts = 0;
  const repository = (dialect: "postgres" | "d1"): ZukanFoundationV2Repository => ({
    dialect,
    capabilities: async () => ({
      available: true,
      dialect,
      schemaVersion: dialect === "postgres"
        ? "foundation_v2_integrity_0139"
        : "foundation_v2_integrity_0014",
      readOnly: false,
      blockers: [],
    }),
    readSourceImportState: async () => emptyFoundationSourceImportState(),
    applySourceImport: async (request) => {
      if (dialect === "d1") {
        d1Attempts += 1;
        if (d1Attempts === 1) throw new Error("do_not_persist_this_raw_message");
      }
      const status = dialect === "postgres" && postgresCommitted ? "replayed" : "succeeded";
      if (dialect === "postgres") postgresCommitted = true;
      return {
        status,
        dialect,
        tenantId: request.batch.tenantId,
        operation: request.batch.operation,
        idempotencyKey: request.idempotencyKey,
        payloadSha256: request.batch.payloadSha256,
        entityCount: 5,
        auditCode: status === "replayed" ? "idempotent_replay" : "write_succeeded",
      };
    },
  });
  const auditEvents: FoundationDualWriteAuditEvent[] = [];
  const sink = {
    appendDurable: async (event: FoundationDualWriteAuditEvent) => {
      auditEvents.push(event);
    },
  };
  const request = {
    batch: plan.batch,
    idempotencyKey: "regional-source:same-key-0001",
  };

  await assert.rejects(runBoundedFoundationDualWrite({
    config,
    repositories: [repository("postgres"), repository("d1")],
    request,
    audit: {
      attemptId: "audit-attempt-retry-0001",
      sourceCommitSha: VERIFIED_SOURCE_SHA,
      sink,
    },
  }), /partial_failure/);
  const retry = await runBoundedFoundationDualWrite({
    config,
    repositories: [repository("postgres"), repository("d1")],
    request,
    audit: {
      attemptId: "audit-attempt-retry-0002",
      sourceCommitSha: VERIFIED_SOURCE_SHA,
      sink,
    },
  });
  assert.equal(retry.status, "succeeded");
  assert.deepEqual(
    retry.outcomes.map((outcome) => `${outcome.dialect}:${outcome.status}`).sort(),
    ["d1:succeeded", "postgres:replayed"],
  );
  assert.equal(d1Attempts, 2);
  assert.equal(postgresCommitted, true);
  assert.deepEqual(
    auditEvents.map((event) => event.phase),
    ["requested", "partial_failure", "requested", "succeeded"],
  );
});

test("mixed success and blocked plus terminal audit failure both fail closed as partial", async () => {
  const source = REGIONAL_SOURCE_ASSETS[0];
  assert.ok(source);
  const plan = planRegionalSourceFoundationImport({
    tenantId: "tenant-a",
    sourceAssets: [source],
  });
  const config = loadFoundationRolloutConfig({
    ZUKAN_FOUNDATION_V2_DUAL_WRITE_MODE: "on",
    ZUKAN_FOUNDATION_V2_WRITE_KILL_SWITCH: "off",
    ZUKAN_FOUNDATION_V2_ALLOWED_TENANTS: "tenant-a",
    ZUKAN_FOUNDATION_V2_ALLOWED_OPERATIONS: "source_registry_import_v1",
    ZUKAN_FOUNDATION_V2_MAX_ENTITIES: "16",
  });
  const repository = (
    dialect: "postgres" | "d1",
    outcome: "succeeded" | "blocked",
  ): ZukanFoundationV2Repository => ({
    dialect,
    capabilities: async () => ({
      available: true,
      dialect,
      schemaVersion: dialect === "postgres"
        ? "foundation_v2_integrity_0139"
        : "foundation_v2_integrity_0014",
      readOnly: false,
      blockers: [],
    }),
    readSourceImportState: async () => emptyFoundationSourceImportState(),
    applySourceImport: async (request) => ({
      status: outcome,
      dialect,
      tenantId: request.batch.tenantId,
      operation: request.batch.operation,
      idempotencyKey: request.idempotencyKey,
      payloadSha256: request.batch.payloadSha256,
      entityCount: 5,
      auditCode: outcome === "succeeded" ? "write_succeeded" : "tenant_not_allowlisted",
    }),
  });
  const durable: FoundationDualWriteAuditEvent[] = [];
  await assert.rejects(
    runBoundedFoundationDualWrite({
      config,
      repositories: [
        repository("postgres", "succeeded"),
        repository("d1", "blocked"),
      ],
      request: { batch: plan.batch, idempotencyKey: "regional-source:mixed-0001" },
      audit: {
        attemptId: "audit-attempt-mixed-0001",
        sourceCommitSha: VERIFIED_SOURCE_SHA,
        sink: {
          appendDurable: async (event) => {
            durable.push(event);
          },
        },
      },
    }),
    (error: unknown) => {
      assert.ok(error instanceof FoundationDualWriteError);
      assert.equal(error.auditEvent.phase, "partial_failure");
      assert.equal(error.auditEvent.killSwitchRecommended, true);
      return true;
    },
  );
  assert.deepEqual(durable.map((event) => event.phase), ["requested", "partial_failure"]);

  const requestedOnly: FoundationDualWriteAuditEvent[] = [];
  await assert.rejects(
    runBoundedFoundationDualWrite({
      config,
      repositories: [
        repository("postgres", "succeeded"),
        repository("d1", "succeeded"),
      ],
      request: { batch: plan.batch, idempotencyKey: "regional-source:audit-fail-0001" },
      audit: {
        attemptId: "audit-attempt-audit-fail-0001",
        sourceCommitSha: VERIFIED_SOURCE_SHA,
        sink: {
          appendDurable: async (event) => {
            if (event.phase === "succeeded") throw new Error("sink unavailable");
            requestedOnly.push(event);
          },
        },
      },
    }),
    (error: unknown) => {
      assert.ok(error instanceof FoundationDualWriteError);
      assert.equal(error.message, "foundation_dual_write_terminal_audit_failed");
      assert.equal(error.settled.length, 2);
      assert.equal(error.auditPersisted, false);
      assert.equal(error.auditEvent.phase, "partial_failure");
      assert.equal(error.auditEvent.retryRequired, true);
      assert.equal(error.auditEvent.killSwitchRecommended, true);
      return true;
    },
  );
  assert.deepEqual(requestedOnly.map((event) => event.phase), ["requested"]);
});
