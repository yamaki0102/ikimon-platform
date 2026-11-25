import assert from "node:assert/strict";
import test from "node:test";
import { ZUKAN_RECORD_CAPTURE_SCRIPT, ZUKAN_RECORD_ENTRY_STYLES, recordCaptureCopy, renderRecordEntryStageHtml } from "./zukanRecordEntry";
import { renderCloudflareRecordHtml } from "./index";
import { globalRecordEntryAsset, recordCaptureCameraCopy } from "../../src/ui/siteShell";

const STAGE = (lang: "ja" | "en" = "ja", startMode: "photo" | "video" = "photo") =>
  renderRecordEntryStageHtml({
    lang,
    prefix: `/${lang}`,
    copy: recordCaptureCopy(lang),
    engineCopy: recordCaptureCameraCopy(lang),
    startMode,
    voiceButtonHtml: "",
  });

test("capture stage renders the live camera, three pills, shutter row, device camera and required input IDs", () => {
  const html = STAGE();
  assert.match(html, /data-zukan-capture-stage/);
  assert.match(html, /data-record-stage="capture-v2"/);
  assert.match(html, /data-global-record-camera-preview/);
  assert.match(html, /<video data-global-record-camera-video playsinline muted autoplay>/);
  for (const mode of ["standard", "closeup", "video"]) assert.match(html, new RegExp(`data-zt-mode="${mode}"`));
  assert.match(html, /標準/);
  assert.match(html, /接写/);
  assert.match(html, /動画/);
  assert.match(html, /id="record-media-camera"[^>]*capture="environment"/);
  assert.match(html, /id="record-media-photo"[^>]*multiple/);
  assert.match(html, /id="record-media-video"/);
  assert.match(html, /写真を選ぶ/);
  assert.match(html, /メモ/);
  assert.match(html, /端末のカメラ/);
  assert.match(html, /data-zt-shutter/);
  assert.match(html, /href="\/ja\/"/);
  assert.doesNotMatch(html, /ひとこと送る/);
});

test("capture stage keeps the macro fallback copy and device/standard exits wired to the engine data attributes", () => {
  const html = STAGE();
  assert.match(html, /data-global-record-camera-error-body/);
  assert.match(html, /data-global-record-camera-focus-fallback/);
  assert.match(html, /data-global-record-camera-error-actions/);
  assert.match(html, /data-zt-standard/);
  assert.equal(recordCaptureCameraCopy("ja").focusUnsupported, "このブラウザでは接写のピントを調整できません");
  assert.equal(recordCaptureCameraCopy("ja").focusFallbackDevice, "端末のカメラで撮る");
  assert.equal(recordCaptureCameraCopy("ja").focusFallbackStandard, "標準に戻る");
  assert.match(html, /端末のカメラで撮る/);
  assert.match(html, /標準に戻る/);
});

test("capture stage has the stack bundle, review overlay, saved overlay and memo dialog, with no publishing choices", () => {
  const html = STAGE();
  for (const hook of ["data-zt-bundle", "data-zt-stack", "data-zt-save", "data-zt-review", "data-zt-review-thumbs", "data-zt-saved", "data-zt-again", "data-zt-view", "data-zt-back-to", "data-zt-memo"]) {
    assert.match(html, new RegExp(hook), hook);
  }
  assert.match(html, /自分だけに保存しました/);
  assert.match(html, /続けて撮る/);
  assert.match(html, /記録を見る/);
  assert.match(html, /元の場所に戻る/);
  assert.doesNotMatch(html, /name="visibility"|公開する|data-zt-publish/);
});

test("capture stage starts in the video variant only when asked", () => {
  assert.match(STAGE("ja", "photo"), /data-mode="standard"/);
  assert.match(STAGE("ja", "video"), /data-mode="video"/);
});

