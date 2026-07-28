import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Pool,
  type PoolClient,
  type QueryResultRow,
} from "pg";
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
  type FoundationPostgresClient,
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
  type FoundationDualWriteTargetIdentity,
} from "../services/zukanFoundationV2Rollout.js";
import {
  lookupForFoundationSourceImport,
  planRegionalSourceFoundationImport,
} from "../services/zukanFoundationV2SourceRegistryImport.js";

const FOUNDATION_APPLY_CONFIRMATION_PREFIX =
  "APPLY_ZUKAN_FOUNDATION_SOURCE_REGISTRY_V2";

type FoundationSourceRegistryApplyBaseOptions = {
  sourceSha: string;
  expectedTenantId: typeof ZUKAN_FOUNDATION_SOURCE_REGISTRY_CANONICAL_TENANT_ID;
  expectedPlanSha256: string | null;
  maxEntities: number;
};

type FoundationSourceRegistryTargetOptions = {
  expectedPlanSha256: string;
  idempotencyKey: string;
  expectedPostgresHost: string;
  expectedPostgresPort: number;
  expectedPostgresDatabase: string;
  expectedD1AccountId: string;
  expectedD1DatabaseId: string;
  expectedD1DatabaseName: string;
};

export type FoundationSourceRegistryApplyCliOptions =
  | (FoundationSourceRegistryApplyBaseOptions & {
    mode: "dry_run";
  })
  | (FoundationSourceRegistryApplyBaseOptions & FoundationSourceRegistryTargetOptions & {
    mode: "prepare_confirmation";
  })
  | (FoundationSourceRegistryApplyBaseOptions & FoundationSourceRegistryTargetOptions & {
    mode: "apply";
    attemptId: string;
    confirmation: string;
  });

