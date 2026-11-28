import assert from "node:assert/strict";
import test from "node:test";
import { observationGuideFailures } from "./recordObservationGuide";
import { renderRecordReaderModesHtml } from "./recordReaderModes";

test("gate accepts a plain guide", () => {
  assert.deepEqual(observationGuideFailures("葉の形と、葉や茎にある細かい毛を見てみてください。"), []);
});

test("gate rejects exclamation, emoji, praise, technique, length, tone", () => {
  for (const bad of ["葉の形を見てみてください！", "葉の形を見てみてください!", "葉の形を見てください🌿", "すごい葉の形です。", "素晴らしい色です。", "上手な写真です。", "ピントが合っています。", "構図がよいです。", "撮り方が良いです。", "葉がきれいですね。", "あ".repeat(121), ""]) {
    assert.notEqual(observationGuideFailures(bad).length, 0, bad);
  }
});

test("renderer shows guide with AI note, falls back otherwise", () => {
  const base = { enabled: true, group: "plant" as const, speciesHeading: null };
  const withGuide = renderRecordReaderModesHtml({ ...base, guideText: "葉の形を見てみてください。", aiNote: "この文章はAIが作成しました" });
  assert.match(withGuide, /data-observation-guide/);
  assert.match(withGuide, /葉の形を見てみてください。/);
  assert.match(withGuide, /この文章はAIが作成しました/);
  assert.doesNotMatch(withGuide, /data-reader-mode-panel/);
  assert.equal(renderRecordReaderModesHtml(base), "");
  assert.equal(renderRecordReaderModesHtml({ ...base, guideText: "すごい！" }), "");
  assert.equal(renderRecordReaderModesHtml({ ...base, enabled: false, guideText: "葉。" }), "");
});
