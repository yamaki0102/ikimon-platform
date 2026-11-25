import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";

test("real /map and /ja/map routes carry the mock's photo-pin sheet and use the public places API", async () => {
  const app = buildApp();
  try {
    for (const url of ["/map?lang=ja", "/ja/map"]) {
      const res = await app.inject({ method: "GET", url });
      assert.equal(res.statusCode, 200, url);
      assert.match(res.body, /data-zukan-map-sheet/);
      assert.match(res.body, /近くの場所/);
      assert.match(res.body, /"見る"/);
      assert.match(res.body, /\/api\/v1\/map\/places/);
      assert.match(res.body, /__ikimonMapBoot/);
      assert.match(res.body, /data-zukan-geo-off/);
      assert.match(res.body, /位置情報がオフになっています/);
      assert.match(res.body, /設定を開く/);
      assert.match(res.body, /名前で探す/);
      assert.match(res.body, /最新の記録/);
      assert.match(res.body, /ctrl-bottom-right{bottom:0!important/);
      assert.match(res.body, /me-tabs[^{]*{display:none/);
    }
  } finally {
    await app.close();
  }
});
