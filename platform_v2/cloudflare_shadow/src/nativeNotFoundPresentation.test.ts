import assert from "node:assert/strict";
import test from "node:test";
import publicPresentationEntry from "./publicPresentationEntry";

const paths = [
  { prefix: "", lang: "ja", title: "ページが見つかりません", home: "/", map: "/map", walks: "/walk-maps" },
  { prefix: "/ja", lang: "ja", title: "ページが見つかりません", home: "/ja/", map: "/ja/map", walks: "/ja/walk-maps" },
  { prefix: "/en", lang: "en", title: "Page not found", home: "/en/", map: "/en/map", walks: "/en/walk-maps" },
  { prefix: "/es", lang: "es", title: "Página no encontrada", home: "/es/", map: "/es/map", walks: "/es/walk-maps" },
  { prefix: "/pt-br", lang: "pt-br", title: "Página não encontrada", home: "/pt-br/", map: "/pt-br/map", walks: "/pt-br/walk-maps" },
] as const;

test("unknown public pages keep a branded, localized 404 at the final Worker entry", async () => {
  const effects = { db: 0, r2: 0 };
  const forbiddenNetwork = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("external fetch forbidden in not-found fixture"); };
  const db = { prepare() { effects.db += 1; throw new Error("database access forbidden in not-found fixture"); } };
  const env = {
    ENVIRONMENT: "production",
    CORE_DB: db,
    OBS_DB: db,
    ASSET_BUCKET: {
      async get() { effects.r2 += 1; throw new Error("R2 access forbidden in not-found fixture"); },
      async put() { effects.r2 += 1; throw new Error("R2 access forbidden in not-found fixture"); },
      async delete() { effects.r2 += 1; throw new Error("R2 access forbidden in not-found fixture"); },
    },
  };

  try {
    for (const page of paths) {
      const path = `${page.prefix}/missing-native-page`;
      const response = await publicPresentationEntry.fetch(
        new Request(`https://zukan.earth${path}`),
        env,
        { waitUntil() {} },
      );
      const html = await response.text();
      const csp = response.headers.get("content-security-policy") ?? "";

      assert.equal(response.status, 404, path);
      assert.match(html, new RegExp(`<html lang="${page.lang}">`), path);
      assert.match(html, new RegExp(`<title>${page.title} - ZUKAN</title>`), path);
      assert.match(html, new RegExp(`href="${page.map}"`), path);
      assert.match(html, new RegExp(`href="${page.walks}"`), path);
      assert.match(html, new RegExp(`href="${page.home}"`), path);
      assert.match(csp, /script-src[^;]*'nonce-[^']+'/u, path);
      assert.match(csp, /style-src[^;]*'unsafe-inline'/u, path);
      assert.match(csp, /frame-ancestors 'none'/u, path);
      assert.equal(response.headers.get("x-content-type-options"), "nosniff", path);
      assert.equal(response.headers.get("x-frame-options"), "SAMEORIGIN", path);

      const head = await publicPresentationEntry.fetch(
        new Request(`https://zukan.earth${path}`, { method: "HEAD" }),
        env,
        { waitUntil() {} },
      );
      assert.equal(head.status, 404, `HEAD ${path}`);
      assert.equal(await head.text(), "", `HEAD ${path} body must be empty`);
      const headCsp = head.headers.get("content-security-policy") ?? "";
      assert.match(headCsp, /script-src[^;]*'nonce-[^']+'/u, `HEAD ${path}`);
      assert.match(headCsp, /frame-ancestors 'none'/u, `HEAD ${path}`);
      assert.equal(head.headers.get("x-content-type-options"), "nosniff", `HEAD ${path}`);
      assert.equal(head.headers.get("x-frame-options"), "SAMEORIGIN", `HEAD ${path}`);
    }
    assert.deepEqual(effects, { db: 0, r2: 0 });
  } finally {
    globalThis.fetch = forbiddenNetwork;
  }
});
