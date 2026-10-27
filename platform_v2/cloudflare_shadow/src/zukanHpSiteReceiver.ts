// Narrow receiver for the NOCOSIL -> ZUKAN static homepage handoff.
export interface ZukanHpD1Statement {
  bind(...values: unknown[]): ZukanHpD1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<{ success?: boolean; meta?: { changes?: number } }>;
}
export interface ZukanHpD1Database {
  prepare(query: string): ZukanHpD1Statement;
}
export interface ZukanHpReceiverEnv {
  CORE_DB: ZukanHpD1Database;
  NOCOSIL_INTEGRATION_HMAC_SECRET: string;
  ENVIRONMENT: string;
}

export type ZukanHpAction = "publish" | "takedown" | "status";
export const ZUKAN_HP_RECEIVER_PATH = "/api/v1/integrations/nocosil/sites";
export const ZUKAN_HP_CSS = ":root{color-scheme:light}body{margin:0;font-family:system-ui,-apple-system,'Hiragino Sans',sans-serif;line-height:1.75;color:#1d1d1f;background:#fff}main{max-width:760px;margin:0 auto;padding:16px}h1{font-size:1.8rem;line-height:1.3}h2{font-size:1.4rem}h3{font-size:1.15rem}p{margin:1em 0}img{max-width:100%;height:auto}figure{margin:1.5rem 0}a{color:#2358a8}";
export const ZUKAN_HP_CSS_SHA256 = "bd3bf0dcf29310061fc72bd477d9a0cc54da9784715f5cf0d3dbac931649bbe4";

const TABLE = "nocosil_hp_sites";
const MAX_BODY_BYTES = 64 * 1024;
const encoder = new TextEncoder();
type Row = {
  publication_id: string; scope_digest: string; site_id: string; last_operation_id: string | null;
  request_digest: string | null; edition_id: string | null; state: "published" | "retracted";
  html: string | null; css: string | null; updated_at: string;
};
type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const keysOnly = (v: Obj, keys: string[]) => Object.keys(v).every(k => keys.includes(k));
const hashPattern = /^[a-f0-9]{64}$/;
const hex = (buffer: ArrayBuffer) => Array.from(new Uint8Array(buffer), n => n.toString(16).padStart(2, "0")).join("");
const sha256Text = async (s: string) => hex(await crypto.subtle.digest("SHA-256", encoder.encode(s)));
const operationIdPattern = /^[A-Za-z0-9_-]{1,180}$/;
function validInstant(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value)) return false;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return false;
  const canonical = value.replace(/(?:\.(\d{1,3}))?Z$/, (_match, fraction: string | undefined) => `.${(fraction ?? "").padEnd(3, "0")}Z`);
  return new Date(time).toISOString() === canonical;
}
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isObj(value)) return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
  return JSON.stringify(value);
}

function originFor(env: ZukanHpReceiverEnv): string | null {
  if (env.ENVIRONMENT === "staging") return "https://staging.zukan.earth";
  if (env.ENVIRONMENT === "production") return "https://zukan.earth";
  return null;
}

function responseJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: {
    "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff",
  } });
}
function error(code: string, status: number): Response { return responseJson({ schema: "zukan.hp-site-result/v1", error: code }, status); }
async function result(row: Row | null, publicationId: string, scopeDigest: string, siteId: string, origin: string): Promise<Obj> {
  return {
    schema: "zukan.hp-site-result/v1", publicationId, scopeDigest, siteId,
    status: row?.state ?? "not_found", lastOperationId: row?.last_operation_id ?? null,
    activeEditionId: row?.state === "published" ? row.edition_id : null,
    htmlSha256: row?.state === "published" && row.html !== null ? await sha256Text(row.html) : null,
    cssSha256: row?.state === "published" && row.css !== null ? await sha256Text(row.css) : null,
    publicUrl: row?.state === "published" ? `${origin}/sites/${publicationId}/` : null,
    updatedAt: row?.updated_at ?? null,
  };
}

async function readBoundedBody(request: Request): Promise<Uint8Array | null> {
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) return null;
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

