import assert from "node:assert/strict";
import test from "node:test";
import { ZUKAN_RECORD_MEMO_ONLY_SCRIPT, ZUKAN_RECORD_MEMO_ONLY_STYLES, renderRecordMemoOnlyHtml } from "./zukanRecordMemoOnly";

test("memo-only entry renders dialog with place picker and no photo input", () => {
  const html = renderRecordMemoOnlyHtml({ lang: "ja", prefix: "/ja", userId: "u<1>" });
  assert.match(html, /メモだけ残す/);
  assert.match(html, /id="zt-mo-pick"/);
  assert.match(html, /data-user-id="u&lt;1&gt;"/);
  assert.doesNotMatch(html, /type="file"/);
  assert.match(ZUKAN_RECORD_MEMO_ONLY_STYLES, /min-height:48px/);
});

test("memo-only script posts a photo-less upsert with site id hint", () => {
  assert.match(ZUKAN_RECORD_MEMO_ONLY_SCRIPT, /\/api\/v1\/observations\/upsert/);
  assert.match(ZUKAN_RECORD_MEMO_ONLY_SCRIPT, /siteId: placeId \|\| null/);
  assert.match(ZUKAN_RECORD_MEMO_ONLY_SCRIPT, /\/api\/v1\/record\/places\/nearby/);
  assert.match(ZUKAN_RECORD_MEMO_ONLY_SCRIPT, /mediaKind: "none"/);
});
