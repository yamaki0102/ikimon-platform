import assert from "node:assert/strict";
import test from "node:test";
import { gzipSync } from "node:zlib";
import Fastify from "fastify";
import { registerMaterializationInjectPatch } from "./lightPostingHtmlPatch.js";

test("materialization patches leave encoded HTML bytes and headers untouched", async () => {
  const app = Fastify();
  const payload = gzipSync("<html><body>地図</body></html>");
  let patches = 0;
  app.get("/", (_request, reply) => reply.type("text/html").header("content-encoding", "gzip").send(payload));
  registerMaterializationInjectPatch(app, (html) => {
    patches += 1;
    return `${html}patched`;
  }, "__encodedResponseTest");
  try {
    const response = await app.inject("/");
    assert.equal(patches, 0);
    assert.deepEqual(response.rawPayload, payload);
    assert.equal(response.headers["content-length"], String(payload.length));
  } finally {
    await app.close();
  }
});

test("materialization patches still update identity HTML and its byte length", async () => {
  const app = Fastify();
  app.get("/", (_request, reply) => reply.type("text/html").header("content-encoding", "identity").send("<p>地図</p>"));
  registerMaterializationInjectPatch(app, (html) => html.replace("地図", "記録"), "__identityResponseTest");
  try {
    const response = await app.inject("/");
    assert.equal(response.body, "<p>記録</p>");
    assert.equal(response.headers["content-length"], String(Buffer.byteLength(response.body)));
  } finally {
    await app.close();
  }
});
