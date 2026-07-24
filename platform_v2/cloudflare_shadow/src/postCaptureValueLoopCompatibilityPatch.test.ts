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
    <section data-observation-processing-status>既存状態</section>
    <script data-observation-reassess-script>window.oldStatus=true;</script>
  </main>
</body>
</html>`;

test("compatibility patch waits for the enhanced panel before removing the existing owner status panel", () => {
  const patched = applyPostCaptureValueLoopCompatibilityPatch(detailHtml);

  assert.match(patched, /data-ikimon-post-capture-value-loop-compat="v1"/u);
  assert.match(patched, /nonce="compat-nonce"/u);
  assert.match(patched, /data-ikimon-record-value-loop-panel/u);
  assert.match(patched, /data-observation-processing-status/u);
  assert.match(patched, /if \(!enhanced\) return/u);
  assert.match(patched, /original\.remove\(\)/u);
  assert.match(patched, /data-observation-reassess-script/u);
});

test("compatibility patch is idempotent and skips pages without the record detail renderer", () => {
  const once = applyPostCaptureValueLoopCompatibilityPatch(detailHtml);
  const twice = applyPostCaptureValueLoopCompatibilityPatch(once);
  const unrelated = "<!doctype html><html><head></head><body>plain</body></html>";

  assert.equal(twice, once);
  assert.equal((twice.match(/data-ikimon-post-capture-value-loop-compat="v1"/gu) ?? []).length, 1);
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
  assert.equal(response.headers.get("etag"), null);
  assert.equal(response.headers.get("content-length"), null);
  assert.match(await response.text(), /data-ikimon-post-capture-value-loop-compat="v1"/u);

  const post = await enforcePostCaptureValueLoopCompatibility(
    new Request("https://ikimon.life/ja/observations/record-1", { method: "POST" }),
    new Response(detailHtml, { headers: { "content-type": "text/html" } }),
  );
  assert.equal(await post.text(), detailHtml);
});
