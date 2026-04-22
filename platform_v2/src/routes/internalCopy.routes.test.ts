import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";

test("specialist queue gate explains access in plain Japanese", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/specialist/review-queue?lang=ja" });
    assert.equal(response.statusCode, 403);
    assert.match(response.body, /専門確認の権限が必要です/);
    assert.match(response.body, /確認待ち一覧は、運営または担当分類群を持つ人だけが見られます/);
  } finally {
    await app.close();
  }
});

test("authority admin gate stays concrete and Japanese", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/specialist/authority-admin?lang=ja" });
    assert.equal(response.statusCode, 403);
    assert.match(response.body, /権限管理の権限が必要です/);
    assert.match(response.body, /権限管理は運営権限を持つ人だけが使えます/);
  } finally {
    await app.close();
  }
});

test("qa site map uses content-backed Japanese labels", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/qa/site-map?lang=ja" });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /どこを見ればよいかを、1 画面で整理する/);
    assert.match(response.body, /確認導線/);
    assert.match(response.body, />開く</);
    assert.doesNotMatch(response.body, /qa lane/i);
    assert.doesNotMatch(response.body, />Open</);
  } finally {
    await app.close();
  }
});
