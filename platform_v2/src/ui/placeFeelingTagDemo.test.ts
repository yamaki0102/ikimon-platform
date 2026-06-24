import assert from "node:assert/strict";
import test from "node:test";
import { renderPlaceFeelingTagDemo } from "./placeFeelingTagDemo.js";

test("place feeling tag demo renders fixture data without requiring real records", () => {
  const html = renderPlaceFeelingTagDemo({
    lang: "ja",
    recordHref: "/record?start=photo",
  });

  assert.match(html, /実データではありません/);
  assert.match(html, /固定サンプルだけで表示/);
  assert.match(html, /前回選んだタグ/);
  assert.match(html, /ウォーキング中/);
  assert.match(html, /家族と/);
  assert.match(html, /地域集計プレビュー/);
  assert.match(html, /&quot;place_feeling_tags&quot;/);
  assert.match(html, /&quot;beautiful&quot;/);
  assert.match(html, /href="\/record\?start=photo"/);
});
