import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  verifyFoundationMigrationSet,
  verifyFoundationEvidenceSourceSha,
} from "./zukanFoundationV2EvidenceSourceProvenance.js";

test("source evidence requires exact clean HEAD", () => {
  const sha = "a".repeat(40);
  assert.equal(verifyFoundationEvidenceSourceSha({
    sourceSha: sha,
    repositoryRoot: "unused",
    readGitState: () => ({ headSha: sha, porcelainStatus: "" }),
  }), sha);
  assert.throws(() => verifyFoundationEvidenceSourceSha({
    sourceSha: "b".repeat(40),
    repositoryRoot: "unused",
    readGitState: () => ({ headSha: sha, porcelainStatus: "" }),
  }), /source_sha_head_mismatch/);
  assert.throws(() => verifyFoundationEvidenceSourceSha({
    sourceSha: sha,
    repositoryRoot: "unused",
    readGitState: () => ({ headSha: sha, porcelainStatus: "?? evidence.json" }),
  }), /requires_clean_worktree/);
  assert.throws(() => verifyFoundationEvidenceSourceSha({
    sourceSha: "short",
    repositoryRoot: "unused",
    readGitState: () => ({ headSha: sha, porcelainStatus: "" }),
  }), /must_be_full_commit/);
});

test("migration evidence is pinned to the repository directory and content digests", () => {
  const repositoryRoot = path.resolve("fixture-repository");
  const migrationDirectory = path.join(repositoryRoot, "platform_v2", "db", "migrations");
  const result = verifyFoundationMigrationSet({
    repositoryRoot,
    migrationDirectory,
    expectedRelativeDirectory: "platform_v2/db/migrations",
    migrationFiles: ["0001_first.sql", "0002_second.sql"],
    readMigrationFile: (absolutePath) => Buffer.from(path.basename(absolutePath)),
  });
  assert.equal(result.directory, "platform_v2/db/migrations");
  assert.deepEqual(result.files.map((item) => item.file), [
    "0001_first.sql",
    "0002_second.sql",
  ]);
  assert.match(result.files[0]!.sha256, /^[0-9a-f]{64}$/u);
  assert.match(result.setSha256, /^[0-9a-f]{64}$/u);
  const changed = verifyFoundationMigrationSet({
    repositoryRoot,
    migrationDirectory,
    expectedRelativeDirectory: "platform_v2/db/migrations",
    migrationFiles: ["0001_first.sql", "0002_second.sql"],
    readMigrationFile: (absolutePath) => Buffer.from(`${path.basename(absolutePath)} changed`),
  });
  assert.notEqual(changed.setSha256, result.setSha256);
  assert.throws(() => verifyFoundationMigrationSet({
    repositoryRoot,
    migrationDirectory: path.join(repositoryRoot, "copied-migrations"),
    expectedRelativeDirectory: "platform_v2/db/migrations",
    migrationFiles: ["0001_first.sql"],
    readMigrationFile: () => Buffer.from("SELECT 1"),
  }), /migration_directory_source_mismatch/);
});
