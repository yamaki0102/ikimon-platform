import assert from "node:assert/strict";
import test from "node:test";
import { renderZukanChrome } from "./zukanShellChrome.js";

test("speculationrules prefetch is emitted only with nonce and excludes current page", () => {
  const withNonce = renderZukanChrome({ lang: "ja", activeNav: "library", authenticated: true, nonce: "abc", pathname: "/ja/library" });
  const m = withNonce.bottomNavHtml.match(/<script type="speculationrules" nonce="abc">([\s\S]*?)<\/script>/);
  assert.ok(m);
  const rules = JSON.parse(m![1]!);
  assert.equal(rules.prefetch[0].eagerness, "eager");
  const urls: string[] = rules.prefetch[0].urls;
  assert.deepEqual(urls, ["/ja/community/events", "/ja/map", "/ja/profile", "/ja/record"]);
  assert.ok(!JSON.stringify(rules).includes("prerender"));

  const without = renderZukanChrome({ lang: "ja", activeNav: "library", authenticated: true });
  assert.ok(!without.bottomNavHtml.includes("speculationrules"));
});
