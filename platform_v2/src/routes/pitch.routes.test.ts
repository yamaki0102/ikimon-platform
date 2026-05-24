import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";

test("ikimon pitch mode renders award-derived Shizuoka pitch with image assets", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/pitch/ikimon?lang=ja",
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.body, /地域の観察を、未来の判断材料へ。/);
    assert.match(response.body, /アワード資料の核は、そのまま明日の紹介に使える。/);
    assert.match(response.body, /IKIMON Monitoring/);
    assert.match(response.body, /静岡では、1地域・1テーマ・1出力/);
    assert.match(response.body, /ikimon-pitch-riverside-hero\.webp/);
    assert.match(response.body, /ikimon-pitch-monitoring-workspace\.webp/);
    assert.match(response.body, /data-pitch-mode/);
    assert.match(response.body, /<meta name="robots" content="noindex,follow" \/>/);
  } finally {
    await app.close();
  }
});