async function authenticate(request: Request, raw: Uint8Array, secret: string, now: number): Promise<boolean> {
  const timestamp = request.headers.get("X-NOCOSIL-Timestamp");
  const signature = request.headers.get("X-NOCOSIL-Signature");
  if (!timestamp || !/^\d{10}$/.test(timestamp) || !signature || !/^v1=[a-f0-9]{64}$/.test(signature)) return false;
  const seconds = Number(timestamp);
  if (!Number.isSafeInteger(seconds) || Math.abs(Math.floor(now / 1000) - seconds) > 300) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const content = new Uint8Array(encoder.encode(`${timestamp}.`).length + raw.length);
  content.set(encoder.encode(`${timestamp}.`)); content.set(raw, encoder.encode(`${timestamp}.`).length);
  const supplied = Uint8Array.from(signature.slice(3).match(/../g)!, pair => Number.parseInt(pair, 16));
  return crypto.subtle.verify("HMAC", key, supplied, content);
}

// Parse a deliberately small HTML language: known sender tags and attributes only,
// no active elements, form controls, arbitrary URLs, or unbalanced markup.
function safeSenderHtml(html: string, siteId: string, origin: string, publicationId: string): boolean {
  if ((html.match(/<!doctype html>/g) ?? []).length !== 1 || /<!--|<!ENTITY|<\?/i.test(html)) return false;
  const tokens = html.match(/<[^>]*>|[^<]+/g);
  if (!tokens || tokens.join("") !== html) return false;
  const allowedTags = new Set(["html", "head", "meta", "title", "link", "body", "main", "header", "section", "h1", "h2", "h3", "p"]);
  const voidTags = new Set(["meta", "link"]);
  const stack: string[] = [];
  const uniqueElements: Record<string, number> = { html: 0, head: 0, body: 0, main: 0, header: 0, section: 0, title: 0 };
  const seenMetadata = new Set<string>();
  const seenLinks = new Set<string>();
  let doctypeSeen = false;
  for (const token of tokens) {
    if (!token.startsWith("<")) {
      if (token.includes("]]>") || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(token) || !["title", "h1", "h2", "h3", "p"].includes(stack.at(-1) ?? "")) return false;
      continue;
    }
    if (token === "<!doctype html>") { if (doctypeSeen || stack.length !== 0) return false; doctypeSeen = true; continue; }
    const close = /^<\/([a-z][a-z0-9]*)\s*>$/.exec(token);
    if (close) { if (stack.pop() !== close[1]!.toLowerCase()) return false; continue; }
    const open = /^<([a-z][a-z0-9]*)([\s\S]*?)\s*\/?>$/.exec(token);
    if (!open) return false;
    const tag = open[1]!.toLowerCase(); const attrsText = open[2]!;
    if (!allowedTags.has(tag)) return false;
    if (Object.hasOwn(uniqueElements, tag) && ++uniqueElements[tag]! > 1) return false;
    const parent = stack.at(-1) ?? "";
    const parentAllowed: Record<string, string[]> = {
      html: [""], head: ["html"], body: ["html"], meta: ["head"], link: ["head"], title: ["head"],
      main: ["body"], header: ["main"], section: ["main"], h1: ["header", "section"], h2: ["section"], h3: ["section"], p: ["section"],
    };
    if (!parentAllowed[tag]?.includes(parent)) return false;
    const attrs: Record<string, string> = {};
    const attrRe = /\s+([a-zA-Z][a-zA-Z0-9:_-]*)="([^"<>]*)"/g;
    let consumed = ""; let match: RegExpExecArray | null;
    while ((match = attrRe.exec(attrsText))) { if (attrs[match[1]!.toLowerCase()] !== undefined) return false; attrs[match[1]!.toLowerCase()] = match[2]!; consumed += match[0]; }
    if (consumed !== attrsText) return false;
    const attrNames = Object.keys(attrs);
    if (attrNames.some(name => name.startsWith("on") || name === "style" || name === "src" || name === "srcset" || name === "action" || name === "formaction")) return false;
    if (tag === "html" && (!keysOnly(attrs, ["lang"]) || attrs.lang !== "ja")) return false;
    if (tag === "meta") {
      if (stack.at(-1) !== "head") return false;
      const metadataKey = attrs.charset !== undefined ? "charset" : attrs.name !== undefined ? `name:${attrs.name}` : attrs.property !== undefined ? `property:${attrs.property}` : "";
      if (!metadataKey || seenMetadata.has(metadataKey)) return false;
      seenMetadata.add(metadataKey);
      if (keysOnly(attrs, ["charset"]) && attrs.charset === "utf-8") continue;
      if (keysOnly(attrs, ["name", "content"]) && attrs.name === "viewport" && attrs.content === "width=device-width,initial-scale=1") continue;
      if (keysOnly(attrs, ["name", "content"]) && ["description", "twitter:card", "twitter:title", "twitter:description", "twitter:image"].includes(attrs.name!)) {
        if (attrs.content === undefined || (attrs.name === "twitter:card" && attrs.content !== "summary_large_image")) return false;
        if (attrs.name === "twitter:image" && attrs.content !== `${origin}/sites/${publicationId}/og-image.svg`) return false;
        continue;
      }
      if (keysOnly(attrs, ["property", "content"]) && ["og:title", "og:description", "og:type", "og:url", "og:image", "og:locale"].includes(attrs.property!)) {
        if (attrs.content === undefined || (attrs.property === "og:type" && attrs.content !== "website") || (attrs.property === "og:locale" && attrs.content !== "ja_JP")) return false;
        if (attrs.property === "og:url" && attrs.content !== `${origin}/sites/${publicationId}/`) return false;
        if (attrs.property === "og:image" && attrs.content !== `${origin}/sites/${publicationId}/og-image.svg`) return false;
        continue;
      }
      return false;
    }
    if (tag === "link") {
      if (stack.at(-1) !== "head") return false;
      if (!attrs.rel || seenLinks.has(attrs.rel)) return false;
      seenLinks.add(attrs.rel);
      if (keysOnly(attrs, ["rel", "href"]) && attrs.rel === "stylesheet" && attrs.href === "assets/site.css") continue;
      if (keysOnly(attrs, ["rel", "href"]) && attrs.rel === "canonical" && attrs.href === `${origin}/sites/${publicationId}/`) continue;
      return false;
    }
    const componentHeading = ["h1", "h2", "h3", "p"].includes(tag) && stack.at(-1) === "section";
    const allowedAttrs: Record<string, string[]> = {
      html: ["lang"], head: [], title: [], body: [], header: [], section: [], h1: componentHeading ? ["data-component-id"] : [], h2: ["data-component-id"], h3: ["data-component-id"], p: ["data-component-id"],
      main: ["data-site-id", "data-site-version"],
    };
    if (!keysOnly(attrs, allowedAttrs[tag] ?? [])) return false;
    if (componentHeading && !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(attrs["data-component-id"] ?? "")) return false;
    if (tag === "main" && (attrs["data-site-id"] !== siteId || !/^[A-Za-z0-9][A-Za-z0-9.+_-]{0,63}$/.test(attrs["data-site-version"] ?? ""))) return false;
    if (!voidTags.has(tag)) stack.push(tag);
  }
  return doctypeSeen && stack.length === 0 && Object.values(uniqueElements).every(count => count === 1)
    && seenMetadata.has("charset") && seenMetadata.has("name:viewport") && seenLinks.has("stylesheet")
    && /^<!doctype html><html lang="ja"><head>[\s\S]*<\/head><body><main data-site-id="[^\"]+" data-site-version="[^\"]+"><header><h1>[^<>]*<\/h1><\/header><section>(?:<(?:h1|h2|h3) data-component-id="[A-Za-z0-9][A-Za-z0-9._-]{0,63}">[^<>]*<\/(?:h1|h2|h3)>|<p data-component-id="[A-Za-z0-9][A-Za-z0-9._-]{0,63}">[^<>]*<\/p>)*<\/section><\/main><\/body><\/html>$/.test(html);
}

