import assert from "node:assert/strict";
import test from "node:test";
import {
  renderCloudflareRecordRecoveryGuestHtml,
  renderCloudflareRecordRecoverySignedHtml,
  resolveCloudflareRecordRecoveryState,
} from "./recordRecoveryHtml";

// Recovery stays Cloudflare-native so VPS origin fallback readiness is unchanged.
// Network retries must resume the same record and only the unfinished media steps.
// The interactive recovery state belongs to one card, not the page body.
// These assertions are the final merge contract for the native recovery surface.
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

test("signed recovery resumes the same record and only unfinished media", () => {
  const url = new URL("https://ikimon.life/ja/record?draft=1&start=photo&source=location_denied");
  const html = renderCloudflareRecordRecoverySignedHtml(
    { userId: "user-1", displayName: "記録者" },
    url,
    "nonce-value",
    resolveCloudflareRecordRecoveryState(url),
  );
  assert.match(html, /indexedDB\.open\("ikimon-record-draft", 1\)/);
  assert.match(html, /objectStore\("drafts"\)\.get\("latest"\)/);
  assert.match(html, /async function persistDraftProgress/);
  assert.match(html, /recoverySubmissionId/);
  assert.match(html, /const isRetry = Boolean\(pendingRetryTarget\)/);
  assert.match(html, /if \(!isRetry\) \{[\s\S]*\/api\/v1\/observations\/upsert/);
  assert.match(html, /await persistDraftProgress\(\{[\s\S]*recoverySubmissionId[\s\S]*const observationId/);
  assert.match(html, /pendingMediaRetryVisitId: visitId/);
  assert.match(html, /completedPhotoIndexes\.has\(index\)[\s\S]*completedPhotoIndexes\.add\(index\)/);
  assert.match(html, /pendingMediaRetryVideoUid/);
  assert.match(html, /pendingMediaRetryVideoBodyUploaded/);
  assert.match(html, /if \(!pendingVideoBodyUploaded\)[\s\S]*\/finalize/);
  assert.match(html, /for \(let index = 0; index < files\.length; index \+= 1\)/);
  assert.match(html, /await deleteDraft\(\);[\s\S]*setPanelState\("saved"/);
  assert.match(html, /data-record-recovery-page="1"/);
  assert.match(html, /document\.querySelector\("\.cf-recovery-card\[data-record-recovery\]"\)/);
  assert.match(html, /data-record-recovery-pick/);
  assert.match(html, /data-record-recovery-location/);
  assert.match(html, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(html, /record:latest/);
  assert.doesNotMatch(html, /fetchOriginFallback|ORIGIN_FALLBACK_BASE_URL/);
});

test("signed recovery preserves safe event context through the observation write", () => {
  const url = new URL(
    "https://ikimon.life/ja/record?draft=1&start=photo&source=login_required&event=RENRI26&eventSessionId=event-renri-20260719&teamId=family-1&participantRole=participant",
  );
  const html = renderCloudflareRecordRecoverySignedHtml(
    { userId: "user-1", displayName: "記録者" },
    url,
    "nonce-value",
    resolveCloudflareRecordRecoveryState(url),
  );

  assert.match(html, /data-event-code="RENRI26"/);
  assert.match(html, /data-event-session-id="event-renri-20260719"/);
  assert.match(html, /data-event-team-id="family-1"/);
  assert.match(html, /data-event-participant-role="participant"/);
  assert.match(html, /eventCode: eventContext\.eventCode \|\| null/);
  assert.match(html, /eventSessionId: eventContext\.eventSessionId \|\| null/);
  assert.match(html, /teamId: eventContext\.teamId \|\| null/);
  assert.match(html, /participantRole: eventContext\.participantRole \|\| null/);
  assert.match(html, /eventContext,[\s\S]*formValues:/);
  assert.match(html, /\/api\/v1\/observation-events\/.*\/analytics/);
  assert.match(html, /event_photo_selected/);
  assert.match(html, /event_observation_submit_started/);
  assert.match(html, /event_retry_succeeded/);
  assert.doesNotMatch(html, /guest_token|guestToken/);
  assert.doesNotMatch(html, /<\/script><script>alert/);

  const maliciousUrl = new URL(
    "https://ikimon.life/ja/record?draft=1&event=%3C%2Fscript%3E%3Cscript%3Ealert(1)%3C%2Fscript%3E",
  );
  const maliciousHtml = renderCloudflareRecordRecoverySignedHtml(
    { userId: "user-1" },
    maliciousUrl,
    "nonce-value",
    resolveCloudflareRecordRecoveryState(maliciousUrl),
  );
  assert.doesNotMatch(maliciousHtml, /alert\(1\)/);
});
