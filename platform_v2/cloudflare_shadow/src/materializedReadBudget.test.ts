import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import worker from "./publicPresentationEntry";

const hash = "a".repeat(64);
const prefix = `original-ui/versions/${hash}`;
const relative = "static/assets/brand/zukan-symbol.svg";
const bytes = "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>";
const digest = createHash("sha256").update(bytes).digest("hex");

function fixture(pinned = true) {
  const objects = new Map<string, string>([
    [`${prefix}/manifest.json`, JSON.stringify({ items: [{ key: relative, sha256: digest }] })],
    [`${prefix}/${relative}`, bytes],
    ["original-ui/current/staging.json", JSON.stringify({ version_prefix: prefix })],
  ]);
  const gets: string[] = [];
  const env = {
    ENVIRONMENT: "staging", IKIMON_GIT_SHA: "b".repeat(40),
    ...(pinned ? { IKIMON_UI_MANIFEST_HASH: hash } : {}),
    ASSET_BUCKET: {
      async get(key: string) {
        gets.push(key);
        const body = objects.get(key);
        return body === undefined ? null : { body: new Response(body).body,
          httpMetadata: { contentType: "image/svg+xml" },
          checksums: { sha256: createHash("sha256").update(body).digest("hex") } };
      },
    },
    CORE_DB: { prepare() { throw new Error("static assets must not read the database"); } },
    OBS_DB: { prepare() { throw new Error("static assets must not read the database"); } },
  };
  const read = (path = "/assets/brand/zukan-symbol.svg") => worker.fetch(
    new Request(`https://staging.zukan.earth${path}`), env, { waitUntil() {} });
  return { objects, gets, read };
}

test("a pinned release asset needs exactly one manifest read and one object read", async () => {
  const f = fixture();
  const response = await f.read();
  assert.equal(response.status, 200);
  assert.equal(await response.text(), bytes);
  assert.deepEqual(f.gets, [`${prefix}/manifest.json`, `${prefix}/${relative}`]);
});

test("an unpinned release adds only the current-pointer read", async () => {
  const f = fixture(false);
  assert.equal((await f.read()).status, 200);
  assert.deepEqual(f.gets, ["original-ui/current/staging.json", `${prefix}/manifest.json`, `${prefix}/${relative}`]);
});

test("selectively reused assets retain their original manifest binding", async () => {
  const f = fixture();
  const oldPrefix = `original-ui/versions/${"c".repeat(64)}`;
  f.objects.set(`${prefix}/manifest.json`, JSON.stringify({ items: [{ key: relative, sha256: digest, version_prefix: oldPrefix }] }));
  f.objects.set(`${oldPrefix}/${relative}`, bytes);
  f.objects.set(`${oldPrefix}/manifest.json`, JSON.stringify({ items: [{ key: relative, sha256: digest }] }));
  assert.equal(await (await f.read()).text(), bytes);
  assert.deepEqual(f.gets, [`${prefix}/manifest.json`, `${oldPrefix}/${relative}`, `${oldPrefix}/manifest.json`]);
});

test("reads are not cached across requests or releases", async () => {
  const f = fixture();
  assert.equal((await f.read()).status, 200);
  f.objects.delete(`${prefix}/${relative}`);
  assert.equal((await f.read()).status, 404);
  assert.deepEqual(f.gets, [`${prefix}/manifest.json`, `${prefix}/${relative}`, `${prefix}/manifest.json`, `${prefix}/${relative}`]);
});

test("Learn admission still fails closed on missing or malformed manifests", async () => {
  for (const manifest of [undefined, "{", JSON.stringify({ items: [] })]) {
    const f = fixture();
    if (manifest === undefined) f.objects.delete(`${prefix}/manifest.json`);
    else f.objects.set(`${prefix}/manifest.json`, manifest);
    const key = "html/ja/learn/field-loop.html";
    f.objects.set(`${prefix}/${key}`, "<h1>This unlisted article must stay unavailable</h1>");
    const response = await f.read("/ja/learn/field-loop");
    assert.equal(response.status, 404);
    assert.doesNotMatch(await response.text(), /This unlisted article/);
    assert.ok(!f.gets.includes(`${prefix}/${key}`));
  }
});
