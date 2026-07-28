import { execFileSync } from "node:child_process";
import { createHash, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import path from "node:path";
import { DatabaseSync, type StatementSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import {
  verifyFoundationEvidenceSourceSha,
} from "../../src/services/zukanFoundationV2EvidenceSourceProvenance";
import {
  canonicalFoundationJson,
} from "../../src/services/zukanFoundationV2RepositoryContract";
import {
  buildFoundationSourceRegistryReadOnlyEvidence,
  type FoundationIdentityCandidate,
  type FoundationIdentityCandidateReader,
} from "../../src/services/zukanFoundationV2ReadOnlyEvidence";
import {
  type FoundationD1Database,
  type FoundationD1PreparedStatement,
  ZukanFoundationV2D1Repository,
} from "./zukanFoundationV2D1Repository";

type D1Value = string | number | null;

class ReadOnlyDatabaseSyncStatement implements FoundationD1PreparedStatement {
  private values: D1Value[] = [];

  constructor(private readonly statement: StatementSync) {}

  bind(...values: D1Value[]): FoundationD1PreparedStatement {
    this.values = values;
    return this;
  }

  async first<T>(): Promise<T | null> {
    return (this.statement.get(...this.values) as T | undefined) ?? null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.statement.all(...this.values) as T[] };
  }

  async run(): Promise<never> {
    throw new Error("foundation_d1_evidence_write_forbidden");
  }
}

export class ReadOnlyFoundationDatabaseSync implements FoundationD1Database {
  constructor(readonly database: DatabaseSync) {}

  prepare(query: string): FoundationD1PreparedStatement {
    return new ReadOnlyDatabaseSyncStatement(this.database.prepare(assertSelectOnly(query)));
  }

  async batch(): Promise<never> {
    throw new Error("foundation_d1_evidence_batch_forbidden");
  }
}

function assertSelectOnly(query: string): string {
  const normalized = query.trim();
  if (
    !/^(?:SELECT|WITH)\b/iu.test(normalized)
    || normalized.includes(";")
    || /\b(?:INSERT|UPDATE|DELETE|REPLACE|CREATE|ALTER|DROP|VACUUM|ATTACH|DETACH)\b/iu.test(normalized)
  ) {
    throw new Error("foundation_d1_evidence_query_not_read_only");
  }
  return normalized;
}

function sqlLiteral(value: D1Value): string {
  if (value === null) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("foundation_d1_evidence_bind_number_invalid");
    return String(value);
  }
  return `'${value.replaceAll("'", "''")}'`;
}

function bindSql(query: string, values: readonly D1Value[]): string {
  let index = 0;
  const rendered = query.replaceAll("?", () => {
    const value = values[index];
    if (index >= values.length || value === undefined) {
      throw new Error("foundation_d1_evidence_bind_count_mismatch");
    }
    index += 1;
    return sqlLiteral(value);
  });
  if (index !== values.length) throw new Error("foundation_d1_evidence_bind_count_mismatch");
  return rendered;
}

export type FoundationWranglerExecutor = (input: {
  wranglerBin: string;
  wranglerConfig: string;
  databaseName: string;
  sql: string;
}) => string;

function executeWrangler(input: Parameters<FoundationWranglerExecutor>[0]): string {
  const wranglerArgs = [
    "d1",
    "execute",
    input.databaseName,
    "--remote",
    "--command",
    input.sql,
    "--json",
    "--yes",
    "--config",
    input.wranglerConfig,
  ];
  const isJavaScriptEntrypoint = /\.[cm]?js$/iu.test(input.wranglerBin);
  return execFileSync(
    isJavaScriptEntrypoint ? process.execPath : input.wranglerBin,
    isJavaScriptEntrypoint ? [input.wranglerBin, ...wranglerArgs] : wranglerArgs,
    {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    },
  );
}

function executeWranglerInfo(input: {
  wranglerBin: string;
  wranglerConfig: string;
  databaseName: string;
}): string {
  const wranglerArgs = [
    "d1",
    "info",
    input.databaseName,
    "--json",
    "--config",
    input.wranglerConfig,
  ];
  const isJavaScriptEntrypoint = /\.[cm]?js$/iu.test(input.wranglerBin);
  return execFileSync(
    isJavaScriptEntrypoint ? process.execPath : input.wranglerBin,
    isJavaScriptEntrypoint ? [input.wranglerBin, ...wranglerArgs] : wranglerArgs,
    {
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
    },
  );
}

