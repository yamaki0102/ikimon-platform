import type { DiscoveryDatabase, DiscoveryStatement, DiscoveryBucket } from "./eventDiscovery";
import { credentialDigest, guestCookieName, privateCookie, randomCredential, readGuestCredential, readOpaqueCookie } from "./guestCredentialNative";
import { removePhotoMetadata } from "./biosecurityMedia";
import { BIOSECURITY_PROFILES, biosecurityProfile } from "../../src/services/biosecurityProfiles";
import { MUNICIPALITIES, MUNICIPALITY_DIRECTORY_VERSION, findMunicipality, matchMunicipalityEmail } from "../../src/services/municipalityDirectory";
import { renderBiosecurityPage } from "../../src/ui/biosecurity";
import { officialMailboxDomain, resolveOfficialMailboxDomain } from "./municipalDomainEvidence";
import { parseBiosecurityCaptureMetadata, legacyBiosecurityCaptureMetadata, type BiosecurityCaptureMetadata } from "./biosecurityCaptureContext";
import { ENVIRONMENT_RECORD_FIELDS, mergeAutoEnvironmentRecordValues, mergeUserEnvironmentRecordValues, normalizeEnvironmentRecordValue } from "../../src/services/environmentRecord";
import { BIOSECURITY_PHOTO_HINT_MODEL, BIOSECURITY_PHOTO_HINT_VERSION, BIOSECURITY_PHOTO_HINT_MAX_INPUT_TOKENS, generateBiosecurityPhotoHints } from "./biosecurityPhotoHints";
import { MULTI_TAXA_MAX_INPUT_TOKENS, generateMultiTaxaHints, mergeMultiTaxaPhotos, type PostTaxonResult, type PhotoTaxonResult } from "./biosecurityMultiTaxa";

