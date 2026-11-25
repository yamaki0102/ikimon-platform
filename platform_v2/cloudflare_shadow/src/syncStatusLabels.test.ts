import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ZUKAN_SYNC_STATUS_LABELS, getZukanSyncStatusLabel } from "./syncStatusLabels";

test("syncStatusLabels defines the four shared save/retry status labels", () => {
  assert.equal(getZukanSyncStatusLabel("saving", "ja"), "保存中");
  assert.equal(getZukanSyncStatusLabel("queued", "ja"), "送信待ち");
  assert.equal(getZukanSyncStatusLabel("delivered", "ja"), "届いた");
  assert.equal(getZukanSyncStatusLabel("failed", "ja"), "失敗");

  assert.equal(getZukanSyncStatusLabel("saving", "en"), "Saving");
  assert.equal(getZukanSyncStatusLabel("queued", "en"), "Waiting to send");
  assert.equal(getZukanSyncStatusLabel("delivered", "en"), "Delivered");
  assert.equal(getZukanSyncStatusLabel("failed", "en"), "Failed");

  assert.deepEqual(Object.keys(ZUKAN_SYNC_STATUS_LABELS), ["saving", "queued", "delivered", "failed"]);
});

test("capture, recovery, and guide screens consume the shared syncStatusLabels table", () => {
  for (const file of ["recordRecoveryHtml.ts", "guideVoiceEvent.ts", "index.ts"]) {
    const src = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
    assert.match(src, /from "\.\/syncStatusLabels"/, `${file} should import syncStatusLabels`);
  }
});
