import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workerSource = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

test("record recovery requests use the origin only for explicit recovery states", () => {
  assert.match(workerSource, /const RECORD_RECOVERY_ORIGIN_FALLBACK_SOURCES = new Set<string>\(\[/);
  for (const source of [
    "location_denied",
    "login_required",
    "draft_restore",
    "media_retry",
    "upload_failed",
    "global_capture",
  ]) {
    assert.match(workerSource, new RegExp(`"${source}"`));
  }
  assert.match(workerSource, /function isRecordRecoveryOriginFallbackRequest\(url: URL\): boolean \{/);
  assert.match(workerSource, /if \(!isRecordHtmlPath\(url\.pathname\)\) return false;/);
  assert.match(workerSource, /url\.searchParams\.get\("draft"\) === "1"/);
  assert.match(workerSource, /url\.searchParams\.get\("retry"\) === "media"/);
  assert.match(workerSource, /RECORD_RECOVERY_ORIGIN_FALLBACK_SOURCES\.has\(source\)/);
});

test("session-aware record rendering sends recovery queries through the existing origin fallback", () => {
  assert.match(
    workerSource,
    /async function getSessionAwareRecordHtml\(request: Request, url: URL, env: Env\): Promise<Response> \{\s+if \(isRecordRecoveryOriginFallbackRequest\(url\) && shouldUseOriginFallback\(url, env\)\) \{\s+return fetchOriginFallback\(request, url, env, "record_recovery"\);\s+\}\s+const session = await readCompatibleSessionWithOriginFallback/,
  );
  assert.doesNotMatch(
    workerSource,
    /isRecordRecoveryOriginFallbackRequest\(url\)[\s\S]{0,300}PUBLIC_CUSTOM_DOMAIN_ORIGIN_FALLBACK_MODE/,
  );
});