function findWranglerDatabaseIdentity(value: unknown): {
  id: string;
  name: string | null;
} | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findWranglerDatabaseIdentity(item);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = typeof record.uuid === "string"
    ? record.uuid
    : typeof record.id === "string"
      ? record.id
      : typeof record.database_id === "string"
        ? record.database_id
        : null;
  if (id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(id)) {
    const name = typeof record.name === "string"
      ? record.name
      : typeof record.database_name === "string"
        ? record.database_name
        : null;
    return { id, name };
  }
  for (const child of Object.values(record)) {
    const found = findWranglerDatabaseIdentity(child);
    if (found) return found;
  }
  return null;
}

export function verifyWranglerD1DatabaseIdentity(input: {
  rawInfoJson: string;
  expectedId: string;
  expectedName: string;
}): void {
  const identity = findWranglerDatabaseIdentity(JSON.parse(input.rawInfoJson));
  if (
    !identity
    || identity.id !== input.expectedId
    || (identity.name !== null && identity.name !== input.expectedName)
  ) {
    throw new Error("foundation_d1_evidence_remote_identity_mismatch");
  }
}

export async function sha256FoundationSnapshotFile(databasePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(databasePath)) {
    hash.update(chunk as Buffer);
  }
  return hash.digest("hex");
}

export async function verifyFoundationD1SnapshotExportSha256(input: {
  databasePath: string;
  expectedSha256: string;
}): Promise<string> {
  const expectedSha256 = input.expectedSha256.toLowerCase();
  if (!/^[0-9a-f]{64}$/u.test(expectedSha256)) {
    throw new Error("foundation_d1_evidence_snapshot_sha256_invalid");
  }
  const actualSha256 = await sha256FoundationSnapshotFile(input.databasePath);
  if (!timingSafeEqual(
    Buffer.from(actualSha256, "hex"),
    Buffer.from(expectedSha256, "hex"),
  )) {
    throw new Error(
      `foundation_d1_evidence_snapshot_sha256_mismatch:${expectedSha256}:${actualSha256}`,
    );
  }
  return actualSha256;
}

function wranglerRows(raw: string): Array<Record<string, unknown>> {
  const parsed = JSON.parse(raw) as unknown;
  const responses = Array.isArray(parsed) ? parsed : [parsed];
  const response = responses.find((item) =>
    item && typeof item === "object" && "results" in item) as {
      success?: boolean;
      error?: string;
      results?: Array<Record<string, unknown>>;
    } | undefined;
  if (!response || response.success === false || !Array.isArray(response.results)) {
    throw new Error(`foundation_d1_evidence_wrangler_query_failed:${response?.error ?? "invalid_json"}`);
  }
  return response.results;
}

class WranglerReadOnlyStatement implements FoundationD1PreparedStatement {
  private values: D1Value[] = [];

  constructor(
    private readonly database: WranglerRemoteReadOnlyD1Database,
    private readonly query: string,
  ) {}

  bind(...values: D1Value[]): FoundationD1PreparedStatement {
    this.values = values;
    return this;
  }

  async first<T>(): Promise<T | null> {
    return (await this.database.query(bindSql(this.query, this.values)))[0] as T | undefined ?? null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    return { results: await this.database.query(bindSql(this.query, this.values)) as T[] };
  }

  async run(): Promise<never> {
    throw new Error("foundation_d1_evidence_write_forbidden");
  }
}

export class WranglerRemoteReadOnlyD1Database implements FoundationD1Database {
  constructor(
    private readonly options: {
      wranglerBin: string;
      wranglerConfig: string;
      databaseName: string;
    },
    private readonly execute: FoundationWranglerExecutor = executeWrangler,
  ) {}

  prepare(query: string): FoundationD1PreparedStatement {
    return new WranglerReadOnlyStatement(this, assertSelectOnly(query));
  }

  async batch(): Promise<never> {
    throw new Error("foundation_d1_evidence_batch_forbidden");
  }

  async query(sql: string): Promise<Array<Record<string, unknown>>> {
    return wranglerRows(this.execute({ ...this.options, sql: assertSelectOnly(sql) }));
  }
}

class D1IdentityCandidateReader implements FoundationIdentityCandidateReader {
  constructor(private readonly database: FoundationD1Database) {}

