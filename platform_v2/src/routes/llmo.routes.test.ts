import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";

test("llms.txt exposes staging canonical markdown references from either staging host", async () => {
  const app = buildApp();
  try {
    for (const host of ["staging.zukan.earth", "staging.ikimon.life"]) {
      const response = await app.inject({
        method: "GET",
        url: "/llms.txt",
        headers: { host, "x-forwarded-proto": "https" },
      });
      assert.equal(response.statusCode, 200);
      assert.match(response.headers["content-type"] as string, /text\/plain/);
      assert.match(response.body, /^# ZUKAN/m);
      assert.match(response.body, /ZUKANは/);
      assert.doesNotMatch(response.body, /ikimon\.life は/);
      assert.match(response.body, /https:\/\/staging\.zukan\.earth\/llms\/guide\.md/);
      assert.match(response.body, /https:\/\/staging\.zukan\.earth\/llms\/terms\.md/);
      assert.match(response.body, /https:\/\/staging\.zukan\.earth\/ja\/learn\/biomonweek/);
      assert.doesNotMatch(response.body, /https:\/\/staging\.ikimon\.life\//);
      assert.match(response.body, /Use the Japanese pages as canonical source material/);
    }
  } finally {
    await app.close();
  }
});

test("llmo markdown routes return zukan.earth canonical source URLs", async () => {
  const app = buildApp();
  try {
    for (const url of ["/llms/guide.md", "/llms/faq.md", "/llms/researcher.md", "/llms/terms.md"]) {
      const response = await app.inject({ method: "GET", url, headers: { host: "zukan.earth" } });
      assert.equal(response.statusCode, 200, `${url} should render`);
      assert.match(response.headers["content-type"] as string, /text\/markdown/);
      assert.match(response.body, /^# ZUKAN/);
      assert.match(response.body, /既存の日本語 longform コンテンツから生成/);
      assert.match(response.body, /Canonical URL: https:\/\/zukan\.earth\/ja\//);
      assert.doesNotMatch(response.body, /Canonical URL: https:\/\/ikimon\.life\/ja\//);
    }
    const terms = await app.inject({ method: "GET", url: "/llms/terms.md", headers: { host: "ikimon.life" } });
    assert.match(terms.body, /BioMonWeek/);
    assert.match(terms.body, /観察努力量/);
    assert.match(terms.body, /自然とのつながり/);
    assert.match(terms.body, /AI候補/);
    assert.match(terms.body, /Canonical URL: https:\/\/zukan\.earth\/ja\/learn\/terms\/environmental-dna/);
    assert.doesNotMatch(terms.body, /Canonical URL: https:\/\/ikimon\.life\//);
  } finally {
    await app.close();
  }
});
