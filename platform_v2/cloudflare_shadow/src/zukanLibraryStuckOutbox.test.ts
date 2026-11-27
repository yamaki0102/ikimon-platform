import assert from "node:assert/strict";
import test from "node:test";
import { renderLibraryV2Page } from "./zukanLibraryV2";

test("stuck outbox items count as failed", () => {
  const html = renderLibraryV2Page({ visits: [], lang: "ja", authenticated: true, displayName: "a", nextCursor: null });
  assert.ok(html.includes("(Date.now() - Number(x.createdAt || 0)) > 20 * 60 * 1000"));
  assert.ok(html.includes("Number(x.attempts || 0) >= 3"));
  for (const m of html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)) {
    if (/application\/(ld\+)?json/.test(m[0])) continue;
    new Function(m[1]);
  }
});
