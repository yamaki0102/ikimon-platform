import assert from "node:assert/strict";
import test from "node:test";
import { canonicalFoundationJson } from "../services/zukanFoundationV2RepositoryContract.js";
import {
  buildFoundationSourceImportEvidence,
  parseFoundationSourceImportCli,
  verifyFoundationSourceSha,
} from "./planZukanFoundationV2SourceRegistryImport.js";

test("Source Registry dry-run CLI emits reproducible canonical evidence", () => {
  const headSha = "a".repeat(40);
  const verifiedSourceSha = verifyFoundationSourceSha(headSha, () => ({
    headSha,
    porcelainStatus: "",
  }));
  const input = {
    tenantId: "zukan-regional-source-dry-run",
    verifiedSourceSha,
  };
  const first = buildFoundationSourceImportEvidence(input);
  const second = buildFoundationSourceImportEvidence(input);
  assert.equal(first.twoRunStability.stable, true);
  assert.equal(first.twoRunStability.firstPayloadSha256, first.twoRunStability.secondPayloadSha256);
  assert.deepEqual(first.idempotencySimulation, {
    payloadSha256: first.plan.payloadSha256,
    wouldInsert: 0,
    unchanged: first.plan.counts.entities,
    conflicts: 0,
  });
  assert.equal(canonicalFoundationJson(first), canonicalFoundationJson(second));
  assert.equal(first.plan.mode, "dry_run");
  assert.equal(first.sourceShaVerification, "git_head_clean");
  assert.deepEqual(first.plan.blockers, []);
});

test("Source Registry exact-SHA evidence requires matching clean git HEAD", () => {
  const headSha = "a".repeat(40);
  assert.throws(
    () => verifyFoundationSourceSha("b".repeat(40), () => ({
      headSha,
      porcelainStatus: "",
    })),
    /source_sha_head_mismatch/,
  );
  assert.throws(
    () => verifyFoundationSourceSha(headSha, () => ({
      headSha,
      porcelainStatus: " M platform_v2/src/example.ts\n",
    })),
    /source_sha_requires_clean_worktree/,
  );
  assert.equal(verifyFoundationSourceSha(null), null);
});

test("Source Registry dry-run CLI rejects write and ambiguous source arguments", () => {
  assert.throws(
    () => parseFoundationSourceImportCli(["--apply"]),
    /foundation_dry_run_forbids/,
  );
  assert.throws(
    () => parseFoundationSourceImportCli(["--source-sha=short"]),
    /source_sha_must_be_full_commit/,
  );
  assert.throws(
    () => parseFoundationSourceImportCli(["--source-sha="]),
    /source_sha_must_be_full_commit/,
  );
  assert.throws(
    () => parseFoundationSourceImportCli([
      `--source-sha=${"a".repeat(40)}`,
      `--source-sha=${"b".repeat(40)}`,
    ]),
    /duplicate_source_sha/,
  );
  assert.throws(
    () => parseFoundationSourceImportCli(["--tenant=tenant-a", "--tenant=tenant-b"]),
    /duplicate_tenant/,
  );
  assert.throws(
    () => parseFoundationSourceImportCli(["--tenant="]),
    /tenant_must_not_be_empty/,
  );
  assert.throws(
    () => parseFoundationSourceImportCli(["--tenant=tenant-a", "--other"]),
    /unknown_argument/,
  );
  assert.deepEqual(parseFoundationSourceImportCli([]), {
    tenantId: "zukan-regional-source-dry-run",
    sourceSha: null,
  });
});
