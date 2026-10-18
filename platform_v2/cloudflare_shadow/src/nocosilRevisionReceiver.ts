export const NOCOSIL_REVISION_PATH = "/api/v1/integrations/nocosil/revisions";
export const NOCOSIL_REVISION_SCHEMA = "zukan.saved-revision/v1" as const;

const namespaces = {
  record: ["observations", "records"], place: ["sites", "places"],
  event: ["events", "community/events"], job: ["jobs"], offer: ["offers"],
  article: ["articles", "read"], organization: ["organizations"],
  experience: ["experiences"], stay: ["stays"], learning: ["learning"], service: ["services"],
} as const;
type ObjectKind = keyof typeof namespaces;
export interface NocosilRevision {
  schema: typeof NOCOSIL_REVISION_SCHEMA;
  linkGeneration: string;
  sourceAccountRef: string;
  relationshipId: string;
  revision: number;
  action: "saved" | "removed";
  sourceState: "current" | "withdrawn" | "unavailable";
  occurredAt: string;
  object: { kind: ObjectKind; objectId: string; path: string; title: string };
}
interface ReceiverStatement {
  bind(...values: (string | number)[]): ReceiverStatement;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<unknown>;
  all?<T = unknown>(): Promise<{ results: T[] }>;
}
export interface ReceiverDatabase {
  prepare(sql: string): ReceiverStatement;
}
export interface NocosilRevisionEnv {
  NOCOSIL_REVISION_RECEIVER_ENABLED?: string;
  NOCOSIL_INTEGRATION_HMAC_SECRET?: string;
  CORE_DB: ReceiverDatabase;
}
class ReceiverError extends Error {
  constructor(readonly code: string) { super(code); }
}
function fail(code: string): never { throw new ReceiverError(code); }
function fields(value: unknown, keys: readonly string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).some(key => !keys.includes(key))
    || keys.some(key => !Object.hasOwn(value, key))) fail("shape_invalid");
}
function identity(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/u.test(value)) fail("identity_invalid");
  return value;
}
export function parseNocosilRevision(input: unknown): NocosilRevision {
  fields(input, ["schema", "linkGeneration", "sourceAccountRef", "relationshipId", "revision", "action", "sourceState", "occurredAt", "object"]);
  if (input.schema !== NOCOSIL_REVISION_SCHEMA) fail("schema_invalid");
  if (!Number.isSafeInteger(input.revision) || Number(input.revision) < 1) fail("revision_invalid");
  if (input.action !== "saved" && input.action !== "removed") fail("action_invalid");
  if (input.sourceState !== "current" && input.sourceState !== "withdrawn" && input.sourceState !== "unavailable") fail("source_state_invalid");
  fields(input.object, ["kind", "objectId", "path", "title"]);
  const object = input.object;
  if (typeof object.kind !== "string" || !Object.hasOwn(namespaces, object.kind)) fail("kind_invalid");
  const kind = object.kind as ObjectKind;
  const objectId = identity(object.objectId);
  const path = object.path;
  if (typeof path !== "string" || path.length > 600 || !path.startsWith("/") || path.startsWith("//")
    || /[\\?#%\x00-\x20\x7f]/u.test(path) || path.includes("..")
    || !namespaces[kind].some(namespace => {
      const prefix = "/" + namespace + "/";
      if (!path.startsWith(prefix)) return false;
      const tail = path.slice(prefix.length);
      return /^[A-Za-z0-9][A-Za-z0-9_-]*$/u.test(tail) && (tail === objectId || tail.endsWith("-" + objectId));
    })) fail("path_invalid");
  if (typeof object.title !== "string" || !object.title.trim() || object.title.length > 240
    || /[\x00-\x1f\x7f]/u.test(object.title)) fail("title_invalid");
  const occurredAt = input.occurredAt;
  if (typeof occurredAt !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(occurredAt)
    || !Number.isFinite(Date.parse(occurredAt)) || new Date(occurredAt).toISOString() !== occurredAt) fail("time_invalid");
  return {
    schema: NOCOSIL_REVISION_SCHEMA, linkGeneration: identity(input.linkGeneration),
    sourceAccountRef: identity(input.sourceAccountRef), relationshipId: identity(input.relationshipId),
    revision: Number(input.revision), action: input.action, sourceState: input.sourceState, occurredAt,
    object: { kind, objectId, path, title: object.title.trim() },
  };
}
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (value !== null && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return "{" + Object.keys(object).sort().map(key => JSON.stringify(key) + ":" + canonicalJson(object[key])).join(",") + "}";
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new TypeError("Value is not JSON");
  return encoded;
}
const encoder = new TextEncoder();
function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}
async function digest(value: unknown): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(canonicalJson(value))));
}
interface ReceiptRow {
  receipt_id: string; payload_digest: string; revision: number; action: NocosilRevision["action"];
  object_kind: ObjectKind; object_id: string; occurred_at: string; received_at: string;
}
export async function storeNocosilRevision(db: ReceiverDatabase, revision: NocosilRevision, receivedAt: string) {
  try {
    const normalized = parseNocosilRevision(revision);
    const payloadDigest = await digest(normalized);
    const receiptId = "nrv_" + (await digest(["nocosil", normalized.sourceAccountRef, normalized.relationshipId, normalized.revision])).slice(0, 40);
    const result = await db.prepare(
      "INSERT INTO nocosil_revision_receipts (receipt_id, source, link_generation, source_account_ref, relationship_id, revision, action, source_state, object_kind, object_id, canonical_path, display_title, occurred_at, payload_digest, received_at) VALUES (?, 'nocosil', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(source, source_account_ref, relationship_id, revision) DO NOTHING"
    ).bind(receiptId, normalized.linkGeneration, normalized.sourceAccountRef, normalized.relationshipId, normalized.revision,
      normalized.action, normalized.sourceState, normalized.object.kind, normalized.object.objectId,
      normalized.object.path, normalized.object.title, normalized.occurredAt, payloadDigest, receivedAt).run();
    const row = await db.prepare(
      "SELECT receipt_id, payload_digest, revision, action, object_kind, object_id, occurred_at, received_at FROM nocosil_revision_receipts WHERE source = 'nocosil' AND source_account_ref = ? AND relationship_id = ? AND revision = ?"
    ).bind(normalized.sourceAccountRef, normalized.relationshipId, normalized.revision).first<ReceiptRow>();
    if (!row) fail("storage_unavailable");
    if (row.payload_digest !== payloadDigest) fail("revision_conflict");
    const changes = (result as { meta?: { changes?: number } } | null)?.meta?.changes ?? 0;
    return {
      created: changes > 0,
      body: { ok: true as const, receipt: {
        id: row.receipt_id, url: "https://zukan.earth/integrations/nocosil/revisions/" + row.receipt_id,
        source: "nocosil" as const, revision: row.revision, action: row.action,
        objectKind: row.object_kind, objectId: row.object_id, occurredAt: row.occurred_at, receivedAt: row.received_at,
      } },
    };
  } catch (error) {
    if (error instanceof ReceiverError && error.code === "revision_conflict") throw error;
    return fail("storage_unavailable");
  }
}
function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: {
    "content-type": "application/json; charset=utf-8", "cache-control": "no-store",
  } });
}
function constantTimeEqual(left: string, right: string): boolean {
  left = left.toLowerCase(); right = right.toLowerCase();
  let difference = left.length ^ right.length;
  for (let i = 0; i < 64; i++) difference |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  return difference === 0;
}
async function boundedBody(request: Request): Promise<Uint8Array<ArrayBuffer>> {
  const bytes = new Uint8Array(8192);
  const reader = request.body?.getReader();
  let length = 0;
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (length + value.byteLength > bytes.byteLength) {
          await reader.cancel();
          fail("payload_too_large");
        }
        bytes.set(value, length); length += value.byteLength;
      }
    } finally { reader.releaseLock(); }
  }
  return bytes.slice(0, length);
}
export async function handleNocosilRevisionReceiverApi(request: Request, url: URL, env: NocosilRevisionEnv, nowMs = Date.now()): Promise<Response | null> {
  if (url.pathname !== NOCOSIL_REVISION_PATH) return null;
  if (env.NOCOSIL_REVISION_RECEIVER_ENABLED !== "true") return json({ error: "not_found" }, 404);
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const secret = env.NOCOSIL_INTEGRATION_HMAC_SECRET?.trim();
  if (!secret) return json({ error: "receiver_not_configured" }, 503);
  if (Number(request.headers.get("content-length")) > 8192) return json({ error: "payload_too_large" }, 413);
  const timestamp = request.headers.get("x-nocosil-timestamp");
  const signature = request.headers.get("x-nocosil-signature");
  if (!timestamp || !signature) return json({ error: "signature_required" }, 401);
  if (!/^\d{1,12}$/u.test(timestamp)) return json({ error: "timestamp_invalid" }, 401);
  if (Math.abs(Math.floor(nowMs / 1000) - Number(timestamp)) > 300) return json({ error: "timestamp_out_of_window" }, 401);
  let raw: Uint8Array<ArrayBuffer>;
  try { raw = await boundedBody(request); }
  catch (error) { return json({ error: error instanceof ReceiverError ? error.code : "invalid_json" }, error instanceof ReceiverError ? 413 : 400); }
  const prefix = encoder.encode(timestamp + ".");
  const signed = new Uint8Array(prefix.byteLength + raw.byteLength);
  signed.set(prefix); signed.set(raw, prefix.byteLength);
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = hex(await crypto.subtle.sign("HMAC", key, signed));
  if (!/^v1=[a-f0-9]{64}$/iu.test(signature) || !constantTimeEqual(signature.slice(3), expected)) return json({ error: "signature_invalid" }, 401);
  let input: unknown;
  try { input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw)); }
  catch { return json({ error: "invalid_json" }, 400); }
  let revision: NocosilRevision;
  try { revision = parseNocosilRevision(input); }
  catch (error) { return json({ error: error instanceof ReceiverError ? error.code : "shape_invalid" }, 422); }
  try {
    const { body, created } = await storeNocosilRevision(env.CORE_DB, revision, new Date(nowMs).toISOString());
    return json(body, created ? 201 : 200);
  } catch (error) {
    const conflict = error instanceof ReceiverError && error.code === "revision_conflict";
    return json({ error: conflict ? "revision_conflict" : "storage_unavailable" }, conflict ? 409 : 503);
  }
}
