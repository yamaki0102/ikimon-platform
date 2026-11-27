import assert from "node:assert/strict";
import test from "node:test";
import { renderZukanChrome } from "./zukanShellChrome";
import { renderZukanShellDocument } from "./zukanShell";

test("activeNav none marks no nav item", () => {
  const c = renderZukanChrome({ lang: "ja", activeNav: "none", authenticated: true });
  assert.ok(!c.sidebarHtml.includes("aria-current"));
  assert.ok(!c.bottomNavHtml.includes("aria-current"));
});

test("shell document renders sidebar and bottom nav for members", () => {
  const html = renderZukanShellDocument({ lang: "ja", activeNav: "library", authenticated: true, bodyHtml: "<p>x</p>" });
  assert.ok(html.includes("zt-sidebar"));
  assert.ok(html.includes("zt-bottom-nav"));
});

test("search root redirects to v2 explore and results", async () => {
  const { default: entry } = await import("./publicPresentationEntry");
  const env = { ENVIRONMENT: "staging", SEARCH_V2_ENABLED: "true" } as never;
  const run = async (path: string) => entry.fetch(new Request(`https://zukan.earth${path}`, { redirect: "manual" }), env, { waitUntil() {} } as never);
  for (const [path, loc] of [["/ja/search", "/ja/search/explore"], ["/search", "/ja/search/explore"], ["/ja/search/", "/ja/search/explore"], ["/ja/search?q=%E5%B7%9D", "/ja/search/results?q=%E5%B7%9D"]] as const) {
    const r = await run(path);
    assert.equal(r.headers.get("location"), loc, path);
  }
});
