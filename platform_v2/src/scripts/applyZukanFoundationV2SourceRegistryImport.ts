import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import {
  verifyFoundationEvidenceSourceSha,
  type FoundationEvidenceGitStateReader,
} from "../services/zukanFoundationV2EvidenceSourceProvenance.js";
import {
  CloudflareD1FoundationAuditSink,
} from "../services/zukanFoundationV2D1AuditSink.js";
import {
  CloudflareD1HttpDatabase,
} from "../services/zukanFoundationV2CloudflareD1HttpDatabase.js";
import {
  ZukanFoundationV2D1Repository,
} from "../services/zukanFoundationV2D1Repository.js";
import {
  type FoundationPostgresPool,
  ZukanFoundationV2PostgresRepository,
} from "../services/zukanFoundationV2PostgresRepository.js";
import {
  canonicalFoundationJson,
  foundationSourceImportEntityCount,
  ZUKAN_FOUNDATION_SOURCE_IMPORT_OPERATION,
  ZUKAN_FOUNDATION_SOURCE_REGISTRY_CANONICAL_TENANT_ID,
  type FoundationSourceImportState,
  type ZukanFoundationV2Repository,
} from "../services/zukanFoundationV2RepositoryContract.js";
import {
  loadFoundationRolloutConfig,
  runBoundedFoundationDualWrite,
  type FoundationDualWriteAuditSink,
} from "../services/zukanFoundationV2Rollout.js";
import {
  lookupForFoundationSourceImport,
  planRegionalSourceFoundationImport,
} from "../services/zukanFoundationV2SourceRegistryImport.js";

const FOUNDATION_APPLY_CONFIRMATION_PREFIX =
  "APPLY_ZUKAN_FOUNDATION_SOURCE_REGISTRY_V1";

type FoundationSourceRegistryApplyBaseOptions = {
  sourceSha: string;
  expectedTenantId: typeof ZUKAN_FOUNDATION_SOURCE_REGISTRY_CANONICAL_TENANT_ID;
  expectedPlanSha256: string | null;
  maxEntities: number;
};

export type FoundationSourceRegistryApplyCliOptions =
  | (FoundationSourceRegistryApplyBaseOptions & {
    mode: "dry_run";
  })
  | (FoundationSourceRegistryApplyBaseOptions & {
    mode: "apply";
    expectedPlanSha256: string;
    idempotencyKey: string;
    attemptId: string;
    expectedPostgresHost: string;
    expectedPostgresPort: number;
    expectedPostgresDatabase: string;
    expectedD1DatabaseId: string;
    expectedD1DatabaseName: string;
    confirmation: string;
  });

export type FoundationSourceRegistryApplyTargetResources = {
  repositories: readonly [
    ZukanFoundationV2Repository,
    ZukanFoundationV2Repository,
  ];
  auditSink: FoundationDualWriteAuditSink;
  target: {
    postgresHost: string;
    postgresPort: number;
    postgresDatabase: string;
    d1DatabaseId: string;
    d1DatabaseName: string;
  };
  close(): Promise<void>;
};

export type FoundationSourceRegistryApplyTargetFactory = (input: {
  options: Extract<FoundationSourceRegistryApplyCliOptions, { mode: "apply" }>;
  environment: Readonly<Record<string, string | undefined>>;
}) => Promise<FoundationSourceRegistryApplyTargetResources>;

export type FoundationSourceRegistryApplyDependencies = {
  repositoryRoot?: string;
  readGitState?: FoundationEvidenceGitStateReader;
  createTargets?: FoundationSourceRegistryApplyTargetFactory;
  now?: () => string;
};

function oneArgument(
  argv: readonly string[],
  prefix: string,
  errorCode: string,
): string | null {
  const matches = argv.filter((argument) => argument.startsWith(prefix));
  if (matches.length > 1) throw new Error(`${errorCode}_duplicate`);
  if (matches.length === 0) return null;
  const value = matches[0]!.slice(prefix.length).trim();
  if (!value) throw new Error(`${errorCode}_empty`);
  return value;
}

