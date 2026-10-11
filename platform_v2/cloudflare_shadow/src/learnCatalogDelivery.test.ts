import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { buildApp } from "../../src/app.js";
import { getShortCopy, renderLongformPage } from "../../src/content/index.js";
import { buildLearnCatalog } from "../../src/learn/catalog.js";
import { listLearnMaterializationPaths } from "../../src/learn/materialization.js";
import { listMarketingPages, type SitePageDefinition } from "../../src/siteMap.js";
import publicPresentationEntry from "./publicPresentationEntry";

// These fixtures stay in memory. They use the actual materialization projection,
// canonical route renderer and final Worker entry, without a database or R2 write.
const sourceSha = "a".repeat(40);
const manifestHash = "b".repeat(64);
const versionPrefix = `original-ui/versions/${manifestHash}`;
const manifestKey = `${versionPrefix}/manifest.json`;
const origins = {
  staging: "https://ikimon-life-cloudflare-staging.yamaki0102.workers.dev",
  production: "https://zukan.earth",
};
const sha256 = (body: string) => createHash("sha256").update(body).digest("hex");
const htmlKey = (path: string) => `html/${path.slice(1)}.html`;

type FixtureObject = { body: string; contentType: string };

class ReadOnlyBucket {
  readonly objects = new Map<string, FixtureObject>();
  readonly gets: string[] = [];
  writes = 0;

  async get(key: string) {
    this.gets.push(key);
    const object = this.objects.get(key);
    return object ? {
      key,
      body: new Response(object.body).body,
      httpMetadata: { contentType: object.contentType },
      checksums: { sha256: sha256(object.body) },
    } : null;
  }

  async put() {
    this.writes += 1;
    throw new Error("Learn delivery must not write R2");
  }

  async delete() {
    this.writes += 1;
    throw new Error("Learn delivery must not delete R2 objects");
  }
}

async function renderCanonicalPaths(): Promise<Map<string, string>> {
  const app = buildApp();
  app.log.level = "silent";
  const rendered = new Map<string, string>();
  try {
    for (const path of listLearnMaterializationPaths()) {
      const response = await app.inject({
        method: "GET", url: path,
        headers: { host: "zukan.earth", "x-forwarded-proto": "https", accept: "text/html" },
      });
      assert.equal(response.statusCode, 200, `canonical renderer: ${path}`);
      rendered.set(path, response.body);
    }
  } finally {
    await app.close();
  }
  return rendered;
}

const renderedCanonicalPaths = renderCanonicalPaths();

async function fixture() {
  const rendered = new Map(await renderedCanonicalPaths);
  const bucket = new ReadOnlyBucket();
  const items: { key: string; sha256: string; version_prefix: string }[] = [];
  for (const [path, body] of rendered) {
    const key = htmlKey(path);
    items.push({ key, sha256: sha256(body), version_prefix: versionPrefix });
    bucket.objects.set(`${versionPrefix}/${key}`, { body, contentType: "text/html; charset=utf-8" });
  }
  const saveManifest = () => bucket.objects.set(manifestKey, {
    body: JSON.stringify({ items }), contentType: "application/json",
  });
  saveManifest();
  let databaseReads = 0;
  const db = { prepare() { databaseReads += 1; throw new Error("Anonymous Learn delivery must not query a database"); } };
  const env = {
    ENVIRONMENT: "staging", ASSET_BUCKET: bucket, CORE_DB: db, OBS_DB: db,
    IKIMON_GIT_SHA: sourceSha, IKIMON_WORKER_VERSION: "learn-delivery-local-fixture",
    IKIMON_UI_MANIFEST_HASH: manifestHash,
  };
  return { rendered, bucket, items, saveManifest, env, databaseReads: () => databaseReads };
}

function catalogueData(html: string): unknown {
  const json = html.match(/<script\b[^>]*\bdata-learn-data[^>]*>([\s\S]*?)<\/script>/u)?.[1];
  assert.ok(json, "the delivered Japanese hub retains its search index");
  return JSON.parse(json);
}

async function read(path: string, env: Awaited<ReturnType<typeof fixture>>["env"], method = "GET") {
  const origin = origins[env.ENVIRONMENT as keyof typeof origins];
  return publicPresentationEntry.fetch(new Request(`${origin}${path}`, { method }), env, { waitUntil() {} });
}

