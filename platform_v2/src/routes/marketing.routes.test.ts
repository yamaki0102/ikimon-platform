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
    assert.match(body, /同じ場所に何度か関わる/);
    assert.match(body, /また歩く/);
    assert.match(body, /循環/);
    assert.match(body, /AI はどこで役立つのか/);
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

test("about page explains the service in reader-facing terms and sends readers to the learn hub", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/about?lang=ja",
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.body, /だれのためのサービスか/);
    assert.match(response.body, /なぜ再訪が価値になるか/);
    assert.match(response.body, /使い方と考え方を見る/);
    assert.match(response.body, /\/learn/);
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
    assert.match(response.body, /はじめてならこの順番/);
    assert.match(response.body, /名前が分からないときの基本/);
    assert.match(response.body, /迷ったら、まず次の 3 ページで全体をつかんでください/);
    assert.match(response.body, /団体で考えているとき/);
    assert.match(response.body, /更新を見る/);
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