function validStoredRow(row: Row, origin: string, publicationId: string): boolean {
  if (row.publication_id !== publicationId) return false;
  if (row.state === "retracted") return row.html === null && row.css === null;
  return row.state === "published" && typeof row.edition_id === "string" && /^hp_[a-f0-9]{64}$/.test(row.edition_id)
    && typeof row.html === "string" && row.css === ZUKAN_HP_CSS && safeSenderHtml(row.html, row.site_id, origin, publicationId);
}

async function validateEdition(value: unknown, siteId: string, editionId: string, origin: string, publicationId: string): Promise<{ html: string; css: string } | null> {
  if (!isObj(value) || !keysOnly(value, ["schema", "siteId", "editionId", "draftRevisionId", "title", "sourceDigest", "files", "pages", "forms"])) return null;
  if (value.schema !== "nocosil.hp-static-edition/v1" || value.siteId !== siteId || value.editionId !== editionId
    || typeof value.draftRevisionId !== "string" || !value.draftRevisionId || typeof value.title !== "string"
    || typeof value.sourceDigest !== "string" || !value.sourceDigest) return null;
  if (!Array.isArray(value.files) || value.files.length !== 2 || !Array.isArray(value.pages) || value.pages.length !== 1
    || !isObj(value.pages[0]) || !keysOnly(value.pages[0], ["path", "file"]) || value.pages[0].path !== "/" || value.pages[0].file !== "index.html") return null;
  if (!isObj(value.forms) || !keysOnly(value.forms, ["submissionWebhook", "forms"]) || value.forms.submissionWebhook !== "" || !Array.isArray(value.forms.forms) || value.forms.forms.length !== 0) return null;
  const htmlFile = value.files.find(file => isObj(file) && file.path === "index.html");
  const cssFile = value.files.find(file => isObj(file) && file.path === "assets/site.css");
  if (!isObj(htmlFile) || !isObj(cssFile) || !keysOnly(htmlFile, ["path", "contentType", "body", "sha256"]) || !keysOnly(cssFile, ["path", "contentType", "body", "sha256"])) return null;
  if (value.files[0] !== htmlFile || value.files[1] !== cssFile) return null;
  if (htmlFile.contentType !== "text/html; charset=utf-8" || cssFile.contentType !== "text/css; charset=utf-8"
    || typeof htmlFile.body !== "string" || typeof cssFile.body !== "string" || cssFile.body !== ZUKAN_HP_CSS
    || typeof htmlFile.sha256 !== "string" || typeof cssFile.sha256 !== "string") return null;
  if (await sha256Text(htmlFile.body) !== htmlFile.sha256 || await sha256Text(cssFile.body) !== cssFile.sha256 || cssFile.sha256 !== ZUKAN_HP_CSS_SHA256) return null;
  if (!safeSenderHtml(htmlFile.body, siteId, origin, publicationId)) return null;
  const editionCanonical = { siteId: value.siteId, draftRevisionId: value.draftRevisionId, title: value.title, sourceDigest: value.sourceDigest,
    files: [htmlFile, cssFile].map(file => ({ path: file.path, contentType: file.contentType, body: file.body, sha256: file.sha256 })) };
  if (`hp_${await sha256Text(JSON.stringify(editionCanonical))}` !== editionId) return null;
  return { html: htmlFile.body, css: cssFile.body };
}

