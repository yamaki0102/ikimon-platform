import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import {
  canonicalFoundationJson,
} from "../services/zukanFoundationV2RepositoryContract.js";
import {
  verifyFoundationEvidenceSourceSha,
} from "../services/zukanFoundationV2EvidenceSourceProvenance.js";
import {
  buildFoundationSourceRegistryReadOnlyEvidence,
  type FoundationIdentityCandidate,
  type FoundationIdentityCandidateReader,
} from "../services/zukanFoundationV2ReadOnlyEvidence.js";
import {
  type FoundationPostgresPool,
  ZukanFoundationV2PostgresRepository,
} from "../services/zukanFoundationV2PostgresRepository.js";

export type FoundationPostgresEvidenceCliOptions = {
  databaseUrl: string;
  tenantId: string;
  sourceSha: string;
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

export function parseFoundationPostgresEvidenceCli(
  argv: readonly string[],
  environment: Readonly<Record<string, string | undefined>> = process.env,
): FoundationPostgresEvidenceCliOptions {
  const unknown = argv.find((argument) =>
    !argument.startsWith("--database-url=")
    && !argument.startsWith("--tenant=")
    && !argument.startsWith("--source-sha="));
  if (unknown) throw new Error(`foundation_postgres_evidence_unknown_argument:${unknown}`);
  const databaseUrl = oneArgument(
    argv,
    "--database-url=",
    "foundation_postgres_evidence_database_url",
  ) ?? environment.FOUNDATION_EVIDENCE_DATABASE_URL?.trim() ?? "";
  if (!databaseUrl) throw new Error("foundation_postgres_evidence_database_url_required");
  const parsed = new URL(databaseUrl);
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("foundation_postgres_evidence_database_url_protocol_invalid");
  }
  if (decodeURIComponent(parsed.pathname.slice(1)).trim().length === 0) {
    throw new Error("foundation_postgres_evidence_database_name_required");
  }
  const tenantId = oneArgument(
    argv,
    "--tenant=",
    "foundation_postgres_evidence_tenant",
  ) ?? "zukan-regional-source-dry-run";
  const sourceSha = oneArgument(
    argv,
    "--source-sha=",
    "foundation_postgres_evidence_source_sha",
  );
  if (!sourceSha || !/^[0-9a-fA-F]{40}$/u.test(sourceSha)) {
    throw new Error("foundation_postgres_evidence_source_sha_must_be_full_commit");
  }
  return { databaseUrl, tenantId, sourceSha: sourceSha.toLowerCase() };
}

function targetLocator(databaseUrl: string): string {
  const parsed = new URL(databaseUrl);
  return `postgres:${decodeURIComponent(parsed.pathname.slice(1))}`;
}

class PostgresIdentityCandidateReader implements FoundationIdentityCandidateReader {
  constructor(private readonly pool: Pool) {}

  async searchIdentityCandidates(input: Parameters<
    FoundationIdentityCandidateReader["searchIdentityCandidates"]
  >[0]): Promise<FoundationIdentityCandidate[]> {
    const result = await this.pool.query<{
      subject_id: string;
      name_match: boolean;
      url_match: boolean;
    }>(
      `SELECT subject_id::text,
              lower(COALESCE(metadata #>> '{sourceRegistry,name}', '')) = lower($2) AS name_match,
              lower(COALESCE(metadata #>> '{sourceRegistry,officialUrl}', '')) = lower($3) AS url_match
         FROM zukan_subject_identities
        WHERE tenant_id = $1
          AND subject_kind = 'source_publisher'
          AND (
            lower(COALESCE(metadata #>> '{sourceRegistry,name}', '')) = lower($2)
            OR lower(COALESCE(metadata #>> '{sourceRegistry,officialUrl}', '')) = lower($3)
          )
        ORDER BY subject_id
        LIMIT 20`,
      [input.tenantId, input.publisher.name, input.publisher.officialUrl],
    );
    return result.rows.map((row) => ({
      subjectId: row.subject_id,
      matchSignals: [
        ...(row.name_match ? ["name"] : []),
        ...(row.url_match ? ["official_url"] : []),
      ],
    }));
  }
}

export async function runFoundationPostgresReadOnlyEvidence(
  options: FoundationPostgresEvidenceCliOptions,
): Promise<ReturnType<typeof buildFoundationSourceRegistryReadOnlyEvidence> extends Promise<infer T>
  ? T
  : never> {
  const readOnlyUrl = buildFoundationPostgresReadOnlyUrl(options.databaseUrl);
  const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
  const sourceSha = verifyFoundationEvidenceSourceSha({
    sourceSha: options.sourceSha,
    repositoryRoot,
  });
  const pool = new Pool({
    connectionString: readOnlyUrl,
    application_name: "zukan_foundation_v2_read_only_evidence",
  });
  try {
    const repository = new ZukanFoundationV2PostgresRepository(
      pool as unknown as FoundationPostgresPool,
    );
    return await buildFoundationSourceRegistryReadOnlyEvidence({
      repository,
      candidateReader: new PostgresIdentityCandidateReader(pool),
      tenantId: options.tenantId,
      sourceSha,
      target: {
        evidenceKind: "direct_read_only",
        locator: targetLocator(options.databaseUrl),
        readOnlyEnforcement: "postgres_default_transaction_read_only",
      },
    });
  } finally {
    await pool.end();
  }
}

export function buildFoundationPostgresReadOnlyUrl(databaseUrl: string): string {
  const readOnlyUrl = new URL(databaseUrl);
  readOnlyUrl.searchParams.set(
    "options",
    "-c default_transaction_read_only=on -c statement_timeout=30000",
  );
  return readOnlyUrl.toString();
}

async function main(): Promise<void> {
  const evidence = await runFoundationPostgresReadOnlyEvidence(
    parseFoundationPostgresEvidenceCli(process.argv.slice(2)),
  );
  process.stdout.write(`${canonicalFoundationJson(evidence)}\n`);
  if (!evidence.twoRunStability.stable || !evidence.mutationEvidence.unchanged) {
    process.exitCode = 2;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  void main();
}
