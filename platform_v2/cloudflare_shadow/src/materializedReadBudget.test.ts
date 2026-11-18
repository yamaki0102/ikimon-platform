import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import worker from "./publicPresentationEntry";
import { ORIGINAL_UI_CACHE_TTL_MS } from "./originalUiVersionCache";

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
        return body === undefined ? null : { body: new Response(body).body, size: new TextEncoder().encode(body).byteLength,
          httpMetadata: { contentType: "image/svg+xml" },
          checksums: { sha256: createHash("sha256").update(body).digest("hex") } };
      },
    },
    CORE_DB: { prepare() { throw new Error("static assets must not read the database"); } },
    OBS_DB: { prepare() { throw new Error("static assets must not read the database"); } },
  };
  const read = (path = "/assets/brand/zukan-symbol.svg") => worker.fetch(
    new Request(`https://staging.zukan.earth${path}`), env, { waitUntil() {} });
  return { objects, gets, read, env };
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
  // The same-version object is read alongside the manifest and discarded once the manifest
  // binds the key to its original version.
  assert.deepEqual(f.gets, [`${prefix}/manifest.json`, `${prefix}/${relative}`, `${oldPrefix}/${relative}`, `${oldPrefix}/manifest.json`]);
});

test("the same-version object is read alongside the manifest, not after it", async () => {
  const f = fixture();
  let inFlight = 0;
  let maxInFlight = 0;
  const get = f.env.ASSET_BUCKET.get;
  f.env.ASSET_BUCKET.get = async (key: string) => {
    inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 5));
    try { return await get(key); } finally { inFlight--; }
  };
  assert.equal(await (await f.read()).text(), bytes);
  assert.equal(maxInFlight, 2);
});

function withClock<T>(run: (advance: (ms: number) => void) => Promise<T>): Promise<T> {
  const realNow = Date.now;
  let offset = 0;
  Date.now = () => realNow() + offset;
  return run((ms) => { offset += ms; }).finally(() => { Date.now = realNow; });
}

test("a verified release object is served from the isolate cache until the TTL expires", () => withClock(async (advance) => {
  const f = fixture();
  assert.equal((await f.read()).status, 200);
  const second = await f.read();
  assert.equal(second.status, 200);
  assert.equal(await second.text(), bytes);
  assert.deepEqual(f.gets, [`${prefix}/manifest.json`, `${prefix}/${relative}`]);
  // Withdrawing the object from R2 takes effect once the cached copy expires.
  f.objects.delete(`${prefix}/${relative}`);
  advance(ORIGINAL_UI_CACHE_TTL_MS - 1000);
  assert.equal((await f.read()).status, 200);
  advance(2000);
  assert.equal((await f.read()).status, 404);
  assert.deepEqual(f.gets.slice(2), [`${prefix}/manifest.json`, `${prefix}/${relative}`]);
}));

test("objects whose bytes do not match the manifest digest are never cached", async () => {
  const f = fixture();
  f.objects.set(`${prefix}/${relative}`, "<svg>tampered</svg>");
  assert.equal(await (await f.read()).text(), "<svg>tampered</svg>");
  assert.equal(await (await f.read()).text(), "<svg>tampered</svg>");
  assert.deepEqual(f.gets, [`${prefix}/manifest.json`, `${prefix}/${relative}`, `${prefix}/${relative}`]);
});

test("objects not listed in the manifest are read from R2 every time", async () => {
  const f = fixture();
  f.objects.set(`${prefix}/manifest.json`, JSON.stringify({ items: [] }));
  assert.equal((await f.read()).status, 200);
  assert.equal((await f.read()).status, 200);
  assert.deepEqual(f.gets, [`${prefix}/manifest.json`, `${prefix}/${relative}`, `${prefix}/${relative}`]);
});

test("a cached manifest still keeps unlisted Learn articles unavailable", async () => {
  const f = fixture();
  assert.equal((await f.read()).status, 200);
  const key = "html/ja/learn/field-loop.html";
  f.objects.set(`${prefix}/${key}`, "<h1>This unlisted article must stay unavailable</h1>");
  const response = await f.read("/ja/learn/field-loop");
  assert.equal(response.status, 404);
  assert.ok(!f.gets.includes(`${prefix}/${key}`));
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
