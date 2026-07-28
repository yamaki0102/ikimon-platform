import assert from "node:assert/strict";
import test from "node:test";
import {
  foundationSourceRegistryApplyConfirmation,
  parseFoundationSourceRegistryApplyCli,
  runFoundationSourceRegistryApply,
  type FoundationSourceRegistryApplyCliOptions,
  type FoundationSourceRegistryApplyTargetResources,
} from "./applyZukanFoundationV2SourceRegistryImport.js";
import {
  emptyFoundationSourceImportState,
  foundationSourceImportEntityCount,
  ZUKAN_FOUNDATION_SOURCE_IMPORT_OPERATION,
  ZUKAN_FOUNDATION_SOURCE_REGISTRY_CANONICAL_TENANT_ID,
  type FoundationSourceImportState,
  type FoundationWriteOutcome,
  type FoundationWriteRequest,
  type ZukanFoundationV2Repository,
} from "../services/zukanFoundationV2RepositoryContract.js";
import {
  planRegionalSourceFoundationImport,
} from "../services/zukanFoundationV2SourceRegistryImport.js";
import type {
  FoundationDualWriteAuditEvent,
  FoundationDualWriteAuditSink,
} from "../services/zukanFoundationV2Rollout.js";

const SOURCE_SHA = "a".repeat(40);
const D1_DATABASE_ID = "e06a7372-6964-4db1-92dd-3491d058f412";

function canonicalPlan() {
  return planRegionalSourceFoundationImport({
    tenantId: ZUKAN_FOUNDATION_SOURCE_REGISTRY_CANONICAL_TENANT_ID,
  });
}

function applyOptions(): Extract<
  FoundationSourceRegistryApplyCliOptions,
  { mode: "apply" }
> {
  const plan = canonicalPlan();
  const maxEntities = foundationSourceImportEntityCount(plan.batch);
  return {
    mode: "apply",
    sourceSha: SOURCE_SHA,
    expectedTenantId: ZUKAN_FOUNDATION_SOURCE_REGISTRY_CANONICAL_TENANT_ID,
    expectedPlanSha256: plan.payloadSha256,
    maxEntities,
    idempotencyKey: "foundation-source:apply-0001",
    attemptId: "foundation-source:attempt-0001",
    expectedPostgresHost: "db.staging.internal",
    expectedPostgresPort: 5432,
    expectedPostgresDatabase: "ikimon_staging",
    expectedD1DatabaseId: D1_DATABASE_ID,
    expectedD1DatabaseName: "ikimon_shadow_core",
    confirmation: foundationSourceRegistryApplyConfirmation({
      sourceSha: SOURCE_SHA,
      tenantId: ZUKAN_FOUNDATION_SOURCE_REGISTRY_CANONICAL_TENANT_ID,
      payloadSha256: plan.payloadSha256,
      entityCount: maxEntities,
      maxEntities,
    }),
  };
}

function applyEnvironment(
  options: Extract<FoundationSourceRegistryApplyCliOptions, { mode: "apply" }>,
): Record<string, string> {
  return {
    ZUKAN_FOUNDATION_V2_DUAL_WRITE_MODE: "on",
    ZUKAN_FOUNDATION_V2_WRITE_KILL_SWITCH: "off",
    ZUKAN_FOUNDATION_V2_ALLOWED_TENANTS: options.expectedTenantId,
    ZUKAN_FOUNDATION_V2_ALLOWED_OPERATIONS: ZUKAN_FOUNDATION_SOURCE_IMPORT_OPERATION,
    ZUKAN_FOUNDATION_V2_MAX_ENTITIES: String(options.maxEntities),
  };
}

class MutableFoundationRepository implements ZukanFoundationV2Repository {
  applyCalls = 0;

  constructor(
    readonly dialect: "postgres" | "d1",
    private state: FoundationSourceImportState = emptyFoundationSourceImportState(),
  ) {}

  async capabilities() {
    return {
      available: true as const,
      dialect: this.dialect,
      schemaVersion: this.dialect === "postgres"
        ? "foundation_v2_integrity_0139" as const
        : "foundation_v2_integrity_0014" as const,
      readOnly: false as const,
      blockers: [],
    };
  }

  async readSourceImportState(): Promise<FoundationSourceImportState> {
    return this.state;
  }