test("the actual public Worker serves the complete Learn materialization projection with canonical, noindex and source integrity", async (t) => {
  const f = await fixture();
  const catalogue = buildLearnCatalog();
  const paths = listLearnMaterializationPaths();
  assert.equal(paths.length, catalogue.length + 4);
  assert.equal(new Set(paths).size, paths.length);
  assert.ok(catalogue.length > 20);
  for (const environment of ["production", "staging"] as const) {
    const env = { ...f.env, ENVIRONMENT: environment };
    for (const path of paths) {
      const response = await read(path, env);
      const body = await response.text();
      assert.equal(response.status, 200, `${environment} ${path}`);
      assert.match(response.headers.get("content-type") ?? "", /text\/html/u);
      assert.equal(response.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-html");
      assert.equal(response.headers.get("x-ikimon-deploy-sha"), sourceSha);
      assert.equal(response.headers.get("x-ikimon-worker-version"), env.IKIMON_WORKER_VERSION);
      assert.equal(response.headers.get("x-ikimon-cloudflare-materialized-sha256"), sha256(f.rendered.get(path)!));
      const isJapanese = path.startsWith("/ja/");
      const canonical = body.match(/<link\s+rel="canonical"\s+href="([^"]+)"/u)?.[1];
      assert.equal(canonical, `https://zukan.earth${isJapanese ? path : "/ja/learn"}`, path);
      const robots = `${response.headers.get("x-robots-tag") ?? ""} ${body.match(/<meta\s+name="robots"\s+content="([^"]+)"/u)?.[1] ?? ""}`;
      assert.equal(/noindex/iu.test(robots), environment === "staging" || !isJapanese, `${environment} ${path}`);
      assert.match(body, /<h1\b/u);
      if (path === "/ja/learn") {
        assert.deepEqual(catalogueData(body), catalogue);
        assert.equal([...body.matchAll(/data-learn-entry=/gu)].length, catalogue.length);
        assert.match(body, /<button\b[^>]*\bdata-desktop-side-nav-toggle(?:\s|=|>)[^>]*>/u, "the shared desktop navigation remains available");
        assert.match(body, /class="site-mobile-menu"/u, "the shared mobile menu remains available");
        assert.doesNotMatch(body, /data-cloudflare-header-menu/u, "the Worker does not add a duplicate header menu to the shared shell");
        for (const entry of catalogue) assert.ok(body.includes(`href="/ja${entry.path}"`), entry.path);
      } else if (!isJapanese) {
        assert.doesNotMatch(body, /data-learn-catalog(?:[=>\s])/u);
      }
    }
  }
  assert.equal(f.databaseReads(), 0);
  assert.equal(f.bucket.writes, 0);
  t.diagnostic(JSON.stringify({ scope: "local final-Worker/R2 fixture", articles: catalogue.length, materializedPaths: paths.length, environments: 2, resolvedResponses: paths.length * 2, databaseReads: 0, r2Writes: 0 }));
});

test("native GET, HEAD and search URLs retain the same catalogue, nonce-bound scripts and source hash", async () => {
  const f = await fixture();
  const nonces = new Set<string>();
  for (const query of ["", "?q=%E7%94%9F%E7%89%A9%E5%A4%9A%E6%A7%98%E6%80%A7&kind=term", "?q=%3Cscript%3E&kind=reading"]) {
    const response = await read(`/ja/learn${query}`, f.env);
    const body = await response.text();
    assert.equal(response.status, 200);
    assert.deepEqual(catalogueData(body), buildLearnCatalog());
    assert.match(body, /readState\(window\.location\.search\)/u, "the delivered script restores query conditions from the actual browser URL");
    assert.match(body, /<details[^>]+data-learn-results/u, "ordinary article links remain available without JavaScript");
    const nonce = response.headers.get("content-security-policy")?.match(/'nonce-([^']+)'/u)?.[1];
    assert.ok(nonce);
    nonces.add(nonce);
    for (const [script] of body.matchAll(/<script\b[^>]*>/gu)) assert.ok(script.includes(`nonce="${nonce}"`), script);
    assert.equal(response.headers.get("x-ikimon-cloudflare-materialized-sha256"), sha256(f.rendered.get("/ja/learn")!));
    assert.match(response.headers.get("cache-control") ?? "", /no-store/u);
  }
  assert.equal(nonces.size, 3, "each native response gets its own CSP nonce");
  const head = await read("/ja/learn?q=TNFD&kind=term", f.env, "HEAD");
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  assert.equal(head.headers.get("x-ikimon-cloudflare-materialized-sha256"), sha256(f.rendered.get("/ja/learn")!));
  assert.ok(head.headers.get("content-security-policy")?.includes("'nonce-"));
  assert.ok(f.bucket.gets.every((key) => !/[?&]/u.test(key)), "query URLs must not require separately materialized objects");
});

