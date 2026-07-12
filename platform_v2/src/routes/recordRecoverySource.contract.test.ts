import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Source-level contracts guard the recovery handoff paths before browser QA.
const routeSource = readFileSync(new URL("./read.ts", import.meta.url), "utf8");
const shellSource = readFileSync(new URL("../ui/siteShell.ts", import.meta.url), "utf8");

test("record recovery accepts only explicit source reasons", () => {
  assert.match(routeSource, /const RECORD_RECOVERY_SOURCES = new Set<RecordRecoverySource>/);
  for (const source of ["location_denied", "login_required", "draft_restore", "media_retry", "upload_failed", "global_capture"]) {
    assert.match(routeSource, new RegExp(`"${source}"`));
  }
  assert.match(routeSource, /RECORD_RECOVERY_SOURCES\.has\(rawSource\) \? rawSource : ""/);
});

test("global quick record preserves only allowlisted recovery reasons, not media metadata in the URL", () => {
  assert.match(shellSource, /withDraftParams = \(href, kind, source\)/);
  assert.match(shellSource, /\['location_denied', 'login_required', 'draft_restore', 'media_retry', 'upload_failed', 'global_capture'\]\.includes\(String\(source \|\| ''\)\)/);
  assert.match(shellSource, /url\.searchParams\.set\('source', recoverySource\)/);
  assert.match(shellSource, /navigateWithDraft\(selectedPhotoDraftFiles\(\), 'photo', capturedReviewMeta \|\| \{\}, 'login_required'\)/);
  assert.match(shellSource, /navigateWithDraft\(selectedPhotoDraftFiles\(\), 'photo', capturedReviewMeta \|\| \{\}, 'location_denied'\)/);
  assert.doesNotMatch(shellSource, /searchParams\.set\('(?:file|filename|latitude|longitude)'/);
});

test("recovery media picking opens the internal file input without delegating to the mobile launcher", () => {
  assert.match(routeSource, /const chooseRecordRecoveryMedia = \(\) => \{/);
  assert.match(routeSource, /document\.querySelector\('\[data-record-media-input\]\[data-capture-kind="' \+ action \+ '"\]'/);
  assert.doesNotMatch(routeSource, /const chooseRecordRecoveryMedia = \(\) => \{[\s\S]{0,500}preferred\.click\(\)/);
  assert.doesNotMatch(routeSource, /const chooseRecordRecoveryMedia = \(\) => \{[\s\S]{0,500}captureButtons\.find/);
});