  async applySourceImport(input: FoundationWriteRequest): Promise<FoundationWriteOutcome> {
    this.applyCalls += 1;
    this.state = {
      subjects: [...input.batch.subjects],
      sourceWorks: [...input.batch.sourceWorks],
      sourceEditions: [...input.batch.sourceEditions],
      contentFixityEvents: [...input.batch.contentFixityEvents],
      contentObjects: [...input.batch.contentObjects],
      publicIdentifiers: [...input.batch.publicIdentifiers],
    };
    return {
      status: "succeeded",
      dialect: this.dialect,
      tenantId: input.batch.tenantId,
      operation: input.batch.operation,
      idempotencyKey: input.idempotencyKey,
      payloadSha256: input.batch.payloadSha256,
      entityCount: foundationSourceImportEntityCount(input.batch),
      auditCode: "write_succeeded",
    };
  }
}

class CollectingAuditSink implements FoundationDualWriteAuditSink {
  readonly events: FoundationDualWriteAuditEvent[] = [];

  async appendDurable(event: FoundationDualWriteAuditEvent): Promise<void> {
    this.events.push(event);
  }
}

function targetResources(input: {
  postgres?: MutableFoundationRepository;
  d1?: MutableFoundationRepository;
  sink?: FoundationDualWriteAuditSink;
  close?: () => Promise<void>;
} = {}): FoundationSourceRegistryApplyTargetResources {
  return {
    repositories: [
      input.postgres ?? new MutableFoundationRepository("postgres"),
      input.d1 ?? new MutableFoundationRepository("d1"),
    ],
    auditSink: input.sink ?? new CollectingAuditSink(),
    target: {
      postgresHost: "db.staging.internal",
      postgresPort: 5432,
      postgresDatabase: "ikimon_staging",
      d1DatabaseId: D1_DATABASE_ID,
      d1DatabaseName: "ikimon_shadow_core",
    },
    close: input.close ?? (async () => {}),
  };
}

const cleanGitState = () => ({
  headSha: SOURCE_SHA,
  porcelainStatus: "",
});

test("apply CLI defaults to canonical-tenant dry-run and never uses the synthetic tenant", () => {
  const parsed = parseFoundationSourceRegistryApplyCli([
    `--source-sha=${SOURCE_SHA}`,
  ]);
  assert.deepEqual(parsed, {
    mode: "dry_run",
    sourceSha: SOURCE_SHA,
    expectedTenantId: ZUKAN_FOUNDATION_SOURCE_REGISTRY_CANONICAL_TENANT_ID,
    expectedPlanSha256: null,
    maxEntities: 64,
  });
  assert.notEqual(
    parsed.expectedTenantId,
    "zukan-regional-source-dry-run",
  );
});

test("apply CLI rejects a non-canonical tenant and apply-only args without --apply", () => {
  assert.throws(
    () => parseFoundationSourceRegistryApplyCli([
      `--source-sha=${SOURCE_SHA}`,
      "--expected-tenant=zukan-regional-source-dry-run",
    ]),
    /foundation_apply_expected_tenant_not_canonical/u,
  );
  assert.throws(
    () => parseFoundationSourceRegistryApplyCli([
      `--source-sha=${SOURCE_SHA}`,
      "--idempotency-key=foundation-source:apply-0001",
    ]),
    /foundation_apply_write_arguments_require_apply_flag/u,
  );
});

test("apply CLI requires every immutable plan and target confirmation", () => {
  const expected = applyOptions();
  const parsed = parseFoundationSourceRegistryApplyCli([
    "--apply",
    `--source-sha=${expected.sourceSha}`,
    `--expected-tenant=${expected.expectedTenantId}`,
    `--expected-plan-sha256=${expected.expectedPlanSha256}`,
    `--max-entities=${expected.maxEntities}`,
    `--idempotency-key=${expected.idempotencyKey}`,
    `--attempt-id=${expected.attemptId}`,
    `--expected-postgres-host=${expected.expectedPostgresHost}`,
    `--expected-postgres-port=${expected.expectedPostgresPort}`,
    `--expected-postgres-database=${expected.expectedPostgresDatabase}`,
    `--expected-d1-database-id=${expected.expectedD1DatabaseId}`,
    `--expected-d1-database-name=${expected.expectedD1DatabaseName}`,
    `--confirm=${expected.confirmation}`,
  ]);
  assert.deepEqual(parsed, expected);
  assert.throws(
    () => parseFoundationSourceRegistryApplyCli([
      "--apply",
      `--source-sha=${expected.sourceSha}`,
      `--expected-tenant=${expected.expectedTenantId}`,
    ]),
    /foundation_apply_expected_plan_sha256_required/u,
  );
});

