import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";

test("field loop page ja renders the reader-facing definition without external platform names", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/learn/field-loop?lang=ja",
    });

    assert.equal(response.statusCode, 200);
    const body = response.body;
    assert.match(body, /フィールドループとは/);
    assert.match(body, /粗い衛星/);
    assert.match(body, /知の基盤/);
    assert.match(body, /循環/);
    assert.match(body, /市民の一致/);
    assert.doesNotMatch(body, /iNaturalist/i);
    assert.doesNotMatch(body, /いきものログ/);
    assert.doesNotMatch(body, /eBird/i);
    assert.doesNotMatch(body, /Pl@ntNet/i);
    assert.doesNotMatch(body, /このページについて/);
    assert.doesNotMatch(body, /このページの前提/);
    assert.doesNotMatch(body, /市民同定は価値があるが/);
    assert.ok((body.match(/https:\/\/doi\.org\//g) ?? []).length >= 10);
  } finally {
    await app.close();
  }
});

test("about page sends readers to the learn hub", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/about?lang=ja",
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.body, /使い方を見る/);
    assert.match(response.body, /研究と信頼性を見る/);
    assert.match(response.body, /\/learn\/methodology/);
  } finally {
    await app.close();
  }
});

test("learn index frames the service in plain language", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/learn?lang=ja",
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.body, /まず読むページ/);
    assert.match(response.body, /研究・データ・信頼性について/);
    assert.match(response.body, /更新を見る/);
  } finally {
    await app.close();
  }
});

test("legacy public explainer routes redirect to their canonical destinations", async () => {
  const app = buildApp();
  try {
    const scan = await app.inject({ method: "GET", url: "/scan?lang=ja" });
    assert.equal(scan.statusCode, 308);
    assert.equal(scan.headers.location, "/map?lang=ja");

    const authority = await app.inject({ method: "GET", url: "/learn/authority-policy?lang=ja" });
    assert.equal(authority.statusCode, 308);
    assert.equal(authority.headers.location, "/learn/methodology?lang=ja");
  } finally {
    await app.close();
  }
});

test("learn methodology carries the merged trust and research framing", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/learn/methodology?lang=ja" });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /同定の信頼レーン/);
    assert.match(response.body, /quick capture と survey の違い/);
    assert.match(response.body, /言いすぎないための線引き/);
  } finally {
    await app.close();
  }
});

test("field loop keeps a minimal english fallback", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/learn/field-loop?lang=en",
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.body, /Why ikimon takes this shape/);
    assert.match(response.body, /place-first observatory/);
  } finally {
    await app.close();
  }
});
