const GLOBAL_STAGING_FIXTURE_PREFIXES = [
  "sample-cadence-",
  "smoke-",
  "smoke-resume-",
  "manual-occurrence-map-",
  "staging-session-smoke-",
  "staging-write-smoke-",
  "rally-smoke-",
] as const;

const GLOBAL_STAGING_FIXTURE_SOURCE_REGEX =
  "^(sample[-_]cadence|smoke|manual[-_]occurrence[-_]map|staging[-_]session[-_]smoke|staging[-_]write[-_]smoke|rally[-_]smoke)";

const OBSERVATION_EVENT_QA_CODE_REGEX =
  "^(qa|e2e|fixture|smoke|regression|test|pr[0-9]+)([-_]|$)";
const OBSERVATION_EVENT_QA_TITLE_REGEX =
  "(^|[^[:alnum:]_])(qa|e2e|fixture|smoke|regression|test)([^[:alnum:]_]|$)|テスト|検証用|動作確認|(^|[^[:alnum:]_])(pr[0-9]+|pr[[:space:]]*#?[0-9]+).*prod(uction)?.*rally([^[:alnum:]_]|$)";
const OBSERVATION_EVENT_QA_CONFIG_REGEX =
  '"(qa_fixture|qaFixture|is_fixture|isFixture|test_fixture|testFixture)"[[:space:]]*:[[:space:]]*(true|"(1|true|yes|qa|fixture|test|smoke)")|"(public_listed|publicListVisible)"[[:space:]]*:[[:space:]]*false|"(public_list_visibility|publicListVisibility)"[[:space:]]*:[[:space:]]*"(hidden|internal|qa|fixture|test)"|"(source|fixture_prefix|fixturePrefix)"[[:space:]]*:[[:space:]]*"[^"]*(qa|e2e|fixture|smoke|regression|test)[^"]*"';

export type StagingFixtureColumns = {
  userIdColumn?: string;
  actorUserIdColumn?: string;
  visitIdColumn?: string;
  occurrenceIdColumn?: string;
  placeIdColumn?: string;
  eventCodeColumn?: string;
  titleColumn?: string;
  visitSourceColumn?: string;
  occurrenceSourceColumn?: string;
  configColumn?: string;
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
  return `coalesce((${column})::text, '') ${operator} '${escapeSqlLiteral(regex)}'`;
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
  if (columns.eventCodeColumn) {
    clauses.push(buildRegexSql(columns.eventCodeColumn, `^(${prefixBody})`));
  }

  // Global cleanup/exclusion also needs to catch rows whose ids drifted but still
  // carry smoke provenance in source_payload.source.
  if (!fixturePrefix) {
    if (columns.eventCodeColumn) {
      clauses.push(buildRegexSql(columns.eventCodeColumn, OBSERVATION_EVENT_QA_CODE_REGEX, true));
    }
    if (columns.titleColumn) {
      clauses.push(buildRegexSql(columns.titleColumn, GLOBAL_STAGING_FIXTURE_SOURCE_REGEX, true));
      clauses.push(buildRegexSql(columns.titleColumn, OBSERVATION_EVENT_QA_TITLE_REGEX, true));
    }
    if (columns.configColumn) {
      clauses.push(buildRegexSql(columns.configColumn, GLOBAL_STAGING_FIXTURE_SOURCE_REGEX, true));
      clauses.push(buildRegexSql(columns.configColumn, OBSERVATION_EVENT_QA_CONFIG_REGEX, true));
    }
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