const DAY = 86_400_000;
const GUEST_SCOPE = "zukan-biosecurity-private-v1";
const STAFF_COOKIE = "__Host-zukan_municipal_inbox";
const CHALLENGE_COOKIE = "__Host-zukan_municipal_challenge";
export const MUNICIPAL_INBOX_ROLE = "MunicipalInbox";
export const BIOSECURITY_RETENTION_DAYS = 90;
export const BIOSECURITY_LIMITS = Object.freeze({ photos: 6, photoBytes: 4 * 1024 * 1024, requestBytes: 18 * 1024 * 1024, dailyRecords: 100, guestDailyRecords: 10, ipDailyRecords: 20, recordShares: 20, dailyEmails: 50, monthlyEmails: 1000 });
const PRIVATE_HEADERS = { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow, noarchive", "referrer-policy": "no-referrer", "x-content-type-options": "nosniff" };
type Value = string | number | null;
type Statement = DiscoveryStatement;
export interface BiosecurityEnv {
  CORE_DB: DiscoveryDatabase;
  OBS_DB: DiscoveryDatabase;
  ASSET_BUCKET: DiscoveryBucket;
  ENVIRONMENT: string;
  BIOSECURITY_ENABLED?: string;
  BIOSECURITY_STORAGE_BUDGET_BYTES?: string;
  BIOSECURITY_EMAIL_ENABLED?: string;
  BIOSECURITY_PHOTO_HINTS_ENABLED?: string;
  BIOSECURITY_PHOTO_HINT_DAILY_TOKENS?: string;
  BIOSECURITY_MULTI_TAXA_ENABLED?: string;
  AI?: { run(model: string, input: unknown): Promise<unknown> };
  ALERT_EMAIL_FROM?: string;
  ALERT_EMAIL?: { send(message: { from: string; to: string; subject: string; text: string }): Promise<unknown> };
}
export class BiosecurityError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
function fail(status: number, code: string): never { throw new BiosecurityError(status, code); }
const json = (value: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json; charset=utf-8", ...PRIVATE_HEADERS, ...headers } });
const nowIso = () => new Date().toISOString();
const future = (milliseconds: number) => new Date(Date.now() + milliseconds).toISOString();
const statement = (db: DiscoveryDatabase, sql: string, ...values: Value[]) => db.prepare(sql).bind(...values);
const changed = (result: unknown): boolean => Number((result as { meta?: { changes?: unknown } })?.meta?.changes) === 1;
const pageOffset = (url: URL) => Math.min(10000, Math.max(0, Math.floor(Number(url.searchParams.get("offset")) || 0)));
function equalDigest(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0; for (let index = 0; index < a.length; index++) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

function sameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin !== new URL(request.url).origin || ![null, "same-origin", "none"].includes(request.headers.get("sec-fetch-site"))) fail(403, "same_origin_required");
}
function boundedText(value: unknown, max: number, name: string, required = false): string {
  if (value === null || value === undefined || value === "") { if (required) fail(422, name + "_required"); return ""; }
  if (typeof value !== "string" || Array.from(value).length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) fail(422, name + "_invalid");
  const result = value.trim(); if (required && !result) fail(422, name + "_required"); return result;
}
function idempotency(value: unknown): string {
  const key = boundedText(value, 128, "idempotency_key", true);
  if (!/^[A-Za-z0-9._:-]{16,128}$/.test(key)) fail(422, "idempotency_key_invalid");
  return key;
}
async function bodyBytes(request: Request, limit: number): Promise<ArrayBuffer> {
  const advertised = Number(request.headers.get("content-length"));
  if (advertised > limit) fail(413, "request_too_large");
  if (!request.body) fail(422, "body_required");
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > limit) { await reader.cancel(); fail(413, "request_too_large"); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(size); let offset = 0;
  for (const part of chunks) { result.set(part, offset); offset += part.length; }
  return result.buffer;
}
async function bodyJson(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) fail(415, "json_required");
  let value: unknown;
  try { value = JSON.parse(new TextDecoder().decode(await bodyBytes(request, 16 * 1024))); } catch (error) { if (error instanceof BiosecurityError) throw error; fail(422, "json_invalid"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(422, "json_invalid");
  return value as Record<string, unknown>;
}

async function guest(request: Request, env: BiosecurityEnv): Promise<{ ownerHash: string; expiresAt: string }> {
  const credential = await readGuestCredential(request.headers.get("cookie"), GUEST_SCOPE);
  if (!credential) fail(401, "guest_session_required");
  const hash = await credentialDigest(credential);
  const row = await statement(env.OBS_DB, "SELECT owner_hash, expires_at FROM biosecurity_guest_sessions WHERE owner_hash = ? AND revoked_at IS NULL AND expires_at > ?", hash, nowIso()).first<{ owner_hash: string; expires_at: string }>();
  if (!row) fail(401, "guest_session_expired");
  return { ownerHash: row.owner_hash, expiresAt: row.expires_at };
}

async function initializeGuest(request: Request, env: BiosecurityEnv): Promise<Response> {
  if (![null,"same-origin","none"].includes(request.headers.get("sec-fetch-site")) || (request.headers.has("origin") && request.headers.get("origin") !== new URL(request.url).origin)) fail(403,"same_origin_required");
  try { const active = await guest(request, env); return json({ ready: true, expiresAt: active.expiresAt }); } catch (error) { if (!(error instanceof BiosecurityError) || error.status !== 401) throw error; }
  const token = randomCredential(); const expiresAt = future(BIOSECURITY_RETENTION_DAYS * DAY); const now = nowIso(); const ownerHash = await credentialDigest(token);
  const scope = "guest-issue:" + now.slice(0, 10);
  const ipScope = "guest-issue-ip:" + now.slice(0, 10) + ":" + await credentialDigest(request.headers.get("cf-connecting-ip") ?? "unknown");
  const results = await env.OBS_DB.batch([
    statement(env.OBS_DB, "INSERT INTO biosecurity_guest_sessions (owner_hash, expires_at, created_at) SELECT ?,?,? WHERE COALESCE((SELECT count FROM biosecurity_usage WHERE scope = ?),0) < 2000 AND COALESCE((SELECT count FROM biosecurity_usage WHERE scope = ?),0) < 100", ownerHash, expiresAt, now, scope, ipScope),
    ...[scope,ipScope].map(key=>statement(env.OBS_DB,"INSERT INTO biosecurity_usage (scope,count,bytes) SELECT ?,1,0 WHERE EXISTS (SELECT 1 FROM biosecurity_guest_sessions WHERE owner_hash = ?) ON CONFLICT(scope) DO UPDATE SET count = count + 1",key,ownerHash)),
  ]);
  if (!changed(results[0])) fail(429,"guest_session_capacity_reached");
  return json({ ready: true, expiresAt }, 200, { "set-cookie": privateCookie(await guestCookieName(GUEST_SCOPE), token, BIOSECURITY_RETENTION_DAYS * 86400) });
}

export interface CapturePhoto { bytes: ArrayBuffer; mime: string; sha: string }
export interface CaptureInput {
  profileId: string; profileVersion: string; observedAt: string | null; municipalityCode: string | null;
  spotLabel: string | null; signal: string; note: string | null; exactLat: number | null; exactLng: number | null;
  isMinor: boolean; key: string; photos: CapturePhoto[]; digest: string; captureMetadata: BiosecurityCaptureMetadata;
}

export async function parseCapture(request: Request): Promise<CaptureInput> {
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data;")) fail(415, "multipart_required");
  let form: FormData;
  try { form = await new Response(await bodyBytes(request, BIOSECURITY_LIMITS.requestBytes), { headers: { "content-type": request.headers.get("content-type")! } }).formData(); } catch (error) { if (error instanceof BiosecurityError) throw error; fail(422, "form_invalid"); }
  const profile = biosecurityProfile(form.get("profile_id")); if (!profile) fail(422, "profile_invalid");
  const files = form.getAll("photos");
  if (files.length < 1 || files.length > BIOSECURITY_LIMITS.photos) fail(422, "one_to_six_photos_required");
  const photos: CapturePhoto[] = [];
  for (const file of files) {
    if (!(file instanceof File) || file.size < 16 || file.size > BIOSECURITY_LIMITS.photoBytes) fail(422, "photo_size_invalid");
    try {
      const clean = removePhotoMetadata(await file.arrayBuffer(), file.type);
      photos.push({ ...clean, sha: await credentialDigest(clean.bytes) });
    } catch { fail(422, "photo_format_invalid"); }
  }
  const rawDate = boundedText(form.get("observed_at"), 40, "observed_at");
  const code = boundedText(form.get("municipality_code"), 6, "municipality_code");
  const municipality = code ? findMunicipality(code) : null; if (code && !municipality) fail(422, "municipality_invalid");
  const lat = form.get("exact_lat"); const lng = form.get("exact_lng");
  const exactLat = lat === null || lat === "" ? null : Number(lat);
  const exactLng = lng === null || lng === "" ? null : Number(lng);
  if ((exactLat === null) !== (exactLng === null) || (exactLat !== null && (!Number.isFinite(exactLat) || Math.abs(exactLat) > 90 || !Number.isFinite(exactLng) || Math.abs(exactLng!) > 180))) fail(422, "location_invalid");
  let captureMetadata: BiosecurityCaptureMetadata;
  try { captureMetadata = parseBiosecurityCaptureMetadata(boundedText(form.get("capture_metadata"), 4096, "capture_metadata"), rawDate, photos.length, exactLat !== null); }
  catch (error) { fail(422, error instanceof Error ? error.message : "capture_metadata_invalid"); }
  const signal = boundedText(form.get("signal"), 40, "signal") || "unknown";
  if (!profile.signals.some(item => item.value === signal)) fail(422, "signal_invalid");
  const input = {
    profileId: profile.id, profileVersion: profile.version, observedAt: captureMetadata.time.instant, captureMetadata, municipalityCode: municipality?.code ?? null,
    spotLabel: boundedText(form.get("spot_label"), 160, "spot_label") || null, signal,
    note: boundedText(form.get("note"), 1000, "note") || null, exactLat, exactLng,
    isMinor: ["true", "yes", "1"].includes(String(form.get("is_minor") ?? "")), key: idempotency(form.get("idempotency_key")), photos,
  };
  const digest = await credentialDigest(JSON.stringify({ ...input, photos: photos.map(photo => ({ mime: photo.mime, sha: photo.sha, bytes: photo.bytes.byteLength })) }));
  return { ...input, digest };
}

type CaptureRow = {
  record_id: string; draft_id: string; owner_hash: string; profile_id: string; profile_version: string;
  municipality_code: string | null; spot_label: string | null; signal: string; is_minor: number;
  request_digest: string; reserved_bytes: number; selected_count: number; persistence: string;
  lease_token: string | null; lease_until: string | null; created_at: string; expires_at: string;
  capture_details_json: string | null; private_note: string | null; environment_json: string | null; environment_version: number;
};
type AssetRow = { asset_id: string; object_key: string; mime: string; bytes: number; sha256: string; processing_state: string };
type ObservationRow = { observed_at: string | null; note: string | null; exact_lat: number | null; exact_lng: number | null };
type ShareRow = { share_id: string; record_id: string; municipality_code: string; purpose: string; fields_json: string; owner_hash: string; status: string; version: number; created_at: string; acknowledged_at: string | null; request_digest: string; environment_json: string | null };
type HintAttempt = { record_id: string; asset_id: string; asset_sha256: string; model: string; question_version: string; state: "reserved" | "ready" | "unavailable"; created_at: string; completed_at: string | null };
export type BiosecurityEnvironment = { status: "not_requested" | "processing" | "ready" | "unavailable" | "budget_reached" | "off"; version: number; values: Record<string, string>; model: string | null; questionVersion: string | null; photoNumber: number | null; updatedAt: string | null; multiTaxa?: PostTaxonResult };

export class BiosecurityStore {
  constructor(readonly db: DiscoveryDatabase, readonly bucket: DiscoveryBucket) {}
  async context(id: string): Promise<CaptureRow | null> { return statement(this.db, "SELECT * FROM biosecurity_record_contexts WHERE record_id = ?", id).first<CaptureRow>(); }
  async assets(draftId: string): Promise<AssetRow[]> { return (await statement(this.db, "SELECT asset_id, object_key, mime, bytes, sha256, processing_state FROM asset_ledger WHERE draft_id = ? ORDER BY asset_id", draftId).all<AssetRow>()).results; }
  async ownerContext(id: string, ownerHash: string): Promise<CaptureRow> {
    const row = await this.context(id);
    if (!row || row.owner_hash !== ownerHash || row.expires_at <= nowIso() || ["deleting", "deleted"].includes(row.persistence)) fail(404, "record_not_found");
    const active = await statement(this.db,"SELECT owner_hash FROM biosecurity_guest_sessions WHERE owner_hash = ? AND revoked_at IS NULL AND expires_at > ?",ownerHash,nowIso()).first();
    if (!active) fail(404,"record_not_found");
    return row;
  }
  private metadata(row: CaptureRow, observation: ObservationRow): BiosecurityCaptureMetadata {
    return row.capture_details_json ? JSON.parse(row.capture_details_json) as BiosecurityCaptureMetadata : legacyBiosecurityCaptureMetadata(observation.observed_at, observation.exact_lat !== null && observation.exact_lng !== null);
  }
  private async observation(row: CaptureRow): Promise<ObservationRow> {
    const observation = await statement(this.db, "SELECT observed_at,note,exact_lat,exact_lng FROM observations WHERE observation_id = ? AND owner_user_id = ? AND visibility = 'private'", row.record_id, "guest:" + row.owner_hash).first<ObservationRow>();
    if (observation) return observation;
    // A photo with unknown time is durably saved as a private draft. It does not
    // become a fabricated dated observation merely to satisfy a NOT NULL column.
    const metadata = row.capture_details_json ? JSON.parse(row.capture_details_json) as BiosecurityCaptureMetadata : null;
    if (!metadata || metadata.time.instant !== null) fail(503, "record_storage_unavailable");
    const draft = await statement(this.db, "SELECT observed_at,exact_lat,exact_lng FROM draft_observations WHERE draft_id = ? AND owner_user_id = ? AND visibility = 'private' AND processing_state = 'finalized' AND observed_at IS NULL", row.draft_id, "guest:" + row.owner_hash).first<Omit<ObservationRow, "note">>();
    if (!draft) fail(503, "record_storage_unavailable");
    return { ...draft, note: row.private_note };
  }
  async environment(row: CaptureRow): Promise<BiosecurityEnvironment> {
    const stored = row.environment_json ? JSON.parse(row.environment_json) as Omit<BiosecurityEnvironment, "version"> : null;
    if (stored) return { ...stored, version: row.environment_version };
    const attempt = await statement(this.db, "SELECT * FROM biosecurity_photo_hint_attempts WHERE record_id = ?", row.record_id).first<HintAttempt>();
    return { status: attempt?.state === "reserved" ? (Date.parse(attempt.created_at) > Date.now() - 120_000 ? "processing" : "unavailable") : attempt ? "unavailable" : "not_requested", version: row.environment_version, values: {}, model: attempt?.model ?? null, questionVersion: attempt?.question_version ?? null, photoNumber: null, updatedAt: attempt?.completed_at ?? null };
  }
  async editEnvironment(ownerHash: string, id: string, body: Record<string, unknown>) {
    const row = await this.ownerContext(id, ownerHash);
    if (row.persistence !== "saved") fail(409, "record_still_saving");
    if (!Number.isSafeInteger(body.expectedVersion) || body.expectedVersion !== row.environment_version) fail(409, "environment_version_changed");
    if (!body.values || typeof body.values !== "object" || Array.isArray(body.values)) fail(422, "environment_values_invalid");
    const entries = Object.entries(body.values);
    if (entries.length < 1 || entries.length > ENVIRONMENT_RECORD_FIELDS.length) fail(422, "environment_values_invalid");
    const values: Record<string, string> = {};
    for (const [name, value] of entries) {
      const field = ENVIRONMENT_RECORD_FIELDS.find(item => item.field === name);
      if (!field || typeof value !== "string") fail(422, "environment_values_invalid");
      try { values[field.field] = normalizeEnvironmentRecordValue(field.field, value); } catch { fail(422, "environment_values_invalid"); }
    }
    const current = await this.environment(row); const now = nowIso();
    const environment: BiosecurityEnvironment = { ...current, status: "ready", version: row.environment_version + 1, updatedAt: now, values: mergeUserEnvironmentRecordValues(current.values, values, { updatedAt: now, updatedBy: "biosecurity_owner" }) };
    const result = await statement(this.db, "UPDATE biosecurity_record_contexts SET environment_json = ?, environment_version = environment_version + 1 WHERE record_id = ? AND owner_hash = ? AND environment_version = ? AND persistence = 'saved' AND expires_at > ? AND EXISTS (SELECT 1 FROM biosecurity_guest_sessions WHERE owner_hash = ? AND revoked_at IS NULL AND expires_at > ?)", JSON.stringify(environment), id, ownerHash, row.environment_version, now, ownerHash, now).run();
    if (!changed(result)) { await this.ownerContext(id, ownerHash); fail(409, "environment_version_changed"); }
    await this.ownerContext(id, ownerHash);
    return { environment };
  }
  async photoHints(ownerHash: string, id: string, env: BiosecurityEnv, ipHash: string, consent: unknown) {
    let row = await this.ownerContext(id, ownerHash);
    if (row.persistence !== "saved") fail(409, "record_still_saving");
    if (consent !== true) fail(422, "photo_hint_consent_required");
    const existing = await statement(this.db, "SELECT * FROM biosecurity_photo_hint_attempts WHERE record_id = ?", id).first<HintAttempt>();
    if (existing) { const environment = await this.environment(row); await this.ownerContext(id, ownerHash); return { environment }; }
    const budget = Number(env.BIOSECURITY_PHOTO_HINT_DAILY_TOKENS);
    if (env.BIOSECURITY_PHOTO_HINTS_ENABLED !== "on" || !env.AI || !Number.isSafeInteger(budget) || budget < BIOSECURITY_PHOTO_HINT_MAX_INPUT_TOKENS || budget > 200_000) {
      const environment = { ...await this.environment(row), status: "off" as const }; await this.ownerContext(id, ownerHash); return { environment };
    }
    const assets = await this.assets(row.draft_id);
    const asset = assets[0];
    if (!asset || assets.length !== row.selected_count || assets.some(item => item.processing_state !== "ready" || item.bytes > BIOSECURITY_LIMITS.photoBytes)) fail(503, "photo_storage_incomplete");
    const multiTaxaEnabled = env.BIOSECURITY_MULTI_TAXA_ENABLED === "on";
    const reservedTokens = BIOSECURITY_PHOTO_HINT_MAX_INPUT_TOKENS + (multiTaxaEnabled ? assets.length * MULTI_TAXA_MAX_INPUT_TOKENS : 0);
    const now = nowIso(), attemptKey = randomCredential();
    const scopes = [
      { key: "hint-day:" + now.slice(0, 10), count: BIOSECURITY_LIMITS.dailyRecords, tokens: budget },
      { key: "hint-guest:" + now.slice(0, 10) + ":" + ownerHash, count: 3, tokens: Number.MAX_SAFE_INTEGER },
      { key: "hint-ip:" + now.slice(0, 10) + ":" + ipHash, count: 5, tokens: Number.MAX_SAFE_INTEGER },
    ];
    const checks = scopes.map(() => "COALESCE((SELECT count FROM biosecurity_usage WHERE scope = ?),0) < ? AND COALESCE((SELECT bytes FROM biosecurity_usage WHERE scope = ?),0) + ? <= ?").join(" AND ");
    const writes: Statement[] = [statement(this.db, `INSERT OR IGNORE INTO biosecurity_photo_hint_attempts (record_id,attempt_key,asset_id,asset_sha256,model,question_version,state,reserved_tokens,created_at) SELECT ?,?,?,?,?,?,'reserved',?,? WHERE ${checks} AND EXISTS (SELECT 1 FROM biosecurity_record_contexts c JOIN biosecurity_guest_sessions g ON g.owner_hash = c.owner_hash WHERE c.record_id = ? AND c.owner_hash = ? AND c.persistence = 'saved' AND c.expires_at > ? AND g.revoked_at IS NULL AND g.expires_at > ?)`, id, attemptKey, asset.asset_id, asset.sha256, BIOSECURITY_PHOTO_HINT_MODEL, BIOSECURITY_PHOTO_HINT_VERSION, reservedTokens, now, ...scopes.flatMap(scope => [scope.key, scope.count, scope.key, reservedTokens, scope.tokens]), id, ownerHash, now, now)];
    for (const scope of scopes) writes.push(statement(this.db, "INSERT INTO biosecurity_usage (scope,count,bytes) SELECT ?,1,? WHERE EXISTS (SELECT 1 FROM biosecurity_photo_hint_attempts WHERE record_id = ? AND attempt_key = ?) ON CONFLICT(scope) DO UPDATE SET count = count + 1, bytes = bytes + excluded.bytes", scope.key, reservedTokens, id, attemptKey));
    // Count and token reservations precede the only provider call. Unknown outcomes
    // retain their reservation and are not automatically resent on retries/reloads.
    const reserved = await this.db.batch(writes);
    if (!changed(reserved[0])) {
      row = await this.ownerContext(id, ownerHash);
      const raced = await statement(this.db, "SELECT * FROM biosecurity_photo_hint_attempts WHERE record_id = ?", id).first<HintAttempt>();
      const environment = raced ? await this.environment(row) : { ...await this.environment(row), status: "budget_reached" as const };
      await this.ownerContext(id, ownerHash);
      return { environment };
    }
    let generated: Awaited<ReturnType<typeof generateBiosecurityPhotoHints>> | null = null;
    let multiTaxa: PostTaxonResult | null = null;
    try {
      const head = await this.bucket.head(asset.object_key);
      if (!head || head.size !== asset.bytes) fail(503, "photo_storage_unconfirmed");
      const object = await this.bucket.get(asset.object_key);
      if (!object?.body) fail(503, "photo_storage_unavailable");
      const bytes = await new Response(object.body).arrayBuffer();
      if (bytes.byteLength !== asset.bytes) fail(503, "photo_storage_unconfirmed");
      await this.ownerContext(id, ownerHash);
      generated = await generateBiosecurityPhotoHints(env.AI, { bytes, mime: asset.mime, sha256: asset.sha256, assetId: asset.asset_id });
      if (multiTaxaEnabled) {
        const analyzed: PhotoTaxonResult[] = [];
        for (let index = 0; index < assets.length; index++) {
          const target = assets[index]!;
          await this.ownerContext(id, ownerHash); // An owner deletion cancels later inference and prevents resurrection.
          let image = index === 0 ? bytes : null;
          if (!image) {
            const head = await this.bucket.head(target.object_key);
            if (!head || head.size !== target.bytes) fail(503, "photo_storage_unconfirmed");
            const saved = await this.bucket.get(target.object_key);
            if (!saved?.body) fail(503, "photo_storage_unavailable");
            image = await new Response(saved.body).arrayBuffer();
          }
          if (image.byteLength !== target.bytes) fail(503, "photo_storage_unconfirmed");
          analyzed.push(await generateMultiTaxaHints(env.AI, { bytes: image, mime: target.mime, sha256: target.sha256, assetId: target.asset_id }, index + 1));
        }
        multiTaxa = mergeMultiTaxaPhotos(analyzed);
      }
    } catch (error) {
      if (error instanceof BiosecurityError && error.status === 404) throw error;
      // Saving remains complete even when photo assistance is unavailable.
    }
    const completedAt = nowIso();
    // A user can correct fields while inference is in flight. Bounded CAS retries
    // merge onto those corrections; neither rejected fields nor deleted records return.
    for (let attempt = 0; attempt < 3; attempt++) {
      row = await this.ownerContext(id, ownerHash);
      if (row.persistence !== "saved") fail(404, "record_not_found");
      const current = await this.environment(row);
      const values = generated && generated.status !== "unavailable" ? mergeAutoEnvironmentRecordValues(current.values, generated.environmentRecord, { updatedAt: completedAt, updatedBy: "biosecurity_photo_clef_v1" }) : current.values;
      const environment: BiosecurityEnvironment = { status: (generated && generated.status !== "unavailable") || (multiTaxa && multiTaxa.status !== "unavailable") || ENVIRONMENT_RECORD_FIELDS.some(field => values[field.field]) ? "ready" : "unavailable", version: row.environment_version + 1, values, model: BIOSECURITY_PHOTO_HINT_MODEL, questionVersion: BIOSECURITY_PHOTO_HINT_VERSION, photoNumber: generated && generated.status !== "unavailable" ? 1 : null, updatedAt: completedAt, ...(multiTaxa ? { multiTaxa } : {}) };
      const results = await this.db.batch([
        statement(this.db, "UPDATE biosecurity_record_contexts SET environment_json = ?, environment_version = environment_version + 1 WHERE record_id = ? AND owner_hash = ? AND persistence = 'saved' AND expires_at > ? AND environment_version = ? AND EXISTS (SELECT 1 FROM biosecurity_guest_sessions WHERE owner_hash = ? AND revoked_at IS NULL AND expires_at > ?)", JSON.stringify(environment), id, ownerHash, completedAt, row.environment_version, ownerHash, completedAt),
        statement(this.db, "UPDATE biosecurity_photo_hint_attempts SET state = ?,input_tokens = ?,completed_at = ? WHERE record_id = ? AND attempt_key = ? AND changes() = 1", generated && generated.status !== "unavailable" ? "ready" : "unavailable", generated?.inputTokens !== null && generated?.inputTokens !== undefined && multiTaxa?.inputTokens !== null && multiTaxa?.inputTokens !== undefined ? generated.inputTokens + multiTaxa.inputTokens : multiTaxa ? null : generated?.inputTokens ?? null, completedAt, id, attemptKey),
      ]);
      if (changed(results[0])) { await this.ownerContext(id, ownerHash); return { environment }; }
    }
    await statement(this.db, "UPDATE biosecurity_photo_hint_attempts SET state = 'unavailable', completed_at = ? WHERE record_id = ? AND attempt_key = ?", completedAt, id, attemptKey).run();
    row = await this.ownerContext(id, ownerHash);
    const environment = await this.environment(row);
    await this.ownerContext(id, ownerHash);
    return { environment };
  }
  async receipt(id: string, ownerHash: string) {
    const row = await this.ownerContext(id, ownerHash);
    if (row.persistence !== "saved") fail(409, "record_still_saving");
    const observation = await this.observation(row); const metadata = this.metadata(row, observation);
    const assets = await this.assets(row.draft_id);
    if (assets.length !== row.selected_count || assets.some(asset => asset.processing_state !== "ready")) fail(503, "photo_storage_incomplete");
    const shares = (await statement(this.db, "SELECT * FROM biosecurity_shares WHERE record_id = ? ORDER BY created_at DESC LIMIT 50", id).all<ShareRow>()).results;
    const environment = await this.environment(row);
    // A private, owner-only temporal overlap, never a confirmed Place identity.
    // A matching free-text spot label alone cannot establish that two locations
    // or organisms are identical. Return links only to the current guest's
    // still-active drafts; no map, public feed or municipal inbox projection.
    const related = row.spot_label && row.municipality_code
      ? (await statement(this.db,
          "SELECT record_id, spot_label, created_at FROM biosecurity_record_contexts WHERE owner_hash = ? AND municipality_code = ? AND spot_label = ? AND record_id <> ? AND persistence = 'saved' AND expires_at > ? ORDER BY created_at DESC LIMIT 5",
          ownerHash, row.municipality_code, row.spot_label, id, nowIso())
          .all<{ record_id: string; spot_label: string; created_at: string }>()).results
      : [];
    await this.ownerContext(id,ownerHash);
    return {
      relatedRecords: related.map(other => ({
        id: other.record_id, spotLabel: other.spot_label,
        recordedAt: other.created_at, relation: "matching_spot_label_candidate" as const,
      })),
      id, profileId: row.profile_id, observedAt: metadata.time.instant, observedTime: metadata.time, locationSource: metadata.location.source, photoConflicts: metadata.conflicts, municipalityCode: row.municipality_code,
      municipalityName: findMunicipality(row.municipality_code ?? "")?.name ?? null,
      officialUrl: findMunicipality(row.municipality_code ?? "")?.website ?? biosecurityProfile(row.profile_id)?.guideUrl,
      spotLabel: row.spot_label, signal: row.signal, note: observation.note, isMinor: Boolean(row.is_minor),
      exactLocation: observation.exact_lat !== null && observation.exact_lng !== null ? { lat: observation.exact_lat, lng: observation.exact_lng } : null,
      status: "saved", photoCount: assets.length, expiresAt: row.expires_at, environment,
      photos: assets.map(asset => ({ id: asset.asset_id, url: `/api/v1/biosecurity/records/${id}/photos/${asset.asset_id}` })),
      shares: shares.map(share => ({ id: share.share_id, municipalityCode: share.municipality_code, municipalityName: findMunicipality(share.municipality_code)?.name, fields: JSON.parse(share.fields_json) as string[], status: share.status, version: share.version, acknowledgedAt: share.acknowledged_at })),
    };
  }

  async capture(ownerHash: string, input: CaptureInput, ipHash: string, storageBudget: number) {
    const recordId = "br_" + (await credentialDigest(JSON.stringify([ownerHash, input.key]))).slice(0, 40);
    const draftId = "bd_" + recordId.slice(3); const lease = randomCredential(); const now = nowIso();
    const bytes = input.photos.reduce((total, photo) => total + photo.bytes.byteLength, 0);
    const scopes = [
      { scope: "storage", count: Number.MAX_SAFE_INTEGER, bytes: storageBudget },
      { scope: "day:" + now.slice(0, 10), count: BIOSECURITY_LIMITS.dailyRecords, bytes: Number.MAX_SAFE_INTEGER },
      { scope: "guest:" + now.slice(0, 10) + ":" + ownerHash, count: BIOSECURITY_LIMITS.guestDailyRecords, bytes: Number.MAX_SAFE_INTEGER },
      { scope: "ip:" + now.slice(0, 10) + ":" + ipHash, count: BIOSECURITY_LIMITS.ipDailyRecords, bytes: Number.MAX_SAFE_INTEGER },
    ];
    let row = await this.context(recordId);
    if (!row) {
      const conditions = scopes.map(() => "COALESCE((SELECT count FROM biosecurity_usage WHERE scope = ?), 0) < ? AND COALESCE((SELECT bytes FROM biosecurity_usage WHERE scope = ?), 0) + ? <= ?").join(" AND ");
      const checks = scopes.flatMap(scope => [scope.scope, scope.count, scope.scope, bytes, scope.bytes]);
      const writes: Statement[] = [statement(this.db,
        `INSERT OR IGNORE INTO biosecurity_record_contexts (record_id,draft_id,owner_hash,profile_id,profile_version,municipality_code,spot_label,signal,is_minor,idempotency_key,request_digest,reserved_bytes,selected_count,persistence,lease_token,lease_until,created_at,expires_at,capture_details_json,private_note)
         SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?, 'uploading',?,?,?,?,?,? WHERE ${conditions}
         AND EXISTS (SELECT 1 FROM biosecurity_guest_sessions WHERE owner_hash = ? AND revoked_at IS NULL AND expires_at > ?)`,
        recordId,draftId,ownerHash,input.profileId,input.profileVersion,input.municipalityCode,input.spotLabel,input.signal,input.isMinor ? 1 : 0,input.key,input.digest,bytes,input.photos.length,lease,future(5 * 60_000),now,future(BIOSECURITY_RETENTION_DAYS * DAY),JSON.stringify(input.captureMetadata),input.note,...checks,ownerHash,now),
      ];
      for (const scope of scopes) writes.push(statement(this.db,
        `INSERT INTO biosecurity_usage (scope,count,bytes) SELECT ?,1,? WHERE EXISTS (SELECT 1 FROM biosecurity_record_contexts WHERE record_id = ? AND lease_token = ?)
         ON CONFLICT(scope) DO UPDATE SET count = count + 1, bytes = bytes + excluded.bytes`, scope.scope,bytes,recordId,lease));
      writes.push(statement(this.db,
        `INSERT OR IGNORE INTO draft_observations (draft_id,owner_user_id,observed_at,exact_lat,exact_lng,public_cell,visibility,processing_state)
         SELECT ?,?,?,?,?, 'unknown','private','draft' WHERE EXISTS (SELECT 1 FROM biosecurity_record_contexts WHERE record_id = ? AND lease_token = ?)`,
        draftId,"guest:"+ownerHash,input.observedAt,input.exactLat,input.exactLng,recordId,lease));
      for (let index = 0; index < input.photos.length; index++) {
        const photo = input.photos[index]!; const assetId = `ba_${recordId.slice(3)}_${index}`;
        writes.push(statement(this.db,
          `INSERT OR IGNORE INTO asset_ledger (asset_id,draft_id,observation_id,owner_user_id,object_key,sha256,mime,bytes,visibility,processing_state)
           SELECT ?,?,NULL,?,?,?,?,?,'private','awaiting_upload' WHERE EXISTS (SELECT 1 FROM biosecurity_record_contexts WHERE record_id = ? AND lease_token = ?)`,
          assetId,draftId,"guest:"+ownerHash,`private/biosecurity/${recordId}/${assetId}`,photo.sha,photo.mime,photo.bytes.byteLength,recordId,lease));
      }
      await this.db.batch(writes); row = await this.context(recordId);
      if (!row) fail(429, "capture_capacity_reached");
    }
    if (row.request_digest !== input.digest) fail(409, "idempotency_payload_changed");
    if (["deleting", "deleted"].includes(row.persistence) || row.expires_at <= now) fail(410, "record_expired");
    if (row.persistence === "saved") return this.receipt(recordId, ownerHash);
    if (row.lease_token !== lease) {
      const acquired = await statement(this.db, "UPDATE biosecurity_record_contexts SET lease_token = ?, lease_until = ? WHERE record_id = ? AND persistence = 'uploading' AND lease_until <= ?", lease, future(5 * 60_000), recordId, now).run();
      if (!changed(acquired)) fail(409, "save_in_progress_retry_same_request");
    }
    try {
      for (let index = 0; index < input.photos.length; index++) {
        const photo = input.photos[index]!; const assetId = `ba_${recordId.slice(3)}_${index}`; const key = `private/biosecurity/${recordId}/${assetId}`;
        await this.bucket.put(key, photo.bytes, { sha256:Uint8Array.from(photo.sha.match(/../g)!,pair=>parseInt(pair,16)).buffer, httpMetadata: { contentType: photo.mime, cacheControl: "private, no-store" }, customMetadata: { sha256: photo.sha, privacy: "metadata-removed-private" } });
        const stored = await this.bucket.head(key);
        if (!stored || stored.size !== photo.bytes.byteLength) fail(503, "photo_storage_unconfirmed");
      }
      const finalize: Statement[] = [statement(this.db,
        `INSERT OR IGNORE INTO observations (observation_id,draft_id,owner_user_id,observed_at,taxon_label,note,exact_lat,exact_lng,public_cell,visibility,processing_state)
         SELECT ?,?,?,?,NULL,?,?,?,'unknown','private','accepted' WHERE ? IS NOT NULL AND EXISTS (SELECT 1 FROM biosecurity_record_contexts c JOIN biosecurity_guest_sessions g ON g.owner_hash = c.owner_hash WHERE c.record_id = ? AND c.lease_token = ? AND c.persistence = 'uploading' AND c.expires_at > ? AND g.revoked_at IS NULL AND g.expires_at > ?)`,
        recordId,draftId,"guest:"+ownerHash,input.observedAt,input.note,input.exactLat,input.exactLng,input.observedAt,recordId,lease,nowIso(),nowIso()),
        statement(this.db,"UPDATE asset_ledger SET observation_id = (SELECT observation_id FROM observations WHERE observation_id = ?), processing_state = 'ready', uploaded_at = ? WHERE draft_id = ? AND (? IS NULL OR EXISTS (SELECT 1 FROM observations WHERE observation_id = ?)) AND EXISTS (SELECT 1 FROM biosecurity_record_contexts c JOIN biosecurity_guest_sessions g ON g.owner_hash = c.owner_hash WHERE c.record_id = ? AND c.lease_token = ? AND c.persistence = 'uploading' AND c.expires_at > ? AND g.revoked_at IS NULL AND g.expires_at > ?)",recordId,nowIso(),draftId,input.observedAt,recordId,recordId,lease,nowIso(),nowIso()),
        statement(this.db,"UPDATE draft_observations SET processing_state = 'finalized', finalized_at = ? WHERE draft_id = ? AND (? IS NULL OR EXISTS (SELECT 1 FROM observations WHERE observation_id = ?)) AND EXISTS (SELECT 1 FROM biosecurity_record_contexts c JOIN biosecurity_guest_sessions g ON g.owner_hash = c.owner_hash WHERE c.record_id = ? AND c.lease_token = ? AND c.persistence = 'uploading' AND c.expires_at > ? AND g.revoked_at IS NULL AND g.expires_at > ?)",nowIso(),draftId,input.observedAt,recordId,recordId,lease,nowIso(),nowIso()),
        statement(this.db,"UPDATE biosecurity_record_contexts SET persistence = 'saved', lease_token = NULL, lease_until = NULL WHERE record_id = ? AND lease_token = ? AND persistence = 'uploading' AND EXISTS (SELECT 1 FROM draft_observations WHERE draft_id = ? AND processing_state = 'finalized') AND (SELECT COUNT(*) FROM asset_ledger WHERE draft_id = ? AND processing_state = 'ready') = selected_count",recordId,lease,draftId,draftId),
        statement(this.db,"UPDATE biosecurity_guest_sessions SET expires_at = MAX(expires_at, ?) WHERE owner_hash = ? AND revoked_at IS NULL AND EXISTS (SELECT 1 FROM biosecurity_record_contexts WHERE record_id = ? AND persistence = 'saved')",future(BIOSECURITY_RETENTION_DAYS * DAY),ownerHash,recordId),
      ];
      await this.db.batch(finalize);
      return await this.receipt(recordId, ownerHash);
    } catch (error) {
      await statement(this.db,"UPDATE biosecurity_record_contexts SET lease_until = ? WHERE record_id = ? AND lease_token = ? AND persistence = 'uploading'",nowIso(),recordId,lease).run().catch(() => undefined);
      const current = await this.context(recordId).catch(() => null);
      if (current && ["deleting","deleted"].includes(current.persistence)) {
        for (let index=0;index<input.photos.length;index++) await this.bucket.delete(`private/biosecurity/${recordId}/ba_${recordId.slice(3)}_${index}`).catch(()=>undefined);
      }
      throw error;
    }
  }

  async share(ownerHash: string, id: string, body: Record<string, unknown>) {
    const record = await this.ownerContext(id, ownerHash);
    if (record.persistence !== "saved") fail(409, "record_still_saving");
    const municipality = findMunicipality(boundedText(body.municipalityCode, 6, "municipality_code", true));
    if (!municipality) fail(422, "municipality_invalid");
    if (body.consent !== true || body.purpose !== "invasive_response") fail(422, "explicit_recipient_consent_required");
    if (record.is_minor && body.guardianConsent !== true) fail(422, "guardian_consent_required");
    const allowed = ["photos", "observedAt", "spotLabel", "note", "exactLocation", "environment"];
    if (!Array.isArray(body.fields) || body.fields.some(field => typeof field !== "string" || !allowed.includes(field))) fail(422, "share_fields_invalid");
    const fields = [...new Set(body.fields as string[])].sort();
    if (!fields.includes("observedAt") || fields.length < 2) fail(422, "select_information_to_share");
    if (fields.includes("environment") && (!Number.isSafeInteger(body.environmentVersion) || (body.environmentVersion as number) < 1)) fail(409, "environment_version_changed");
    const key = idempotency(body.idempotencyKey);
    const digest = await credentialDigest(JSON.stringify([id,municipality.code,fields,body.guardianConsent === true,...(fields.includes("environment") ? [body.environmentVersion] : [])]));
    const shareId = "bs_" + (await credentialDigest(JSON.stringify([ownerHash,key]))).slice(0,40); const now = nowIso();
    const previous = await statement(this.db,"SELECT * FROM biosecurity_shares WHERE share_id = ? AND owner_hash = ?",shareId,ownerHash).first<ShareRow>();
    if (previous) {
      if (previous.request_digest !== digest) fail(409,"idempotency_payload_changed");
      await this.ownerContext(id,ownerHash);
      return { shareId, status: previous.status, version: previous.version };
    }
    const environment = fields.includes("environment") ? await this.environment(record) : null;
    if (environment && (environment.status !== "ready" || !ENVIRONMENT_RECORD_FIELDS.some(field => environment.values[field.field]) || body.environmentVersion !== record.environment_version)) fail(409, "environment_version_changed");
    await this.db.batch([
      statement(this.db,"INSERT OR IGNORE INTO biosecurity_shares (share_id,record_id,municipality_code,purpose,fields_json,guardian_consent,owner_hash,idempotency_key,request_digest,status,created_at,environment_json) SELECT ?,?,?,'invasive_response',?,?,?,?,?,'available',?,? WHERE EXISTS (SELECT 1 FROM biosecurity_record_contexts c JOIN biosecurity_guest_sessions g ON g.owner_hash = c.owner_hash WHERE c.record_id = ? AND c.persistence = 'saved' AND c.expires_at > ? AND g.revoked_at IS NULL AND g.expires_at > ? AND (? IS NULL OR c.environment_version = ?)) AND (SELECT COUNT(*) FROM biosecurity_shares WHERE record_id = ?) < ?",shareId,id,municipality.code,JSON.stringify(fields),body.guardianConsent === true ? 1 : 0,ownerHash,key,digest,now,environment ? JSON.stringify({ ...environment, multiTaxa: undefined }) : null,id,now,now,environment?.version ?? null,environment?.version ?? null,id,BIOSECURITY_LIMITS.recordShares),
      statement(this.db,"INSERT OR IGNORE INTO biosecurity_share_events (event_id,share_id,event_type,actor_id,version,created_at) SELECT ?,?,'consented',?,1,? WHERE EXISTS (SELECT 1 FROM biosecurity_shares WHERE share_id = ? AND request_digest = ?)","be_"+shareId,shareId,"guest:"+ownerHash,now,shareId,digest),
    ]);
    const stored = await statement(this.db,"SELECT * FROM biosecurity_shares WHERE share_id = ?",shareId).first<ShareRow>();
    if (!stored) {
      const current = await this.ownerContext(id,ownerHash);
      if (environment && current.environment_version !== environment.version) fail(409, "environment_version_changed");
      fail(429,"share_capacity_reached");
    }
    if (stored.request_digest !== digest) fail(409,"idempotency_payload_changed");
    return { shareId, status: stored.status, version: stored.version };
  }

  async withdraw(ownerHash: string, shareId: string, expectedVersion: unknown) {
    const row = await statement(this.db,"SELECT * FROM biosecurity_shares WHERE share_id = ? AND owner_hash = ?",shareId,ownerHash).first<ShareRow>();
    if (!row) fail(404,"share_not_found");
    if (row.status === "withdrawn") return { status: "withdrawn", version: row.version };
    if (!Number.isInteger(expectedVersion) || expectedVersion !== row.version) fail(409,"share_version_changed");
    const now = nowIso();
    const results = await this.db.batch([
      statement(this.db,"UPDATE biosecurity_shares SET status = 'withdrawn', version = version + 1, withdrawn_at = ?, environment_json = NULL WHERE share_id = ? AND owner_hash = ? AND version = ? AND status <> 'withdrawn' AND EXISTS (SELECT 1 FROM biosecurity_guest_sessions WHERE owner_hash = ? AND revoked_at IS NULL AND expires_at > ?)",now,shareId,ownerHash,row.version,ownerHash,now),
      statement(this.db,"INSERT INTO biosecurity_share_events (event_id,share_id,event_type,actor_id,version,created_at) SELECT ?,?,'withdrawn',?,?,? WHERE changes() = 1","be_"+randomCredential(),shareId,"guest:"+ownerHash,row.version+1,now),
    ]);
    if (!changed(results[0])) fail(409,"share_version_changed");
    return { status:"withdrawn", version:row.version+1 };
  }

  async recipientRecord(share: ShareRow, municipalityCode: string) {
    if (share.municipality_code !== municipalityCode || share.status === "withdrawn") fail(404,"share_not_found");
    const record = await this.context(share.record_id);
    if (!record || record.persistence !== "saved" || record.expires_at <= nowIso()) fail(404,"share_not_found");
    const observation = await this.observation(record); const metadata = this.metadata(record, observation);
    const fields = JSON.parse(share.fields_json) as string[];
    const selected: Record<string, unknown> = { id: share.share_id, shareId: share.share_id, profileId: record.profile_id, status: share.status, version: share.version, fields, sharedAt: share.created_at, acknowledgedAt: share.acknowledged_at, expiresAt: record.expires_at };
    if (fields.includes("observedAt")) { selected.observedAt = metadata.time.instant; selected.observedTime = metadata.time; }
    if (fields.includes("spotLabel")) selected.spotLabel = record.spot_label;
    if (fields.includes("note")) selected.note = observation.note;
    if (fields.includes("exactLocation")) { selected.exactLocation = observation.exact_lat !== null && observation.exact_lng !== null ? { lat: observation.exact_lat, lng: observation.exact_lng } : null; selected.locationSource = metadata.location.source; }
    if (fields.includes("environment") && share.environment_json) selected.environment = JSON.parse(share.environment_json) as BiosecurityEnvironment;
    if (fields.includes("photos")) selected.photos = (await this.assets(record.draft_id)).map(asset => ({ id:asset.asset_id, url:`/api/v1/biosecurity/inbox/${share.share_id}/photos/${asset.asset_id}` }));
    const current=await statement(this.db,"SELECT s.version FROM biosecurity_shares s JOIN biosecurity_record_contexts c ON c.record_id = s.record_id WHERE s.share_id = ? AND s.municipality_code = ? AND s.status <> 'withdrawn' AND c.persistence = 'saved' AND c.expires_at > ?",share.share_id,municipalityCode,nowIso()).first<{version:number}>();
    if (!current || current.version !== share.version) fail(404,"share_not_found");
    return selected;
  }

  async acknowledge(shareId: string, municipalityCode: string, actorId: string, expectedVersion: unknown) {
    const row = await statement(this.db,"SELECT * FROM biosecurity_shares WHERE share_id = ? AND municipality_code = ? AND status <> 'withdrawn'",shareId,municipalityCode).first<ShareRow>();
    if (!row) fail(404,"share_not_found");
    await this.recipientRecord(row, municipalityCode);
    if (row.status === "acknowledged") return { status:row.status,version:row.version };
    if (!Number.isInteger(expectedVersion) || expectedVersion !== row.version) fail(409,"share_version_changed");
    const now = nowIso();
    const results = await this.db.batch([
      statement(this.db,"UPDATE biosecurity_shares SET status = 'acknowledged',version = version + 1,acknowledged_at = ?,acknowledged_by = ? WHERE share_id = ? AND municipality_code = ? AND version = ? AND status = 'available' AND EXISTS (SELECT 1 FROM biosecurity_record_contexts WHERE record_id = biosecurity_shares.record_id AND persistence = 'saved' AND expires_at > ?)",now,actorId,shareId,municipalityCode,row.version,now),
      statement(this.db,"INSERT INTO biosecurity_share_events (event_id,share_id,event_type,actor_id,version,created_at) SELECT ?,?,'acknowledged',?,?,? WHERE changes() = 1","be_"+randomCredential(),shareId,actorId,row.version+1,now),
    ]);
    if (!changed(results[0])) fail(409,"share_version_changed");
    return { status:"acknowledged",version:row.version+1 };
  }

  /** One lease owns physical deletion and the storage release. Failed deletes remain private and retryable. */
  async remove(id:string,ownerHash:string|null,reason:"withdrawn"|"expired") {
    const row=await this.context(id); const now=nowIso();
    if (!row || (ownerHash !== null && row.owner_hash !== ownerHash)) fail(404,"record_not_found");
    if (row.persistence === "deleted") return {status:"deleted"};
    if (ownerHash !== null && row.persistence === "uploading") fail(409,"record_still_saving");
    const lease=randomCredential();
    const result=await this.db.batch([
      statement(this.db,"UPDATE biosecurity_record_contexts SET persistence = 'deleting',lease_token = ?,lease_until = ?,expires_at = MIN(expires_at,?) WHERE record_id = ? AND persistence <> 'deleted' AND (persistence <> 'deleting' OR lease_until <= ?) AND (persistence <> 'uploading' OR lease_until <= ?)",lease,future(5*60_000),now,id,now,now),
      statement(this.db,"INSERT OR IGNORE INTO biosecurity_share_events (event_id,share_id,event_type,actor_id,version,created_at) SELECT ? || share_id,share_id,?,?,version+1,? FROM biosecurity_shares WHERE record_id = ? AND status <> 'withdrawn' AND EXISTS (SELECT 1 FROM biosecurity_record_contexts WHERE record_id = ? AND lease_token = ? AND persistence = 'deleting')","be_"+lease+":",reason,ownerHash === null ? "expiry" : "guest:"+ownerHash,now,id,id,lease),
      statement(this.db,"UPDATE biosecurity_shares SET status = 'withdrawn',withdrawn_at = ?,version = version + 1,environment_json = NULL WHERE record_id = ? AND status <> 'withdrawn' AND EXISTS (SELECT 1 FROM biosecurity_record_contexts WHERE record_id = ? AND lease_token = ? AND persistence = 'deleting')",now,id,id,lease),
    ]);
    if (!changed(result[0])) fail(409,"record_deletion_in_progress");
    try {
      for (const asset of await this.assets(row.draft_id)) await this.bucket.delete(asset.object_key);
      const owns="EXISTS (SELECT 1 FROM biosecurity_record_contexts WHERE record_id = ? AND lease_token = ? AND persistence = 'deleting')";
      await this.db.batch([
        statement(this.db,`DELETE FROM biosecurity_photo_hint_attempts WHERE record_id = ? AND ${owns}`,id,id,lease),
        statement(this.db,`DELETE FROM asset_ledger WHERE draft_id = ? AND ${owns}`,row.draft_id,id,lease),
        statement(this.db,`DELETE FROM observations WHERE observation_id = ? AND owner_user_id = ? AND ${owns}`,id,"guest:"+row.owner_hash,id,lease),
        statement(this.db,`DELETE FROM draft_observations WHERE draft_id = ? AND owner_user_id = ? AND ${owns}`,row.draft_id,"guest:"+row.owner_hash,id,lease),
        statement(this.db,`UPDATE biosecurity_usage SET bytes = MAX(0,bytes - COALESCE((SELECT reserved_bytes FROM biosecurity_record_contexts WHERE record_id = ?),0)),count = MAX(0,count - 1) WHERE scope = 'storage' AND ${owns}`,id,id,lease),
        statement(this.db,"UPDATE biosecurity_record_contexts SET persistence = 'deleted',spot_label = NULL,municipality_code = NULL,capture_details_json = NULL,private_note = NULL,environment_json = NULL,reserved_bytes = 0,lease_token = NULL,lease_until = NULL,deleted_at = ? WHERE record_id = ? AND lease_token = ? AND persistence = 'deleting'",now,id,lease),
      ]);
      const current=await this.context(id); if (current?.persistence !== "deleted") fail(503,"record_deletion_unconfirmed");
      return {status:"deleted"};
    } catch(error) {
      await statement(this.db,"UPDATE biosecurity_record_contexts SET lease_until = ? WHERE record_id = ? AND lease_token = ? AND persistence = 'deleting'",nowIso(),id,lease).run().catch(()=>undefined);
      throw error;
    }
  }
}

type Staff = { token_hash: string; holder_id: string; membership_id: string; municipality_code: string; email: string; verified_domain: string };
async function trustedMailboxDomain(env:BiosecurityEnv,municipalityCode:string,email:string):Promise<boolean> {
  const domain=officialMailboxDomain(email); const municipality=findMunicipality(municipalityCode);
  if (!domain || !municipality) return false;
  const revoked=await statement(env.CORE_DB,"SELECT domain FROM municipal_domain_evidence WHERE municipality_code = ? AND domain = ? AND revoked_at IS NOT NULL",municipality.code,domain).first();
  if (revoked) return false;
  if (matchMunicipalityEmail(municipalityCode,email) && Date.parse(municipality.verifiedAt) > Date.now()-180*DAY) return true;
  const evidence=await statement(env.CORE_DB,"SELECT verified FROM municipal_domain_evidence WHERE municipality_code = ? AND domain = ? AND directory_version = ? AND expires_at > ? AND revoked_at IS NULL",municipality.code,domain,MUNICIPALITY_DIRECTORY_VERSION,nowIso()).first<{verified:number}>();
  return evidence?.verified === 1;
}

async function establishMailboxDomain(request:Request,env:BiosecurityEnv,municipalityCode:string,email:string):Promise<boolean> {
  const municipality=findMunicipality(municipalityCode); const domain=officialMailboxDomain(email);
  if (!municipality || !domain) return false;
  if (await trustedMailboxDomain(env,municipality.code,email)) return true;
  const now=nowIso();
  const cached=await statement(env.CORE_DB,"SELECT verified,revoked_at FROM municipal_domain_evidence WHERE municipality_code = ? AND domain = ? AND directory_version = ? AND expires_at > ?",municipality.code,domain,MUNICIPALITY_DIRECTORY_VERSION,now).first<{verified:number;revoked_at:string|null}>();
  if (cached) return false;
  // A denied domain cannot be refreshed into an authorization by the applicant.
  const revoked=await statement(env.CORE_DB,"SELECT domain FROM municipal_domain_evidence WHERE municipality_code = ? AND domain = ? AND revoked_at IS NOT NULL",municipality.code,domain).first();
  if (revoked) return false;
  const day="proof-day:"+now.slice(0,10);
  const ip="proof-ip:"+now.slice(0,10)+":"+await credentialDigest("official-domain:"+(request.headers.get("cf-connecting-ip")??"unknown"));
  const reservation=await env.CORE_DB.batch([
    statement(env.CORE_DB,"INSERT INTO municipal_email_usage (scope,count) SELECT ?,1 WHERE COALESCE((SELECT count FROM municipal_email_usage WHERE scope = ?),0) < 10 ON CONFLICT(scope) DO UPDATE SET count = count + 1 WHERE count < 100 AND COALESCE((SELECT count FROM municipal_email_usage WHERE scope = ?),0) < 10",day,ip,ip),
    statement(env.CORE_DB,"INSERT INTO municipal_email_usage (scope,count) SELECT ?,1 WHERE changes() = 1 ON CONFLICT(scope) DO UPDATE SET count = count + 1",ip),
  ]);
  if (!changed(reservation[0])) fail(429,"official_domain_verification_rate_limited");
  const evidence=await resolveOfficialMailboxDomain(municipality,email);
  await statement(env.CORE_DB,"INSERT INTO municipal_domain_evidence (municipality_code,domain,directory_version,source_url,verified,verified_at,expires_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(municipality_code,domain) DO UPDATE SET directory_version = excluded.directory_version,source_url = excluded.source_url,verified = excluded.verified,verified_at = excluded.verified_at,expires_at = excluded.expires_at WHERE municipal_domain_evidence.revoked_at IS NULL",municipality.code,domain,MUNICIPALITY_DIRECTORY_VERSION,evidence?.sourceUrl??null,evidence?1:0,evidence?.verifiedAt??now,future(evidence?7*DAY:15*60_000)).run();
  return Boolean(evidence) && await trustedMailboxDomain(env,municipality.code,email);
}

export async function municipalStaff(request: Request, env: BiosecurityEnv): Promise<Staff> {
  const token = readOpaqueCookie(request.headers.get("cookie"),STAFF_COOKIE); if (!token) fail(401,"official_email_verification_required");
  const row = await statement(env.CORE_DB,
    `SELECT s.token_hash,m.holder_id,m.membership_id,m.municipality_code,m.email,m.verified_domain FROM auth_sessions s JOIN municipal_mailbox_memberships m ON m.holder_id = s.user_id
     WHERE s.token_hash = ? AND s.role_name = ? AND s.banned = 0 AND s.expires_at > ? AND m.revoked_at IS NULL AND m.expires_at > ? AND s.rank_label = m.membership_id`,
    await credentialDigest(token),MUNICIPAL_INBOX_ROLE,nowIso(),nowIso()).first<Staff>();
  if (!row || row.verified_domain !== officialMailboxDomain(row.email) || !await trustedMailboxDomain(env,row.municipality_code,row.email)) fail(401,"official_email_verification_expired");
  return row;
}

async function challenge(request: Request, env: BiosecurityEnv, body: Record<string, unknown>): Promise<Response> {
  if (env.BIOSECURITY_EMAIL_ENABLED !== "on" || !env.ALERT_EMAIL || !env.ALERT_EMAIL_FROM) fail(503,"email_verification_unavailable");
  const municipality = findMunicipality(boundedText(body.municipalityCode,6,"municipality_code",true));
  const email = boundedText(body.email,254,"email",true).toLowerCase();
  if (!municipality || !await establishMailboxDomain(request,env,municipality.code,email)) fail(422,"official_email_domain_unverified");
  const token = randomCredential(); const browserHash = await credentialDigest(token); const challengeId = "mc_"+randomCredential();
  // Uniform decimal code; rejection sampling avoids modulo bias.
  let random: number; do { random = crypto.getRandomValues(new Uint32Array(1))[0]!; } while(random >= 4_200_000_000);
  const code = String(random % 100_000_000).padStart(8,"0");
  const now = nowIso(); const expiresAt = future(10 * 60_000);
  const ipHash = await credentialDigest("municipal-mail-ip:" + now.slice(0,10) + ":" + (request.headers.get("cf-connecting-ip") ?? "unknown"));
  const scopes = [["day:"+now.slice(0,10),BIOSECURITY_LIMITS.dailyEmails],["month:"+now.slice(0,7),BIOSECURITY_LIMITS.monthlyEmails],["email:"+now.slice(0,10)+":"+await credentialDigest(email),5],["ip:"+now.slice(0,10)+":"+ipHash,10]] as const;
  const conditions = scopes.map(()=>"COALESCE((SELECT count FROM municipal_email_usage WHERE scope = ?),0) < ?").join(" AND ");
  const writes:Statement[] = [statement(env.CORE_DB,
    `INSERT INTO municipal_email_challenges (challenge_id,municipality_code,email,browser_hash,code_hash,send_state,expires_at,created_at)
     SELECT ?,?,?,?,?, 'reserved',?,? WHERE ${conditions} AND NOT EXISTS (SELECT 1 FROM municipal_email_challenges WHERE email = ? AND created_at > ?)`,
    challengeId,municipality.code,email,browserHash,await credentialDigest(challengeId+":"+code),expiresAt,now,...scopes.flatMap(([scope,limit])=>[scope,limit]),email,new Date(Date.now()-60_000).toISOString())];
  for (const [scope] of scopes) writes.push(statement(env.CORE_DB,"INSERT INTO municipal_email_usage (scope,count) SELECT ?,1 WHERE EXISTS (SELECT 1 FROM municipal_email_challenges WHERE challenge_id = ?) ON CONFLICT(scope) DO UPDATE SET count = count + 1",scope,challengeId));
  const results = await env.CORE_DB.batch(writes); if (!changed(results[0])) fail(429,"email_verification_rate_limited");
  try {
    await env.ALERT_EMAIL.send({ from:env.ALERT_EMAIL_FROM,to:email,subject:"ZUKAN 自治体受信箱の確認コード",text:`${municipality.name}の受信箱を開くための確認コードです。\n\n${code}\n\n10分以内に、申請した画面で入力してください。\n公式メールの所有確認であり、自治体代表権限や公認表示を付与するものではありません。\nこの操作に心当たりがなければ、コードを共有せずこのメールを破棄してください。` });
    await statement(env.CORE_DB,"UPDATE municipal_email_challenges SET send_state = 'sent' WHERE challenge_id = ?",challengeId).run();
  } catch {
    await statement(env.CORE_DB,"UPDATE municipal_email_challenges SET send_state = 'unknown' WHERE challenge_id = ?",challengeId).run().catch(()=>undefined);
    return json({ error:"email_delivery_unconfirmed",challengeId,expiresAt },503,{"set-cookie":privateCookie(CHALLENGE_COOKIE,token,600)});
  }
  return json({ challengeId,expiresAt },200,{"set-cookie":privateCookie(CHALLENGE_COOKIE,token,600)});
}

export async function verifyMunicipalChallenge(request:Request,env:BiosecurityEnv,body:Record<string,unknown>):Promise<Response> {
  const id = boundedText(body.challengeId,80,"challenge_id",true); const code = boundedText(body.code,8,"code",true);
  if (!/^mc_[a-f0-9]{64}$/.test(id) || !/^\d{8}$/.test(code)) fail(422,"verification_code_invalid");
  const browserToken = readOpaqueCookie(request.headers.get("cookie"),CHALLENGE_COOKIE); if (!browserToken) fail(401,"verification_browser_required");
  const browserHash = await credentialDigest(browserToken); const now = nowIso();
  const attempt = await statement(env.CORE_DB,"UPDATE municipal_email_challenges SET attempts = attempts + 1 WHERE challenge_id = ? AND browser_hash = ? AND consumed_at IS NULL AND expires_at > ? AND attempts < 5",id,browserHash,now).run();
  if (!changed(attempt)) fail(401,"verification_expired_or_used");
  const row = await statement(env.CORE_DB,"SELECT municipality_code,email,code_hash FROM municipal_email_challenges WHERE challenge_id = ? AND browser_hash = ?",id,browserHash).first<{municipality_code:string;email:string;code_hash:string}>();
  const digest = await credentialDigest(id+":"+code);
  if (!row || !equalDigest(row.code_hash,digest) || !await trustedMailboxDomain(env,row.municipality_code,row.email)) fail(401,"verification_code_invalid");
  const holder = "mailbox_"+(await credentialDigest(row.email)).slice(0,40);
  const membership = "mm_"+(await credentialDigest(JSON.stringify([row.municipality_code,row.email]))).slice(0,40);
  const sessionToken = randomCredential(); const sessionHash = await credentialDigest(sessionToken);
  const results = await env.CORE_DB.batch([
    statement(env.CORE_DB,"UPDATE municipal_email_challenges SET consumed_at = ?, consumed_nonce = ? WHERE challenge_id = ? AND browser_hash = ? AND code_hash = ? AND consumed_at IS NULL AND expires_at > ? AND attempts <= 5",now,sessionHash,id,browserHash,digest,now),
    statement(env.CORE_DB,"INSERT OR IGNORE INTO municipal_inboxes (municipality_code,created_at) SELECT ?,? WHERE EXISTS (SELECT 1 FROM municipal_email_challenges WHERE challenge_id = ? AND consumed_nonce = ?)",row.municipality_code,now,id,sessionHash),
    statement(env.CORE_DB,"INSERT INTO municipal_mailbox_memberships (membership_id,municipality_code,holder_id,email,verified_domain,directory_version,verified_at,expires_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM municipal_email_challenges WHERE challenge_id = ? AND consumed_nonce = ?) ON CONFLICT(municipality_code,email) DO UPDATE SET verified_at = excluded.verified_at,expires_at = excluded.expires_at,verified_domain = excluded.verified_domain,directory_version = excluded.directory_version WHERE municipal_mailbox_memberships.revoked_at IS NULL",membership,row.municipality_code,holder,row.email,row.email.split("@")[1]!,MUNICIPALITY_DIRECTORY_VERSION,now,future(90*DAY),id,sessionHash),
    statement(env.CORE_DB,"INSERT OR IGNORE INTO users (user_id) SELECT ? WHERE EXISTS (SELECT 1 FROM municipal_email_challenges WHERE challenge_id = ? AND consumed_nonce = ?)",holder,id,sessionHash),
    statement(env.CORE_DB,"INSERT INTO auth_sessions (token_hash,user_id,display_name,role_name,rank_label,banned,expires_at) SELECT ?,?,?,?, ?,0,? WHERE EXISTS (SELECT 1 FROM municipal_email_challenges WHERE challenge_id = ? AND consumed_nonce = ?) AND EXISTS (SELECT 1 FROM municipal_mailbox_memberships WHERE membership_id = ? AND revoked_at IS NULL)",sessionHash,holder,"公式メール確認済みの担当者",MUNICIPAL_INBOX_ROLE,membership,future(12*60*60_000),id,sessionHash,membership),
  ]);
  if (!changed(results[0])) fail(401,"verification_expired_or_used");
  if (!changed(results[4])) fail(403,"membership_revoked");
  const response = json({ok:true,municipality:findMunicipality(row.municipality_code)},200,{"set-cookie":privateCookie(STAFF_COOKIE,sessionToken,12*3600)});
  response.headers.append("set-cookie",privateCookie(CHALLENGE_COOKIE,"",0));
  return response;
}

async function photoResponse(store:BiosecurityStore, record:CaptureRow, assetId:string):Promise<Response> {
  const asset = (await store.assets(record.draft_id)).find(item=>item.asset_id===assetId && item.processing_state==="ready");
  if (!asset || record.persistence !== "saved" || record.expires_at <= nowIso()) fail(404,"photo_not_found");
  const object = await store.bucket.get(asset.object_key); if (!object?.body) fail(503,"photo_storage_unavailable");
  return new Response(object.body,{headers:{...PRIVATE_HEADERS,"content-type":asset.mime,"content-disposition":`inline; filename="${asset.asset_id}.${asset.mime === "image/png" ? "png" : asset.mime === "image/webp" ? "webp" : "jpg"}"`}});
}

export async function handleBiosecurityRequest(request:Request,env:BiosecurityEnv):Promise<Response|null> {
  const url = new URL(request.url); const path = url.pathname.replace(/^\/(?:ja|en|es|pt-br)(?=\/)/,"");
  if (!path.startsWith("/biosecurity") && !path.startsWith("/api/v1/biosecurity") && !path.startsWith("/kubiaka")) return null;
  const store = new BiosecurityStore(env.OBS_DB,env.ASSET_BUCKET);
  const annotateReceipt=async (record:Awaited<ReturnType<BiosecurityStore["receipt"]>>) => {
    const codes=[...new Set(record.shares.map(share=>share.municipalityCode))];
    if (!codes.length) return record;
    const rows=(await statement(env.CORE_DB,`SELECT DISTINCT municipality_code FROM municipal_mailbox_memberships WHERE municipality_code IN (${codes.map(()=>"?").join(",")}) AND revoked_at IS NULL AND expires_at > ?`,...codes,nowIso()).all<{municipality_code:string}>()).results;
    const active=new Set(rows.map(row=>row.municipality_code));
    return {...record,shares:record.shares.map(share=>({...share,recipientActive:active.has(share.municipalityCode)}))};
  };
  try {
    if (path.startsWith("/kubiaka") && ["GET","HEAD"].includes(request.method)) return new Response(null,{status:308,headers:{location:path.endsWith("/record") ? "/ja/biosecurity/kubiaka/capture" : "/ja/biosecurity",...PRIVATE_HEADERS}});
    if (["GET","HEAD"].includes(request.method) && path.startsWith("/biosecurity")) {
      const receipt = path.match(/^\/biosecurity\/records(?:\/(br_[a-f0-9]{40}))?\/?$/);
      const profileRoute=path.match(/^\/biosecurity\/([a-z0-9-]+)(\/capture)?\/?$/);
      const selectedProfile=profileRoute?biosecurityProfile(profileRoute[1]):null;
      const view = receipt ? "receipt" : path === "/biosecurity/municipalities" ? "municipalities" : path === "/biosecurity/inbox" ? "inbox" : selectedProfile ? (profileRoute?.[2] ? "capture" : "guide") : ["/biosecurity","/biosecurity/"].includes(path) ? "guide" : null;
      if (!view) return json({error:"not_found"},404);
      const html = renderBiosecurityPage(view,{profile:selectedProfile??BIOSECURITY_PROFILES[0]!,recordId:receipt?.[1]});
      return new Response(request.method==="HEAD"?null:html,{headers:{...PRIVATE_HEADERS,"content-type":"text/html; charset=utf-8","x-ikimon-cloudflare-native":"biosecurity-selfservice-v1",...(view === "guide" ? {"cache-control":"public, max-age=300","x-robots-tag":"index, follow"}: {})}});
    }
    const api = path.slice("/api/v1/biosecurity".length);
    if (request.method === "GET" && api === "/profiles") return json({profiles:BIOSECURITY_PROFILES});
    if (request.method === "GET" && api === "/municipalities") {
      const query = (url.searchParams.get("q") ?? "").trim().slice(0,100);
      const code = url.searchParams.get("code");
      const rows = code ? [findMunicipality(code)].filter(Boolean) : MUNICIPALITIES.filter(item=>!query||`${item.prefecture}${item.name}${item.code}`.includes(query)).slice(0,100);
      return json({municipalities:rows,items:rows,query,version:MUNICIPALITY_DIRECTORY_VERSION});
    }
    if (env.BIOSECURITY_ENABLED !== "on") fail(503,"biosecurity_temporarily_unavailable");
    if (!["GET","HEAD"].includes(request.method)) sameOrigin(request);
    if (request.method === "GET" && api === "/session") return await initializeGuest(request,env);
    if (request.method === "POST" && api === "/session/reset") {
      const active = await guest(request,env);
      await statement(env.OBS_DB,"UPDATE biosecurity_guest_sessions SET revoked_at = ? WHERE owner_hash = ?",nowIso(),active.ownerHash).run();
      return json({ok:true},200,{"set-cookie":privateCookie(await guestCookieName(GUEST_SCOPE),"",0)});
    }
    if (request.method === "POST" && api === "/staff/challenge") return await challenge(request,env,await bodyJson(request));
    if (request.method === "POST" && api === "/staff/verify") return await verifyMunicipalChallenge(request,env,await bodyJson(request));
    if (api === "/staff/session" && request.method === "GET") {
      try { const active = await municipalStaff(request,env); return json({authenticated:true,email:active.email,municipality:findMunicipality(active.municipality_code)}); }
      catch (error) { if (error instanceof BiosecurityError && error.status===401) return json({authenticated:false}); throw error; }
    }
    if (api === "/staff/logout" && request.method === "POST") {
      const active = await municipalStaff(request,env);
      await statement(env.CORE_DB,"DELETE FROM auth_sessions WHERE token_hash = ? AND role_name = ?",active.token_hash,MUNICIPAL_INBOX_ROLE).run();
      return json({ok:true},200,{"set-cookie":privateCookie(STAFF_COOKIE,"",0)});
    }
    if (api === "/records" && request.method === "POST") {
      const active = await guest(request,env); const input = await parseCapture(request);
      const budget = Number(env.BIOSECURITY_STORAGE_BUDGET_BYTES);
      if (!Number.isSafeInteger(budget) || budget <= 0 || budget > 1024*1024*1024) fail(503,"capture_capacity_unconfigured");
      const ipHash = await credentialDigest("biosecurity-ip:" + nowIso().slice(0,10) + ":" + (request.headers.get("cf-connecting-ip") ?? "unknown"));
      const record=await store.capture(active.ownerHash,input,ipHash,budget);
      const renewed=await guest(request,env);
      const token=await readGuestCredential(request.headers.get("cookie"),GUEST_SCOPE);
      return json({record:await annotateReceipt(record),guestExpiresAt:renewed.expiresAt},201,{"set-cookie":privateCookie(await guestCookieName(GUEST_SCOPE),token!,Math.max(0,Math.floor((Date.parse(renewed.expiresAt)-Date.now())/1000)))});
    }
    if (api === "/records" && request.method === "GET") {
      const active = await guest(request,env);
      const offset=pageOffset(url);
      const rows = (await statement(env.OBS_DB,"SELECT record_id FROM biosecurity_record_contexts WHERE owner_hash = ? AND persistence = 'saved' AND expires_at > ? ORDER BY created_at DESC,record_id DESC LIMIT 51 OFFSET ?",active.ownerHash,nowIso(),offset).all<{record_id:string}>()).results;
      return json({records:await Promise.all(rows.slice(0,50).map(row=>store.receipt(row.record_id,active.ownerHash))),nextOffset:rows.length>50?offset+50:null});
    }
    const recordMatch = api.match(/^\/records\/(br_[a-f0-9]{40})(?:\/(share|photos|environment-hints|environment)(?:\/(ba_[a-f0-9]{40}_[0-5]))?)?$/);
    if (recordMatch) {
      const active = await guest(request,env); const id=recordMatch[1]!;
      if (!recordMatch[2] && request.method === "GET") return json({record:await annotateReceipt(await store.receipt(id,active.ownerHash)),guestExpiresAt:active.expiresAt});
      if (!recordMatch[2] && request.method === "DELETE") return json(await store.remove(id,active.ownerHash,"withdrawn"));
      if (recordMatch[2] === "environment" && request.method === "POST") return json(await store.editEnvironment(active.ownerHash,id,await bodyJson(request)));
      if (recordMatch[2] === "environment-hints" && request.method === "POST") {
        const body = await bodyJson(request);
        const ipHash = await credentialDigest("biosecurity-hint-ip:" + nowIso().slice(0,10) + ":" + (request.headers.get("cf-connecting-ip") ?? "unknown"));
        return json(await store.photoHints(active.ownerHash,id,env,ipHash,body.consent));
      }
      if (recordMatch[2] === "share" && request.method === "POST") {
        const body=await bodyJson(request); const result=await store.share(active.ownerHash,id,body);
        const code=findMunicipality(String(body.municipalityCode??""))!.code;
        const recipient=await statement(env.CORE_DB,"SELECT membership_id FROM municipal_mailbox_memberships WHERE municipality_code = ? AND revoked_at IS NULL AND expires_at > ? LIMIT 1",code,nowIso()).first();
        return json({...result,recipientActive:Boolean(recipient)},201);
      }
      if (recordMatch[2] === "photos" && recordMatch[3] && request.method === "GET") {
        const response=await photoResponse(store,await store.ownerContext(id,active.ownerHash),recordMatch[3]);
        try {await guest(request,env);await store.ownerContext(id,active.ownerHash);}catch(error){await response.body?.cancel();throw error;}
        return response;
      }
    }
    const withdrawMatch = api.match(/^\/shares\/(bs_[a-f0-9]{40})\/withdraw$/);
    if (withdrawMatch && request.method === "POST") { const active = await guest(request,env); const body=await bodyJson(request); return json(await store.withdraw(active.ownerHash,withdrawMatch[1]!,body.expectedVersion)); }
    if (api === "/inbox" && request.method === "GET") {
      const active = await municipalStaff(request,env); const requestedStatus=url.searchParams.get("status");
      const status=["available","acknowledged"].includes(requestedStatus??"")?requestedStatus!:"all";
      const offset=pageOffset(url);
      const rows = (await statement(env.OBS_DB,"SELECT s.* FROM biosecurity_shares s JOIN biosecurity_record_contexts c ON c.record_id = s.record_id WHERE s.municipality_code = ? AND s.status <> 'withdrawn' AND (? = 'all' OR s.status = ?) AND c.persistence = 'saved' AND c.expires_at > ? ORDER BY s.created_at DESC,s.share_id DESC LIMIT 101 OFFSET ?",active.municipality_code,status,status,nowIso(),offset).all<ShareRow>()).results;
      const items = await Promise.all(rows.slice(0,100).map(async row=> { try{return await store.recipientRecord(row,active.municipality_code);}catch(error){if(error instanceof BiosecurityError&&error.status===404)return null;throw error;} }));
      await municipalStaff(request,env);
      return json({municipality:findMunicipality(active.municipality_code),items:items.filter(Boolean),nextOffset:rows.length>100?offset+100:null});
    }
    const inboxMatch = api.match(/^\/inbox\/(bs_[a-f0-9]{40})\/(acknowledge|photos)(?:\/(ba_[a-f0-9]{40}_[0-5]))?$/);
    if (inboxMatch) {
      const active=await municipalStaff(request,env);
      if (inboxMatch[2] === "acknowledge" && request.method === "POST") { const body=await bodyJson(request); return json(await store.acknowledge(inboxMatch[1]!,active.municipality_code,active.membership_id,body.expectedVersion)); }
      if (inboxMatch[2] === "photos" && inboxMatch[3] && request.method === "GET") {
        const row=await statement(env.OBS_DB,"SELECT * FROM biosecurity_shares WHERE share_id = ? AND municipality_code = ? AND status <> 'withdrawn'",inboxMatch[1]!,active.municipality_code).first<ShareRow>();
        if (!row || !(JSON.parse(row.fields_json) as string[]).includes("photos")) fail(404,"photo_not_found");
        await store.recipientRecord(row,active.municipality_code);
        const record=await store.context(row.record_id); if (!record) fail(404,"photo_not_found");
        const response=await photoResponse(store,record,inboxMatch[3]);
        const current=await statement(env.OBS_DB,"SELECT s.version FROM biosecurity_shares s JOIN biosecurity_record_contexts c ON c.record_id = s.record_id WHERE s.share_id = ? AND s.municipality_code = ? AND s.status <> 'withdrawn' AND c.persistence = 'saved' AND c.expires_at > ?",row.share_id,active.municipality_code,nowIso()).first<{version:number}>();
        if (!current || current.version !== row.version) { await response.body?.cancel(); fail(404,"photo_not_found"); }
        try { await municipalStaff(request,env); } catch(error) { await response.body?.cancel(); throw error; }
        return response;
      }
    }
    return json({error:"not_found"},404);
  } catch (error) {
    if (error instanceof BiosecurityError) return json({error:error.message},error.status,error.status===429?{"retry-after":"3600"}:{});
    return json({error:"biosecurity_storage_unavailable"},503);
  }
}

/** Existing scheduled handler calls a bounded expiry sweep. No new timer, unbounded scan, or AI. */
export async function expireBiosecurityRecords(env:BiosecurityEnv):Promise<void> {
  if (env.BIOSECURITY_ENABLED !== "on") return;
  const store=new BiosecurityStore(env.OBS_DB,env.ASSET_BUCKET); const now=nowIso();
  const rows=(await statement(env.OBS_DB,"SELECT * FROM biosecurity_record_contexts WHERE (persistence = 'saved' AND expires_at <= ?) OR (persistence = 'uploading' AND created_at <= ? AND lease_until <= ?) OR (persistence = 'deleting' AND lease_until <= ?) ORDER BY expires_at LIMIT 10",now,new Date(Date.now()-DAY).toISOString(),now,now).all<CaptureRow>()).results;
  for (const row of rows) {
    try { await store.remove(row.record_id,null,"expired"); } catch(error) { if (!(error instanceof BiosecurityError) || error.status !== 409) throw error; }
  }
  // Bounded, indexed expiry of authentication material. No private source copies are retained here.
  await statement(env.CORE_DB,"DELETE FROM municipal_email_challenges WHERE challenge_id IN (SELECT challenge_id FROM municipal_email_challenges WHERE expires_at < ? ORDER BY expires_at LIMIT 100)",new Date(Date.now()-DAY).toISOString()).run();
  await statement(env.CORE_DB,"DELETE FROM municipal_domain_evidence WHERE revoked_at IS NULL AND (municipality_code,domain) IN (SELECT municipality_code,domain FROM municipal_domain_evidence WHERE expires_at < ? AND revoked_at IS NULL ORDER BY expires_at LIMIT 100)",new Date(Date.now()-DAY).toISOString()).run();
  const cutoff=new Date(Date.now()-32*DAY).toISOString().slice(0,10);
  for (const prefix of ["day","guest","ip","guest-issue","guest-issue-ip","hint-day","hint-guest","hint-ip"]) {
    await statement(env.OBS_DB,"DELETE FROM biosecurity_usage WHERE scope IN (SELECT scope FROM biosecurity_usage WHERE scope >= ? AND scope < ? ORDER BY scope LIMIT 200)",prefix+":",prefix+":"+cutoff).run();
  }
  for (const prefix of ["day","email","ip","proof-day","proof-ip"]) {
    await statement(env.CORE_DB,"DELETE FROM municipal_email_usage WHERE scope IN (SELECT scope FROM municipal_email_usage WHERE scope >= ? AND scope < ? ORDER BY scope LIMIT 100)",prefix+":",prefix+":"+cutoff).run();
  }
  await statement(env.CORE_DB,"DELETE FROM municipal_email_usage WHERE scope >= 'month:' AND scope < ?","month:"+cutoff.slice(0,7)).run();
}