function exactApplyFlag(argv: readonly string[]): boolean {
  const count = argv.filter((argument) => argument === "--apply").length;
  if (count > 1) throw new Error("foundation_apply_duplicate_apply_flag");
  return count === 1;
}

function parseMaxEntities(raw: string | null): number {
  if (raw === null) return 64;
  const parsed = Number.parseInt(raw, 10);
  if (
    !Number.isInteger(parsed)
    || String(parsed) !== raw
    || parsed < 1
    || parsed > 64
  ) {
    throw new Error("foundation_apply_max_entities_invalid");
  }
  return parsed;
}

function isValidOpaqueOperatorValue(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u.test(value);
}

export function parseFoundationSourceRegistryApplyCli(
  argv: readonly string[],
): FoundationSourceRegistryApplyCliOptions {
  const allowedPrefixes = [
    "--source-sha=",
    "--expected-tenant=",
    "--expected-plan-sha256=",
    "--max-entities=",
    "--idempotency-key=",
    "--attempt-id=",
    "--expected-postgres-host=",
    "--expected-postgres-port=",
    "--expected-postgres-database=",
    "--expected-d1-database-id=",
    "--expected-d1-database-name=",
    "--confirm=",
  ] as const;
  const unknown = argv.find((argument) =>
    argument !== "--apply"
    && !allowedPrefixes.some((prefix) => argument.startsWith(prefix)));
  if (unknown) throw new Error(`foundation_apply_unknown_argument:${unknown}`);
  const apply = exactApplyFlag(argv);
  const sourceSha = oneArgument(
    argv,
    "--source-sha=",
    "foundation_apply_source_sha",
  )?.toLowerCase() ?? "";
  if (!/^[0-9a-f]{40}$/u.test(sourceSha)) {
    throw new Error("foundation_apply_source_sha_must_be_full_commit");
  }
  const tenantArgument = oneArgument(
    argv,
    "--expected-tenant=",
    "foundation_apply_expected_tenant",
  );
  if (apply && tenantArgument === null) {
    throw new Error("foundation_apply_expected_tenant_required");
  }
  const expectedTenantId = tenantArgument
    ?? ZUKAN_FOUNDATION_SOURCE_REGISTRY_CANONICAL_TENANT_ID;
  if (expectedTenantId !== ZUKAN_FOUNDATION_SOURCE_REGISTRY_CANONICAL_TENANT_ID) {
    throw new Error("foundation_apply_expected_tenant_not_canonical");
  }
  const expectedPlanSha256 = oneArgument(
    argv,
    "--expected-plan-sha256=",
    "foundation_apply_expected_plan_sha256",
  )?.toLowerCase() ?? null;
  if (
    expectedPlanSha256 !== null
    && !/^[0-9a-f]{64}$/u.test(expectedPlanSha256)
  ) {
    throw new Error("foundation_apply_expected_plan_sha256_invalid");
  }
  const maxEntitiesArgument = oneArgument(
    argv,
    "--max-entities=",
    "foundation_apply_max_entities",
  );
  const maxEntities = parseMaxEntities(maxEntitiesArgument);
  const idempotencyKey = oneArgument(
    argv,
    "--idempotency-key=",
    "foundation_apply_idempotency_key",
  );
  const attemptId = oneArgument(
    argv,
    "--attempt-id=",
    "foundation_apply_attempt_id",
  );
  const expectedPostgresDatabase = oneArgument(
    argv,
    "--expected-postgres-database=",
    "foundation_apply_expected_postgres_database",
  );
  const expectedPostgresHost = oneArgument(
    argv,
    "--expected-postgres-host=",
    "foundation_apply_expected_postgres_host",
  )?.toLowerCase() ?? null;
  const expectedPostgresPortArgument = oneArgument(
    argv,
    "--expected-postgres-port=",
    "foundation_apply_expected_postgres_port",
  );
  const expectedD1DatabaseId = oneArgument(
    argv,
    "--expected-d1-database-id=",
    "foundation_apply_expected_d1_database_id",
  )?.toLowerCase() ?? null;
  const expectedD1DatabaseName = oneArgument(
    argv,
    "--expected-d1-database-name=",
    "foundation_apply_expected_d1_database_name",
  );
  const confirmation = oneArgument(
    argv,
    "--confirm=",
    "foundation_apply_confirmation",
  );
  if (!apply) {
    if (
      idempotencyKey !== null
      || attemptId !== null
      || expectedPostgresHost !== null
      || expectedPostgresPortArgument !== null
      || expectedPostgresDatabase !== null
      || expectedD1DatabaseId !== null
      || expectedD1DatabaseName !== null
      || confirmation !== null
    ) {
      throw new Error("foundation_apply_write_arguments_require_apply_flag");
    }
    return {
      mode: "dry_run",
      sourceSha,
      expectedTenantId,
      expectedPlanSha256,
      maxEntities,
    };
  }
  if (expectedPlanSha256 === null) {
    throw new Error("foundation_apply_expected_plan_sha256_required");
  }
  if (maxEntitiesArgument === null) {
    throw new Error("foundation_apply_max_entities_required");
  }
  if (!idempotencyKey || !isValidOpaqueOperatorValue(idempotencyKey)) {
    throw new Error("foundation_apply_idempotency_key_invalid");
  }
  if (!attemptId || !isValidOpaqueOperatorValue(attemptId)) {
    throw new Error("foundation_apply_attempt_id_invalid");
  }
  if (
    !expectedPostgresHost
    || !/^[A-Za-z0-9][A-Za-z0-9.:[\]-]{0,252}$/u.test(expectedPostgresHost)
  ) {
    throw new Error("foundation_apply_expected_postgres_host_invalid");
  }
  const expectedPostgresPort = Number.parseInt(
    expectedPostgresPortArgument ?? "",
    10,
  );
  if (
    !expectedPostgresPortArgument
    || String(expectedPostgresPort) !== expectedPostgresPortArgument
    || expectedPostgresPort < 1
    || expectedPostgresPort > 65_535
  ) {
    throw new Error("foundation_apply_expected_postgres_port_invalid");
  }
  if (
    !expectedPostgresDatabase
    || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/u.test(expectedPostgresDatabase)
  ) {
    throw new Error("foundation_apply_expected_postgres_database_invalid");
  }
  if (
    !expectedD1DatabaseId
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(expectedD1DatabaseId)
  ) {
    throw new Error("foundation_apply_expected_d1_database_id_invalid");
  }
  if (
    !expectedD1DatabaseName
    || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u.test(expectedD1DatabaseName)
  ) {
    throw new Error("foundation_apply_expected_d1_database_name_invalid");
  }
  if (!confirmation) {
    throw new Error("foundation_apply_confirmation_required");
  }
  return {
    mode: "apply",
    sourceSha,
    expectedTenantId,
    expectedPlanSha256,
    maxEntities,
    idempotencyKey,
    attemptId,
    expectedPostgresHost,
    expectedPostgresPort,
    expectedPostgresDatabase,
    expectedD1DatabaseId,
    expectedD1DatabaseName,
    confirmation,
  };
}

