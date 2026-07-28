import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFoundationPostgresReadOnlyUrl,
  parseFoundationPostgresEvidenceCli,
} from "./runZukanFoundationV2PostgresReadOnlyEvidence.js";

test("PostgreSQL evidence CLI requires an explicit actual target", () => {
  assert.throws(
    () => parseFoundationPostgresEvidenceCli([], {}),
    /foundation_postgres_evidence_database_url_required/,
  );
  assert.throws(
    () => parseFoundationPostgresEvidenceCli([
      "--database-url=postgresql://localhost/one",
      "--database-url=postgresql://localhost/two",
      `--source-sha=${"a".repeat(40)}`,
    ], {}),
    /foundation_postgres_evidence_database_url_duplicate/,
  );
});

test("PostgreSQL evidence CLI registers a sanitized target and tenant", () => {
  const parsed = parseFoundationPostgresEvidenceCli([
    "--database-url=postgresql://user:secret@localhost/zukan_foundation_fixture_contract",
    "--tenant=fixture-tenant",
    `--source-sha=${"A".repeat(40)}`,
  ], {});
  assert.equal(parsed.tenantId, "fixture-tenant");
  assert.equal(parsed.sourceSha, "a".repeat(40));
  assert.match(parsed.databaseUrl, /zukan_foundation_fixture_contract$/);
});

test("PostgreSQL evidence connection forces server-side read-only mode", () => {
  const url = new URL(buildFoundationPostgresReadOnlyUrl(
    "postgresql://localhost/zukan_foundation_fixture_contract",
  ));
  assert.match(url.searchParams.get("options") ?? "", /default_transaction_read_only=on/);
});
