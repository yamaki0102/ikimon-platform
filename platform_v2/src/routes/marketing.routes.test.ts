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
    assert.match(body, /なぜ循環で考えるのか/);
    assert.match(body, /なぜ 1 件で言い切らないのか/);
    assert.match(body, /再訪で何が増えるのか/);
    assert.match(body, /AI はどこで補助するのか/);
    assert.match(body, /次にどう使うか/);
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

test("authority policy page ja explains each trust stage in plain language", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/learn/authority-policy?lang=ja",
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.body, /AI の候補、みんなの見立て、任された人の確認、公開前判断/);
    assert.match(response.body, /なぜ段階を分けるのか/);
    assert.match(response.body, /どこで慎重さが必要になるのか/);
    assert.match(response.body, /ふだん使うときはどう読めばよいか/);
    assert.match(response.body, /だれが「任された人」になるのか/);
    assert.doesNotMatch(response.body, /authority-backed/i);
  } finally {
    await app.close();
  }
});

test("methodology page ja explains the boundary between recording and overclaiming", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/learn/methodology?lang=ja",
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.body, /場所を残す理由/);
    assert.match(response.body, /公開範囲をどう分けるのか/);
    assert.match(response.body, /使う人が最初に気にすべきこと/);
    assert.match(response.body, /言いすぎない線引き/);
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
