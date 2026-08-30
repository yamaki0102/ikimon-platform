import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const indexSource = readFileSync(
  fileURLToPath(new URL("./index.ts", import.meta.url)),
  "utf8",
);

test("native record capture persists a stable media retry draft", () => {
  assert.match(indexSource, /function renderCloudflareRecordHtml[\s\S]*indexedDB\.open\("ikimon-record-draft", 1\)/);
  assert.match(indexSource, /function renderCloudflareRecordHtml[\s\S]*async function persistRecordDraftProgress/);
  assert.match(indexSource, /function renderCloudflareRecordHtml[\s\S]*recoverySubmissionId/);
  assert.match(indexSource, /function renderCloudflareRecordHtml[\s\S]*pendingMediaRetryVisitId/);
  assert.match(indexSource, /function renderCloudflareRecordHtml[\s\S]*recordPrefix \+ "\/record"/);
  assert.match(indexSource, /function renderCloudflareRecordHtml[\s\S]*searchParams\.set\("retry", "media"\)/);
  assert.match(indexSource, /function renderCloudflareRecordHtml[\s\S]*const observationId = recoverySubmissionId/);
  assert.match(indexSource, /function renderCloudflareRecordHtml[\s\S]*let recoveryObservedAt = ""/);
  assert.match(indexSource, /if \(!recoverySubmissionId\) \{[\s\S]*recoveryObservedAt = new Date\(\)\.toISOString\(\)/);
  assert.match(indexSource, /observedAt: recoveryObservedAt/);
  assert.match(indexSource, /function renderCloudflareRecordHtml[\s\S]*location\.assign\(recordRecoveryHref\(\)\)/);
});