test("ZUKAN_RECORD_ENTRY_STYLES collapses header and nav, hides floating feedback, uses the shared motion vocabulary and honours reduced motion", () => {
  assert.match(ZUKAN_RECORD_ENTRY_STYLES, /body\.zt-capturing/);
  assert.match(ZUKAN_RECORD_ENTRY_STYLES, /\[data-otayori-fab\][^}]*display:\s*none\s*!important/);
  assert.match(ZUKAN_RECORD_ENTRY_STYLES, /--zt-d1:\s*120ms/);
  assert.match(ZUKAN_RECORD_ENTRY_STYLES, /--zt-d2:\s*240ms/);
  assert.match(ZUKAN_RECORD_ENTRY_STYLES, /--zt-d3:\s*360ms/);
  assert.match(ZUKAN_RECORD_ENTRY_STYLES, /cubic-bezier\(0\.2,\s*0,\s*0,\s*1\)/);
  assert.match(ZUKAN_RECORD_ENTRY_STYLES, /prefers-reduced-motion:\s*reduce/);
  assert.match(ZUKAN_RECORD_ENTRY_STYLES, /min-height:\s*44px/);
  assert.match(ZUKAN_RECORD_ENTRY_STYLES, /@media \(min-width:\s*960px\)/);
  assert.match(ZUKAN_RECORD_ENTRY_STYLES, /320px/);
  assert.doesNotMatch(ZUKAN_RECORD_ENTRY_STYLES, /cubic-bezier\([^)]*(?:1\.[1-9]|[2-9]\.\d)\)/);
});

test("capture script drives the engine through its public API and never opens its own camera", () => {
  assert.match(ZUKAN_RECORD_CAPTURE_SCRIPT, /ikimonCaptureEngine/);
  assert.match(ZUKAN_RECORD_CAPTURE_SCRIPT, /ikimon-capture-photo/);
  assert.match(ZUKAN_RECORD_CAPTURE_SCRIPT, /ikimon-capture-start-failed/);
  assert.doesNotMatch(ZUKAN_RECORD_CAPTURE_SCRIPT, /getUserMedia|applyConstraints|getCapabilities/);
});

test("renderCloudflareRecordHtml mounts the capture stage, collapses chrome, drops the floating feedback button and preserves the hidden form contract", () => {
  const html = renderCloudflareRecordHtml(
    { userId: "user_c1_c2", displayName: "テスター", banned: false } as any,
    new URL("https://ikimon.life/ja/record"),
    "test-nonce"
  );

  assert.match(html, /data-record-stage="capture-v2"/);
  assert.match(html, /<body[^>]*class="[^"]*zt-capturing/);
  assert.match(html, /id="record-media-camera"[^>]*capture="environment"/);
  assert.match(html, /id="record-media-photo"/);
  assert.match(html, /id="record-media-video"/);
  assert.match(html, /id="record-form"[^>]*hidden/);
  assert.match(html, /name="note"[^>]*form="record-form"|form="record-form"[^>]*name="note"/);
  assert.doesNotMatch(html, /<(?:a|button)[^>]*data-otayori-fab/);
  assert.doesNotMatch(html, /ひとこと送る/);
});

test("record page keeps the macro engine byte-for-byte: constraints, focus fallback, and the engine asset still ship", () => {
  for (const path of ["/ja/record", "/record", "/en/record"]) {
    const html = renderCloudflareRecordHtml(
      { userId: "user_macro", displayName: "テスター", banned: false } as any,
      new URL(`https://ikimon.life${path}`),
      "test-nonce"
    );
    assert.match(html, /data-zt-mode="closeup"/, path);
    assert.match(html, /data-global-record-camera-focus-fallback/, path);
    assert.match(html, /data-global-record-camera-focus-range/, path);
    assert.match(html, /data-global-record-camera-zoom-range/, path);
    assert.match(html, /<script src="\/assets\/ui\/global-record-entry\.[a-f0-9]{12}\.js" defer><\/script>/, path);
    assert.match(html, /id="global-record-config"/, path);
    assert.doesNotMatch(html, /data-global-record-macro-open/, path);
  }
  const engine = globalRecordEntryAsset().content.toString("utf8");
  assert.match(engine, /data-global-record-macro-open/);
  assert.match(engine, /focus_unsupported/);
  assert.ok(engine.includes("const CAMERA_PHOTO_IDEAL_WIDTH = 2560;"));
  assert.ok(engine.includes("const CAMERA_PHOTO_IDEAL_HEIGHT = 1920;"));
  assert.ok(engine.includes("streamHasCloseupFocusMode"));
});
