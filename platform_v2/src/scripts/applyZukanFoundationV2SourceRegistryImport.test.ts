import assert from "node:assert/strict";
import test from "node:test";
import {
  assertFoundationApplyPostgresIdentity,
  foundationApplyPostgresConnection,
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
  FoundationDualWriteTargetIdentity,
} from "../services/zukanFoundationV2Rollout.js";

const SOURCE_SHA = "a".repeat(40);
const D1_ACCOUNT_ID = "b".repeat(32);
const D1_DATABASE_ID = "e06a7372-6964-4db1-92dd-3491d058f412";

const TARGET_IDENTITY: FoundationDualWriteTargetIdentity = {
  postgresHost: "db.staging.internal",
  postgresPort: 5432,
  postgresDatabase: "ikimon_staging",
  d1AccountId: D1_ACCOUNT_ID,
  d1DatabaseId: D1_DATABASE_ID,
  d1DatabaseName: "ikimon_shadow_core",
};

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
  const idempotencyKey = "foundation-source:apply-0001";
  return {
    mode: "apply",
    sourceSha: SOURCE_SHA,
    expectedTenantId: ZUKAN_FOUNDATION_SOURCE_REGISTRY_CANONICAL_TENANT_ID,
    expectedPlanSha256: plan.payloadSha256,
    maxEntities,
    idempotencyKey,
    attemptId: "foundation-source:attempt-0001",
    expectedPostgresHost: TARGET_IDENTITY.postgresHost,
    expectedPostgresPort: TARGET_IDENTITY.postgresPort,
    expectedPostgresDatabase: TARGET_IDENTITY.postgresDatabase,
    expectedD1AccountId: TARGET_IDENTITY.d1AccountId,
    expectedD1DatabaseId: TARGET_IDENTITY.d1DatabaseId,
    expectedD1DatabaseName: TARGET_IDENTITY.d1DatabaseName,
    confirmation: foundationSourceRegistryApplyConfirmation({
      sourceSha: SOURCE_SHA,
      tenantId: ZUKAN_FOUNDATION_SOURCE_REGISTRY_CANONICAL_TENANT_ID,
      payloadSha256: plan.payloadSha256,
      entityCount: maxEntities,
      maxEntities,
      idempotencyKey,
      target: TARGET_IDENTITY,
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
  target?: Partial<FoundationSourceRegistryApplyTargetResources["target"]>;
  close?: () => Promise<void>;
} = {}): FoundationSourceRegistryApplyTargetResources {
  return {
    repositories: [
      input.postgres ?? new MutableFoundationRepository("postgres"),
      input.d1 ?? new MutableFoundationRepository("d1"),
    ],
    auditSink: input.sink ?? new CollectingAuditSink(),
    target: {
      ...TARGET_IDENTITY,
      postgresServerAddress: "192.0.2.10",
      postgresServerPort: 5432,
      postgresSchema: "public",
      postgresTls: true,
      ...input.target,
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
    `--expected-d1-account-id=${expected.expectedD1AccountId}`,
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

test("prepare-confirmation emits target-bound evidence without constructing targets", async () => {
  const expected = applyOptions();
  const parsed = parseFoundationSourceRegistryApplyCli([
    "--prepare-confirmation",
    `--source-sha=${expected.sourceSha}`,
    `--expected-tenant=${expected.expectedTenantId}`,
    `--expected-plan-sha256=${expected.expectedPlanSha256}`,
    `--max-entities=${expected.maxEntities}`,
    `--idempotency-key=${expected.idempotencyKey}`,
    `--expected-postgres-host=${expected.expectedPostgresHost}`,
    `--expected-postgres-port=${expected.expectedPostgresPort}`,
    `--expected-postgres-database=${expected.expectedPostgresDatabase}`,
    `--expected-d1-account-id=${expected.expectedD1AccountId}`,
    `--expected-d1-database-id=${expected.expectedD1DatabaseId}`,
    `--expected-d1-database-name=${expected.expectedD1DatabaseName}`,
  ]);
  let createTargetsCalls = 0;
  const result = await runFoundationSourceRegistryApply(parsed, {}, {
    repositoryRoot: "ignored",
    readGitState: cleanGitState,
    createTargets: async () => {
      createTargetsCalls += 1;
      return targetResources();
    },
  });
  assert.equal(result.status, "confirmation_ready");
  assert.equal(result.requiredConfirmation, expected.confirmation);
  assert.equal(result.idempotencyKey, expected.idempotencyKey);
  assert.deepEqual(result.target, TARGET_IDENTITY);
  assert.equal(createTargetsCalls, 0);
});

test("confirmation changes with the exact target tuple and idempotency key", () => {
  const expected = applyOptions();
  const plan = canonicalPlan();
  const confirmation = (input: {
    idempotencyKey?: string;
    target?: FoundationDualWriteTargetIdentity;
  }) => foundationSourceRegistryApplyConfirmation({
    sourceSha: SOURCE_SHA,
    tenantId: ZUKAN_FOUNDATION_SOURCE_REGISTRY_CANONICAL_TENANT_ID,
    payloadSha256: plan.payloadSha256,
    entityCount: expected.maxEntities,
    maxEntities: expected.maxEntities,
    idempotencyKey: input.idempotencyKey ?? expected.idempotencyKey,
    target: input.target ?? TARGET_IDENTITY,
  });
  assert.equal(confirmation({}), expected.confirmation);
  assert.notEqual(
    confirmation({ idempotencyKey: "foundation-source:apply-0002" }),
    expected.confirmation,
  );
  assert.notEqual(
    confirmation({
      target: {
        ...TARGET_IDENTITY,
        d1DatabaseId: "4f111229-7329-49db-bbbd-073a0dc00e5f",
      },
    }),
    expected.confirmation,
  );
  assert.notEqual(
    confirmation({
      target: {
        ...TARGET_IDENTITY,
        postgresDatabase: "ikimon_production",
      },
    }),
    expected.confirmation,
  );
});

test("PostgreSQL DSN rejects target overrides and weak TLS, then canonicalizes safe TLS options", () => {
  const base = "postgresql://operator:secret@db.staging.internal:5432/ikimon_staging";
  assert.throws(
    () => foundationApplyPostgresConnection(base),
    /foundation_apply_postgres_tls_verify_full_required/u,
  );
  for (const mode of ["disable", "allow", "prefer", "require", "verify-ca"]) {
    assert.throws(
      () => foundationApplyPostgresConnection(`${base}?sslmode=${mode}`),
      /foundation_apply_postgres_tls_verify_full_required/u,
    );
  }
  for (const query of [
    "host=other.internal",
    "port=6543",
    "database=other",
    "user=other",
    "password=other",
    "search_path=other",
    "options=-c%20search_path%3Dother",
  ]) {
    assert.throws(
      () => foundationApplyPostgresConnection(`${base}?sslmode=verify-full&${query}`),
      /foundation_apply_postgres_url_query_parameter_forbidden/u,
    );
  }
  assert.throws(
    () => foundationApplyPostgresConnection(
      `${base}?sslmode=verify-full&sslmode=disable`,
    ),
    /foundation_apply_postgres_url_query_parameter_invalid/u,
  );
  const accepted = foundationApplyPostgresConnection(
    `${base}?sslmode=verify-full&sslrootcert=C%3A%5Ccerts%5Cfoundation-ca.pem`,
  );
  assert.deepEqual(accepted.target, {
    host: "db.staging.internal",
    port: 5432,
    database: "ikimon_staging",
  });
  const canonical = new URL(accepted.connectionString);
  assert.equal(canonical.searchParams.get("sslmode"), "verify-full");
  assert.equal(
    canonical.searchParams.get("options"),
    "-c statement_timeout=30000 -c lock_timeout=5000 -c search_path=public",
  );
  assert.equal(canonical.searchParams.has("host"), false);
});

test("PostgreSQL live identity requires resolved server, public schema, and active TLS", () => {
  const row = {
    database_name: "ikimon_staging",
    transaction_read_only: "off",
    schema_name: "public",
    search_path: "public",
    server_address: "192.0.2.10",
    server_port: 5432,
    tls_enabled: true,
  };
  assert.deepEqual(assertFoundationApplyPostgresIdentity({
    row,
    expectedDatabase: "ikimon_staging",
    expectedPort: 5432,
    resolvedHostAddresses: ["192.0.2.10", "192.0.2.11"],
  }), {
    serverAddress: "192.0.2.10",
    serverPort: 5432,
    schema: "public",
    tls: true,
  });
  assert.throws(
    () => assertFoundationApplyPostgresIdentity({
      row: { ...row, tls_enabled: false },
      expectedDatabase: "ikimon_staging",
      expectedPort: 5432,
      resolvedHostAddresses: ["192.0.2.10"],
    }),
    /foundation_apply_postgres_tls_not_active/u,
  );
  assert.throws(
    () => assertFoundationApplyPostgresIdentity({
      row: { ...row, search_path: "other, public" },
      expectedDatabase: "ikimon_staging",
      expectedPort: 5432,
      resolvedHostAddresses: ["192.0.2.10"],
    }),
    /foundation_apply_postgres_schema_mismatch/u,
  );
  assert.throws(
    () => assertFoundationApplyPostgresIdentity({
      row,
      expectedDatabase: "ikimon_staging",
      expectedPort: 5432,
      resolvedHostAddresses: ["192.0.2.99"],
    }),
    /foundation_apply_postgres_server_identity_mismatch/u,
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
  assert.deepEqual(sink.events.map((event) => event.target), [
    TARGET_IDENTITY,
    TARGET_IDENTITY,
  ]);
  assert.equal(sink.events[0]?.idempotencyKey, options.idempotencyKey);
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

test("target factory identity mismatch prevents audit and both writes", async () => {
  const options = applyOptions();
  const postgres = new MutableFoundationRepository("postgres");
  const d1 = new MutableFoundationRepository("d1");
  const sink = new CollectingAuditSink();
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
          sink,
          target: {
            d1DatabaseId: "4f111229-7329-49db-bbbd-073a0dc00e5f",
          },
          close: async () => {
            closed = true;
          },
        }),
      },
    ),
    /foundation_apply_target_factory_identity_mismatch/u,
  );
  assert.equal(postgres.applyCalls, 0);
  assert.equal(d1.applyCalls, 0);
  assert.equal(sink.events.length, 0);
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
