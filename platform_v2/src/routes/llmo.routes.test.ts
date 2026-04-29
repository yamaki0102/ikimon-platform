import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";

test("llms.txt exposes Japanese canonical markdown references", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/llms.txt",
      headers: { host: "staging.ikimon.life", "x-forwarded-proto": "https" },
    });
    assert.equal(response.statusCode, 200);
    assert.match(response.headers["content-type"] as string, /text\/plain/);
    assert.match(response.body, /ikimon\.life は/);
    assert.match(response.body, /https:\/\/staging\.ikimon\.life\/llms\/guide\.md/);
    assert.match(response.body, /Use the Japanese pages as canonical source material/);
  } finally {
    await app.close();
  }
});

test("llmo markdown routes return compact Japanese source material", async () => {
  const app = buildApp();
  try {
    for (const url of ["/llms/guide.md", "/llms/faq.md", "/llms/researcher.md"]) {
      const response = await app.inject({ method: "GET", url });
      assert.equal(response.statusCode, 200, `${url} should render`);
      assert.match(response.headers["content-type"] as string, /text\/markdown/);
      assert.match(response.body, /^# /);
      assert.match(response.body, /既存の日本語 longform コンテンツから生成/);
      assert.match(response.body, /Canonical URL: https:\/\/ikimon\.life\/ja\//);
    }
  } finally {
    await app.close();
  }
});
