import assert from "node:assert/strict";
import test from "node:test";
import { renderRecordsProductSection } from "./index";

const item = { visitId: "obs-1", displayName: "リュウノウギク", observedAt: "2026-11-24T00:00:00.000Z", assetCount: 1, photoUrl: "/media/1.jpg", publicAreaLabel: "公園", isAwaitingId: false } as never;

test("public records page has no limit copy, no saved section or save control, keeps nouns together", () => {
  const html = renderRecordsProductSection([item], new URL("https://zukan.earth/ja/records?view=public"), "public",
    { userId: "u1", banned: false } as never, false, new Map(), [{ placeId: "plc_a", name: "公園" }]);
  assert.ok(!html.includes("最大"));
  assert.ok(!html.includes("保存したもの"));
  assert.ok(!html.includes("<div class=\"zs-card\"") && !html.includes("data-zukan-save"));
  assert.ok(html.includes("最近公開された写真やメモから、名前や場所で探せます。"));
  assert.ok(html.includes("keep-all"));
  assert.match(html, /\.cf-records-places a:is\(:link,:visited/);
  assert.ok(html.indexOf("cf-records-native-grid") < html.indexOf("<nav class=\"cf-records-places\""));
  for (const l of ["es", "pt-br"] as const) {
    const x = renderRecordsProductSection([item], new URL(`https://zukan.earth/${l}/records?view=public`), "public", null);
    assert.doesNotMatch(x, /120/);
  }
  const noPhoto = renderRecordsProductSection([{ ...(item as object), photoUrl: null } as never], new URL("https://zukan.earth/ja/records?view=public"), "public", null);
  assert.doesNotMatch(noPhoto, /<span class="cf-records-native-media"/);
  const en = renderRecordsProductSection([], new URL("https://zukan.earth/en/records?view=public"), "public", null);
  assert.ok(en.includes("Search recent public photos and notes by name or place."));
});

test("mine scope redirects to the library", async () => {
  const { default: worker } = await import("./index");
  const row = { user_id: "u1", display_name: "u1", role_name: "Observer", rank_label: null, banned: 0, expires_at: "2099-01-01" };
  const stmt: any = { bind: () => stmt, first: async () => row, all: async () => ({ results: [row] }), run: async () => ({ meta: { changes: 1 } }) };
  const env = { ENVIRONMENT: "production", CORE_DB: { prepare: () => stmt }, OBS_DB: { prepare: () => stmt } } as never;
  const res = await worker.fetch(new Request("https://zukan.earth/ja/records?view=mine", { headers: { cookie: "ikimon_v2_session=t" } }), env);
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("location"), "/ja/library");
});
