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
  assert.match(indexSource, /id="record-media-photo"[^>]*multiple/);
  assert.match(indexSource, /id="record-photo-review"/);
  assert.match(indexSource, /selectedPhotos\.push\(\.\.\.incoming\)/);
  assert.match(indexSource, /copy\.removePhoto \+ ": " \+ \(file\.name/);
  assert.match(indexSource, /dialog\.showModal\(\)/);
  assert.match(indexSource, /completedPhotoIndexes\.has\(index\)/);
  assert.match(indexSource, /completedPhotoIndexes\.add\(index\)/);
  assert.match(indexSource, /mediaRole: index === 0 \? "primary" : "context"/);
  assert.match(indexSource, /"記録を確認"/);
  assert.match(indexSource, /id="record-review-open">\$\{escapeHtml\(mediaCopy\.save\)\}<\/button>/);
  assert.match(indexSource, /id="record-confirm" class="cf-record-confirm"/);
  assert.match(indexSource, /<button type="submit" form="record-form" id="record-confirm-save"/);
  assert.match(indexSource, /reviewOpen\?\.addEventListener\("click"[\s\S]*confirmDialog\.showModal\(\)/);
  assert.match(indexSource, /savePrivate: "非公開で保存"/);
  assert.match(indexSource, /"保存した記録は非公開です。公開する場合は、保存後に公開範囲を別途選びます。"/);
  assert.match(indexSource, /\.cf-record-photo button\{[^}]*min-height:44px[^}]*border-radius:4px[^}]*font-size:16px/);
  assert.match(indexSource, /\.cf-record-add\{[^}]*border-radius:4px[^}]*font-size:16px/);
  const captureSource = indexSource.slice(indexSource.indexOf("export function renderCloudflareRecordHtml"), indexSource.indexOf("async function getSessionAwareProfileHtml"));
  assert.doesNotMatch(captureSource, /visibility:\s*"public"|publication\/publish/);
});
