import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPublicDesignFoundation,
  ensurePublicDesignFoundation,
  isPublicUserFacingHtmlRequest,
} from "./publicDesignFoundation";

const publicDocument = `<!doctype html><html lang="ja"><head><title>ZUKAN</title></head><body><main><button>保存</button></main></body></html>`;

test("public design foundation covers representative user-facing Worker documents", () => {
  for (const path of ["/", "/records", "/record", "/observations/example", "/map", "/community/events", "/profile"]) {
    assert.equal(isPublicUserFacingHtmlRequest(new Request(`https://zukan.earth${path}`)), true, path);
  }
  const rendered = applyPublicDesignFoundation(publicDocument);
  assert.match(rendered, /id="zukan-design-foundation-v1"/);
  assert.match(rendered, /<body data-zukan-design="v1">/);
  assert.match(rendered, /--zukan-focus-yellow-300:#FFD43D/);
  assert.match(rendered, /--zukan-control-min:44px/);
  assert.match(rendered, /@media\(prefers-reduced-motion:reduce\)/);
});

test("public foundation excludes internal, debug, smoke and administrative paths", () => {
  for (const path of ["/admin/guide", "/debug/app-outbox", "/ops/status", "/smoke/record", "/synthetic/renri", "/api/v1/records", "/__health"]) {
    assert.equal(isPublicUserFacingHtmlRequest(new Request(`https://zukan.earth${path}`)), false, path);
  }
  assert.equal(isPublicUserFacingHtmlRequest(new Request("https://zukan.earth/record", { method: "POST" })), false);
});

test("response wrapper marks HTML once and preserves non-HTML responses", async () => {
  const response = await ensurePublicDesignFoundation(
    new Request("https://zukan.earth/map"),
    new Response(publicDocument, { headers: { "content-type": "text/html; charset=utf-8", etag: "stale" } }),
  );
  assert.equal(response.headers.get("x-zukan-design-foundation"), "v1");
  assert.equal(response.headers.get("etag"), null);
  assert.match(await response.text(), /data-zukan-design="v1"/);

  const api = await ensurePublicDesignFoundation(new Request("https://zukan.earth/api/v1/records"), Response.json({ ok: true }));
  assert.deepEqual(await api.json(), { ok: true });
});
