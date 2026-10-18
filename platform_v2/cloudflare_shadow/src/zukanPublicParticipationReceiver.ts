import { canonicalJson, type ReceiverDatabase } from "./nocosilRevisionReceiver";

export const PUBLIC_PARTICIPATION_PATH = "/api/v1/integrations/nocosil/public-participations";
export const PUBLIC_PARTICIPATION_WITHDRAWAL_PATH = PUBLIC_PARTICIPATION_PATH + "/withdrawals";
export const PUBLIC_PARTICIPATION_SCHEMA = "zukan.public-participation/v1" as const;

export interface PublicParticipationEnv {
  NOCOSIL_PUBLIC_RECEIVER_ENABLED?: string;
  NOCOSIL_INTEGRATION_HMAC_SECRET?: string;
  CORE_DB: ReceiverDatabase;
}
type Photo = { photoId: string; url: string; consent: { public_display: boolean; rights_holder: string; consent_at: string } };
export interface PublicParticipation {
  schema: typeof PUBLIC_PARTICIPATION_SCHEMA; idempotencyKey: string; kind: "event" | "site" | "record";
  id: string; title: string; organizer_approval: { approverId: string; approvedAt: string }; photos: Photo[];
  genre?: string; region?: string; description?: string; url?: string; startsAt?: string; locationName?: string; publisherName?: string;
}
class ParticipationError extends Error { constructor(readonly code: string) { super(code); } }
const fail = (code: string): never => { throw new ParticipationError(code); };
function object(value: unknown, required: string[], optional: string[] = []): asserts value is Record<string, unknown> {
  const allowed = [...required, ...optional];
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(k => !allowed.includes(k)) || required.some(k => !Object.hasOwn(value, k))) fail("shape_invalid");
}
function id(value: unknown): string { if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/u.test(value)) return fail("identity_invalid"); return value; }
function time(value: unknown): string { if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(value) || new Date(value).toISOString() !== value) return fail("time_invalid"); return value; }
function slug(value: unknown): string { if (typeof value !== "string" || !/^[a-z0-9-]{1,64}$/u.test(value)) return fail("slug_invalid"); return value; }
function optionalText(value: unknown, maximum: number, code: string, trim = false): string {
  if (typeof value !== "string") return fail(code);
  const parsed = trim ? value.trim() : value;
  if (parsed.length > maximum) return fail(code);
  return parsed;
}
function httpsUrl(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048) return fail("url_invalid");
  try { if (new URL(value).protocol !== "https:") fail("url_invalid"); } catch { fail("url_invalid"); }
  return value;
}
export function parsePublicParticipation(value: unknown): PublicParticipation {
  object(value, ["schema", "idempotencyKey", "kind", "id", "title", "organizer_approval", "photos"], ["genre", "region", "description", "url", "startsAt", "locationName", "publisherName"]);
  const input = value as any;
  if (input.schema !== PUBLIC_PARTICIPATION_SCHEMA) fail("schema_invalid");
  if (!( ["event", "site", "record"] as unknown[]).includes(input.kind)) fail("kind_invalid");
  if (typeof input.title !== "string" || !input.title.trim() || input.title.length > 240) fail("title_invalid");
  object(input.organizer_approval, ["approverId", "approvedAt"]);
  if (!Array.isArray(input.photos) || input.photos.length > 20) fail("photos_invalid");
  const photos = input.photos.map((photo: any) => {
    object(photo, ["photoId", "url", "consent"]); const photoInput = photo as any; object(photoInput.consent, ["public_display", "rights_holder", "consent_at"]); const consent = photoInput.consent as any;
    if (typeof photoInput.url !== "string" || photoInput.url.length > 2048 || !/^https:\/\//u.test(photoInput.url)) fail("photo_invalid");
    if (typeof consent.public_display !== "boolean" || typeof consent.rights_holder !== "string" || !consent.rights_holder.trim()) fail("consent_invalid");
    return { photoId: id(photoInput.photoId), url: photoInput.url, consent: { public_display: consent.public_display, rights_holder: consent.rights_holder.trim(), consent_at: time(consent.consent_at) } };
  });
  return {
    schema: PUBLIC_PARTICIPATION_SCHEMA, idempotencyKey: id(input.idempotencyKey), kind: input.kind as PublicParticipation["kind"], id: id(input.id), title: input.title.trim(),
    organizer_approval: { approverId: id(input.organizer_approval.approverId), approvedAt: time(input.organizer_approval.approvedAt) }, photos,
    ...(Object.hasOwn(input, "genre") && { genre: slug(input.genre) }),
    ...(Object.hasOwn(input, "region") && { region: slug(input.region) }),
    ...(Object.hasOwn(input, "description") && { description: optionalText(input.description, 2000, "description_invalid", true) }),
    ...(Object.hasOwn(input, "url") && { url: httpsUrl(input.url) }),
    ...(Object.hasOwn(input, "startsAt") && { startsAt: time(input.startsAt) }),
    ...(Object.hasOwn(input, "locationName") && { locationName: optionalText(input.locationName, 240, "location_name_invalid") }),
    ...(Object.hasOwn(input, "publisherName") && { publisherName: optionalText(input.publisherName, 240, "publisher_name_invalid") }),
  };
}
const encoder = new TextEncoder();
const hex = (buffer: ArrayBuffer) => Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, "0")).join("");
async function digest(value: unknown) { return hex(await crypto.subtle.digest("SHA-256", encoder.encode(canonicalJson(value)))); }
function response(body: unknown, status: number) { return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }); }
function equal(left: string, right: string) { left = left.toLowerCase(); right = right.toLowerCase(); let difference = left.length ^ right.length; for (let i = 0; i < 64; i++) difference |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0); return difference === 0; }
async function body(request: Request) { const data = new Uint8Array(await request.arrayBuffer()); if (data.byteLength > 8192) fail("payload_too_large"); return data; }
type Receipt = { payload_digest: string; response_json: string };
async function receipt(db: ReceiverDatabase, operation: string, key: string, payloadDigest: string, bodyValue: unknown, receivedAt: string) {
  const encoded = JSON.stringify(bodyValue);
  const result = await db.prepare("INSERT INTO zukan_public_participation_receipts (operation, idempotency_key, payload_digest, response_json, received_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(operation, idempotency_key) DO NOTHING").bind(operation, key, payloadDigest, encoded, receivedAt).run() as { meta?: { changes?: number } };
  const row = await db.prepare("SELECT payload_digest, response_json FROM zukan_public_participation_receipts WHERE operation = ? AND idempotency_key = ?").bind(operation, key).first<Receipt>();
  if (!row) return fail("storage_unavailable"); if (row.payload_digest !== payloadDigest) fail("idempotency_conflict");
  return { created: (result.meta?.changes ?? 0) > 0, body: JSON.parse(row.response_json) };
}
async function publish(db: ReceiverDatabase, item: PublicParticipation, now: string) {
  const payloadDigest = await digest(item); const resultBody = { ok: true, idempotencyKey: item.idempotencyKey, kind: item.kind, id: item.id, published: true };
  const saved = await receipt(db, "publish", item.idempotencyKey, payloadDigest, resultBody, now); if (!saved.created) return saved;
  await db.prepare("INSERT INTO zukan_public_participations (idempotency_key, participation_kind, participation_id, title, approver_id, approved_at, published_at, withdrawn_at, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?) ON CONFLICT(idempotency_key) DO UPDATE SET participation_kind=excluded.participation_kind, participation_id=excluded.participation_id, title=excluded.title, approver_id=excluded.approver_id, approved_at=excluded.approved_at, published_at=excluded.published_at, withdrawn_at=NULL, payload_json=excluded.payload_json").bind(item.idempotencyKey, item.kind, item.id, item.title, item.organizer_approval.approverId, item.organizer_approval.approvedAt, now, canonicalJson(item)).run();
  for (const photo of item.photos) await db.prepare("INSERT INTO zukan_public_participation_photos (idempotency_key, photo_id, url, public_display, rights_holder, consent_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(idempotency_key, photo_id) DO UPDATE SET url=excluded.url, public_display=excluded.public_display, rights_holder=excluded.rights_holder, consent_at=excluded.consent_at").bind(item.idempotencyKey, photo.photoId, photo.url, photo.consent.public_display ? 1 : 0, photo.consent.rights_holder, photo.consent.consent_at).run();
  return saved;
}
async function withdraw(db: ReceiverDatabase, key: string, now: string) {
  const payload = { schema: PUBLIC_PARTICIPATION_SCHEMA, idempotencyKey: key }; const resultBody = { ok: true, idempotencyKey: key, withdrawn: true };
  const saved = await receipt(db, "withdrawal", key, await digest(payload), resultBody, now); if (saved.created) await db.prepare("UPDATE zukan_public_participations SET withdrawn_at = ? WHERE idempotency_key = ?").bind(now, key).run(); return saved;
}
export async function listPublicParticipations(db: ReceiverDatabase) {
  const statement = db.prepare("SELECT idempotency_key, participation_kind, participation_id, title, approver_id, approved_at, published_at FROM zukan_public_participations WHERE approved_at IS NOT NULL AND withdrawn_at IS NULL ORDER BY published_at, idempotency_key");
  const getRows = statement.all; if (!getRows) return fail("storage_unavailable");
  const rows = (await getRows.call(statement)).results as any[];
  return Promise.all(rows.map(async record => {
    const photos = db.prepare("SELECT photo_id AS photoId, url, rights_holder, consent_at FROM zukan_public_participation_photos WHERE idempotency_key = ? AND public_display = 1 ORDER BY photo_id").bind(record.idempotency_key);
    const getPhotos = photos.all; if (!getPhotos) return fail("storage_unavailable");
    return { idempotencyKey: record.idempotency_key, kind: record.participation_kind, id: record.participation_id, title: record.title, organizer_approval: { approverId: record.approver_id, approvedAt: record.approved_at }, photos: (await getPhotos.call(photos)).results as any[] };
  }));
}
export async function handleZukanPublicParticipationReceiver(request: Request, url: URL, env: PublicParticipationEnv, nowMs = Date.now()): Promise<Response | null> {
  const withdrawal = url.pathname === PUBLIC_PARTICIPATION_WITHDRAWAL_PATH; if (!withdrawal && url.pathname !== PUBLIC_PARTICIPATION_PATH) return null;
  if (env.NOCOSIL_PUBLIC_RECEIVER_ENABLED !== "true") return response({ error: "not_found" }, 404); if (request.method !== "POST") return response({ error: "method_not_allowed" }, 405);
  const secret = env.NOCOSIL_INTEGRATION_HMAC_SECRET?.trim(); if (!secret) return response({ error: "receiver_not_configured" }, 503);
  if (Number(request.headers.get("content-length")) > 8192) return response({ error: "payload_too_large" }, 413);
  const timestamp = request.headers.get("x-nocosil-timestamp"), signature = request.headers.get("x-nocosil-signature"); if (!timestamp || !signature) return response({ error: "signature_required" }, 401);
  if (!/^\d{1,12}$/u.test(timestamp)) return response({ error: "timestamp_invalid" }, 401);
  if (Math.abs(Math.floor(nowMs / 1000) - Number(timestamp)) > 300) return response({ error: "timestamp_out_of_window" }, 401);
  let raw: Uint8Array; try { raw = await body(request); } catch (error) { return response({ error: error instanceof ParticipationError ? error.code : "invalid_json" }, error instanceof ParticipationError ? 413 : 400); }
  const signed = new Uint8Array(encoder.encode(timestamp + ".").length + raw.length); signed.set(encoder.encode(timestamp + ".")); signed.set(raw, encoder.encode(timestamp + ".").length);
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); const expected = hex(await crypto.subtle.sign("HMAC", key, signed));
  if (!/^v1=[a-f0-9]{64}$/iu.test(signature) || !equal(signature.slice(3), expected)) return response({ error: "signature_invalid" }, 401);
  let input: unknown; try { input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw)); } catch { return response({ error: "invalid_json" }, 400); }
  try {
    if (withdrawal) { object(input, ["schema", "idempotencyKey"]); const withdrawalInput = input as any; if (withdrawalInput.schema !== PUBLIC_PARTICIPATION_SCHEMA) fail("schema_invalid"); const saved = await withdraw(env.CORE_DB, id(withdrawalInput.idempotencyKey), new Date(nowMs).toISOString()); return response(saved.body, saved.created ? 201 : 200); }
    const item = parsePublicParticipation(input); const saved = await publish(env.CORE_DB, item, new Date(nowMs).toISOString()); return response(saved.body, saved.created ? 201 : 200);
  } catch (error) { const code = error instanceof ParticipationError ? error.code : "storage_unavailable"; const status = code === "idempotency_conflict" ? 409 : code === "storage_unavailable" ? 503 : 422; return response({ error: code }, status); }
}
