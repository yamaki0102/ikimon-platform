import assert from "node:assert/strict";
import test from "node:test";
import { createLearnSearch, type LearnCatalogEntry, type LearnSearchState } from "./search.js";

const entries: LearnCatalogEntry[] = [
  { path: "/learn/biodiversity", kind: "reading", title: "生物多様性の基礎", summary: "自然の変化を考える読みもの。", headings: ["観察努力量をそろえる", "自然共生サイト"], searchAliases: ["生きものの多様さ"] },
  { path: "/learn/terms/tnfd", kind: "term", title: "TNFDとは", summary: "企業と自然の関係", headings: ["依存と影響"], searchAliases: ["自然関連財務情報開示"] },
  { path: "/learn/terms/nature-positive", kind: "term", title: "ネイチャーポジティブとは", summary: "自然を回復へ向ける考え方", headings: ["３０ｂｙ３０との関係"] },
  { path: "/learn/terms/darwin-core", kind: "term", title: "Darwin Coreとは", summary: "データ交換の標準語彙", headings: ["ＤｗＣ－Ａ形式"] },
];

test("search covers Japanese titles, summaries, body headings and canonical aliases", () => {
  const search = createLearnSearch();
  for (const [q, path] of [
    ["生物多様性", "/learn/biodiversity"],
    ["変化を考える", "/learn/biodiversity"],
    ["観察努力量", "/learn/biodiversity"],
    ["生きものの多様さ", "/learn/biodiversity"],
    ["自然関連財務情報開示", "/learn/terms/tnfd"],
  ]) {
    assert.equal(search.search(entries, { q: q!, kind: "all" })[0]?.path, path);
  }
});

test("normalization treats Japanese half/full width, composed kana, Latin case and whitespace consistently", () => {
  const search = createLearnSearch();
  assert.equal(search.normalize("　 ＴＮＦＤ\t\nの　 例  "), "tnfd の 例");
  assert.equal(search.normalize("ｶﾞ"), search.normalize("カ\u3099"));
  for (const q of ["ＴＮＦＤ", "tnfd", "TnFd", "　ＴｎＦｄ　"]) {
    assert.deepEqual(search.search(entries, { q, kind: "all" }).map((entry) => entry.path), ["/learn/terms/tnfd"]);
  }
  assert.equal(search.search(entries, { q: "ﾈｲﾁｬｰﾎﾟｼﾞﾃｨﾌﾞ", kind: "all" })[0]?.path, "/learn/terms/nature-positive");
  assert.equal(search.search(entries, { q: "30BY30", kind: "all" })[0]?.path, "/learn/terms/nature-positive");
  assert.equal(search.search(entries, { q: "darwin　\n\t CORE", kind: "all" })[0]?.path, "/learn/terms/darwin-core");
  assert.equal(search.search(entries, { q: "dwc-a", kind: "all" })[0]?.path, "/learn/terms/darwin-core");
  assert.equal(search.search(entries, { q: "生物 多様性　観察努力量", kind: "all" })[0]?.path, "/learn/biodiversity");
});

test("all, reading and term filters combine with every search token and preserve catalogue order", () => {
  const search = createLearnSearch();
  assert.deepEqual(search.search(entries, { q: "", kind: "all" }), entries);
  assert.deepEqual(search.search(entries, { q: "　\n\t", kind: "all" }), entries);
  assert.deepEqual(search.search(entries, { q: "", kind: "reading" }), [entries[0]]);
  assert.deepEqual(search.search(entries, { q: "", kind: "term" }), entries.slice(1));
  assert.equal(search.search(entries, { q: "TNFD", kind: "reading" }).length, 0);
  assert.equal(search.search(entries, { q: "TNFD", kind: "term" }).length, 1);
  assert.equal(search.search(entries, { q: "自然 未登録の言葉", kind: "all" }).length, 0);
  assert.equal(search.search([], { q: "", kind: "all" }).length, 0);
});

test("URL conditions round-trip for direct links, reload, back/forward and clearing", () => {
  const search = createLearnSearch();
  const history: LearnSearchState[] = [
    { q: "", kind: "all" },
    { q: "自然　TNFD", kind: "all" },
    { q: "自然　TNFD", kind: "term" },
    { q: "not present", kind: "term" },
    { q: "", kind: "all" },
  ];
  const urls = history.map((state) => search.writeState(state));
  for (const index of [0, 1, 2, 3, 2, 1, 2, 3, 4]) {
    const restored = search.readState(urls[index]!);
    assert.deepEqual(restored, history[index]);
    assert.deepEqual(search.search(entries, restored), search.search(entries, history[index]!));
  }
  assert.equal(urls[0], "");
  assert.equal(urls[4], "");
  assert.equal(search.writeState({ q: "", kind: "term" }), "?kind=term");
  assert.deepEqual(search.readState("?q=TNFD&kind=unknown"), { q: "TNFD", kind: "all" });
  assert.deepEqual(search.readState("?unrelated=value&q=&kind=all"), { q: "", kind: "all" });
  assert.deepEqual(search.readState("?q=first&q=second&kind=term&kind=reading"), { q: "first", kind: "term" });
});

test("long queries are bounded consistently without splitting a trailing Unicode surrogate", () => {
  const search = createLearnSearch();
  const long = "未登録".repeat(10_000);
  const state = search.readState(`?q=${encodeURIComponent(long)}&kind=term`);
  assert.equal(state.q.length, search.maxQueryLength);
  assert.equal(search.search(entries, state).length, 0);
  assert.deepEqual(search.readState(search.writeState({ q: long, kind: "term" })), state);
  const edge = `${"あ".repeat(search.maxQueryLength - 1)}🌳`;
  const edgeState = search.readState(`?q=${encodeURIComponent(edge)}`);
  assert.equal(edgeState.q, "あ".repeat(search.maxQueryLength - 1));
  assert.deepEqual(search.readState(search.writeState(edgeState)), edgeState);
});

test("HTML, script, regex and URL punctuation inputs are literal data and safely URL encoded", () => {
  const search = createLearnSearch();
  for (const q of ['</script><script>alert("x")</script>', '<img src=x onerror=alert(1)>', ".*", "[", "(a+)+$", "q=1&kind=reading#x", "O'Reilly & <tag>"]) {
    const state: LearnSearchState = { q, kind: "term" };
    const url = search.writeState(state);
    assert.ok(!url.includes("<") && !url.includes(">") && !url.includes('"'));
    assert.deepEqual(search.readState(url), state);
    assert.equal(search.search(entries, state).length, 0);
  }
  assert.doesNotThrow(() => search.readState("?q=%E0%A4%A&kind=%00"));
  const literal: LearnCatalogEntry = { path: "/learn/literal", kind: "reading", title: "<script>alert(1)</script>", summary: "", headings: [] };
  assert.deepEqual(search.search([literal], { q: "<script>alert(1)</script>", kind: "all" }), [literal]);
});

test("browser factory serializes without imports, transpiler helpers or a duplicated search implementation", () => {
  const serialized = createLearnSearch.toString();
  const standalone = new Function(`"use strict"; return (${serialized})();`)() as ReturnType<typeof createLearnSearch>;
  for (const q of ["ＴＮＦＤ", "ﾈｲﾁｬｰﾎﾟｼﾞﾃｨﾌﾞ", "Darwin Core", "<script>alert(1)</script>", "", "not found"]) {
    const state: LearnSearchState = { q, kind: "all" };
    assert.deepEqual(standalone.search(entries, state), createLearnSearch().search(entries, state));
    assert.deepEqual(standalone.readState(standalone.writeState(state)), state);
  }
});