export function foundationSourceRegistryApplyConfirmation(input: {
  sourceSha: string;
  tenantId: string;
  payloadSha256: string;
  entityCount: number;
  maxEntities: number;
}): string {
  return [
    FOUNDATION_APPLY_CONFIRMATION_PREFIX,
    input.sourceSha,
    input.tenantId,
    input.payloadSha256,
    String(input.entityCount),
    String(input.maxEntities),
  ].join(":");
}

function requiredEnvironmentValue(
  environment: Readonly<Record<string, string | undefined>>,
  key: string,
): string {
  const value = environment[key]?.trim() ?? "";
  if (!value) throw new Error(`foundation_apply_environment_required:${key}`);
  return value;
}

function postgresTarget(databaseUrl: string): {
  host: string;
  port: number;
  database: string;
} {
  const parsed = new URL(databaseUrl);
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("foundation_apply_postgres_url_protocol_invalid");
  }
  const databaseName = decodeURIComponent(parsed.pathname.slice(1)).trim();
  if (!databaseName) {
    throw new Error("foundation_apply_postgres_database_name_required");
  }
  return {
    host: parsed.hostname.toLowerCase(),
    port: parsed.port ? Number.parseInt(parsed.port, 10) : 5432,
    database: databaseName,
  };
}

function boundedPostgresUrl(databaseUrl: string): string {
  const parsed = new URL(databaseUrl);
  const existingOptions = parsed.searchParams.get("options")?.trim() ?? "";
  parsed.searchParams.set(
    "options",
    [
      existingOptions,
      "-c statement_timeout=30000",
      "-c lock_timeout=5000",
    ].filter(Boolean).join(" "),
  );
  return parsed.toString();
}

