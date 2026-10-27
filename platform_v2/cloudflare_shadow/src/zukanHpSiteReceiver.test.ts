import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { handleZukanHpSiteReceiver, ZUKAN_HP_CSS, ZUKAN_HP_CSS_SHA256 } from "./zukanHpSiteReceiver";
import publicPresentationEntry from "./publicPresentationEntry";

const nowMs = Date.parse("2026-10-27T00:00:00.000Z");
const timestamp = String(nowMs / 1000);
const secret = "fixture-hmac-secret";
const route = "/api/v1/integrations/nocosil/sites";
const environment = "staging";
const audience = "https://staging.zukan.earth";
const scope = { workspaceId: "workspace_fixture", securityDomainId: "domain_fixture", domainKind: "organization" };
const scopeDigest = createHash("sha256").update(JSON.stringify([scope.workspaceId, scope.securityDomainId, scope.domainKind])).digest("hex");
const siteId = "forest-guide";
const publicationId = "hp_" + createHash("sha256").update(JSON.stringify(["nocosil", environment, scopeDigest, siteId])).digest("hex");
const publicUrl = `${audience}/sites/${publicationId}/`;
const siteCss = ":root{color-scheme:light}body{margin:0;font-family:system-ui,-apple-system,'Hiragino Sans',sans-serif;line-height:1.75;color:#1d1d1f;background:#fff}main{max-width:760px;margin:0 auto;padding:16px}h1{font-size:1.8rem;line-height:1.3}h2{font-size:1.4rem}h3{font-size:1.15rem}p{margin:1em 0}img{max-width:100%;height:auto}figure{margin:1.5rem 0}a{color:#2358a8}";
const cssSha256 = "bd3bf0dcf29310061fc72bd477d9a0cc54da9784715f5cf0d3dbac931649bbe4";
const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>地域の場所</title><meta name="description" content="地域の紹介です。"><link rel="canonical" href="${publicUrl}"><meta property="og:type" content="website"><meta property="og:locale" content="ja_JP"><meta property="og:title" content="地域の場所"><meta property="og:description" content="地域の紹介です。"><meta property="og:url" content="${publicUrl}"><meta property="og:image" content="${publicUrl}og-image.svg"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="地域の場所"><meta name="twitter:description" content="地域の紹介です。"><meta name="twitter:image" content="${publicUrl}og-image.svg"><link rel="stylesheet" href="assets/site.css"></head><body><main data-site-id="${siteId}" data-site-version="v1.0+1"><header><h1>地域の場所</h1></header><section><p data-component-id="intro.a">地域の紹介です。</p></section></main></body></html>`;
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const sourceDigest = sha("fixture source evidence");
const files = [
  { path: "index.html", contentType: "text/html; charset=utf-8", body: html, sha256: sha(html) },
  { path: "assets/site.css", contentType: "text/css; charset=utf-8", body: siteCss, sha256: sha(siteCss) },
];
const editionId = "hp_" + sha(JSON.stringify({ siteId, draftRevisionId: "draft_fixture_1", title: "地域の場所", sourceDigest, files }));
const edition = {
  schema: "nocosil.hp-static-edition/v1", siteId, editionId, draftRevisionId: "draft_fixture_1",
  title: "地域の場所", sourceDigest, files,
  pages: [{ path: "/", file: "index.html" }], forms: { submissionWebhook: "", forms: [] },
};

function fixture(t: TestContext) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../migrations/core/0024_nocosil_hp_sites.sql", import.meta.url), "utf8"));
  t.after(() => sqlite.close());
  let successfulWrites = 0;
  const db = {
    prepare(sql: string) {
      const statement = sqlite.prepare(sql);
      const query = (values: SQLInputValue[] = []): any => ({
        bind: (...bound: SQLInputValue[]) => query(bound),
        first: async <T>() => (statement.get(...values) ?? null) as T | null,
        all: async <T>() => ({ results: statement.all(...values) as T[] }),
        run: async () => {
          const changes = Number(statement.run(...values).changes);
          successfulWrites += changes;
          return { meta: { changes } };
        },
      });
      return query();
    },
  };
  return { sqlite, getSuccessfulWrites: () => successfulWrites, env: { CORE_DB: db, NOCOSIL_INTEGRATION_HMAC_SECRET: secret, ENVIRONMENT: environment } };
}

function payload(action: "publish" | "takedown" | "status" = "publish", options: {
  operationId?: string; expectedOperationId?: string | null; edition?: unknown; scopeDigest?: string;
  publicationId?: string; environment?: string; audience?: string; actorDigest?: string;
} = {}) {
  const common = {
    schema: "nocosil.hp-zukan-handoff/v2", action,
    environment: options.environment ?? environment, audience: options.audience ?? audience,
    scopeDigest: options.scopeDigest ?? scopeDigest, siteId,
    publicationId: options.publicationId ?? publicationId,
  };
  if (action === "status") return common;
  return {
    ...common, operationId: options.operationId ?? "op_1",
    expectedOperationId: options.expectedOperationId === undefined ? null : options.expectedOperationId,
    issuedAt: "2026-10-26T23:59:00.000Z", actorDigest: options.actorDigest ?? sha(JSON.stringify(["actor_fixture", "membership_fixture"])),
    verifiedAt: "2026-10-26T23:59:30.000Z",
    ...(action === "publish" ? { edition: options.edition ?? edition } : {}),
  };
}

function signedRequest(value: unknown = payload(), options: { ts?: string; signingSecret?: string; raw?: string } = {}) {
  const body = options.raw ?? JSON.stringify(value);
  const ts = options.ts ?? timestamp;
  const signature = createHmac("sha256", options.signingSecret ?? secret).update(`${ts}.${body}`).digest("hex");
  return new Request(new URL(route, "https://zukan.earth"), { method: "POST", body, headers: {
    "content-type": "application/json", "x-nocosil-timestamp": ts, "x-nocosil-signature": "v1=" + signature,
  } });
}
async function receive(request: Request, env: any, at = nowMs) { return handleZukanHpSiteReceiver(request, env, at); }
async function throughPublicEntry(request: Request, env: any) {
  return publicPresentationEntry.fetch(request, env, { waitUntil() {} });
}
async function expectError(request: Request, env: any, status: number, code: string) {
  const response = await receive(request, env);
  assert.equal(response.status, status);
  assert.deepEqual(await response.json(), { schema: "zukan.hp-site-result/v1", error: code });
}
async function result(response: Response) { return await response.json() as Record<string, any>; }
const publishRequest = (operationId = "op_1", expectedOperationId: string | null = null, editionValue: unknown = edition) =>
  signedRequest(payload("publish", { operationId, expectedOperationId, edition: editionValue }));
const takedownRequest = (operationId = "op_2", expectedOperationId: string | null = "op_1") =>
  signedRequest(payload("takedown", { operationId, expectedOperationId }));
const statusRequest = () => signedRequest(payload("status"));
function editionForHtml(pageHtml: string, draftRevisionId: string) {
  const changedFiles = [{ ...files[0]!, body: pageHtml, sha256: sha(pageHtml) }, files[1]!];
  const changedEditionId = "hp_" + sha(JSON.stringify({ siteId, draftRevisionId, title: "地域の場所", sourceDigest, files: changedFiles }));
  return { ...edition, draftRevisionId, editionId: changedEditionId, files: changedFiles };
}

test("sender static edition publishes the exact HTML and CSS bytes at one stable URL", async t => {
  const { env } = fixture(t);
  assert.equal(ZUKAN_HP_CSS, siteCss);
  assert.equal(ZUKAN_HP_CSS_SHA256, cssSha256);
  assert.equal(files[1]!.sha256, cssSha256);
  const response = await throughPublicEntry(signedRequest(payload(), { ts: String(Math.floor(Date.now() / 1000)) }), env);
  assert.equal(response.status, 200);
  const data = await result(response);
  assert.equal(data.schema, "zukan.hp-site-result/v1");
  assert.equal(data.publicationId, publicationId);
  assert.equal(data.scopeDigest, scopeDigest);
  assert.equal(data.siteId, siteId);
  assert.equal(data.status, "published");
  assert.equal(data.lastOperationId, "op_1");
  assert.equal(data.activeEditionId, editionId);
  assert.equal(data.htmlSha256, files[0]!.sha256);
  assert.equal(data.cssSha256, files[1]!.sha256);
  assert.equal(data.publicUrl, publicUrl);

  const htmlResponse = await throughPublicEntry(new Request(publicUrl), env);
  assert.equal(htmlResponse.status, 200);
  assert.equal(htmlResponse.headers.get("content-type"), "text/html; charset=utf-8");
  assert.equal(htmlResponse.headers.get("cache-control"), "no-store");
  assert.equal(htmlResponse.headers.get("x-robots-tag"), "noindex, nofollow");
  assert.equal(htmlResponse.headers.get("x-content-type-options"), "nosniff");
  assert.equal(htmlResponse.headers.get("referrer-policy"), "no-referrer");
  for (const rule of ["sandbox allow-same-origin", "default-src 'none'", "style-src 'self'", "script-src 'none'", "img-src 'none'", "connect-src 'none'", "form-action 'none'", "base-uri 'none'", "frame-ancestors 'none'"]) {
    assert.ok((htmlResponse.headers.get("content-security-policy") ?? "").includes(rule));
  }
  assert.equal(await htmlResponse.text(), html);

  const cssResponse = await throughPublicEntry(new Request(publicUrl + "assets/site.css"), env);
  assert.equal(cssResponse.status, 200);
  assert.equal(cssResponse.headers.get("content-type"), "text/css; charset=utf-8");
  assert.equal(cssResponse.headers.get("cache-control"), "no-store");
  assert.equal(cssResponse.headers.get("x-robots-tag"), "noindex, nofollow");
  assert.equal(await cssResponse.text(), siteCss);
  // The sender's HTML is preserved byte-for-byte; its relative link resolves beneath the publication path.
  assert.equal(new URL("assets/site.css", publicUrl).href, publicUrl + "assets/site.css");
  assert.equal(html.includes('href="assets/site.css"'), true);

  const head = await throughPublicEntry(new Request(publicUrl, { method: "HEAD" }), env);
  assert.equal(head.status, 200);
  assert.equal(head.headers.get("content-type"), "text/html; charset=utf-8");
  assert.equal(await head.text(), "");
  const cssHead = await throughPublicEntry(new Request(publicUrl + "assets/site.css", { method: "HEAD" }), env);
  assert.equal(cssHead.status, 200);
  assert.equal(await cssHead.text(), "");
});

test("publishing a new edition updates the same URL and serves the new bytes", async t => {
  const { env } = fixture(t);
  assert.equal((await receive(publishRequest(), env)).status, 200);
  const nextHtml = html.replace("地域の紹介です。", "更新された紹介です。");
  const nextEdition = editionForHtml(nextHtml, "draft_fixture_2");
  const nextEditionId = nextEdition.editionId;
  const update = await receive(publishRequest("op_2", "op_1", nextEdition), env);
  assert.equal(update.status, 200);
  const data = await result(update);
  assert.equal(data.publicUrl, publicUrl);
  assert.equal(data.activeEditionId, nextEditionId);
  assert.equal(data.htmlSha256, sha(nextHtml));
  assert.equal(await (await receive(new Request(publicUrl), env)).text(), nextHtml);
});

test("identical operation replay returns the same receipt and causes no second write", async t => {
  const { env, sqlite, getSuccessfulWrites } = fixture(t);
  const first = await receive(publishRequest(), env);
  const before = sqlite.prepare("SELECT updated_at, request_digest FROM nocosil_hp_sites").get();
  const replay = await receive(publishRequest(), env, nowMs + 1000);
  assert.equal(await first.text(), await replay.text());
  assert.deepEqual(sqlite.prepare("SELECT updated_at, request_digest FROM nocosil_hp_sites").get(), before);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM nocosil_hp_sites").get()?.count, 1);
  const reorder = (value: any): any => Array.isArray(value) ? value.map(reorder) : value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reorder(item)])) : value;
  assert.equal((await receive(signedRequest(reorder(payload())), env)).status, 200);
  assert.equal(getSuccessfulWrites(), 1);
  await expectError(signedRequest(payload("publish", { actorDigest: "d".repeat(64) })), env, 409, "operation_conflict");
});

test("takedown removes both public files and an old initial publish cannot resurrect the tombstone", async t => {
  const { env } = fixture(t);
  assert.equal((await receive(publishRequest(), env)).status, 200);
  const takedown = await receive(takedownRequest(), env);
  assert.equal(takedown.status, 200);
  assert.equal((await result(takedown)).status, "retracted");
  assert.equal((await result(await receive(statusRequest(), env))).status, "retracted");
  for (const url of [publicUrl, publicUrl + "assets/site.css"]) assert.equal((await receive(new Request(url), env)).status, 410);
  await expectError(publishRequest("op_stale", null), env, 409, "stale_operation");
  assert.equal((await result(await receive(statusRequest(), env))).status, "retracted");
});

test("status recovers a lost takedown receipt without mutation and exposes no retracted edition", async t => {
  const { env, getSuccessfulWrites, sqlite } = fixture(t);
  assert.equal((await receive(publishRequest(), env)).status, 200);

  await receive(takedownRequest("op_takedown_lost", "op_1"), env); // Deliberately discard the successful response.
  const writesAfterTakedown = getSuccessfulWrites();
  assert.equal(writesAfterTakedown, 2);

  const status = await receive(statusRequest(), env);
  assert.equal(status.status, 200);
  assert.deepEqual(await result(status), {
    schema: "zukan.hp-site-result/v1",
    publicationId,
    scopeDigest,
    siteId,
    status: "retracted",
    lastOperationId: "op_takedown_lost",
    activeEditionId: null,
    htmlSha256: null,
    cssSha256: null,
    publicUrl: null,
    updatedAt: new Date(nowMs).toISOString(),
  });
  assert.equal(getSuccessfulWrites(), writesAfterTakedown);

  for (const mutationFields of [
    { operationId: "op_status" },
    { expectedOperationId: "op_takedown_lost" },
    { issuedAt: "2026-10-26T23:59:00.000Z" },
    { actorDigest: sha("status actor") },
    { verifiedAt: "2026-10-26T23:59:30.000Z" },
    { edition },
  ]) {
    await expectError(signedRequest({ ...payload("status"), ...mutationFields }), env, 400, "invalid_payload");
  }
  assert.equal(getSuccessfulWrites(), writesAfterTakedown);
  assert.equal(sqlite.prepare("SELECT state, last_operation_id FROM nocosil_hp_sites").get()?.last_operation_id, "op_takedown_lost");

  for (const url of [publicUrl, publicUrl + "assets/site.css"]) {
    assert.equal((await throughPublicEntry(new Request(url), env)).status, 410);
  }
  assert.equal(getSuccessfulWrites(), writesAfterTakedown);
});

test("an initial takedown creates a tombstone that rejects a late first publish", async t => {
  const { env, sqlite } = fixture(t);
  const initialTakedown = await receive(takedownRequest("op_tombstone", null), env);
  assert.equal(initialTakedown.status, 200);
  assert.equal((await result(initialTakedown)).status, "retracted");
  assert.equal(sqlite.prepare("SELECT state, last_operation_id FROM nocosil_hp_sites").get()?.state, "retracted");
  for (const url of [publicUrl, publicUrl + "assets/site.css"]) assert.equal((await receive(new Request(url), env)).status, 410);
  await expectError(publishRequest("op_late", null), env, 409, "stale_operation");
});

test("concurrent updates against the same head have exactly one winner", async t => {
  const { env } = fixture(t);
  await receive(publishRequest(), env);
  const makeEdition = (label: string, draftRevisionId: string) => editionForHtml(html.replace("地域の紹介です。", label), draftRevisionId);
  const responses = await Promise.all([
    receive(publishRequest("op_a", "op_1", makeEdition("Aです。", "draft_a")), env),
    receive(publishRequest("op_b", "op_1", makeEdition("Bです。", "draft_b")), env),
  ]);
  assert.equal(responses.filter(response => response.status === 200).length, 1);
  assert.equal(responses.filter(response => response.status === 409).length, 1);
  const final = await result(await receive(statusRequest(), env));
  assert.ok(["op_a", "op_b"].includes(final.lastOperationId));
});

test("concurrent identical operation replay persists one mutation and returns success to both callers", async t => {
  const { env, getSuccessfulWrites, sqlite } = fixture(t);
  const requests = [publishRequest("op_same"), publishRequest("op_same")];
  const responses = await Promise.all(requests.map(request => receive(request, env)));
  assert.deepEqual(responses.map(response => response.status), [200, 200]);
  assert.equal(getSuccessfulWrites(), 1);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM nocosil_hp_sites").get()?.count, 1);
});

test("wrong HMAC, environment, audience, scope digest, publication ID, edition digest and unsafe HTML are rejected", async t => {
  const { env } = fixture(t);
  await expectError(signedRequest(payload(), { signingSecret: "wrong-secret" }), env, 401, "invalid_signature");
  await expectError(signedRequest(payload(), { ts: String(Math.floor(nowMs / 1000) - 301) }), env, 401, "invalid_signature");
  await expectError(signedRequest(payload("publish", { environment: "production" })), env, 400, "invalid_audience");
  await expectError(signedRequest(payload("publish", { audience: "https://evil.example" })), env, 400, "invalid_audience");
  await expectError(signedRequest(payload("publish", { scopeDigest: "c".repeat(64) })), env, 400, "invalid_publication_id");
  await expectError(signedRequest(payload("publish", { publicationId: "hp_" + "0".repeat(64) })), env, 400, "invalid_publication_id");
  await expectError(signedRequest({ ...payload(), scopeDigest: [scopeDigest] }), env, 400, "invalid_payload");
  await expectError(signedRequest({ ...payload(), issuedAt: "2026-02-30T00:00:00.000Z" }), env, 400, "invalid_operation");
  await expectError(signedRequest({ ...payload(), expectedOperationId: "" }), env, 400, "invalid_operation");
  const hashMismatch = { ...edition, files: [{ ...files[0]!, sha256: "0".repeat(64) }, files[1]!] };
  await expectError(publishRequest("op_hash", null, hashMismatch), env, 400, "invalid_edition");
  const changedCss = siteCss + "body{display:none}";
  const cssMismatchFiles = [files[0]!, { ...files[1]!, body: changedCss, sha256: sha(changedCss) }];
  const cssMismatch = { ...edition, files: cssMismatchFiles,
    editionId: "hp_" + sha(JSON.stringify({ siteId, draftRevisionId: edition.draftRevisionId, title: edition.title, sourceDigest, files: cssMismatchFiles })) };
  await expectError(publishRequest("op_css", null, cssMismatch), env, 400, "invalid_edition");
  const unsafe = { ...edition, files: [{ ...files[0]!, body: html.replace("<section>", "<script>alert(1)</script><section>"), sha256: "" }, files[1]!] };
  unsafe.files[0]!.sha256 = sha(unsafe.files[0]!.body);
  unsafe.editionId = "hp_" + sha(JSON.stringify({ siteId, draftRevisionId: unsafe.draftRevisionId, title: unsafe.title, sourceDigest, files: unsafe.files }));
  await expectError(publishRequest("op_unsafe", null, unsafe), env, 400, "invalid_edition");
  const metaInjection = editionForHtml(html.replace('content="地域の紹介です。"', 'content="x" onload="alert(1)"'), "draft_meta_injection");
  await expectError(publishRequest("op_meta", null, metaInjection), env, 400, "invalid_edition");
  const titleInjection = editionForHtml(html.replace("<title>地域の場所</title>", "<title>地域</title><script>alert(1)</script><title></title>"), "draft_title_injection");
  await expectError(publishRequest("op_title", null, titleInjection), env, 400, "invalid_edition");
  const malformed = editionForHtml(html.replace("</section>", ""), "draft_malformed");
  await expectError(publishRequest("op_malformed", null, malformed), env, 400, "invalid_edition");
  const unsupportedPages = [
    html.replace("<section>", '<meta http-equiv="refresh" content="0;url=https://evil.example"><section>'),
    html.replace("<section>", '<section><img src="https://evil.example/a">'),
    html.replace("<section>", '<section><a href="https://evil.example">外部</a>'),
    html.replace("<section>", '<section><form action="/x"></form>'),
    html.replace('<link rel="stylesheet" href="assets/site.css">', ""),
    html.replace('<meta charset="utf-8">', '<meta charset="utf-8"><meta charset="utf-8">'),
    html.replace("<title>地域の場所</title>", "<title><h1>nested</h1></title>"),
  ];
  for (const [index, page] of unsupportedPages.entries()) {
    await expectError(publishRequest(`op_unsupported_${index}`, null, editionForHtml(page, `draft_unsupported_${index}`)), env, 400, "invalid_edition");
  }
});

test("retry and status recover a committed operation after its first response is dropped", async t => {
  const { env, sqlite } = fixture(t);
  await receive(publishRequest("op_lost"), env); // Deliberately discard the successful response.
  const retry = await receive(publishRequest("op_lost"), env);
  assert.equal(retry.status, 200);
  const status = await receive(statusRequest(), env);
  assert.equal(status.status, 200);
  const data = await result(status);
  assert.equal(data.status, "published");
  assert.equal(data.lastOperationId, "op_lost");
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM nocosil_hp_sites").get()?.count, 1);
});

test("oversized input and storage failure never produce a success response", async t => {
  const { env } = fixture(t);
  const oversized = JSON.stringify(payload("publish", { edition: { ...edition, files: [{ ...files[0]!, body: html + " ".repeat(66_000) }, files[1]!] } }));
  const signature = createHmac("sha256", secret).update(`${timestamp}.${oversized}`).digest("hex");
  const request = new Request(new URL(route, "https://zukan.earth"), { method: "POST", body: oversized, headers: {
    "content-type": "application/json", "x-nocosil-timestamp": timestamp, "x-nocosil-signature": "v1=" + signature,
  } });
  await expectError(request, env, 413, "body_too_large");
  const broken = { ...env, CORE_DB: { prepare() { throw new Error("fixture storage failure"); } } };
  await expectError(publishRequest(), broken, 503, "storage_unavailable");
  await expectError(signedRequest(payload(), { signingSecret: "wrong-secret" }), broken, 401, "invalid_signature");
  const lostReadback = { ...env, CORE_DB: { prepare(sql: string) {
    return { bind() { return this; }, first: async () => null, run: async () => ({ meta: { changes: sql.startsWith("INSERT") ? 1 : 0 } }) };
  } } };
  await expectError(publishRequest(), lostReadback, 503, "readback_failed");
});

test("mismatched stored binding and corrupted read-back cannot report success", async t => {
  const { env, sqlite } = fixture(t);
  assert.equal((await receive(publishRequest(), env)).status, 200);
  sqlite.prepare("UPDATE nocosil_hp_sites SET scope_digest = ?").run("f".repeat(64));
  await expectError(statusRequest(), env, 409, "binding_conflict");

  const changed = fixture(t);
  assert.equal((await receive(publishRequest(), changed.env)).status, 200);
  changed.sqlite.prepare("UPDATE nocosil_hp_sites SET html = ?").run(html.replace("地域の紹介です。", "異なる説明です。"));
  await expectError(publishRequest(), changed.env, 503, "readback_failed");

  const fresh = fixture(t);
  const faulty = { ...fresh.env, CORE_DB: { prepare(sql: string) {
    const statement = fresh.sqlite.prepare(sql);
    let values: SQLInputValue[] = [];
    return {
      bind(...bound: SQLInputValue[]) { values = bound; return this; },
      async first() { const row = statement.get(...values); return row ? { ...row, html: String(row.html) + "<script>bad</script>" } : null; },
      async run() { return { success: true, meta: { changes: Number(statement.run(...values).changes) } }; },
    };
  } } };
  await expectError(publishRequest(), faulty, 503, "readback_failed");
});
