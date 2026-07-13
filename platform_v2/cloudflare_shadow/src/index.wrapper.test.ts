import assert from "node:assert/strict";
import test from "node:test";
import { filterLegacyQaEventCards } from "./index.js";

test("Cloudflare event list removes legacy PR-numbered QA cards", () => {
  const html = [
    '<main>',
    '<article class="event-card"><h2>PR973 prod rally</h2><a href="/community/events/pr973/join">参加</a></article>',
    '<article class="event-card"><h2>連理の木の下で サイエンスアドベンチャー</h2><a href="/community/events/RENRI0719/join">参加</a></article>',
    '</main>',
  ].join("");
  const filtered = filterLegacyQaEventCards(html);
  assert.doesNotMatch(filtered, /PR973 prod rally/);
  assert.match(filtered, /連理の木の下で サイエンスアドベンチャー/);
});

test("ordinary event cards and navigation list items are preserved", () => {
  const html = '<ul><li><a href="/community/events">観察会</a></li></ul><article class="evt-card"><h2>夏の観察会</h2></article>';
  assert.equal(filterLegacyQaEventCards(html), html);
});