  async searchIdentityCandidates(input: Parameters<
    FoundationIdentityCandidateReader["searchIdentityCandidates"]
  >[0]): Promise<FoundationIdentityCandidate[]> {
    const rows = (await this.database.prepare(
      `SELECT subject_id,
              lower(COALESCE(json_extract(metadata_json, '$.sourceRegistry.name'), '')) = lower(?) AS name_match,
              lower(COALESCE(json_extract(metadata_json, '$.sourceRegistry.officialUrl'), '')) = lower(?) AS url_match
         FROM zukan_subject_identities
        WHERE tenant_id = ?
          AND subject_kind = 'source_publisher'
          AND (
            lower(COALESCE(json_extract(metadata_json, '$.sourceRegistry.name'), '')) = lower(?)
            OR lower(COALESCE(json_extract(metadata_json, '$.sourceRegistry.officialUrl'), '')) = lower(?)
          )
        ORDER BY subject_id
        LIMIT 20`,
    ).bind(
      input.publisher.name,
      input.publisher.officialUrl,
      input.tenantId,
      input.publisher.name,
      input.publisher.officialUrl,
    ).all<Record<string, unknown>>()).results;
    return rows.map((row) => ({
      subjectId: String(row.subject_id),
      matchSignals: [
        ...(Number(row.name_match) === 1 ? ["name"] : []),
        ...(Number(row.url_match) === 1 ? ["official_url"] : []),
      ],
    }));
  }
}

type FoundationD1EvidenceCliCommon = {
  tenantId: string;
  sourceSha: string;
  remoteDatabaseId: string;
  remoteDatabaseName: string;
};

export type FoundationD1EvidenceCliOptions = FoundationD1EvidenceCliCommon & (
  | {
    mode: "remote";
    wranglerBin: string;
    wranglerConfig: string;
  }
  | {
    mode: "snapshot";
    databasePath: string;
    remoteExportSha256: string;
    remoteBookmark: string;
  }
);

function oneArgument(argv: readonly string[], prefix: string, errorCode: string): string | null {
  const matches = argv.filter((argument) => argument.startsWith(prefix));
  if (matches.length > 1) throw new Error(`${errorCode}_duplicate`);
  if (matches.length === 0) return null;
  const value = matches[0]!.slice(prefix.length).trim();
  if (!value) throw new Error(`${errorCode}_empty`);
  return value;
}

export function parseFoundationD1EvidenceCli(
  argv: readonly string[],
): FoundationD1EvidenceCliOptions {
  const prefixes = [
    "--remote-database=",
    "--remote-database-id=",
    "--wrangler-bin=",
    "--wrangler-config=",
    "--snapshot-database-path=",
    "--remote-export-sha256=",
    "--remote-bookmark=",
    "--tenant=",
    "--source-sha=",
  ];
  const unknown = argv.find((argument) =>
    !prefixes.some((prefix) => argument.startsWith(prefix)));
  if (unknown) throw new Error(`foundation_d1_evidence_unknown_argument:${unknown}`);
  const remoteDatabaseName = oneArgument(
    argv,
    "--remote-database=",
    "foundation_d1_evidence_remote_database",
  );
  const remoteDatabaseId = oneArgument(
    argv,
    "--remote-database-id=",
    "foundation_d1_evidence_remote_database_id",
  );
  if (!remoteDatabaseName || !remoteDatabaseId) {
    throw new Error("foundation_d1_evidence_remote_identity_required");
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(
    remoteDatabaseId,
  )) {
    throw new Error("foundation_d1_evidence_remote_database_id_invalid");
  }
  const sourceSha = oneArgument(argv, "--source-sha=", "foundation_d1_evidence_source_sha");
  if (!sourceSha || !/^[0-9a-fA-F]{40}$/u.test(sourceSha)) {
    throw new Error("foundation_d1_evidence_source_sha_must_be_full_commit");
  }
  const tenantId = oneArgument(argv, "--tenant=", "foundation_d1_evidence_tenant")
    ?? "zukan-regional-source-dry-run";
  const snapshotPath = oneArgument(
    argv,
    "--snapshot-database-path=",
    "foundation_d1_evidence_snapshot_database_path",
  );
  const wranglerBin = oneArgument(argv, "--wrangler-bin=", "foundation_d1_evidence_wrangler_bin");
  const wranglerConfig = oneArgument(
    argv,
    "--wrangler-config=",
    "foundation_d1_evidence_wrangler_config",
  );
  if (snapshotPath && (wranglerBin || wranglerConfig)) {
    throw new Error("foundation_d1_evidence_target_mode_ambiguous");
  }
  const common = {
    tenantId,
    sourceSha: sourceSha.toLowerCase(),
    remoteDatabaseId,
    remoteDatabaseName,
  };
  if (snapshotPath) {
    const remoteExportSha256 = oneArgument(
      argv,
      "--remote-export-sha256=",
      "foundation_d1_evidence_remote_export_sha256",
    );
    const remoteBookmark = oneArgument(
      argv,
      "--remote-bookmark=",
      "foundation_d1_evidence_remote_bookmark",
    );
    if (!remoteExportSha256 || !/^[0-9a-fA-F]{64}$/u.test(remoteExportSha256) || !remoteBookmark) {
      throw new Error("foundation_d1_evidence_snapshot_provenance_required");
    }
    return {
      ...common,
      mode: "snapshot",
      databasePath: path.resolve(snapshotPath),
      remoteExportSha256: remoteExportSha256.toLowerCase(),
      remoteBookmark,
    };
  }
  if (!wranglerBin || !wranglerConfig) {
    throw new Error("foundation_d1_evidence_remote_wrangler_required");
  }
  return {
    ...common,
    mode: "remote",
    wranglerBin: path.resolve(wranglerBin),
    wranglerConfig: path.resolve(wranglerConfig),
  };
}