test("dry-run reports the exact plan and does not construct database targets", async () => {
  let createTargetsCalls = 0;
  const result = await runFoundationSourceRegistryApply(
    parseFoundationSourceRegistryApplyCli([`--source-sha=${SOURCE_SHA}`]),
    {},
    {
      repositoryRoot: "ignored",
      readGitState: cleanGitState,
      createTargets: async () => {
        createTargetsCalls += 1;
        return targetResources();
      },
    },
  );
  const plan = canonicalPlan();
  assert.equal(result.status, "planned");
  assert.equal(result.payloadSha256, plan.payloadSha256);
  assert.equal(result.entityCount, foundationSourceImportEntityCount(plan.batch));
  assert.equal(createTargetsCalls, 0);
});

test("apply fails closed while rollout flags remain at their default OFF values", async () => {
  let createTargetsCalls = 0;
  await assert.rejects(
    runFoundationSourceRegistryApply(
      applyOptions(),
      {},
      {
        repositoryRoot: "ignored",
        readGitState: cleanGitState,
        createTargets: async () => {
          createTargetsCalls += 1;
          return targetResources();
        },
      },
    ),
    /foundation_apply_dual_write_not_enabled/u,
  );
  assert.equal(createTargetsCalls, 0);
});

test("apply writes both repositories, audits requested/succeeded, and verifies post-state", async () => {
  const options = applyOptions();
  const postgres = new MutableFoundationRepository("postgres");
  const d1 = new MutableFoundationRepository("d1");
  const sink = new CollectingAuditSink();
  let closed = false;
  const result = await runFoundationSourceRegistryApply(
    options,
    applyEnvironment(options),
    {
      repositoryRoot: "ignored",
      readGitState: cleanGitState,
      now: () => "2026-07-28T00:00:00.000Z",
      createTargets: async () => targetResources({
        postgres,
        d1,
        sink,
        close: async () => {
          closed = true;
        },
      }),
    },
  );
  assert.equal(result.status, "succeeded");
  assert.equal(postgres.applyCalls, 1);
  assert.equal(d1.applyCalls, 1);
  assert.deepEqual(sink.events.map((event) => event.phase), [
    "requested",
    "succeeded",
  ]);
  assert.equal(closed, true);
});

test("requested audit failure prevents either repository write", async () => {
  const options = applyOptions();
  const postgres = new MutableFoundationRepository("postgres");
  const d1 = new MutableFoundationRepository("d1");
  let closed = false;
  await assert.rejects(
    runFoundationSourceRegistryApply(
      options,
      applyEnvironment(options),
      {
        repositoryRoot: "ignored",
        readGitState: cleanGitState,
        createTargets: async () => targetResources({
          postgres,
          d1,
          sink: {
            appendDurable: async () => {
              throw new Error("unavailable");
            },
          },
          close: async () => {
            closed = true;
          },
        }),
      },
    ),
    /foundation_dual_write_audit_persistence_failed/u,
  );
  assert.equal(postgres.applyCalls, 0);
  assert.equal(d1.applyCalls, 0);
  assert.equal(closed, true);
});

test("pre-existing row conflict fails before audit or writes", async () => {
  const options = applyOptions();
  const plan = canonicalPlan();
  const conflictingState = emptyFoundationSourceImportState();
  conflictingState.subjects = [{
    ...plan.batch.subjects[0]!,
    metadataJson: "{}",
  }];
  const postgres = new MutableFoundationRepository("postgres", conflictingState);
  const d1 = new MutableFoundationRepository("d1");
  const sink = new CollectingAuditSink();
  await assert.rejects(
    runFoundationSourceRegistryApply(
      options,
      applyEnvironment(options),
      {
        repositoryRoot: "ignored",
        readGitState: cleanGitState,
        createTargets: async () => targetResources({ postgres, d1, sink }),
      },
    ),
    /foundation_apply_pre_state_conflict:postgres/u,
  );
  assert.equal(postgres.applyCalls, 0);
  assert.equal(d1.applyCalls, 0);
  assert.equal(sink.events.length, 0);
});
