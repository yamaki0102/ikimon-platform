import test from "node:test";
import assert from "node:assert/strict";
import { renderGlossaryText } from "./glossaryTerms.js";

test("renderGlossaryText adds short hints for specialized observation terms", () => {
  const html = renderGlossaryText("胞子嚢群（ソーラス）の有無と葉柄基部の鱗片を見る");

  assert.match(html, /class="term-hint"/);
  assert.match(html, /胞子をつくる袋の集まり/);
  assert.match(html, /葉の柄が根元や茎につながるあたり/);
  assert.match(html, /薄い小片状の毛や皮/);
});

test("renderGlossaryText prefers the longest glossary alias", () => {
  const html = renderGlossaryText("胞子嚢群（ソーラス）を接写する");
  const hintCount = (html.match(/class="term-hint"/g) ?? []).length;

  assert.equal(hintCount, 1);
  assert.match(html, />胞子嚢群（ソーラス）</);
});
