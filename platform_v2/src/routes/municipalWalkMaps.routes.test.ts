import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";

const rejectedPublicCopy = new RegExp(["順番" + "通り", "外れてても" + "OK", "貢" + "献", "見" + "返せる", "少し" + "厚"].join("|"));

test("municipal walk map public index renders static samples and source counts", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/walk-maps", headers: { accept: "text/html" } });

    assert.equal(response.statusCode, 200);
    assert.match(response.body, /公開範囲で使う散策サンプル/);
    assert.match(response.body, /谷津山周辺の散策サンプル/);
    assert.match(response.body, /麻機の水辺を歩くサンプル/);
    assert.match(response.body, /丸子川・広野海岸公園の水辺サンプル/);
    assert.match(response.body, /引用元 3件/);
    assert.match(response.body, /href="\/ja\/walk-maps\/jp-shizuoka-asahata-waterfront-sample-v0/);
    assert.doesNotMatch(response.body, rejectedPublicCopy);
  } finally {
    await app.close();
  }
});

test("municipal walk map public list API returns static summaries", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/api/v1/municipal-walk-maps" });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.ok, true);
    assert.equal(body.source, "static");
    assert.ok(body.summaries.length >= 3);
    assert.match(JSON.stringify(body.summaries), /jp-shizuoka-mariko-waterfront-sample-v0/);
  } finally {
    await app.close();
  }
});

test("municipal walk map public detail renders source links and record entry", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/walk-maps/jp-shizuoka-asahata-waterfront-sample-v0",
      headers: { accept: "text/html" },
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.body, /麻機の水辺を歩くサンプル/);
    assert.match(response.body, /公開プレビュー/);
    assert.match(response.body, /散策の手がかり/);
    assert.match(response.body, /公開範囲で使う/);
    assert.match(response.body, /移動手段/);
    assert.match(response.body, /徒歩 \/ 自転車 \/ 車 \/ 公共交通/);
    assert.match(response.body, /引用元/);
    assert.match(response.body, /静岡市 いきもの散策マップ/);
    assert.match(response.body, /PDF本文や図版は転載していません/);
    assert.match(response.body, /context=municipal_walk_map/);
    assert.match(response.body, /walkMapId=jp-shizuoka-asahata-waterfront-sample-v0/);
    assert.match(response.body, /stopId=asahata-water-edge/);
    assert.doesNotMatch(response.body, rejectedPublicCopy);
    assert.doesNotMatch(response.body, /admin\/municipal-walk-maps/);
  } finally {
    await app.close();
  }
});

test("municipal walk map unknown detail returns 404", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/walk-maps/not-found" });

    assert.equal(response.statusCode, 404);
    assert.match(response.body, /散策サンプルは見つかりませんでした/);
  } finally {
    await app.close();
  }
});