test("a future public registration flows through the content projection and native Worker without another static route entry", async () => {
  const f = await fixture();
  const template = listMarketingPages().find((page) => page.path === "/learn/field-loop")!;
  const path = "/learn/future-catalog-delivery-fixture";
  const page: SitePageDefinition = {
    ...template, path, title: { ...template.title, ja: "追加登録の試験記事" },
    marketing: { ...template.marketing!, pageKey: "learnDeliveryFixture" },
  };
  const source = {
    pages: [...listMarketingPages(), page],
    readMetadata: (key: string) => key === "learnDeliveryFixture"
      ? { title: "追加登録の試験記事", heading: "試験記事", lead: "公開登録経路のローカル試験", bodyPageId: "learnDeliveryFixture" }
      : getShortCopy<unknown>("ja", "public", `marketing.pages.${key}`),
    renderContent: (key: string) => key === "learnDeliveryFixture" ? "<h1>追加登録の試験記事</h1>" : renderLongformPage("ja", key),
  };
  assert.ok(listLearnMaterializationPaths(source).includes(`/ja${path}`));
  assert.equal(f.rendered.has(`/ja${path}`), false, "this is a local fixture, not an existing published article");
  const key = htmlKey(`/ja${path}`);
  const body = f.rendered.get("/ja/learn/field-loop")!.replaceAll("https://zukan.earth/ja/learn/field-loop", `https://zukan.earth/ja${path}`);
  f.items.push({ key, sha256: sha256(body), version_prefix: versionPrefix });
  f.bucket.objects.set(`${versionPrefix}/${key}`, { body, contentType: "text/html; charset=utf-8" });
  f.saveManifest();
  const response = await read(`/ja${path}`, f.env);
  assert.equal(response.status, 200);
  assert.ok((await response.text()).includes(`rel="canonical" href="https://zukan.earth/ja${path}"`));
  assert.equal(response.headers.get("x-ikimon-cloudflare-materialized-sha256"), sha256(body));
});

test("unlisted Learn objects and missing published objects return 404 through the final Worker entry", async () => {
  const f = await fixture();
  const unknown = "/ja/learn/unregistered-delivery-fixture";
  const unknownKey = `${versionPrefix}/${htmlKey(unknown)}`;
  f.bucket.objects.set(unknownKey, { body: "<h1>Unregistered object must stay unreadable</h1>", contentType: "text/html" });
  const unlisted = await read(unknown, f.env);
  assert.equal(unlisted.status, 404);
  assert.equal(f.bucket.gets.includes(unknownKey), false, "manifest rejection happens before the unlisted object's bytes are read");
  const missing = "/ja/learn/field-loop";
  f.bucket.objects.delete(`${versionPrefix}/${htmlKey(missing)}`);
  assert.equal((await read(missing, f.env)).status, 404);
});

test("missing or malformed version manifests cannot publish a Japanese Learn object", async (t) => {
  for (const [name, manifest] of [
    ["missing", undefined], ["invalid JSON", "{"], ["null", "null"],
    ["non-array items", '{"items":{}}'], ["unlisted", '{"items":[]}'],
  ] as const) {
    await t.test(name, async () => {
      const f = await fixture();
      if (manifest === undefined) f.bucket.objects.delete(manifestKey);
      else f.bucket.objects.set(manifestKey, { body: manifest, contentType: "application/json" });
      const response = await read("/ja/learn", f.env);
      assert.equal(response.status, 404);
      assert.equal(f.bucket.gets.includes(`${versionPrefix}/${htmlKey("/ja/learn")}`), false);
      assert.equal(f.databaseReads(), 0);
      assert.equal(f.bucket.writes, 0);
    });
  }
});

test("an unpinned legacy Learn object cannot bypass the current version manifest", async () => {
  const f = await fixture();
  const key = `original-ui/${htmlKey("/ja/learn")}`;
  f.bucket.objects.set(key, { body: f.rendered.get("/ja/learn")!, contentType: "text/html" });
  const env = { ...f.env, IKIMON_UI_MANIFEST_HASH: "" };
  assert.equal((await read("/ja/learn", env)).status, 404);
  assert.equal(f.bucket.gets.includes(key), false, "Learn does not use an unmanifested legacy fallback");
  f.bucket.objects.set("original-ui/current/staging.json", { body: JSON.stringify({ version_prefix: versionPrefix }), contentType: "application/json" });
  assert.equal((await read("/ja/learn", env)).status, 200, "the existing valid current pointer still supplies its registered Learn object");
  f.bucket.objects.set(manifestKey, { body: '{"items":[]}', contentType: "application/json" });
  assert.equal((await read("/ja/learn", env)).status, 404, "an unlisted current object cannot fall through to legacy bytes");
});