function publicHeaders(type: string): Headers {
  return new Headers({ "content-type": type, "cache-control": "no-store", "x-robots-tag": "noindex, nofollow",
    "x-content-type-options": "nosniff", "referrer-policy": "no-referrer",
    "content-security-policy": "default-src 'none'; style-src 'self'; script-src 'none'; img-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'; sandbox allow-same-origin" });
}

async function readSite(request: Request, env: ZukanHpReceiverEnv): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") return error("method_not_allowed", 405);
  const match = /^\/sites\/(hp_[a-f0-9]{64})\/(assets\/site\.css)?$/.exec(new URL(request.url).pathname);
  if (!match) return error("not_found", 404);
  let row: Row | null;
  try { row = await env.CORE_DB.prepare(`SELECT publication_id,scope_digest,site_id,last_operation_id,request_digest,edition_id,state,html,css,updated_at FROM ${TABLE} WHERE publication_id=?`).bind(match[1]).first<Row>(); }
  catch { return error("storage_unavailable", 503); }
  if (!row) return new Response(null, { status: 404, headers: publicHeaders("text/plain; charset=utf-8") });
  const origin = originFor(env);
  if (!origin || !validStoredRow(row, origin, match[1]!)) return error("storage_unavailable", 503);
  if (row.state !== "published") return new Response(null, { status: 410, headers: publicHeaders("text/plain; charset=utf-8") });
  const content = match[2] ? row.css : row.html;
  if (content === null) return error("storage_unavailable", 503);
  return new Response(request.method === "HEAD" ? null : content, { status: 200, headers: publicHeaders(match[2] ? "text/css; charset=utf-8" : "text/html; charset=utf-8") });
}