export type FoundationSourceRegistryApplyTargetResources = {
  repositories: readonly [
    ZukanFoundationV2Repository,
    ZukanFoundationV2Repository,
  ];
  auditSink: FoundationDualWriteAuditSink;
  target: FoundationDualWriteTargetIdentity & {
    postgresServerAddress: string;
    postgresServerPort: number;
    postgresSchema: "public";
    postgresTls: true;
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

type FoundationPostgresConnectionIdentityRow = {
  database_name: string;
  transaction_read_only: string;
  schema_name: string | null;
  search_path: string;
  server_address: string | null;
  server_port: number | null;
  tls_enabled: boolean;
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

function exactPrepareConfirmationFlag(argv: readonly string[]): boolean {
  const count = argv.filter((argument) => argument === "--prepare-confirmation").length;
  if (count > 1) {
    throw new Error("foundation_apply_duplicate_prepare_confirmation_flag");
  }
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
    "--expected-d1-account-id=",
    "--expected-d1-database-id=",
    "--expected-d1-database-name=",
    "--confirm=",
  ] as const;
  const unknown = argv.find((argument) =>
    argument !== "--apply"
    && argument !== "--prepare-confirmation"
    && !allowedPrefixes.some((prefix) => argument.startsWith(prefix)));
  if (unknown) throw new Error(`foundation_apply_unknown_argument:${unknown}`);
  const apply = exactApplyFlag(argv);
  const prepareConfirmation = exactPrepareConfirmationFlag(argv);
  if (apply && prepareConfirmation) {
    throw new Error("foundation_apply_mode_flags_conflict");
  }
  const targetBoundMode = apply || prepareConfirmation;
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
  if (targetBoundMode && tenantArgument === null) {
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
  const expectedD1AccountId = oneArgument(
    argv,
    "--expected-d1-account-id=",
    "foundation_apply_expected_d1_account_id",
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
  if (!targetBoundMode) {
    if (
      idempotencyKey !== null
      || attemptId !== null
      || expectedPostgresHost !== null
      || expectedPostgresPortArgument !== null
      || expectedPostgresDatabase !== null
      || expectedD1AccountId !== null
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
    !expectedD1AccountId
    || !/^[0-9a-f]{32}$/u.test(expectedD1AccountId)
  ) {
    throw new Error("foundation_apply_expected_d1_account_id_invalid");
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
  if (prepareConfirmation) {
    if (attemptId !== null || confirmation !== null) {
      throw new Error("foundation_apply_prepare_confirmation_write_arguments_forbidden");
    }
    return {
      mode: "prepare_confirmation",
      sourceSha,
      expectedTenantId,
      expectedPlanSha256,
      maxEntities,
      idempotencyKey,
      expectedPostgresHost,
      expectedPostgresPort,
      expectedPostgresDatabase,
      expectedD1AccountId,
      expectedD1DatabaseId,
      expectedD1DatabaseName,
    };
  }
  if (!attemptId || !isValidOpaqueOperatorValue(attemptId)) {
    throw new Error("foundation_apply_attempt_id_invalid");
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
    expectedD1AccountId,
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
  idempotencyKey: string;
  target: FoundationDualWriteTargetIdentity;
}): string {
  const digest = createHash("sha256")
    .update(canonicalFoundationJson({
      sourceSha: input.sourceSha,
      tenantId: input.tenantId,
      payloadSha256: input.payloadSha256,
      entityCount: input.entityCount,
      maxEntities: input.maxEntities,
      idempotencyKey: input.idempotencyKey,
      target: input.target,
    }), "utf8")
    .digest("hex");
  return `${FOUNDATION_APPLY_CONFIRMATION_PREFIX}:${digest}`;
}

function targetIdentityFromOptions(
  options: Extract<
    FoundationSourceRegistryApplyCliOptions,
    { mode: "prepare_confirmation" | "apply" }
  >,
): FoundationDualWriteTargetIdentity {
  return {
    postgresHost: options.expectedPostgresHost,
    postgresPort: options.expectedPostgresPort,
    postgresDatabase: options.expectedPostgresDatabase,
    d1AccountId: options.expectedD1AccountId,
    d1DatabaseId: options.expectedD1DatabaseId,
    d1DatabaseName: options.expectedD1DatabaseName,
  };
}

function requiredEnvironmentValue(
  environment: Readonly<Record<string, string | undefined>>,
  key: string,
): string {
  const value = environment[key]?.trim() ?? "";
  if (!value) throw new Error(`foundation_apply_environment_required:${key}`);
  return value;
}

const FOUNDATION_POSTGRES_TLS_QUERY_KEYS = [
  "sslmode",
  "sslrootcert",
  "sslcert",
  "sslkey",
  "sslnegotiation",
] as const;

export function foundationApplyPostgresConnection(databaseUrl: string): {
  connectionString: string;
  target: {
    host: string;
    port: number;
    database: string;
  };
} {
  const parsed = new URL(databaseUrl);
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("foundation_apply_postgres_url_protocol_invalid");
  }
  if (!parsed.hostname || !parsed.username) {
    throw new Error("foundation_apply_postgres_url_authority_incomplete");
  }
  if (parsed.hash) {
    throw new Error("foundation_apply_postgres_url_fragment_forbidden");
  }
  const databaseName = decodeURIComponent(parsed.pathname.slice(1)).trim();
  if (!databaseName) {
    throw new Error("foundation_apply_postgres_database_name_required");
  }
  const queryValues = new Map<string, string>();
  for (const key of new Set(parsed.searchParams.keys())) {
    if (!(FOUNDATION_POSTGRES_TLS_QUERY_KEYS as readonly string[]).includes(key)) {
      throw new Error(`foundation_apply_postgres_url_query_parameter_forbidden:${key}`);
    }
    const values = parsed.searchParams.getAll(key);
    if (values.length !== 1 || !values[0]?.trim()) {
      throw new Error(`foundation_apply_postgres_url_query_parameter_invalid:${key}`);
    }
    queryValues.set(key, values[0]);
  }
  if (queryValues.get("sslmode") !== "verify-full") {
    throw new Error("foundation_apply_postgres_tls_verify_full_required");
  }
  const sslNegotiation = queryValues.get("sslnegotiation");
  if (
    sslNegotiation !== undefined
    && sslNegotiation !== "postgres"
    && sslNegotiation !== "direct"
  ) {
    throw new Error("foundation_apply_postgres_ssl_negotiation_invalid");
  }
  const port = parsed.port ? Number.parseInt(parsed.port, 10) : 5432;
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("foundation_apply_postgres_url_port_invalid");
  }
  const target = {
    host: parsed.hostname.toLowerCase(),
    port,
    database: databaseName,
  };
  parsed.search = "";
  for (const key of FOUNDATION_POSTGRES_TLS_QUERY_KEYS) {
    const value = queryValues.get(key);
    if (value !== undefined) parsed.searchParams.set(key, value);
  }
  parsed.searchParams.set(
    "options",
    "-c statement_timeout=30000 -c lock_timeout=5000 -c search_path=public",
  );
  return {
    connectionString: parsed.toString(),
    target,
  };
}

function normalizedPostgresAddress(value: string): string {
  const withoutBrackets = value.startsWith("[") && value.endsWith("]")
    ? value.slice(1, -1)
    : value;
  const ipv4Mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/iu.exec(withoutBrackets);
  if (ipv4Mapped?.[1] && isIP(ipv4Mapped[1]) === 4) return ipv4Mapped[1];
  if (isIP(withoutBrackets) === 6) {
    return new URL(`http://[${withoutBrackets}]/`).hostname.slice(1, -1).toLowerCase();
  }
  if (isIP(withoutBrackets) === 4) {
    return new URL(`http://${withoutBrackets}/`).hostname.toLowerCase();
  }
  throw new Error("foundation_apply_postgres_server_address_invalid");
}

async function resolvePostgresHost(host: string): Promise<string[]> {
  const lookupHost = host.startsWith("[") && host.endsWith("]")
    ? host.slice(1, -1)
    : host;
  const addresses = await lookup(lookupHost, { all: true, verbatim: true });
  if (addresses.length === 0) {
    throw new Error("foundation_apply_postgres_host_resolution_empty");
  }
  return [...new Set(addresses.map((item) => normalizedPostgresAddress(item.address)))];
}

export function assertFoundationApplyPostgresIdentity(input: {
  row: FoundationPostgresConnectionIdentityRow | undefined;
  expectedDatabase: string;
  expectedPort: number;
  resolvedHostAddresses: readonly string[];
}): {
  serverAddress: string;
  serverPort: number;
  schema: "public";
  tls: true;
} {
  const row = input.row;
  if (
    row?.database_name !== input.expectedDatabase
    || row.transaction_read_only !== "off"
  ) {
    throw new Error("foundation_apply_postgres_identity_mismatch");
  }
  if (row.schema_name !== "public" || row.search_path !== "public") {
    throw new Error("foundation_apply_postgres_schema_mismatch");
  }
  if (row.tls_enabled !== true) {
    throw new Error("foundation_apply_postgres_tls_not_active");
  }
  if (row.server_address === null || row.server_port !== input.expectedPort) {
    throw new Error("foundation_apply_postgres_server_identity_mismatch");
  }
  const serverAddress = normalizedPostgresAddress(row.server_address);
  const expectedAddresses = new Set(
    input.resolvedHostAddresses.map((item) => normalizedPostgresAddress(item)),
  );
  if (!expectedAddresses.has(serverAddress)) {
    throw new Error("foundation_apply_postgres_server_identity_mismatch");
  }
  return {
    serverAddress,
    serverPort: row.server_port,
    schema: "public",
    tls: true,
  };
}

class PinnedFoundationPostgresPool implements FoundationPostgresPool {
  private leased = false;

  constructor(private readonly client: PoolClient) {}

  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<{ rows: T[]; rowCount?: number | null }> {
    if (this.leased) {
      throw new Error("foundation_apply_postgres_connection_busy");
    }
    return this.execute<T>(sql, params);
  }

  async connect(): Promise<FoundationPostgresClient> {
    if (this.leased) {
      throw new Error("foundation_apply_postgres_connection_busy");
    }
    this.leased = true;
    let released = false;
    const owner = this;
    return {
      query<T extends Record<string, unknown> = Record<string, unknown>>(
        sql: string,
        params?: readonly unknown[],
      ) {
        if (released) {
          throw new Error("foundation_apply_postgres_connection_released");
        }
        return owner.execute<T>(sql, params);
      },
      release() {
        if (released) return;
        released = true;
        owner.leased = false;
      },
    };
  }

  releaseUnderlying(): void {
    if (this.leased) {
      throw new Error("foundation_apply_postgres_connection_busy");
    }
    this.client.release();
  }

  private async execute<T extends Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<{ rows: T[]; rowCount?: number | null }> {
    const result = await this.client.query<T & QueryResultRow>(
      sql,
      params === undefined ? undefined : [...params],
    );
    return {
      rows: result.rows,
      rowCount: result.rowCount,
    };
  }
}

async function createDefaultTargets(input: {
  options: Extract<FoundationSourceRegistryApplyCliOptions, { mode: "apply" }>;
  environment: Readonly<Record<string, string | undefined>>;
}): Promise<FoundationSourceRegistryApplyTargetResources> {
  const databaseUrl = requiredEnvironmentValue(
    input.environment,
    "FOUNDATION_APPLY_DATABASE_URL",
  );
  const postgresConnection = foundationApplyPostgresConnection(databaseUrl);
  const expectedPostgresTarget = postgresConnection.target;
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
  if (accountId !== input.options.expectedD1AccountId) {
    throw new Error("foundation_apply_d1_account_identity_mismatch");
  }
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
    connectionString: postgresConnection.connectionString,
    application_name: "zukan_foundation_v2_source_registry_apply",
    connectionTimeoutMillis: 10_000,
    enableChannelBinding: true,
    max: 1,
  });
  let postgresClient: PoolClient | undefined;
  let pinnedPool: PinnedFoundationPostgresPool | undefined;
  try {
    const resolvedHostAddresses = await resolvePostgresHost(expectedPostgresTarget.host);
    postgresClient = await pool.connect();
    pinnedPool = new PinnedFoundationPostgresPool(postgresClient);
    const [postgresIdentity, d1Identity] = await Promise.all([
      postgresClient.query<FoundationPostgresConnectionIdentityRow>(
        `SELECT current_database()::text AS database_name,
                current_setting('transaction_read_only') AS transaction_read_only,
                current_schema()::text AS schema_name,
                current_setting('search_path') AS search_path,
                inet_server_addr()::text AS server_address,
                inet_server_port()::integer AS server_port,
                COALESCE((
                  SELECT ssl
                    FROM pg_catalog.pg_stat_ssl
                   WHERE pid = pg_backend_pid()
                ), false)::boolean AS tls_enabled`,
      ),
      d1Database.assertExpectedDatabaseIdentity(),
    ]);
    const postgresActual = assertFoundationApplyPostgresIdentity({
      row: postgresIdentity.rows[0],
      expectedDatabase: input.options.expectedPostgresDatabase,
      expectedPort: input.options.expectedPostgresPort,
      resolvedHostAddresses,
    });
    if (
      d1Identity.uuid !== input.options.expectedD1DatabaseId
      || d1Identity.name !== input.options.expectedD1DatabaseName
    ) {
      throw new Error("foundation_apply_d1_identity_mismatch");
    }
    const postgresRepository = new ZukanFoundationV2PostgresRepository(
      pinnedPool,
    );
    const d1Repository = new ZukanFoundationV2D1Repository(d1Database);
    return {
      repositories: [postgresRepository, d1Repository],
      auditSink: new CloudflareD1FoundationAuditSink(d1Database),
      target: {
        postgresHost: expectedPostgresTarget.host,
        postgresPort: expectedPostgresTarget.port,
        postgresDatabase: input.options.expectedPostgresDatabase,
        postgresServerAddress: postgresActual.serverAddress,
        postgresServerPort: postgresActual.serverPort,
        postgresSchema: postgresActual.schema,
        postgresTls: postgresActual.tls,
        d1AccountId: accountId,
        d1DatabaseId: d1Identity.uuid,
        d1DatabaseName: d1Identity.name,
      },
      close: async () => {
        pinnedPool?.releaseUnderlying();
        await pool.end();
      },
    };
  } catch (error) {
    if (pinnedPool) {
      pinnedPool.releaseUnderlying();
    } else {
      postgresClient?.release();
    }
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
  const targetIdentity = options.mode === "dry_run"
    ? null
    : targetIdentityFromOptions(options);
  const boundIdempotencyKey = options.mode === "dry_run"
    ? null
    : options.idempotencyKey;
  const requiredConfirmation = targetIdentity === null || boundIdempotencyKey === null
    ? null
    : foundationSourceRegistryApplyConfirmation({
      sourceSha,
      tenantId: options.expectedTenantId,
      payloadSha256: plan.payloadSha256,
      entityCount,
      maxEntities: options.maxEntities,
      idempotencyKey: boundIdempotencyKey,
      target: targetIdentity,
    });
  const evidence = {
    schema: "zukan.foundation-source-registry-operator/v2",
    mode: options.mode,
    sourceSha,
    tenantId: options.expectedTenantId,
    payloadSha256: plan.payloadSha256,
    entityCount,
    maxEntities: options.maxEntities,
    idempotencyKey: boundIdempotencyKey,
    target: targetIdentity,
    blockers: plan.blockers,
    unmapped: plan.unmapped,
    requiredConfirmation,
  };
  if (options.expectedPlanSha256 !== null
    && options.expectedPlanSha256 !== plan.payloadSha256) {
    throw new Error("foundation_apply_expected_plan_sha256_mismatch");
  }
  if (plan.blockers.length > 0) {
    if (options.mode !== "apply") {
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
  if (options.mode === "prepare_confirmation") {
    return { ...evidence, status: "confirmation_ready" };
  }
  if (targetIdentity === null || requiredConfirmation === null) {
    throw new Error("foundation_apply_target_confirmation_internal_error");
  }
  if (options.confirmation !== requiredConfirmation) {
    throw new Error("foundation_apply_confirmation_mismatch");
  }
  const config = assertExplicitApplyConfig({ options, environment });
  const createTargets = dependencies.createTargets ?? createDefaultTargets;
  const targets = await createTargets({ options, environment });
  try {
    const actualTargetIdentity: FoundationDualWriteTargetIdentity = {
      postgresHost: targets.target.postgresHost,
      postgresPort: targets.target.postgresPort,
      postgresDatabase: targets.target.postgresDatabase,
      d1AccountId: targets.target.d1AccountId,
      d1DatabaseId: targets.target.d1DatabaseId,
      d1DatabaseName: targets.target.d1DatabaseName,
    };
    if (
      canonicalFoundationJson(actualTargetIdentity)
      !== canonicalFoundationJson(targetIdentity)
    ) {
      throw new Error("foundation_apply_target_factory_identity_mismatch");
    }
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
        target: targetIdentity,
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
      schema: "zukan.foundation-source-registry-operator-error/v2",
      status: "failed",
      errorCode: safeErrorCode(error),
    })}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  void main();
}
