import assert from "node:assert/strict";
import test from "node:test";
import {
  renderCloudflareRecordRecoveryGuestHtml,
  renderCloudflareRecordRecoverySignedHtml,
  resolveCloudflareRecordRecoveryState,
} from "./recordRecoveryHtml";

// Recovery stays Cloudflare-native so VPS origin fallback readiness is unchanged.
// Network retries must resume the same record and only the unfinished media steps.
// The retry contract is verified after the one-shot progress patch is applied.
test("record recovery state accepts only explicit recovery inputs", () => {
  const draft = resolveCloudflareRecordRecoveryState(new URL("https://ikimon.life/ja/record?draft=1&start=photo"));
  assert.equal(draft.active, true);
  assert.equal(draft.source, "draft_restore");
  assert.equal(draft.start, "photo");

  const retry = resolveCloudflareRecordRecoveryState(new URL("https://ikimon.life/en/record?retry=media&start=video"));
  assert.equal(retry.active, true);
  assert.equal(retry.source, "media_retry");
  assert.equal(retry.start, "video");

  const allowlisted = resolveCloudflareRecordRecoveryState(new URL("https://ikimon.life/ja/record?source=login_required"));
  assert.equal(allowlisted.active, true);
  assert.equal(allowlisted.source, "login_required");

  const unknown = resolveCloudflareRecordRecoveryState(new URL("https://ikimon.life/ja/record?source=filename.jpg"));
  assert.equal(unknown.active, false);
  assert.equal(unknown.source, "");
});

test("guest recovery keeps the draft on-device and preserves the recovery redirect", () => {
  const url = new URL("https://ikimon.life/ja/record?draft=1&start=photo&source=login_required");
  const html = renderCloudflareRecordRecoveryGuestHtml(url, "nonce-value");
  assert.match(html, /data-record-recovery-start/);
  assert.match(html, /写真・入力内容はこの端末に残っています/);
  assert.match(html, /ログインして続ける/);
  assert.match(html, /登録して続ける/);
  assert.match(html, /redirect=%2Fja%2Frecord%3Fdraft%3D1%26start%3Dphoto%26source%3Dlogin_required/);
  assert.match(html, /nonce="nonce-value"/);
  assert.doesNotMatch(html, /filename\.jpg|latitude=|longitude=/);
});

test("signed recovery restores IndexedDB media and deletes it only after success or explicit discard", () => {
  const url = new URL("https://ikimon.life/ja/record?draft=1&start=photo&source=location_denied");
  const html = renderCloudflareRecordRecoverySignedHtml(
    { userId: "user-1", displayName: "記録者" },
    url,
    "nonce-value",
    resolveCloudflareRecordRecoveryState(url),
  );
  assert.match(html, /indexedDB\.open\("ikimon-record-draft", 1\)/);
  assert.match(html, /objectStore\("drafts"\)\.get\("latest"\)/);
  assert.match(html, /pendingMediaRetryVisitId/);
  assert.match(html, /pendingMediaRetryObservationId/);
  assert.match(html, /pendingMediaRetryDetailId/);
  assert.match(html, /for \(let index = 0; index < files\.length; index \+= 1\)/);
  assert.match(html, /await deleteDraft\(\);[\s\S]*setPanelState\("saved"/);
  assert.match(html, /data-record-recovery-pick/);
  assert.match(html, /data-record-recovery-location/);
  assert.match(html, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(html, /record:latest/);
  assert.doesNotMatch(html, /fetchOriginFallback|ORIGIN_FALLBACK_BASE_URL/);
});