async function handlePost(request: Request, env: ZukanHpReceiverEnv, now: number): Promise<Response> {
  if (request.method !== "POST") return error("method_not_allowed", 405);
  const origin = originFor(env);
  if (!origin || !env.NOCOSIL_INTEGRATION_HMAC_SECRET) return error("integration_unavailable", 503);
  const raw = await readBoundedBody(request);
  if (raw === null) return error("body_too_large", 413);
  if (!await authenticate(request, raw, env.NOCOSIL_INTEGRATION_HMAC_SECRET, now)) return error("invalid_signature", 401);
  let text: string; let body: unknown;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(raw); body = JSON.parse(text); }
  catch { return error("invalid_json", 400); }
  if (!isObj(body) || !keysOnly(body, ["schema", "action", "environment", "audience", "scopeDigest", "siteId", "publicationId", "operationId", "expectedOperationId", "issuedAt", "actorDigest", "verifiedAt", "edition"])) return error("invalid_payload", 400);
  if (body.schema !== "nocosil.hp-zukan-handoff/v2" || body.environment !== env.ENVIRONMENT || body.audience !== origin) return error("invalid_audience", 400);
  if (!(body.action === "publish" || body.action === "takedown" || body.action === "status") || typeof body.scopeDigest !== "string" || !hashPattern.test(body.scopeDigest)
    || typeof body.siteId !== "string" || !/^(?:site_[A-Za-z0-9_-]{8,175}|[a-z0-9][a-z0-9-]{2,62})$/.test(body.siteId)) return error("invalid_payload", 400);
  const publicationId = `hp_${await sha256Text(JSON.stringify(["nocosil", env.ENVIRONMENT, body.scopeDigest, body.siteId]))}`;
  if (body.publicationId !== publicationId) return error("invalid_publication_id", 400);
  const action = body.action as ZukanHpAction;
  if (action === "status") {
    if (Object.keys(body).some(key => !["schema", "action", "environment", "audience", "scopeDigest", "siteId", "publicationId"].includes(key))) return error("invalid_payload", 400);
    try {
      const row = await env.CORE_DB.prepare(`SELECT publication_id,scope_digest,site_id,last_operation_id,request_digest,edition_id,state,html,css,updated_at FROM ${TABLE} WHERE publication_id=?`).bind(publicationId).first<Row>();
      if (row && (row.scope_digest !== body.scopeDigest || row.site_id !== body.siteId)) return error("binding_conflict", 409);
      if (row && !validStoredRow(row, origin, publicationId)) return error("storage_unavailable", 503);
      return responseJson(await result(row, publicationId, body.scopeDigest as string, body.siteId, origin));
    } catch { return error("storage_unavailable", 503); }
  }
  if (typeof body.operationId !== "string" || !operationIdPattern.test(body.operationId)
    || !(body.expectedOperationId === null || (typeof body.expectedOperationId === "string" && operationIdPattern.test(body.expectedOperationId)))
    || !validInstant(body.issuedAt) || typeof body.actorDigest !== "string" || !hashPattern.test(body.actorDigest)
    || !validInstant(body.verifiedAt)) return error("invalid_operation", 400);
  const mutationEditionId = action === "publish" && isObj(body.edition) && typeof body.edition.editionId === "string" ? body.edition.editionId : null;
  if (action === "publish" && (!mutationEditionId || !/^hp_[a-f0-9]{64}$/.test(mutationEditionId))) return error("invalid_edition", 400);
  let edition: { html: string; css: string } | null = null;
  if (action === "publish") {
    edition = await validateEdition(body.edition, body.siteId, mutationEditionId!, origin, publicationId);
    if (!edition) return error("invalid_edition", 400);
  } else if (body.edition !== undefined) return error("invalid_edition", 400);
  const digest = await sha256Text(canonicalJson(body));
  const matchesOperation = (row: Row): boolean => action === "publish"
    ? row.state === "published" && row.edition_id === mutationEditionId && row.html === edition?.html && row.css === edition?.css
    : row.state === "retracted";
  const values = await (async () => {
    try {
      const before = await env.CORE_DB.prepare(`SELECT publication_id,scope_digest,site_id,last_operation_id,request_digest,edition_id,state,html,css,updated_at FROM ${TABLE} WHERE publication_id=?`).bind(publicationId).first<Row>();
      if (before && (before.scope_digest !== body.scopeDigest || before.site_id !== body.siteId)) return { response: error("binding_conflict", 409) };
      if (before && !validStoredRow(before, origin, publicationId)) return { response: error("storage_unavailable", 503) };
      if (before && before.last_operation_id === body.operationId) {
        if (before.request_digest !== digest) return { response: error("operation_conflict", 409) };
        if (!matchesOperation(before)) return { response: error("readback_failed", 503) };
        return { response: responseJson(await result(before, publicationId, body.scopeDigest as string, body.siteId as string, origin)) };
      }
      if ((before?.last_operation_id ?? null) !== body.expectedOperationId) return { response: error("stale_operation", 409) };
      const updatedAt = new Date(now).toISOString();
      const state = action === "publish" ? "published" : "retracted";
      const html = edition?.html ?? null; const css = edition?.css ?? null;
      const editionIdToStore = action === "publish" ? mutationEditionId : before?.edition_id ?? null;
      if (before === null) {
        const inserted = await env.CORE_DB.prepare(`INSERT INTO ${TABLE} (publication_id,scope_digest,site_id,last_operation_id,request_digest,edition_id,state,html,css,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(publication_id) DO NOTHING`)
          .bind(publicationId, body.scopeDigest, body.siteId, body.operationId, digest, editionIdToStore, state, html, css, updatedAt).run();
        if (inserted.success === false) return { response: error("storage_unavailable", 503) };
      } else {
        const changed = await env.CORE_DB.prepare(`UPDATE ${TABLE} SET last_operation_id=?,request_digest=?,edition_id=?,state=?,html=?,css=?,updated_at=? WHERE publication_id=? AND scope_digest=? AND site_id=? AND last_operation_id IS ?`)
          .bind(body.operationId, digest, editionIdToStore, state, html, css, updatedAt, publicationId, body.scopeDigest, body.siteId, body.expectedOperationId).run();
        if (changed.success === false) return { response: error("storage_unavailable", 503) };
        if ((changed.meta?.changes ?? 0) !== 1) {
          const winner = await env.CORE_DB.prepare(`SELECT publication_id,scope_digest,site_id,last_operation_id,request_digest,edition_id,state,html,css,updated_at FROM ${TABLE} WHERE publication_id=?`).bind(publicationId).first<Row>();
          if (winner && winner.scope_digest === body.scopeDigest && winner.site_id === body.siteId && winner.last_operation_id === body.operationId && winner.request_digest === digest && validStoredRow(winner, origin, publicationId)) {
            if (!matchesOperation(winner)) return { response: error("readback_failed", 503) };
            return { response: responseJson(await result(winner, publicationId, body.scopeDigest as string, body.siteId as string, origin)) };
          }
          return { response: error(winner?.last_operation_id === body.operationId ? "operation_conflict" : "stale_operation", 409) };
        }
      }
      const after = await env.CORE_DB.prepare(`SELECT publication_id,scope_digest,site_id,last_operation_id,request_digest,edition_id,state,html,css,updated_at FROM ${TABLE} WHERE publication_id=?`).bind(publicationId).first<Row>();
      if (!after) return { response: error("readback_failed", 503) };
      if (after.scope_digest !== body.scopeDigest || after.site_id !== body.siteId) return { response: error("binding_conflict", 409) };
      if (after.last_operation_id !== body.operationId || after.request_digest !== digest) {
        return { response: error(after.last_operation_id === body.operationId ? "operation_conflict" : "stale_operation", 409) };
      }
      if (after.state !== state || after.edition_id !== editionIdToStore || after.html !== html || after.css !== css || !validStoredRow(after, origin, publicationId)) return { response: error("readback_failed", 503) };
      return { response: responseJson(await result(after, publicationId, body.scopeDigest as string, body.siteId as string, origin)) };
    } catch { return { response: error("storage_unavailable", 503) }; }
  })();
  return values.response;
}

export async function handleZukanHpSiteReceiver(request: Request, env: ZukanHpReceiverEnv, now = Date.now()): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (path === ZUKAN_HP_RECEIVER_PATH) return handlePost(request, env, now);
  if (path.startsWith("/sites/")) return readSite(request, env);
  return error("not_found", 404);
}
