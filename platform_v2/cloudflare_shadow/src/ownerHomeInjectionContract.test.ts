import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

test("owner home replaces a materialized guest feed state", () => {
  assert.match(source, /const normalized = classes/);
  assert.match(source, /className !== "is-owner" && className !== "is-guest"/);
  assert.match(source, /normalized\.push\(isOwnerFeed \? "is-owner" : "is-guest"\)/);
  assert.doesNotMatch(source, /class="prototype-record-feed\(\?!/);
  assert.match(source, /data-owner-home-state-v2/);
});

test("owner home cards and launcher use the full mobile shell range", () => {
  assert.match(source, /@media\(max-width:900px\)/);
  assert.match(source, /prototype-record-feed\.is-owner \.prototype-record-feed-main\{display:grid;grid-template-columns:124px/);
  assert.match(source, /body\[data-owner-home-state-v2\] \.global-record-choice\{min-height:50px/);
});
