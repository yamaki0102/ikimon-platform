import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { __test__ } from "./smokeProductionMediaUpload.js";

test("production media smoke verifies duplicate post guard", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "scripts", "smokeProductionMediaUpload.ts"), "utf8");

  assert.match(source, /verifyDuplicateGuard/);
  assert.match(source, /clientSubmissionId/);
  assert.match(source, /duplicate_upsert_created_new_visit/);
  assert.match(source, /duplicate_media_visit_detected/);
  assert.match(source, /observation_write_idempotency/);
  assert.match(source, /http_idempotency_reused_without_legacy_postgres_rows/);
  assert.match(source, /hideNativeObservationForCleanup/);
  assert.match(source, /const mediaObservationId = state\.visitId/);
  assert.match(source, /verifyObservationDetailPageReady/);
  assert.match(source, /detail_page:poll/);
  assert.match(source, /cloudflare_delete_auth_scheme_not_allowed/);
  assert.match(source, /const pathname = `\/observations\/\$\{encodeURIComponent\(visitId\)\}\?subject=\$\{encodeURIComponent\(occurrenceId\)\}`/);
  assert.doesNotMatch(source, /encodeURIComponent\(state\.occurrenceId\)}\/photos\/upload/);
  assert.doesNotMatch(source, /observationId: state\.occurrenceId/);
  assert.match(source, /verifyLegacyAiStateIfPresent/);
  assert.doesNotMatch(source, /processMediaProcessingJobs/);
  assert.doesNotMatch(source, /media_worker/);
});

test("production media smoke refuses unsafe production cleanup settings", () => {
  const safeOptions = __test__.parseArgs([
    "--base-url=https://zukan.earth",
    "--fixture-prefix=prod-media-smoke-contract",
    "--video-file=fixtures/smoke.mp4",
  ]);
  assert.doesNotThrow(() => __test__.assertSafeSmokeOptions(safeOptions));
  assert.equal(__test__.isProductionBaseUrl("https://zukan.earth"), true);
  assert.equal(__test__.isProductionBaseUrl("https://ikimon.life"), true);
  assert.equal(__test__.isProductionBaseUrl("https://www.ikimon.life"), true);
  assert.equal(__test__.isProductionBaseUrl("https://staging.zukan.earth"), false);
  assert.equal(__test__.isProductionBaseUrl("https://zukan.earth.evil.example"), false);
  assert.equal(__test__.isProductionBaseUrl("https://ikimon.life.evil.example"), false);
  assert.equal(__test__.isProductionBaseUrl("http://127.0.0.1:3200"), false);

  const unsafeNoCleanup = __test__.parseArgs([
    "--base-url=https://zukan.earth",
    "--fixture-prefix=prod-media-smoke-contract",
    "--video-file=fixtures/smoke.mp4",
    "--no-cleanup",
  ]);
  assert.throws(
    () => __test__.assertSafeSmokeOptions(unsafeNoCleanup),
    /production_media_smoke_cleanup_required/,
  );

  const unsafePrefix = __test__.parseArgs([
    "--base-url=https://zukan.earth",
    "--fixture-prefix=smoke-ui-contract",
    "--video-file=fixtures/smoke.mp4",
  ]);
  assert.throws(
    () => __test__.assertSafeSmokeOptions(unsafePrefix),
    /fixture_prefix_must_match_prod_media_smoke_pattern/,
  );
});
