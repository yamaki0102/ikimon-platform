import assert from "node:assert/strict";
import test from "node:test";
import publicPresentationEntry from "./publicPresentationEntry";

const locales = [
  { prefix: "", lang: "ja", title: "浜松のガイド地点", map: "/map?place=hamamatsu", walks: "/walk-maps" },
  { prefix: "/ja", lang: "ja", title: "浜松のガイド地点", map: "/ja/map?place=hamamatsu", walks: "/ja/walk-maps" },
  { prefix: "/en", lang: "en", title: "Places to explore in Hamamatsu", map: "/en/map?place=hamamatsu", walks: "/en/walk-maps" },
  { prefix: "/es", lang: "es", title: "Lugares para explorar en Hamamatsu", map: "/es/map?place=hamamatsu", walks: "/es/walk-maps" },
  { prefix: "/pt-br", lang: "pt-br", title: "Lugares para conhecer em Hamamatsu", map: "/pt-br/map?place=hamamatsu", walks: "/pt-br/walk-maps" },
] as const;

test("native Hamamatsu place guide keeps its public route and uses ZUKAN locale shell", async () => {
  const effects = { db: 0, r2: 0 };
  const forbiddenNetwork = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("external fetch forbidden in place guide fixture"); };
  const db = { prepare() { effects.db += 1; throw new Error("database access forbidden in place guide fixture"); } };
  const env = {
    ENVIRONMENT: "production",
    CORE_DB: db,
    OBS_DB: db,
    ASSET_BUCKET: {
      async get() { effects.r2 += 1; throw new Error("R2 access forbidden in place guide fixture"); },
      async put() { effects.r2 += 1; throw new Error("R2 access forbidden in place guide fixture"); },
      async delete() { effects.r2 += 1; throw new Error("R2 access forbidden in place guide fixture"); },
    },
  };

  try {
    for (const locale of locales) {
      const path = `${locale.prefix}/places/hamamatsu`;
      const response = await publicPresentationEntry.fetch(
        new Request(`https://zukan.earth${path}`),
        env,
        { waitUntil() {} },
      );
      const html = await response.text();

      assert.equal(response.status, 200, path);
      assert.equal(response.headers.get("x-ikimon-cloudflare-native"), "place-guide-list", path);
      assert.match(html, new RegExp(`<html lang="${locale.lang}">`), path);
      assert.match(html, new RegExp(`<title>${locale.title} - ZUKAN</title>`), path);
      assert.match(html, new RegExp(`<h1>${locale.title}</h1>`), path);
      assert.doesNotMatch(html, /<title>[^<]*ikimon/i, path);
      assert.match(html, new RegExp(`href="${locale.map.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`), path);
      assert.match(html, new RegExp(`href="${locale.walks}"`), path);
      assert.match(html, /<section class="place-grid" lang="ja">/u, path);
      assert.match(html, /浜松地域遺産認定制度/u, path);
      assert.doesNotMatch(html, /34\.831|137\.72/u, path);

      const head = await publicPresentationEntry.fetch(
        new Request(`https://zukan.earth${path}`, { method: "HEAD" }),
        env,
        { waitUntil() {} },
      );
      assert.equal(head.status, 200, `HEAD ${path}`);
      assert.equal(head.headers.get("x-ikimon-cloudflare-native"), "place-guide-list", `HEAD ${path}`);
      assert.equal(await head.text(), "", `HEAD ${path} must stay empty`);
      assert.match(head.headers.get("content-type") ?? "", /text\/html/u, `HEAD ${path}`);
    }
    assert.deepEqual(effects, { db: 0, r2: 0 });
  } finally {
    globalThis.fetch = forbiddenNetwork;
  }
});
