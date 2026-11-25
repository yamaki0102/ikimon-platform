import assert from "node:assert/strict";
import test from "node:test";
import { ZUKAN_RECORD_ENTRY_STYLES, renderRecordEntryStageHtml } from "./zukanRecordEntry";
import { renderCloudflareRecordHtml } from "./index";

test("zukanRecordEntry renders C1 fullscreen camera stage and C2 photo picker with required IDs", () => {
  const html = renderRecordEntryStageHtml({
    lang: "ja",
    prefix: "/ja",
    title: "記録する",
    cameraLabel: "カメラで撮る",
    cameraHint: "カメラを起動して撮影",
    photoLabel: "写真フォルダから選ぶ",
    photoHint: "端末の写真・画像",
    videoLabel: "動画",
    videoHint: "端末の動画",
    prompt: "生きものの写真や動画を選んで記録を始めます。",
    privateBoundary: "最初は自分だけに保存されます。"
  });

  assert.match(html, /data-record-stage="c1-c2"/);
  assert.match(html, /class="[^"]*zt-capture-stage/);
  assert.match(html, /id="record-media-camera"[^>]*capture="environment"/);
  assert.match(html, /id="record-media-photo"[^>]*multiple/);
  assert.match(html, /id="record-media-video"/);
  assert.match(html, /href="\/ja\/"/);
  assert.doesNotMatch(html, /ひとこと送る/);
});

test("ZUKAN_RECORD_ENTRY_STYLES hides floating feedback button and handles reduced motion and visited links", () => {
  assert.match(ZUKAN_RECORD_ENTRY_STYLES, /\[data-otayori-fab\][^}]*display:\s*none\s*!important/);
  assert.match(ZUKAN_RECORD_ENTRY_STYLES, /prefers-reduced-motion:\s*reduce/);
  assert.match(ZUKAN_RECORD_ENTRY_STYLES, /:visited/);
  assert.match(ZUKAN_RECORD_ENTRY_STYLES, /min-height:\s*44px/);
});

test("renderCloudflareRecordHtml integrates C1-C2 entry without floating feedback button and preserves form contract", () => {
  const html = renderCloudflareRecordHtml(
    { userId: "user_c1_c2", displayName: "テスター", banned: false } as any,
    new URL("https://ikimon.life/ja/record"),
    "test-nonce"
  );

  assert.match(html, /data-record-stage="c1-c2"/);
  assert.match(html, /id="record-media-camera"[^>]*capture="environment"/);
  assert.match(html, /id="record-media-photo"/);
  assert.match(html, /id="record-media-video"/);
  assert.match(html, /id="record-form"[^>]*hidden/);
  assert.doesNotMatch(html, /<(?:a|button)[^>]*data-otayori-fab/);
  assert.doesNotMatch(html, /ひとこと送る/);
});