async function createDefaultTargets(input: {
  options: Extract<FoundationSourceRegistryApplyCliOptions, { mode: "apply" }>;
  environment: Readonly<Record<string, string | undefined>>;
}): Promise<FoundationSourceRegistryApplyTargetResources> {
  const databaseUrl = requiredEnvironmentValue(
    input.environment,
    "FOUNDATION_APPLY_DATABASE_URL",
  );
  const expectedPostgresTarget = postgresTarget(databaseUrl);
  if (
    expectedPostgresTarget.host !== input.options.expectedPostgresHost
    || expectedPostgresTarget.port !== input.options.expectedPostgresPort
    || expectedPostgresTarget.database !== input.options.expectedPostgresDatabase
  ) {
    throw new Error("foundation_apply_postgres_url_target_mismatch");
  }
  const accountId = requiredEnvironmentValue(
    input.environment,
    "CLOUDFLARE_ACCOUNT_ID",
  ).toLowerCase();
  const apiToken = requiredEnvironmentValue(
    input.environment,
    "CLOUDFLARE_API_TOKEN",
  );
  const d1Database = new CloudflareD1HttpDatabase({
    accountId,
    databaseId: input.options.expectedD1DatabaseId,
    expectedDatabaseName: input.options.expectedD1DatabaseName,
    apiToken,
  });
  const pool = new Pool({
    connectionString: boundedPostgresUrl(databaseUrl),
    application_name: "zukan_foundation_v2_source_registry_apply",
  });
  try {
    const [postgresIdentity, d1Identity] = await Promise.all([
      pool.query<{
        database_name: string;
        transaction_read_only: string;
      }>(
        `SELECT current_database()::text AS database_name,
                current_setting('transaction_read_only') AS transaction_read_only`,
      ),
      d1Database.assertExpectedDatabaseIdentity(),
    ]);
    const postgresRow = postgresIdentity.rows[0];
    if (
      postgresRow?.database_name !== input.options.expectedPostgresDatabase
      || postgresRow.transaction_read_only !== "off"
    ) {
      throw new Error("foundation_apply_postgres_identity_mismatch");
    }
    if (
      d1Identity.uuid !== input.options.expectedD1DatabaseId
      || d1Identity.name !== input.options.expectedD1DatabaseName
    ) {
      throw new Error("foundation_apply_d1_identity_mismatch");
    }
    const postgresRepository = new ZukanFoundationV2PostgresRepository(
      pool as unknown as FoundationPostgresPool,
    );
    const d1Repository = new ZukanFoundationV2D1Repository(d1Database);
    return {
      repositories: [postgresRepository, d1Repository],
      auditSink: new CloudflareD1FoundationAuditSink(d1Database),
      target: {
        postgresHost: expectedPostgresTarget.host,
        postgresPort: expectedPostgresTarget.port,
        postgresDatabase: postgresRow.database_name,
        d1DatabaseId: d1Identity.uuid,
        d1DatabaseName: d1Identity.name,
      },
      close: async () => {
        await pool.end();
      },
    };
  } catch (error) {
    await pool.end();
    throw error;
  }
}

