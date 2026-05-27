import test from "node:test";
import assert from "node:assert/strict";
import { extractGlossaryTermCandidatesFromText, renderGlossaryText } from "./glossaryTerms.js";

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

test("extractGlossaryTermCandidatesFromText keeps unknown specialized terms for review", () => {
  const candidates = extractGlossaryTermCandidatesFromText("托葉の形と萼片の反り、胞子嚢群（ソーラス）の有無を見る");
  const labels = candidates.map((candidate) => candidate.label);

  assert.ok(labels.includes("托葉"));
  assert.ok(labels.includes("萼片"));
  assert.equal(labels.includes("胞子嚢群"), false);
  assert.equal(labels.includes("ソーラス"), false);
});