export async function runFoundationD1ReadOnlyEvidence(
  options: FoundationD1EvidenceCliOptions,
): Promise<ReturnType<typeof buildFoundationSourceRegistryReadOnlyEvidence> extends Promise<infer T>
  ? T
  : never> {
  const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
  const sourceSha = verifyFoundationEvidenceSourceSha({
    sourceSha: options.sourceSha,
    repositoryRoot,
  });
  if (options.mode === "remote") {
    verifyWranglerD1DatabaseIdentity({
      rawInfoJson: executeWranglerInfo({
        wranglerBin: options.wranglerBin,
        wranglerConfig: options.wranglerConfig,
        databaseName: options.remoteDatabaseName,
      }),
      expectedId: options.remoteDatabaseId,
      expectedName: options.remoteDatabaseName,
    });
  }
  const verifiedSnapshotSha256 = options.mode === "snapshot"
    ? await verifyFoundationD1SnapshotExportSha256({
      databasePath: options.databasePath,
      expectedSha256: options.remoteExportSha256,
    })
    : null;
  const syncDatabase = options.mode === "snapshot"
    ? new DatabaseSync(options.databasePath, {
      readOnly: true,
      enableForeignKeyConstraints: true,
    })
    : null;
  const database: FoundationD1Database = options.mode === "remote"
    ? new WranglerRemoteReadOnlyD1Database({
      wranglerBin: options.wranglerBin,
      wranglerConfig: options.wranglerConfig,
      databaseName: options.remoteDatabaseName,
    })
    : new ReadOnlyFoundationDatabaseSync(syncDatabase!);
  try {
    const repository = new ZukanFoundationV2D1Repository(database);
    const locator = options.mode === "remote"
      ? `d1-remote:${options.remoteDatabaseName}:${options.remoteDatabaseId}`
      : [
        `d1-remote-export:${options.remoteDatabaseName}:${options.remoteDatabaseId}`,
        `bookmark=${options.remoteBookmark}`,
        `sha256=${verifiedSnapshotSha256}`,
        `file=${path.basename(options.databasePath)}`,
      ].join(":");
    return await buildFoundationSourceRegistryReadOnlyEvidence({
      repository,
      candidateReader: new D1IdentityCandidateReader(database),
      tenantId: options.tenantId,
      sourceSha,
      target: {
        evidenceKind: options.mode === "remote" ? "direct_read_only" : "remote_snapshot_export",
        locator,
        readOnlyEnforcement: options.mode === "remote"
          ? "d1_wrangler_select_only"
          : "d1_database_sync_read_only",
      },
    });
  } finally {
    syncDatabase?.close();
  }
}

async function main(): Promise<void> {
  const evidence = await runFoundationD1ReadOnlyEvidence(
    parseFoundationD1EvidenceCli(process.argv.slice(2)),
  );
  process.stdout.write(`${canonicalFoundationJson(evidence)}\n`);
  if (!evidence.twoRunStability.stable || !evidence.mutationEvidence.unchanged) {
    process.exitCode = 2;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  void main();
}
