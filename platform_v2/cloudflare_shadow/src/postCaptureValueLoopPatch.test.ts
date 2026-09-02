import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPostCaptureValueLoopPatch,
  enhancePostCaptureValueLoop,
  POST_CAPTURE_VALUE_LOOP_PRESENTATION,
} from "./postCaptureValueLoopPatch";

const captureHtml = `<!doctype html>
<html lang="ja">
<head><title>capture</title><script nonce="nonce-123">window.base=true;</script></head>
<body>
  <section data-global-record-camera-sheet hidden></section>
</body>
</html>`;

const detailHtml = `<!doctype html>
<html lang="ja">
<head><title>detail</title><script nonce="detail-nonce">window.base=true;</script></head>
<body>
  <main data-observation-first-record-detail="1">
    <section class="of-record-info">
      <h1>記録</h1>
      <div class="of-meta">
        <p><span>◷</span>2026年7月24日</p>
        <p><span>⌖</span>常盤公園</p>
      </div>
    </section>
  </main>
</body>
</html>`;

test("capture pages redirect only after record upsert and all photo uploads have reached the saved marker", () => {
  const patched = applyPostCaptureValueLoopPatch(captureHtml, "abc123");

  assert.match(patched, /data-ikimon-post-capture-value-loop="v1"/u);
  assert.match(patched, /nonce="abc123"/u);
  assert.match(patched, /\/api\\\/v1\\\/observations\\\/upsert/u);
  assert.match(patched, /data-global-record-saved-action="records"/u);
  assert.match(patched, /location\.assign\(detailHref\(recordId\)\)/u);
  assert.match(patched, /\?source=' \+ CAPTURE_SOURCE/u);
  assert.match(patched, /response\.clone\(\)\.json\(\)/u);
});

test("record detail pages load the owner-only processing status and render the place contribution", () => {
  const patched = applyPostCaptureValueLoopPatch(detailHtml, "abc123");

  assert.match(patched, /\/processing-status/u);
  assert.match(patched, /data-ikimon-post-capture-value-loop="v1" nonce="abc123"/u);
  assert.match(patched, /credentials: 'same-origin'/u);
  assert.match(patched, /data-ikimon-record-value-loop-panel/u);
  assert.match(patched, /記録できました/u);
  assert.match(patched, /この記録の状態/u);
  assert.match(patched, /この場所の記録として保存されています。/u);
  assert.match(patched, /\/map\?tab=places&source=record_detail/u);
  assert.match(patched, /status\.aiState === 'failed_retryable'/u);
  assert.match(patched, /method: 'POST'/u);
  assert.match(patched, /status\.aiState === 'candidate_ready'/u);
  assert.match(patched, /window\.setTimeout/u);
});

test("dynamic detail injection reuses the response CSP nonce when HTML has no script nonce", async () => {
  const dynamicDetailHtml = detailHtml.replace('<script nonce="detail-nonce">window.base=true;</script>', "");
  const patchedResponse = await enhancePostCaptureValueLoop(
    new Request("https://ikimon.life/ja/observations/visit-detail-contract"),
    new Response(dynamicDetailHtml, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "content-security-policy": "default-src 'self'; script-src 'self' 'nonce-page-csp-nonce' https://static.cloudflareinsights.com",
      },
    }),
  );
  const patched = await patchedResponse.text();
  assert.match(patched, /<script data-ikimon-post-capture-value-loop="v1" nonce="page-csp-nonce">/u);
  assert.match(patched, /<style id="ikimon-post-capture-value-loop-style" nonce="page-csp-nonce">/u);
  assert.doesNotMatch(patched, /unsafe-inline/u);
});

test("existing marked detail injection repairs an empty nonce without adding a duplicate patch", async () => {
  const marked = applyPostCaptureValueLoopPatch(detailHtml, "abc123").replace(/nonce="abc123"/gu, 'nonce=""');
  const response = await enhancePostCaptureValueLoop(
    new Request("https://ikimon.life/ja/observations/visit-detail-contract"),
    new Response(marked, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "content-security-policy": "default-src 'self'; script-src 'self' 'nonce-page-csp-nonce'",
      },
    }),
  );
  const patched = await response.text();
  assert.equal((patched.match(/data-ikimon-post-capture-value-loop="v1"/gu) ?? []).length, 1);
  assert.match(patched, /data-ikimon-post-capture-value-loop="v1" nonce="page-csp-nonce"/u);
});

test("patch is idempotent and skips unrelated HTML", () => {
  const once = applyPostCaptureValueLoopPatch(detailHtml, "abc123");
  const twice = applyPostCaptureValueLoopPatch(once, "abc123");
  const unrelated = "<!doctype html><html><head></head><body><p>plain</p></body></html>";

  assert.equal(twice, once);
  assert.equal((twice.match(/data-ikimon-post-capture-value-loop="v1"/gu) ?? []).length, 1);
  assert.equal(applyPostCaptureValueLoopPatch(unrelated), unrelated);
});

test("response wrapper changes only successful GET HTML responses with eligible markers", async () => {
  const patchedResponse = await enhancePostCaptureValueLoop(
    new Request("https://ikimon.life/ja/"),
    new Response(captureHtml, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "content-length": String(captureHtml.length),
        etag: '"capture"',
        "content-security-policy": "default-src 'self'; script-src 'self' 'nonce-header-nonce'",
      },
    }),
  );

  assert.equal(
    patchedResponse.headers.get("x-ikimon-post-capture-value-loop"),
    POST_CAPTURE_VALUE_LOOP_PRESENTATION,
  );
  assert.equal(patchedResponse.headers.get("content-length"), null);
  assert.equal(patchedResponse.headers.get("etag"), null);
  assert.match(await patchedResponse.text(), /data-ikimon-post-capture-value-loop="v1" nonce="header-nonce"/u);

  const postResponse = await enhancePostCaptureValueLoop(
    new Request("https://ikimon.life/api/v1/observations/upsert", { method: "POST" }),
    new Response(captureHtml, { headers: { "content-type": "text/html" } }),
  );
  assert.equal(postResponse.headers.get("x-ikimon-post-capture-value-loop"), null);
  assert.equal(await postResponse.text(), captureHtml);

  const jsonResponse = await enhancePostCaptureValueLoop(
    new Request("https://ikimon.life/ja/records"),
    new Response('{"ok":true}', { headers: { "content-type": "application/json" } }),
  );
  assert.equal(await jsonResponse.text(), '{"ok":true}');
});

test("missing CSP nonce fails closed without generating an executable inline handler", async () => {
  const dynamicDetailHtml = detailHtml.replace('<script nonce="detail-nonce">window.base=true;</script>', "");
  const response = await enhancePostCaptureValueLoop(
    new Request("https://ikimon.life/ja/observations/visit-detail-contract"),
    new Response(dynamicDetailHtml, { headers: { "content-type": "text/html; charset=utf-8" } }),
  );
  const patched = await response.text();
  assert.equal(patched, dynamicDetailHtml);
  assert.doesNotMatch(patched, /data-ikimon-post-capture-value-loop="v1"/u);
});