function assertExplicitApplyConfig(input: {
  options: Extract<FoundationSourceRegistryApplyCliOptions, { mode: "apply" }>;
  environment: Readonly<Record<string, string | undefined>>;
}): ReturnType<typeof loadFoundationRolloutConfig> {
  const config = loadFoundationRolloutConfig(input.environment);
  if (config.invalidValues.length > 0) {
    throw new Error("foundation_apply_rollout_config_invalid");
  }
  if (config.dualWriteMode !== "on") {
    throw new Error("foundation_apply_dual_write_not_enabled");
  }
  if (config.writeKillSwitch) {
    throw new Error("foundation_apply_kill_switch_active");
  }
  if (
    config.allowedTenants.length !== 1
    || config.allowedTenants[0] !== input.options.expectedTenantId
  ) {
    throw new Error("foundation_apply_tenant_allowlist_not_exact");
  }
  if (
    config.allowedOperations.length !== 1
    || config.allowedOperations[0] !== ZUKAN_FOUNDATION_SOURCE_IMPORT_OPERATION
  ) {
    throw new Error("foundation_apply_operation_allowlist_not_exact");
  }
  if (config.maxEntities !== input.options.maxEntities) {
    throw new Error("foundation_apply_entity_limit_not_exact");
  }
  if (
    input.environment.ZUKAN_FOUNDATION_V2_MAX_ENTITIES?.trim()
    !== String(input.options.maxEntities)
  ) {
    throw new Error("foundation_apply_entity_limit_not_explicit");
  }
  return config;
}

function assertCompatibleState(input: {
  phase: "pre" | "post";
  dialect: ZukanFoundationV2Repository["dialect"];
  state: FoundationSourceImportState;
  payloadSha256: string;
  entityCount: number;
}): {
  wouldInsert: number;
  unchanged: number;
  conflicts: number;
} {
  const statePlan = planRegionalSourceFoundationImport({
    tenantId: ZUKAN_FOUNDATION_SOURCE_REGISTRY_CANONICAL_TENANT_ID,
    existing: input.state,
  });
  if (statePlan.payloadSha256 !== input.payloadSha256) {
    throw new Error("foundation_apply_internal_plan_digest_mismatch");
  }
  if (
    statePlan.blockers.length > 0
    || statePlan.counts.conflicts > 0
    || statePlan.counts.wouldInsert + statePlan.counts.unchanged !== input.entityCount
  ) {
    throw new Error(
      `foundation_apply_${input.phase}_state_conflict:${input.dialect}`,
    );
  }
  if (
    input.phase === "post"
    && (
      statePlan.counts.wouldInsert !== 0
      || statePlan.counts.unchanged !== input.entityCount
    )
  ) {
    throw new Error(`foundation_apply_post_state_incomplete:${input.dialect}`);
  }
  return {
    wouldInsert: statePlan.counts.wouldInsert,
    unchanged: statePlan.counts.unchanged,
    conflicts: statePlan.counts.conflicts,
  };
}

