const GLOBAL_STAGING_FIXTURE_PREFIXES = [
  "sample-cadence-",
  "smoke-",
  "smoke-resume-",
  "manual-occurrence-map-",
  "staging-session-smoke-",
  "staging-write-smoke-",
] as const;

const GLOBAL_STAGING_FIXTURE_SOURCE_REGEX =
  "^(sample[-_]cadence|smoke|manual[-_]occurrence[-_]map|staging[-_]session[-_]smoke|staging[-_]write[-_]smoke)";

export type StagingFixtureColumns = {
  userIdColumn?: string;
  actorUserIdColumn?: string;
  visitIdColumn?: string;
  occurrenceIdColumn?: string;
  placeIdColumn?: string;
  visitSourceColumn?: string;
  occurrenceSourceColumn?: string;
};

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim() ?? "").filter(Boolean))];
}

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function buildRegexSql(column: string, regex: string, caseInsensitive = false): string {
  const operator = caseInsensitive ? "~*" : "~";
  return `coalesce(${column}, '') ${operator} '${escapeSqlLiteral(regex)}'`;
}

export function getStagingFixturePrefixes(fixturePrefix?: string | null): string[] {
  if (fixturePrefix && fixturePrefix.trim()) {
    return unique([fixturePrefix]);
  }
  return [...GLOBAL_STAGING_FIXTURE_PREFIXES];
}

export function buildStagingFixturePredicate(
  columns: StagingFixtureColumns,
  fixturePrefix?: string | null,
): string {
  const prefixes = getStagingFixturePrefixes(fixturePrefix);
  if (prefixes.length === 0) {
    return "false";
  }

  const prefixBody = prefixes.map(escapeRegexLiteral).join("|");
  const clauses: string[] = [];

  if (columns.userIdColumn) {
    clauses.push(buildRegexSql(columns.userIdColumn, `^(${prefixBody})`));
  }
  if (columns.actorUserIdColumn) {
    clauses.push(buildRegexSql(columns.actorUserIdColumn, `^(${prefixBody})`));
  }
  if (columns.visitIdColumn) {
    clauses.push(buildRegexSql(columns.visitIdColumn, `^(track:)?(${prefixBody})`));
  }
  if (columns.occurrenceIdColumn) {
    clauses.push(buildRegexSql(columns.occurrenceIdColumn, `^(occ:)?(${prefixBody})`));
  }
  if (columns.placeIdColumn) {
    clauses.push(buildRegexSql(columns.placeIdColumn, `^(site:)?(${prefixBody})`));
  }

  // Global cleanup/exclusion also needs to catch rows whose ids drifted but still
  // carry smoke provenance in source_payload.source.
  if (!fixturePrefix) {
    if (columns.visitSourceColumn) {
      clauses.push(buildRegexSql(columns.visitSourceColumn, GLOBAL_STAGING_FIXTURE_SOURCE_REGEX, true));
    }
    if (columns.occurrenceSourceColumn) {
      clauses.push(buildRegexSql(columns.occurrenceSourceColumn, GLOBAL_STAGING_FIXTURE_SOURCE_REGEX, true));
    }
  }

  return clauses.length > 0 ? `(${clauses.join(" or ")})` : "false";
}

export function buildStagingFixtureExclusionSql(
  columns: StagingFixtureColumns,
  fixturePrefix?: string | null,
): string {
  return `not ${buildStagingFixturePredicate(columns, fixturePrefix)}`;
}

export function stagingFixtureOpsEnabled(): boolean {
  return process.env.ALLOW_QUERY_USER_ID === "1";
}
