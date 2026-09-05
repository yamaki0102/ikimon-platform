import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import {
  applyPostCaptureValueLoopCompatibilityPatch,
  enforcePostCaptureValueLoopCompatibility,
  POST_CAPTURE_VALUE_LOOP_COMPATIBILITY,
} from "./postCaptureValueLoopCompatibilityPatch";
import { applyPostCaptureValueLoopPatch } from "./postCaptureValueLoopPatch";

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

test("detail ordering reaches a fixed point instead of retriggering its observer forever", () => {
  const patched = applyPostCaptureValueLoopCompatibilityPatch(detailHtml);
  const from = patched.indexOf("var prioritizeContent = function (enhanced)");
  const to = patched.indexOf("var compactPanel =", from);
  assert.ok(from >= 0 && to > from);
  for (const captureReturn of [false, true]) {
    const children: any[] = [];
    let mutations = 0;
    const moveBefore = (node: any, before: any) => {
      const old = children.indexOf(node);
      if (old >= 0) children.splice(old, 1);
      const target = before ? children.indexOf(before) : children.length;
      children.splice(target, 0, node); mutations += 1;
    };
    const node = (name: string): any => ({ name,
      get previousElementSibling() { return children[children.indexOf(this) - 1] ?? null; },
      get nextElementSibling() { return children[children.indexOf(this) + 1] ?? null; },
      insertAdjacentElement(_position: string, other: any) { moveBefore(other, this.nextElementSibling); },
    });
    const info = node("info"), note = node("note"), summary = node("summary"), enhanced = node("status");
    children.push(info, note, summary, enhanced);
    const panel = { querySelector: (selector: string) => selector === ".of-note" ? note : summary, insertBefore: moveBefore };
    const context = vm.createContext({ document: { querySelector: () => panel }, isCaptureReturn: () => captureReturn });
    new vm.Script(patched.slice(from, to)).runInContext(context);
    context.prioritizeContent(enhanced);
    const settled = mutations;
    for (let i = 0; i < 10; i += 1) context.prioritizeContent(enhanced);
    assert.equal(mutations, settled, "observer reconciliation must stop mutating the same nodes");
    assert.equal(new Set(children).size, 4);
  }
});

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

test("compatibility patch keeps the recorded note before AI content and save reassurance high after capture", () => {
  const patched = applyPostCaptureValueLoopCompatibilityPatch(detailHtml);

  assert.match(patched, /note\.insertAdjacentElement\('afterend', summary\)/u);
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

test("dynamic compatibility injection reuses the response CSP nonce", async () => {
  const dynamicDetailHtml = detailHtml.replace('<script nonce="compat-nonce">window.base=true;</script>', "");
  const withValueLoop = applyPostCaptureValueLoopPatch(dynamicDetailHtml, "page-csp-nonce");
  const response = await enforcePostCaptureValueLoopCompatibility(
    new Request("https://ikimon.life/ja/observations/record-1"),
    new Response(withValueLoop, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "content-security-policy": "default-src 'self'; script-src 'self' 'nonce-page-csp-nonce' https://static.cloudflareinsights.com",
      },
    }),
  );
  const patched = await response.text();
  assert.match(patched, /<script data-ikimon-post-capture-value-loop-compat="v2" nonce="page-csp-nonce">/u);
  assert.match(patched, /<style id="ikimon-post-capture-value-loop-compact-style" nonce="page-csp-nonce">/u);
  assert.doesNotMatch(patched, /unsafe-inline/u);
});

test("existing marked compatibility injection preserves the value-loop nonce", async () => {
  const marked = applyPostCaptureValueLoopPatch(detailHtml, "page-csp-nonce");
  const response = await enforcePostCaptureValueLoopCompatibility(
    new Request("https://ikimon.life/ja/observations/record-1"),
    new Response(marked, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "content-security-policy": "default-src 'self'; script-src 'self' 'nonce-page-csp-nonce'",
      },
    }),
  );
  const patched = await response.text();
  assert.equal((patched.match(/data-ikimon-post-capture-value-loop-compat="v2"/gu) ?? []).length, 1);
  assert.match(patched, /data-ikimon-post-capture-value-loop-compat="v2" nonce="page-csp-nonce"/u);
});