export async function runFoundationSourceRegistryApply(
  options: FoundationSourceRegistryApplyCliOptions,
  environment: Readonly<Record<string, string | undefined>> = process.env,
  dependencies: FoundationSourceRegistryApplyDependencies = {},
): Promise<Record<string, unknown>> {
  const repositoryRoot = dependencies.repositoryRoot
    ?? fileURLToPath(new URL("../../..", import.meta.url));
  const sourceSha = verifyFoundationEvidenceSourceSha({
    sourceSha: options.sourceSha,
    repositoryRoot,
    readGitState: dependencies.readGitState,
  });
  const plan = planRegionalSourceFoundationImport({
    tenantId: options.expectedTenantId,
  });
  const entityCount = foundationSourceImportEntityCount(plan.batch);
  const requiredConfirmation = foundationSourceRegistryApplyConfirmation({
    sourceSha,
    tenantId: options.expectedTenantId,
    payloadSha256: plan.payloadSha256,
    entityCount,
    maxEntities: options.maxEntities,
  });
  const evidence = {
    schema: "zukan.foundation-source-registry-operator/v1",
    mode: options.mode,
    sourceSha,
    tenantId: options.expectedTenantId,
    payloadSha256: plan.payloadSha256,
    entityCount,
    maxEntities: options.maxEntities,
    blockers: plan.blockers,
    unmapped: plan.unmapped,
    requiredConfirmation,
  };
  if (options.expectedPlanSha256 !== null
    && options.expectedPlanSha256 !== plan.payloadSha256) {
    throw new Error("foundation_apply_expected_plan_sha256_mismatch");
  }
  if (plan.blockers.length > 0) {
    if (options.mode === "dry_run") {
      return { ...evidence, status: "blocked" };
    }
    throw new Error("foundation_apply_plan_blocked");
  }
  if (entityCount > options.maxEntities) {
    throw new Error("foundation_apply_plan_exceeds_entity_limit");
  }
  if (options.mode === "dry_run") {
    return { ...evidence, status: "planned" };
  }
  if (options.confirmation !== requiredConfirmation) {
    throw new Error("foundation_apply_confirmation_mismatch");
  }
  const config = assertExplicitApplyConfig({ options, environment });
  const createTargets = dependencies.createTargets ?? createDefaultTargets;
  const targets = await createTargets({ options, environment });
  try {
    const lookup = lookupForFoundationSourceImport(plan.batch);
    const preStates = await Promise.all(
      targets.repositories.map((repository) =>
        repository.readSourceImportState(lookup)),
    );
    const preflight = preStates.map((state, index) =>
      assertCompatibleState({
        phase: "pre",
        dialect: targets.repositories[index]!.dialect,
        state,
        payloadSha256: plan.payloadSha256,
        entityCount,
      }));
    const outcome = await runBoundedFoundationDualWrite({
      config,
      repositories: targets.repositories,
      request: {
        batch: plan.batch,
        idempotencyKey: options.idempotencyKey,
      },
      audit: {
        attemptId: options.attemptId,
        sourceCommitSha: sourceSha,
        sink: targets.auditSink,
        now: dependencies.now,
      },
    });
    if (outcome.status !== "succeeded") {
      throw new Error(`foundation_apply_dual_write_not_succeeded:${outcome.auditCode}`);
    }
    const postStates = await Promise.all(
      targets.repositories.map((repository) =>
        repository.readSourceImportState(lookup)),
    );
    const postflight = postStates.map((state, index) =>
      assertCompatibleState({
        phase: "post",
        dialect: targets.repositories[index]!.dialect,
        state,
        payloadSha256: plan.payloadSha256,
        entityCount,
      }));
    return {
      ...evidence,
      status: "succeeded",
      idempotencyKey: options.idempotencyKey,
      attemptId: options.attemptId,
      target: targets.target,
      preflight,
      outcome,
      postflight,
    };
  } finally {
    await targets.close();
  }
}

function safeErrorCode(error: unknown): string {
  if (
    error instanceof Error
    && /^foundation_[A-Za-z0-9_:,.-]+$/u.test(error.message)
  ) {
    return error.message;
  }
  return "foundation_apply_unexpected_error";
}

async function main(): Promise<void> {
  try {
    const result = await runFoundationSourceRegistryApply(
      parseFoundationSourceRegistryApplyCli(process.argv.slice(2)),
    );
    process.stdout.write(`${canonicalFoundationJson(result)}\n`);
  } catch (error) {
    process.stderr.write(`${canonicalFoundationJson({
      schema: "zukan.foundation-source-registry-operator-error/v1",
      status: "failed",
      errorCode: safeErrorCode(error),
    })}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  void main();
}
