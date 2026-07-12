import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

// Keep recovery-only queries ahead of the native/materialized record surface on Cloudflare and preserve normal /record behavior.
test("record recovery requests use exact origin fallback before native or materialized record HTML", () => {
  assert.match(source, /const RECORD_RECOVERY_SOURCE_VALUES = new Set\(\[/);
  for (const value of ["location_denied", "login_required", "draft_restore", "media_retry", "upload_failed", "global_capture"]) {
    assert.match(source, new RegExp(`"${value}"`));
  }
  assert.match(source, /function isRecordRecoveryRequest\(url: URL\): boolean/);
  assert.match(source, /if \(!isRecordHtmlPath\(url\.pathname\)\) return false/);
  assert.match(source, /url\.searchParams\.get\("draft"\) === "1"/);
  assert.match(source, /url\.searchParams\.get\("retry"\) === "media"/);
  assert.match(source, /isRecordRecoveryRequest\(url\) && env\.ORIGIN_FALLBACK_BASE_URL/);
  assert.match(source, /fetchOriginFallback\(request, url, env, "record_recovery"\)/);
  assert.match(source, /fetchOriginFallback[\s\S]{0,220}getSessionAwareRecordHtml/);
});
