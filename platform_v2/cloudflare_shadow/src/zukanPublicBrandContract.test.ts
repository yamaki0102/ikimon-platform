import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Worker-native public pages use the canonical ZUKAN identity", async () => {
  const source = await readFile(new URL("./index.ts", import.meta.url), "utf8");

  assert.doesNotMatch(source, /<title>[^<]*(?: -| \|) ikimon(?: admin)?<\/title>/);
  assert.doesNotMatch(source, /aria-label="ikimon ホーム"/);
  assert.doesNotMatch(source, /<header><a href="\/">ikimon<\/a>/);
  assert.doesNotMatch(source, /<a class="cf-record-brand"[^>]*>ikimon<\/a>/);
  assert.doesNotMatch(source, /\.wm-detail-logo\{[^}]*background:/);
  assert.doesNotMatch(source, /datasetName: "ikimon Field Loop"/);
  assert.doesNotMatch(source, /ikimonのガイド|ikimon内では/);
  assert.doesNotMatch(source, /"ikimon: [^"]+"/);
  assert.doesNotMatch(source, /ikimonで通知対象|ikimonの通知設定/);
  assert.doesNotMatch(source, /`ikimon contact:|"ikimonへのお問い合わせ/);
  assert.doesNotMatch(source, /ikimon-darwin-core-v0\.csv/);
  assert.doesNotMatch(source, /aria-label="ikimon shadow derivative"|>ikimon<\/text>/);
  assert.doesNotMatch(source, /"ikimon user"/);

  assert.match(
    source,
    /class="wm-detail-brand"[^>]*aria-label="ZUKAN"[^>]*><img class="wm-detail-logo" src="\/assets\/brand\/zukan-primary\.svg" alt="">/,
  );
  assert.match(
    source,
    /class="fps-brand"[^>]*aria-label="ZUKAN"[^>]*><img src="\/assets\/brand\/zukan-primary\.svg" alt="">/,
  );
  assert.match(
    source,
    /class="cf-record-brand"[^>]*aria-label="ZUKAN"[^>]*><img src="\/assets\/brand\/zukan-primary\.svg" alt="">/,
  );
  assert.match(source, /datasetName: "ZUKAN Field Loop"/);
  assert.match(source, /filename=\\"zukan-darwin-core-v0\.csv\\"/);
  assert.match(source, /"ZUKAN: 外来種らしき記録の通知"/);
});
