import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPostCaptureValueLoopCompatibilityPatch,
  enforcePostCaptureValueLoopCompatibility,
  POST_CAPTURE_VALUE_LOOP_COMPATIBILITY,
} from "./postCaptureValueLoopCompatibilityPatch";

const detailHtml = `<!doctype html>
<html lang="ja">
<head><script nonce="compat-nonce">window.base=true;</script></head>
<body>
  <main data-observation-first-record-detail="1">
    <div class="of-panel">
      <section class="of-record-info">
        <p class="of-status" role="status" aria-live="polite">写真と記録は保存されています。</p>
        <div class="of-meta">
          <p><span>◷</span>2026年7月24日</p>
          <p><span>⌖</span>常盤公園</p>
          <p><span>◌</span>位置はぼかして表示</p>
          <p><span>◉</span>公開</p>
        </div>
      </section>
      <section class="of-note">写真メモ</section>
      <section class="of-summary">AI候補</section>
      <section data-observation-processing-status>既存状態</section>
      <script data-observation-reassess-script>window.oldStatus=true;</script>
    </div>
  </main>
</body>
</html>`;

test("compatibility patch compacts the enhanced status while preserving every detail", () => {
  const patched = applyPostCaptureValueLoopCompatibilityPatch(detailHtml);

  assert.match(patched, /data-ikimon-post-capture-value-loop-compat="v2"/u);
  assert.match(patched, /id="ikimon-post-capture-value-loop-compact-style"/u);
  assert.match(patched, /nonce="compat-nonce"/u);
  assert.match(patched, /data-ikimon-record-value-loop-panel/u);
  assert.match(patched, /data-compact', 'v2'/u);
  assert.match(patched, /保存・解析の詳細/u);
  assert.match(patched, /ikimon-record-value-loop__details-body/u);
  assert.match(patched, /secondaryActions\.forEach/u);
  assert.match(patched, /body\.appendChild\(message\)/u);
  assert.match(patched, /body\.appendChild\(place\)/u);
  assert.match(patched, /body\.appendChild\(result\)/u);
});

test("compatibility patch removes only duplicate processing copy and keeps fail-safe owner cleanup", () => {
  const patched = applyPostCaptureValueLoopCompatibilityPatch(detailHtml);

  assert.match(patched, /\.of-record-info > \.of-status\[aria-live="polite"\]/u);
  assert.match(patched, /data-observation-processing-status/u);
  assert.match(patched, /if \(!enhanced\) return/u);
  assert.match(patched, /original\.remove\(\)/u);
  assert.match(patched, /data-observation-reassess-script/u);
});

test("compatibility patch prioritizes AI content and keeps save reassurance high after capture", () => {
  const patched = applyPostCaptureValueLoopCompatibilityPatch(detailHtml);

  assert.match(patched, /panel\.insertBefore\(summary, note\)/u);
  assert.match(patched, /summary\.insertAdjacentElement\('afterend', enhanced\)/u);
  assert.match(patched, /get\('source'\) === 'capture_saved'/u);
  assert.match(patched, /grid-template-areas/u);
  assert.match(patched, /"date scope"/u);
  assert.match(patched, /"place privacy"/u);
  assert.match(patched, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/u);
});

test("compatibility patch is idempotent and skips pages without the record detail renderer", () => {
  const once = applyPostCaptureValueLoopCompatibilityPatch(detailHtml);
  const twice = applyPostCaptureValueLoopCompatibilityPatch(once);
  const unrelated = "<!doctype html><html><head></head><body>plain</body></html>";

  assert.equal(twice, once);
  assert.equal((twice.match(/data-ikimon-post-capture-value-loop-compat="v2"/gu) ?? []).length, 1);
  assert.equal(applyPostCaptureValueLoopCompatibilityPatch(unrelated), unrelated);
});

test("response wrapper changes only successful GET detail HTML", async () => {
  const response = await enforcePostCaptureValueLoopCompatibility(
    new Request("https://ikimon.life/ja/observations/record-1"),
    new Response(detailHtml, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        etag: '"detail"',
        "content-length": String(detailHtml.length),
      },
    }),
  );

  assert.equal(
    response.headers.get("x-ikimon-post-capture-value-loop-compat"),
    POST_CAPTURE_VALUE_LOOP_COMPATIBILITY,
  );
  assert.equal(POST_CAPTURE_VALUE_LOOP_COMPATIBILITY, "post-capture-value-loop-compat-v2");
  assert.equal(response.headers.get("etag"), null);
  assert.equal(response.headers.get("content-length"), null);
  assert.match(await response.text(), /data-ikimon-post-capture-value-loop-compat="v2"/u);

  const post = await enforcePostCaptureValueLoopCompatibility(
    new Request("https://ikimon.life/ja/observations/record-1", { method: "POST" }),
    new Response(detailHtml, { headers: { "content-type": "text/html" } }),
  );
  assert.equal(await post.text(), detailHtml);
});
