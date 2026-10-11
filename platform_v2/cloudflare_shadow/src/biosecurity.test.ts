import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test, { type TestContext } from "node:test";
import {
  BIOSECURITY_LIMITS, BiosecurityError, BiosecurityStore, MUNICIPAL_INBOX_ROLE,
  expireBiosecurityRecords, handleBiosecurityRequest, municipalStaff, parseCapture,
  type BiosecurityEnv, type CaptureInput,
} from "./biosecurity";
import { credentialDigest } from "./guestCredentialNative";
import type { DiscoveryDatabase, DiscoveryStatement, DiscoveryBucket } from "./eventDiscovery";
import { MUNICIPALITIES, MUNICIPALITY_DIRECTORY_VERSION } from "../../src/services/municipalityDirectory";

// Real SQLite transactions and local R2/mail substitutes; no provider or account is contacted.
type Value = string | number | null;
class SqlStatement implements DiscoveryStatement {
  values: Value[] = [];
  constructor(readonly owner: SqlDatabase, readonly query: string) {}
  bind(...values: Value[]) { this.values = values; return this; }
  async first<T>() {
    const result = (this.owner.native.prepare(this.query).get(...this.values) as T | undefined) ?? null;
    await this.owner.afterRead?.(this.query, this.values);
    return result;
  }
  async all<T>() {
    const results = this.owner.native.prepare(this.query).all(...this.values) as T[];
    await this.owner.afterRead?.(this.query, this.values);
    return { results };
  }
  execute() {
    const result = this.owner.native.prepare(this.query).run(...this.values);
    return { meta: { changes: Number(result.changes) } };
  }
  async run() { return this.execute(); }
}
class SqlDatabase implements DiscoveryDatabase {
  readonly native = new DatabaseSync(":memory:");
  afterRead: ((query: string, values: Value[]) => Promise<void> | void) | null = null;
  beforeBatch: ((queries: string[]) => void) | null = null;
  afterCommit: ((queries: string[]) => void) | null = null;
  constructor(directory: "core" | "observations", migrations: string[]) {
    this.native.exec("PRAGMA foreign_keys = ON");
    for (const name of migrations) this.native.exec(readFileSync(new URL(`../migrations/${directory}/${name}`, import.meta.url), "utf8"));
  }
  prepare(query: string) { return new SqlStatement(this, query); }
  async batch(statements: DiscoveryStatement[]) {
    const rows = statements as SqlStatement[];
    const queries = rows.map(row => row.query);
    this.beforeBatch?.(queries);
    this.native.exec("BEGIN");
    let results: unknown[];
    try { results = rows.map(row => row.execute()); this.native.exec("COMMIT"); }
    catch (error) { this.native.exec("ROLLBACK"); throw error; }
    // A transport can lose the result after a transaction has committed.
    this.afterCommit?.(queries);
    return results;
  }
}
class MemoryBucket implements DiscoveryBucket {
  readonly objects = new Map<string, { bytes: ArrayBuffer; contentType: string; cacheControl?: string }>();
  puts = 0;
  onPut: ((key: string) => Promise<void>) | null = null;
  onGet: ((key: string) => Promise<void>) | null = null;
  onDelete: ((key: string) => Promise<void>) | null = null;
  async put(key: string, body: ArrayBuffer, options?: Parameters<DiscoveryBucket["put"]>[2]) {
    this.puts++;
    await this.onPut?.(key);
    this.objects.set(key, { bytes: body.slice(0), contentType: options?.httpMetadata?.contentType ?? "", cacheControl: options?.httpMetadata?.cacheControl });
  }
  async get(key: string) {
    const object = this.objects.get(key);
    const result = object ? { body: new Response(object.bytes.slice(0)).body, httpMetadata: { contentType: object.contentType } } : null;
    await this.onGet?.(key);
    return result;
  }
  async head(key: string) {
    const object = this.objects.get(key);
    return object ? { size: object.bytes.byteLength, httpMetadata: { contentType: object.contentType } } : null;
  }
  async delete(key: string) { await this.onDelete?.(key); this.objects.delete(key); }
}
const ORIGIN = "https://zukan.example.test";
const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGPUyLNhYGBgYmBgYGBgAAAJ7gDW/OIFpQAAAABJRU5ErkJggg==", "base64")).buffer;
const MUNICIPALITY = MUNICIPALITIES.find(row => row.kind === "municipality" && row.domains.length)!;
const OTHER_MUNICIPALITY = MUNICIPALITIES.find(row => row.kind === "municipality" && row.domains.length && row.code !== MUNICIPALITY.code)!;
const FUTURE = "2099-01-01T00:00:00.000Z";
const PAST = "2000-01-01T00:00:00.000Z";
type Mail = { from: string; to: string; subject: string; text: string };

function fixture(t: TestContext) {
  const core = new SqlDatabase("core", ["0001_core.sql", "0002_auth_session_contract.sql", "0003_auth_user_accounts.sql", "0008_auth_lifecycle_integrity.sql", "0021_municipal_mailbox_access.sql"]);
  const obs = new SqlDatabase("observations", ["0001_observation_write_contract.sql", "0002_asset_observation_index.sql", "0004_public_derivative_gate.sql", "0076_biosecurity_selfservice.sql"]);
  const bucket = new MemoryBucket(); const mail: Mail[] = [];
  const env: BiosecurityEnv = {
    CORE_DB: core, OBS_DB: obs, ASSET_BUCKET: bucket, ENVIRONMENT: "shadow",
    BIOSECURITY_ENABLED: "on", BIOSECURITY_EMAIL_ENABLED: "on", BIOSECURITY_STORAGE_BUDGET_BYTES: String(1024 ** 3),
    ALERT_EMAIL_FROM: "notifications@example.test", ALERT_EMAIL: { async send(message) { mail.push(message); } },
  };
  t.after(() => { core.native.close(); obs.native.close(); });
  return { core, obs, bucket, env, mail, store: new BiosecurityStore(obs, bucket) };
}
type Fixture = ReturnType<typeof fixture>;
function count(db: SqlDatabase, table: string) {
  assert.match(table, /^[a-z_]+$/);
  return Number((db.native.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count);
}
function usage(db: SqlDatabase, scope = "storage") {
  return db.native.prepare("SELECT count,bytes FROM biosecurity_usage WHERE scope = ?").get(scope) as { count: number; bytes: number };
}
function cookie(response: Response, name?: string) {
  const values = response.headers.getSetCookie().map(value => value.split(";", 1)[0]!);
  const value = name ? values.find(value => value.startsWith(name + "=")) : values.find(value => !value.endsWith("="));
  assert.ok(value, "the response must issue an opaque cookie");
  return value;
}
async function request(state: Fixture, path: string, options: { method?: string; cookie?: string; body?: Record<string, unknown> | FormData; headers?: Record<string, string> } = {}) {
  const method = options.method ?? (options.body === undefined ? "GET" : "POST");
  const headers = new Headers({ "cf-connecting-ip": "192.0.2.10", ...options.headers });
  if (options.cookie) headers.set("cookie", options.cookie);
  if (method !== "GET" && !headers.has("origin")) headers.set("origin", ORIGIN);
  if (options.body !== undefined && !(options.body instanceof FormData)) headers.set("content-type", "application/json");
  const response = await handleBiosecurityRequest(new Request(ORIGIN + "/api/v1/biosecurity" + path, {
    method, headers, ...(options.body === undefined ? {} : { body: options.body instanceof FormData ? options.body : JSON.stringify(options.body) }),
  }), state.env);
  assert.ok(response);
  return response;
}
async function newGuest(state: Fixture) {
  const response = await request(state, "/session"); assert.equal(response.status, 200);
  const credential = cookie(response); const token = credential.slice(credential.indexOf("=") + 1);
  return { cookie: credential, owner: await credentialDigest(token) };
}
function captureForm(key: string, changes: Record<string, string> = {}) {
  const form = new FormData();
  for (const [name, value] of Object.entries({ profile_id: "kubiaka", observed_at: "2026-10-01T09:30:00+09:00", municipality_code: MUNICIPALITY.code,
    spot_label: "私有地の木", note: "非公開の補足", exact_lat: "35.123456", exact_lng: "139.654321", signal: "unknown", idempotency_key: "capture-request-" + key, ...changes })) form.set(name, value);
  form.append("photos", new File([PNG], "photo.png", { type: "image/png" }));
  return form;
}
async function input(key: string, changes: Record<string, string> = {}): Promise<CaptureInput> {
  return parseCapture(new Request(ORIGIN, { method: "POST", body: captureForm(key, changes) }));
}
async function capture(state: Fixture, owner: string, key: string, changes: Record<string, string> = {}) {
  return state.store.capture(owner, await input(key, changes), "fixture-ip", 1024 ** 3);
}
function consent(key: string, changes: Record<string, unknown> = {}) {
  return { municipalityCode: MUNICIPALITY.code, consent: true, purpose: "invasive_response", fields: ["observedAt", "spotLabel"], idempotencyKey: "sharing-request-" + key, ...changes };
}
async function challenge(state: Fixture, municipality = MUNICIPALITY, label = "fixture") {
  const email = label + "@" + municipality.domains[0]!;
  const response = await request(state, "/staff/challenge", { body: { municipalityCode: municipality.code, email } });
  const data = await response.json() as { challengeId: string; expiresAt: string };
  assert.ok([200, 503].includes(response.status)); assert.ok(data.challengeId);
  const sent = [...state.mail].reverse().find(message => message.to === email); assert.ok(sent);
  const code = sent.text.match(/\n(\d{8})\n/)?.[1]; assert.ok(code);
  return { response, data, code, cookie: cookie(response), email };
}
async function verifiedStaff(state: Fixture, municipality = MUNICIPALITY, label = "fixture") {
  const proof = await challenge(state, municipality, label);
  const response = await request(state, "/staff/verify", { cookie: proof.cookie, body: { challengeId: proof.data.challengeId, code: proof.code } });
  assert.equal(response.status, 200, await response.clone().text());
  return { cookie: cookie(response, "__Host-zukan_municipal_inbox"), email: proof.email };
}

test("guest capture saves one private source and six photographs without accounts, publication or AI jobs", async t => {
  const state = fixture(t); const guest = await newGuest(state);
  const form = captureForm("six-photos");
  for (let index = 1; index < 6; index++) form.append("photos", new File([PNG], `photo-${index}.png`, { type: "image/png" }));
  const response = await request(state, "/records", { cookie: guest.cookie, body: form });
  assert.equal(response.status, 201, await response.clone().text());
  const { record } = await response.json() as { record: { id: string; status: string; photos: { url: string }[]; shares: unknown[]; exactLocation: { lat: number; lng: number } } };
  assert.equal(record.status, "saved"); assert.equal(record.photos.length, 6); assert.deepEqual(record.shares, []);
  assert.deepEqual(record.exactLocation, { lat: 35.123456, lng: 139.654321 });
  assert.equal(count(state.core, "users"), 0); assert.equal(count(state.core, "auth_sessions"), 0);
  assert.equal(count(state.obs, "observations"), 1); assert.equal(count(state.obs, "outbox"), 0); assert.equal(count(state.obs, "readmodel_public_observations"), 0);
  assert.equal((state.obs.native.prepare("SELECT visibility FROM observations").get() as { visibility: string }).visibility, "private");
  assert.equal(count(state.obs, "asset_ledger"), 6); assert.equal(state.bucket.objects.size, 6);
  for (const [key, object] of state.bucket.objects) { assert.match(key, /^private\/biosecurity\//); assert.equal(object.cacheControl, "private, no-store"); }
  assert.equal((await request(state, record.photos[0]!.url.replace("/api/v1/biosecurity", ""))).status, 401);
  const other = await newGuest(state);
  assert.equal((await request(state, `/records/${record.id}`, { cookie: other.cookie })).status, 404);
  const photo = await request(state, record.photos[0]!.url.replace("/api/v1/biosecurity", ""), { cookie: guest.cookie });
  assert.equal(photo.status, 200); assert.equal(photo.headers.get("cache-control"), "private, no-store");
  assert.equal(photo.headers.get("x-content-type-options"), "nosniff"); assert.deepEqual(await photo.arrayBuffer(), PNG);
});

test("multipart validation and origin checks reject unsafe requests before writes", async t => {
  const state = fixture(t); const guest = await newGuest(state);
  const invalid: Record<string, string>[] = [{ observed_at: "2026-10-01T09:30:00" }, { exact_lat: "90.1" }, { exact_lng: "" }, { signal: "confirmed_invasive" }, { profile_id: "unregistered" }];
  for (const changes of invalid) {
    const response = await request(state, "/records", { cookie: guest.cookie, body: captureForm("invalid", changes) });
    assert.equal(response.status, 422, await response.clone().text());
  }
  const over = captureForm("too-many");
  for (let i = 1; i < 7; i++) over.append("photos", new File([PNG], "extra.png", { type: "image/png" }));
  assert.equal((await request(state, "/records", { cookie: guest.cookie, body: over })).status, 422);
  assert.equal((await request(state, "/records", { cookie: guest.cookie, body: captureForm("cross-origin"), headers: { origin: "https://attacker.example.test" } })).status, 403);
  assert.equal((await request(state, "/records", { cookie: guest.cookie, body: captureForm("cross-site"), headers: { "sec-fetch-site": "cross-site" } })).status, 403);
  assert.equal(count(state.obs, "biosecurity_record_contexts"), 0); assert.equal(state.bucket.puts, 0);
});

test("concurrent duplicate capture and an exact retry reserve and store once; changed payload conflicts", async t => {
  const state = fixture(t); const guest = await newGuest(state); const payload = await input("same-payload");
  let releaseUpload!: () => void; let uploadStarted!: () => void;
  const uploaded = new Promise<void>(resolve => { uploadStarted = resolve; });
  const resume = new Promise<void>(resolve => { releaseUpload = resolve; });
  state.bucket.onPut = async () => { uploadStarted(); await resume; };
  const first = state.store.capture(guest.owner, payload, "same-ip", 1024 ** 3);
  await uploaded;
  try { await assert.rejects(state.store.capture(guest.owner, payload, "same-ip", 1024 ** 3), /save_in_progress_retry_same_request/); }
  finally { releaseUpload(); }
  await first; state.bucket.onPut = null;
  const retry = await state.store.capture(guest.owner, payload, "same-ip", 1024 ** 3);
  assert.equal(count(state.obs, "observations"), 1); assert.equal(count(state.obs, "biosecurity_record_contexts"), 1);
  assert.equal(state.bucket.puts, 1); assert.deepEqual({ ...usage(state.obs) }, { count: 1, bytes: PNG.byteLength });
  await assert.rejects(state.store.capture(guest.owner, await input("same-payload", { note: "changed" }), "same-ip", 1024 ** 3), /idempotency_payload_changed/);
  assert.equal((await state.store.receipt(retry.id, guest.owner)).note, "非公開の補足");
});

test("a second test-only target profile reuses the same private source, asset and consent stores", async t => {
  const state = fixture(t); const guest = await newGuest(state);
  const first = await capture(state, guest.owner, "profile-kubiaka");
  const fixtureInput = await input("profile-fixture");
  // This is a store fixture, deliberately absent from the public configuration.
  const second = await state.store.capture(guest.owner, {
    ...fixtureInput, profileId: "fixture-second-target", profileVersion: "fixture-v1",
    digest: await credentialDigest("second-target-fixture:" + fixtureInput.digest),
  }, "fixture-ip", 1024 ** 3);
  assert.equal(first.profileId, "kubiaka"); assert.equal(second.profileId, "fixture-second-target");
  assert.equal(count(state.obs, "observations"), 2); assert.equal(count(state.obs, "asset_ledger"), 2);
  const shared = await state.store.share(guest.owner, second.id, consent("second-profile"));
  const staff = await verifiedStaff(state);
  const inbox = await (await request(state, "/inbox", { cookie: staff.cookie })).json() as { items: Record<string, unknown>[] };
  assert.equal(inbox.items[0]?.id, shared.shareId); assert.equal(inbox.items[0]?.profileId, "fixture-second-target");
  const profiles = await (await request(state, "/profiles")).json() as { profiles: { id: string }[] };
  assert.equal(profiles.profiles.some(profile => profile.id === "fixture-second-target"), false);
  assert.equal(count(state.obs, "readmodel_public_observations"), 0); assert.equal(state.mail.length, 1, "only the local verification transport is called");
});

test("a withdrawal during recipient field selection discards the stale projection", async t => {
  const state = fixture(t); const guest = await newGuest(state); const record = await capture(state, guest.owner, "projection-race");
  const shared = await state.store.share(guest.owner, record.id, consent("projection-race", { fields: ["observedAt", "exactLocation", "note"] }));
  const staff = await verifiedStaff(state);
  state.obs.afterRead = async query => {
    if (!query.startsWith("SELECT observed_at,note,exact_lat,exact_lng FROM observations")) return;
    state.obs.afterRead = null;
    await state.store.withdraw(guest.owner, shared.shareId, 1);
  };
  const inbox = await request(state, "/inbox", { cookie: staff.cookie });
  assert.equal(inbox.status, 200); const body = await inbox.text();
  assert.deepEqual((JSON.parse(body) as { items: unknown[] }).items, []);
  assert.doesNotMatch(body, /35\.123456|139\.654321|非公開の補足/);
});

test("failed R2 save and unconfirmed D1 finalization retain the receipt identity and never double charge capacity", async t => {
  for (const failure of ["r2", "d1-before", "d1-after"] as const) {
    const state = fixture(t); const guest = await newGuest(state); const payload = await input(failure);
    if (failure === "r2") state.bucket.onPut = async () => { state.bucket.onPut = null; throw new Error("R2 unavailable"); };
    else {
      const hook = (queries: string[]) => { if (queries.some(sql => /INSERT OR IGNORE INTO observations /.test(sql))) { state.obs.beforeBatch = null; state.obs.afterCommit = null; throw new Error("D1 result unavailable"); } };
      if (failure === "d1-before") state.obs.beforeBatch = hook; else state.obs.afterCommit = hook;
    }
    await assert.rejects(state.store.capture(guest.owner, payload, "fixture-ip", 1024 ** 3), /unavailable/);
    assert.equal(count(state.obs, "biosecurity_record_contexts"), 1);
    assert.equal(count(state.obs, "observations"), failure === "d1-after" ? 1 : 0);
    assert.deepEqual({ ...usage(state.obs) }, { count: 1, bytes: PNG.byteLength }, "uncertain storage is not credited back");
    const retry = await state.store.capture(guest.owner, payload, "fixture-ip", 1024 ** 3);
    assert.equal(retry.status, "saved"); assert.equal(count(state.obs, "observations"), 1); assert.equal(state.bucket.objects.size, 1);
    assert.deepEqual({ ...usage(state.obs) }, { count: 1, bytes: PNG.byteLength });
    if (failure === "d1-after") assert.equal(state.bucket.puts, 1, "read back the saved transaction without uploading again");
  }
});

test("SQLite reservations enforce storage and guest quotas across concurrent requests", async t => {
  for (const scenario of ["storage", "guest"] as const) {
    const state = fixture(t); const guest = await newGuest(state);
    const maximum = scenario === "storage" ? 2 : BIOSECURITY_LIMITS.guestDailyRecords;
    const payloads = await Promise.all(Array.from({ length: maximum + 1 }, (_, index) => input(`${scenario}-${index}`)));
    const attempts = await Promise.allSettled(payloads.map(payload => state.store.capture(guest.owner, payload, "fixture-ip", scenario === "storage" ? 2 * PNG.byteLength : 1024 ** 3)));
    assert.equal(attempts.filter(result => result.status === "fulfilled").length, maximum);
    assert.equal(attempts.filter(result => result.status === "rejected" && result.reason instanceof BiosecurityError && result.reason.status === 429).length, 1);
    assert.equal(count(state.obs, "observations"), maximum); assert.equal(state.bucket.objects.size, maximum);
    assert.deepEqual({ ...usage(state.obs) }, { count: maximum, bytes: maximum * PNG.byteLength });
  }
});

test("guest issuance quota is atomic and failures return JSON without creating product sessions", async t => {
  const state = fixture(t); const day = new Date().toISOString().slice(0, 10);
  state.obs.native.prepare("INSERT INTO biosecurity_usage(scope,count,bytes) VALUES (?,1999,0)").run("guest-issue:" + day);
  const responses = await Promise.all([1, 2].map(index => request(state, "/session", { headers: { "cf-connecting-ip": "192.0.2." + index } })));
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 429]);
  const failed = responses.find(response => response.status === 429)!;
  assert.deepEqual(await failed.json(), { error: "guest_session_capacity_reached" });
  assert.equal(count(state.obs, "biosecurity_guest_sessions"), 1); assert.equal(count(state.core, "auth_sessions"), 0);
});

test("consent projects only selected fields to the selected municipality and keeps source records private", async t => {
  const state = fixture(t); const guest = await newGuest(state); const record = await capture(state, guest.owner, "consent-fields");
  const staff = await verifiedStaff(state); const other = await verifiedStaff(state, OTHER_MUNICIPALITY, "other");
  assert.deepEqual((await (await request(state, "/inbox", { cookie: staff.cookie })).json() as { items: unknown[] }).items, []);
  const shared = await state.store.share(guest.owner, record.id, consent("selected-fields"));
  const inbox = await (await request(state, "/inbox", { cookie: staff.cookie })).json() as { items: Record<string, unknown>[] };
  assert.equal(inbox.items.length, 1); assert.equal(inbox.items[0]?.id, shared.shareId);
  assert.equal(inbox.items[0]?.spotLabel, "私有地の木"); assert.equal(inbox.items[0]?.observedAt, record.observedAt);
  assert.equal("note" in inbox.items[0]!, false); assert.equal("exactLocation" in inbox.items[0]!, false); assert.equal("photos" in inbox.items[0]!, false);
  assert.doesNotMatch(JSON.stringify(inbox), /35\.123456|139\.654321|非公開の補足|owner_hash|guest:|private\/biosecurity|request_digest/);
  assert.deepEqual((await (await request(state, "/inbox", { cookie: other.cookie })).json() as { items: unknown[] }).items, []);
  const photoId = record.photos[0]!.id;
  assert.equal((await request(state, `/inbox/${shared.shareId}/photos/${photoId}`, { cookie: staff.cookie })).status, 404);
  await state.store.share(guest.owner, record.id, consent("selected-fields"));
  assert.equal(count(state.obs, "biosecurity_shares"), 1); assert.equal(count(state.obs, "biosecurity_share_events"), 1);
  await assert.rejects(state.store.share(guest.owner, record.id, consent("selected-fields", { fields: ["observedAt", "exactLocation"] })), /idempotency_payload_changed/);
  assert.equal(count(state.obs, "readmodel_public_observations"), 0);
});

test("sharing requires explicit recipient/purpose consent and guardian consent for minors", async t => {
  const state = fixture(t); const guest = await newGuest(state); const record = await capture(state, guest.owner, "minor", { is_minor: "yes" });
  for (const changes of [{ consent: false }, { purpose: "publication" }, { fields: ["observedAt", "owner_hash"] }, { fields: ["observedAt"] }]) {
    await assert.rejects(state.store.share(guest.owner, record.id, consent("invalid-" + JSON.stringify(changes).length, { guardianConsent: true, ...changes })), BiosecurityError);
  }
  await assert.rejects(state.store.share(guest.owner, record.id, consent("minor-without-guardian")), /guardian_consent_required/);
  const shared = await state.store.share(guest.owner, record.id, consent("minor-with-guardian", { guardianConsent: true }));
  assert.equal(shared.status, "available"); assert.equal(count(state.obs, "biosecurity_shares"), 1);
});

test("a lifetime share cap is atomic, preserves all receipt controls, and permits exact replays", async t => {
  const state = fixture(t); const guest = await newGuest(state); const record = await capture(state, guest.owner, "share-cap");
  const attempts = await Promise.allSettled(Array.from({ length: 21 }, (_, index) => state.store.share(guest.owner, record.id, consent("cap-" + index))));
  assert.equal(attempts.filter(result => result.status === "fulfilled").length, 20);
  assert.equal(attempts.filter(result => result.status === "rejected" && result.reason instanceof BiosecurityError && result.reason.status === 429 && result.reason.message === "share_capacity_reached").length, 1);
  assert.equal(count(state.obs, "biosecurity_shares"), 20); assert.equal(count(state.obs, "biosecurity_share_events"), 20);
  assert.equal((await state.store.receipt(record.id, guest.owner)).shares.length, 20, "every consent retains a withdrawal control");
  const acceptedIndex = attempts.findIndex(result => result.status === "fulfilled");
  const accepted = attempts[acceptedIndex]!; assert.ok(accepted.status === "fulfilled");
  await state.store.withdraw(guest.owner, accepted.value.shareId, 1);
  const replay = await state.store.share(guest.owner, record.id, consent("cap-" + acceptedIndex));
  assert.equal(replay.status, "withdrawn"); assert.equal(replay.version, 2);
  await assert.rejects(state.store.share(guest.owner, record.id, consent("after-withdrawal-cap")), /share_capacity_reached/);
  assert.equal(count(state.obs, "biosecurity_shares"), 20);
});

test("fresh capture extends the guest receipt credential while a replay preserves the original record TTL", async t => {
  const state = fixture(t); const guest = await newGuest(state);
  const soon = new Date(Date.now() + 60 * 60_000).toISOString();
  state.obs.native.prepare("UPDATE biosecurity_guest_sessions SET expires_at = ? WHERE owner_hash = ?").run(soon, guest.owner);
  const saved = await request(state, "/records", { cookie: guest.cookie, body: captureForm("renew-guest") });
  assert.equal(saved.status, 201);
  const body = await saved.json() as { record: { id: string; expiresAt: string }; guestExpiresAt: string };
  assert.ok(Date.parse(body.guestExpiresAt) > Date.now() + 80 * 86_400_000);
  assert.equal(cookie(saved), guest.cookie, "renewal retains access to the same private receipts");
  const oldRecordExpiry = new Date(Date.now() + 10 * 86_400_000).toISOString();
  state.obs.native.prepare("UPDATE biosecurity_record_contexts SET expires_at = ? WHERE record_id = ?").run(oldRecordExpiry, body.record.id);
  const replay = await request(state, "/records", { cookie: guest.cookie, body: captureForm("renew-guest") });
  assert.equal(replay.status, 201);
  assert.equal((await replay.json() as { record: { expiresAt: string } }).record.expiresAt, oldRecordExpiry);
  assert.equal(count(state.obs, "observations"), 1); assert.equal(state.bucket.puts, 1);
});

test("acknowledgement and withdrawal use versions and never restore withdrawn access", async t => {
  const state = fixture(t); const guest = await newGuest(state); const record = await capture(state, guest.owner, "ack-race");
  const shared = await state.store.share(guest.owner, record.id, consent("ack-race", { fields: ["observedAt", "photos"] }));
  const staff = await verifiedStaff(state);
  await assert.rejects(state.store.acknowledge(shared.shareId, OTHER_MUNICIPALITY.code, "wrong-recipient", 1), /share_not_found/);
  const results = await Promise.allSettled([
    state.store.acknowledge(shared.shareId, MUNICIPALITY.code, "fixture-member", 1),
    state.store.withdraw(guest.owner, shared.shareId, 1),
  ]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  const current = state.obs.native.prepare("SELECT status,version FROM biosecurity_shares WHERE share_id = ?").get(shared.shareId) as { status: string; version: number };
  if (current.status !== "withdrawn") await state.store.withdraw(guest.owner, shared.shareId, current.version);
  await assert.rejects(state.store.acknowledge(shared.shareId, MUNICIPALITY.code, "fixture-member", 1), /share_not_found/);
  assert.equal((await request(state, `/inbox/${shared.shareId}/photos/${record.photos[0]!.id}`, { cookie: staff.cookie })).status, 404);
  assert.deepEqual((await (await request(state, "/inbox", { cookie: staff.cookie })).json() as { items: unknown[] }).items, []);
  const events = state.obs.native.prepare("SELECT version FROM biosecurity_share_events WHERE share_id = ? ORDER BY version").all(shared.shareId) as { version: number }[];
  assert.deepEqual(events.map(event => event.version), events.map((_, index) => index + 1));
  assert.equal((await state.store.receipt(record.id, guest.owner)).status, "saved", "withdrawal preserves the owner's source");
});

test("withdrawal or membership revocation during R2 retrieval never returns private photo bytes", async t => {
  for (const action of ["withdraw", "membership"] as const) {
    const state = fixture(t); const guest = await newGuest(state); const record = await capture(state, guest.owner, "media-race-" + action);
    const shared = await state.store.share(guest.owner, record.id, consent("media-race", { fields: ["observedAt", "photos"] }));
    const staff = await verifiedStaff(state);
    state.bucket.onGet = async () => {
      state.bucket.onGet = null;
      if (action === "withdraw") await state.store.withdraw(guest.owner, shared.shareId, 1);
      else state.core.native.prepare("UPDATE municipal_mailbox_memberships SET revoked_at = ?").run(new Date().toISOString());
    };
    const response = await request(state, `/inbox/${shared.shareId}/photos/${record.photos[0]!.id}`, { cookie: staff.cookie });
    assert.equal(response.status, action === "withdraw" ? 404 : 401);
    assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    assert.notDeepEqual(await response.arrayBuffer(), PNG);
  }
});

test("guest reset revokes receipt/photo access, including reset during media retrieval and capture", async t => {
  for (const action of ["get", "put"] as const) {
    const state = fixture(t); const guest = await newGuest(state);
    if (action === "get") {
      const record = await capture(state, guest.owner, "reset-get");
      state.bucket.onGet = async () => { state.bucket.onGet = null; assert.equal((await request(state, "/session/reset", { method: "POST", cookie: guest.cookie })).status, 200); };
      const response = await request(state, `/records/${record.id}/photos/${record.photos[0]!.id}`, { cookie: guest.cookie });
      assert.equal(response.status, 401);
      await assert.rejects(state.store.receipt(record.id, guest.owner), /record_not_found/);
    } else {
      state.bucket.onPut = async () => { state.bucket.onPut = null; await request(state, "/session/reset", { method: "POST", cookie: guest.cookie }); };
      await assert.rejects(capture(state, guest.owner, "reset-put"), /record_not_found/);
      assert.equal(count(state.obs, "observations"), 0); assert.equal(count(state.obs, "biosecurity_shares"), 0);
    }
    assert.equal((await request(state, "/records", { cookie: guest.cookie })).status, 401);
  }
});

test("mailbox proof is browser-bound, one-time, and creates only a scoped session", async t => {
  const state = fixture(t); const proof = await challenge(state);
  assert.equal((await request(state, "/staff/verify", { body: { challengeId: proof.data.challengeId, code: proof.code } })).status, 401);
  assert.equal((state.core.native.prepare("SELECT attempts FROM municipal_email_challenges").get() as { attempts: number }).attempts, 0);
  const attempts = await Promise.all([1, 2].map(() => request(state, "/staff/verify", { cookie: proof.cookie, body: { challengeId: proof.data.challengeId, code: proof.code } })));
  assert.deepEqual(attempts.map(response => response.status).sort(), [200, 401]);
  assert.equal(count(state.core, "municipal_inboxes"), 1); assert.equal(count(state.core, "municipal_mailbox_memberships"), 1);
  assert.equal(count(state.core, "auth_sessions"), 1); assert.equal(count(state.core, "auth_users"), 0); assert.equal(count(state.core, "oauth_accounts"), 0);
  const session = state.core.native.prepare("SELECT role_name,banned,token_hash FROM auth_sessions").get() as { role_name: string; banned: number; token_hash: string };
  assert.equal(session.role_name, MUNICIPAL_INBOX_ROLE); assert.equal(session.banned, 0);
  const consumed = state.core.native.prepare("SELECT consumed_at,consumed_nonce,code_hash,browser_hash FROM municipal_email_challenges").get() as { consumed_at: string; consumed_nonce: string; code_hash: string; browser_hash: string };
  assert.ok(Number.isFinite(Date.parse(consumed.consumed_at))); assert.equal(consumed.consumed_nonce, session.token_hash);
  assert.notEqual(consumed.code_hash, proof.code); assert.notEqual(consumed.browser_hash, proof.cookie.split("=")[1]);
  const successful = attempts.find(response => response.status === 200)!; const staffCookie = cookie(successful, "__Host-zukan_municipal_inbox");
  assert.match(successful.headers.getSetCookie().join(";"), /HttpOnly; Secure; SameSite=Lax/);
  assert.equal((await request(state, "/staff/session", { cookie: staffCookie })).status, 200);
  const active = await municipalStaff(new Request(ORIGIN, { headers: { cookie: staffCookie } }), state.env);
  assert.equal(active.municipality_code, MUNICIPALITY.code);
  // Even a client that copies the scoped credential into the general cookie cannot become a product member.
  const { worker } = await import("./index");
  const response = await worker.fetch(new Request(ORIGIN + "/api/v1/auth/session", { headers: { cookie: "ikimon_v2_session=" + staffCookie.split("=")[1] } }), state.env as never);
  assert.equal(response.status, 401); assert.deepEqual(await response.json(), { ok: false, error: "session_not_found" });
});

test("verification guesses exhaust exactly five attempts; expiry and duplicate cookies fail closed", async t => {
  const state = fixture(t); const proof = await challenge(state);
  const wrongCode = proof.code === "00000000" ? "11111111" : "00000000";
  const responses = await Promise.all(Array.from({ length: 6 }, () => request(state, "/staff/verify", { cookie: proof.cookie, body: { challengeId: proof.data.challengeId, code: wrongCode } })));
  assert.ok(responses.every(response => response.status === 401));
  assert.equal((state.core.native.prepare("SELECT attempts FROM municipal_email_challenges").get() as { attempts: number }).attempts, 5);
  assert.equal((await request(state, "/staff/verify", { cookie: proof.cookie, body: { challengeId: proof.data.challengeId, code: proof.code } })).status, 401);
  assert.equal(count(state.core, "auth_sessions"), 0);
  const another = await challenge(state, MUNICIPALITY, "expiry");
  assert.equal((await request(state, "/staff/verify", { cookie: another.cookie + "; " + another.cookie, body: { challengeId: another.data.challengeId, code: another.code } })).status, 401);
  state.core.native.prepare("UPDATE municipal_email_challenges SET expires_at = ? WHERE challenge_id = ?").run(PAST, another.data.challengeId);
  assert.equal((await request(state, "/staff/verify", { cookie: another.cookie, body: { challengeId: another.data.challengeId, code: another.code } })).status, 401);
  assert.equal(count(state.core, "auth_sessions"), 0);
});

test("unconfirmed mail is counted once, never automatically resent, and a delivered code still verifies", async t => {
  const state = fixture(t);
  state.env.ALERT_EMAIL = { async send(message) { state.mail.push(message); throw new Error("provider response lost after acceptance"); } };
  const proof = await challenge(state); assert.equal(proof.response.status, 503);
  assert.equal((state.core.native.prepare("SELECT send_state FROM municipal_email_challenges").get() as { send_state: string }).send_state, "unknown");
  const duplicate = await request(state, "/staff/challenge", { body: { municipalityCode: MUNICIPALITY.code, email: proof.email } });
  assert.equal(duplicate.status, 429); assert.equal(state.mail.length, 1);
  const daily = state.core.native.prepare("SELECT count FROM municipal_email_usage WHERE scope = ?").get("day:" + new Date().toISOString().slice(0, 10)) as { count: number };
  assert.equal(daily.count, 1);
  const verified = await request(state, "/staff/verify", { cookie: proof.cookie, body: { challengeId: proof.data.challengeId, code: proof.code } });
  assert.equal(verified.status, 200); assert.equal(state.mail.length, 1);
});

test("mail capacity and official-domain eligibility prevent unbounded sends before a challenge is reserved", async t => {
  t.mock.method(globalThis,"fetch",async()=>new Response(null,{status:404}));
  const state = fixture(t); const day = new Date().toISOString().slice(0, 10);
  for (const email of ["fixture@example.test", "fixture@" + MUNICIPALITY.domains[0]! + ".attacker.test", "fixture@sub." + MUNICIPALITY.domains[0]!]) {
    assert.equal((await request(state, "/staff/challenge", { body: { municipalityCode: MUNICIPALITY.code, email } })).status, 422);
  }
  assert.equal(state.mail.length, 0); assert.equal(count(state.core, "municipal_email_challenges"), 0);
  state.core.native.prepare("INSERT INTO municipal_email_usage(scope,count) VALUES (?,?)").run("day:" + day, BIOSECURITY_LIMITS.dailyEmails - 1);
  const responses = await Promise.all([1, 2].map(index => request(state, "/staff/challenge", { body: { municipalityCode: MUNICIPALITY.code, email: `capacity${index}@${MUNICIPALITY.domains[0]!}` } })));
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 429]);
  assert.equal(state.mail.length, 1); assert.equal(count(state.core, "municipal_email_challenges"), 1);
});

test("revoked mailbox memberships cannot be restored by another email proof", async t => {
  const state = fixture(t); const staff = await verifiedStaff(state);
  state.core.native.prepare("UPDATE municipal_mailbox_memberships SET revoked_at = ?").run(new Date().toISOString());
  state.core.native.prepare("UPDATE municipal_email_challenges SET created_at = ?").run(PAST);
  assert.deepEqual(await (await request(state, "/staff/session", { cookie: staff.cookie })).json(), { authenticated: false });
  const next = await challenge(state);
  const verified = await request(state, "/staff/verify", { cookie: next.cookie, body: { challengeId: next.data.challengeId, code: next.code } });
  assert.equal(verified.status, 403); assert.equal(count(state.core, "auth_sessions"), 1, "no new session is created for the revoked holder");
});

test("a revoked domain denies static catalog matches, existing sessions and pending codes regardless of cache age", async t => {
  const state=fixture(t); const staff=await verifiedStaff(state); const pending=await challenge(state,MUNICIPALITY,"pending");
  state.core.native.prepare("INSERT INTO municipal_domain_evidence (municipality_code,domain,directory_version,verified,verified_at,expires_at,revoked_at) VALUES (?,?,?,1,?,?,?)").run(MUNICIPALITY.code,MUNICIPALITY.domains[0]!,"old-directory",PAST,PAST,new Date().toISOString());
  assert.deepEqual(await (await request(state,"/staff/session",{cookie:staff.cookie})).json(),{authenticated:false});
  assert.equal((await request(state,"/staff/verify",{cookie:pending.cookie,body:{challengeId:pending.data.challengeId,code:pending.code}})).status,401);
  assert.equal((await request(state,"/staff/challenge",{body:{municipalityCode:MUNICIPALITY.code,email:"again@"+MUNICIPALITY.domains[0]!}})).status,422);
  assert.equal(state.mail.length,2); assert.equal(count(state.core,"auth_sessions"),1);
});

test("on-demand official mailbox evidence is cached, expires closed, and is bounded before network retrieval", async t => {
  const state=fixture(t); const domain="environment."+MUNICIPALITY.domains[0]!;
  const fetchMock=t.mock.method(globalThis,"fetch",async()=>new Response(`<a href="mailto:office@${domain}">Contact</a>`,{headers:{"content-type":"text/html"}}));
  const custom={...MUNICIPALITY,domains:[domain]};
  const staff=await verifiedStaff(state,custom);
  assert.equal(fetchMock.mock.callCount(),1);
  assert.equal((state.core.native.prepare("SELECT directory_version FROM municipal_domain_evidence").get() as {directory_version:string}).directory_version,MUNICIPALITY_DIRECTORY_VERSION);
  await challenge(state,custom,"second"); assert.equal(fetchMock.mock.callCount(),1);
  state.core.native.prepare("UPDATE municipal_domain_evidence SET expires_at = ?").run(PAST);
  assert.deepEqual(await (await request(state,"/staff/session",{cookie:staff.cookie})).json(),{authenticated:false});
  state.core.native.prepare("UPDATE municipal_email_usage SET count = 100 WHERE scope = ?").run("proof-day:"+new Date().toISOString().slice(0,10));
  const blocked=await request(state,"/staff/challenge",{body:{municipalityCode:MUNICIPALITY.code,email:"third@"+domain}});
  assert.equal(blocked.status,429); assert.equal(fetchMock.mock.callCount(),1); assert.equal(state.mail.length,2);
});

test("record expiry during R2 retrieval denies recipient photo bytes before the response starts", async t => {
  const state=fixture(t); const owner=await newGuest(state); const record=await capture(state,owner.owner,"expiry-r2");
  const shared=await state.store.share(owner.owner,record.id,consent("expiry-r2",{fields:["observedAt","photos"]}));
  const staff=await verifiedStaff(state);
  state.bucket.onGet=async()=>{state.bucket.onGet=null;state.obs.native.prepare("UPDATE biosecurity_record_contexts SET expires_at = ? WHERE record_id = ?").run(PAST,record.id);};
  const response=await request(state,`/inbox/${shared.shareId}/photos/${record.photos[0]!.id}`,{cookie:staff.cookie});
  assert.equal(response.status,404); assert.notDeepEqual(await response.arrayBuffer(),PNG);
});

test("cross-site guest initialization cannot rotate the current device credential", async t => {
  const state=fixture(t);const owner=await newGuest(state);
  const response=await request(state,"/session",{cookie:owner.cookie,headers:{"sec-fetch-site":"cross-site"}});
  assert.equal(response.status,403);assert.equal(response.headers.has("set-cookie"),false);assert.equal(count(state.obs,"biosecurity_guest_sessions"),1);
});

test("concurrent TTL sweeps delete expired media and return storage capacity once while preserving live records", async t => {
  const state = fixture(t); const guest = await newGuest(state);
  const expired = await capture(state, guest.owner, "ttl-expired"); const live = await capture(state, guest.owner, "ttl-live");
  const shared = await state.store.share(guest.owner, expired.id, consent("ttl-share", { fields: ["observedAt", "photos"] }));
  state.obs.native.prepare("UPDATE biosecurity_record_contexts SET expires_at = ? WHERE record_id = ?").run(PAST, expired.id);
  await Promise.all([expireBiosecurityRecords(state.env), expireBiosecurityRecords(state.env)]);
  assert.equal(state.bucket.objects.size, 1); assert.equal(count(state.obs, "observations"), 1); assert.equal(count(state.obs, "asset_ledger"), 1);
  assert.deepEqual({ ...usage(state.obs) }, { count: 1, bytes: PNG.byteLength });
  assert.equal((await state.store.context(expired.id))?.persistence, "deleted");
  await assert.rejects(state.store.receipt(expired.id, guest.owner), /record_not_found/);
  assert.equal((await state.store.receipt(live.id, guest.owner)).status, "saved");
  const share = state.obs.native.prepare("SELECT status,version FROM biosecurity_shares WHERE share_id = ?").get(shared.shareId) as { status: string; version: number };
  assert.deepEqual({ ...share }, { status: "withdrawn", version: 2 });
  await expireBiosecurityRecords(state.env); assert.deepEqual({ ...usage(state.obs) }, { count: 1, bytes: PNG.byteLength });
});

test("failed TTL deletion preserves its storage reservation until a later successful sweep", async t => {
  const state = fixture(t); const guest = await newGuest(state); const record = await capture(state, guest.owner, "ttl-retry");
  state.obs.native.prepare("UPDATE biosecurity_record_contexts SET expires_at = ? WHERE record_id = ?").run(PAST, record.id);
  state.bucket.onDelete = async () => { state.bucket.onDelete = null; throw new Error("R2 delete unavailable"); };
  await assert.rejects(expireBiosecurityRecords(state.env), /R2 delete unavailable/);
  assert.equal((await state.store.context(record.id))?.persistence, "deleting"); assert.equal(state.bucket.objects.size, 1);
  assert.deepEqual({ ...usage(state.obs) }, { count: 1, bytes: PNG.byteLength });
  await expireBiosecurityRecords(state.env);
  assert.equal((await state.store.context(record.id))?.persistence, "deleted"); assert.equal(state.bucket.objects.size, 0);
  assert.deepEqual({ ...usage(state.obs) }, { count: 0, bytes: 0 });
});

test("owner deletion revokes recipient access, removes private media, and is safe to repeat", async t => {
  const state = fixture(t); const guest = await newGuest(state); const other = await newGuest(state);
  const record = await capture(state, guest.owner, "manual-delete");
  const shared = await state.store.share(guest.owner, record.id, consent("manual-delete", { fields: ["observedAt", "photos"] }));
  const staff = await verifiedStaff(state);
  assert.equal((await request(state, `/records/${record.id}`, { method: "DELETE", cookie: other.cookie })).status, 404);
  assert.equal(state.bucket.objects.size, 1);
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await request(state, `/records/${record.id}`, { method: "DELETE", cookie: guest.cookie });
    assert.equal(response.status, 200, await response.clone().text()); assert.deepEqual(await response.json(), { status: "deleted" });
  }
  assert.equal(state.bucket.objects.size, 0); assert.equal(count(state.obs, "observations"), 0); assert.equal(count(state.obs, "draft_observations"), 0); assert.equal(count(state.obs, "asset_ledger"), 0);
  assert.deepEqual({ ...usage(state.obs) }, { count: 0, bytes: 0 });
  assert.equal((await request(state, `/records/${record.id}`, { cookie: guest.cookie })).status, 404);
  assert.equal((await request(state, `/inbox/${shared.shareId}/photos/${record.photos[0]!.id}`, { cookie: staff.cookie })).status, 404);
  assert.deepEqual((await (await request(state, "/inbox", { cookie: staff.cookie })).json() as { items: unknown[] }).items, []);
  const events = state.obs.native.prepare("SELECT event_type,version FROM biosecurity_share_events WHERE share_id = ? ORDER BY version").all(shared.shareId) as { event_type: string; version: number }[];
  assert.deepEqual(events.map(row => ({ ...row })), [{ event_type: "consented", version: 1 }, { event_type: "withdrawn", version: 2 }]);
});

test("manual deletion retries a failed R2 delete or unknown committed D1 result without duplicate storage credit", async t => {
  for (const failure of ["r2", "d1-after"] as const) {
    const state = fixture(t); const guest = await newGuest(state); const record = await capture(state, guest.owner, "delete-retry-" + failure);
    if (failure === "r2") state.bucket.onDelete = async () => { state.bucket.onDelete = null; throw new Error("R2 result unavailable"); };
    else state.obs.afterCommit = queries => {
      if (queries.some(query => query.startsWith("DELETE FROM asset_ledger"))) { state.obs.afterCommit = null; throw new Error("D1 delete result unavailable"); }
    };
    assert.equal((await request(state, `/records/${record.id}`, { method: "DELETE", cookie: guest.cookie })).status, 503);
    assert.equal((await request(state, `/records/${record.id}`, { cookie: guest.cookie })).status, 404, "failed deletion stays inaccessible");
    assert.deepEqual({ ...usage(state.obs) }, failure === "r2" ? { count: 1, bytes: PNG.byteLength } : { count: 0, bytes: 0 });
    const retry = await request(state, `/records/${record.id}`, { method: "DELETE", cookie: guest.cookie });
    assert.equal(retry.status, 200, await retry.clone().text()); assert.equal(state.bucket.objects.size, 0);
    assert.deepEqual({ ...usage(state.obs) }, { count: 0, bytes: 0 });
  }
});

test("manual and expiry deletion contend for one lease and leave another live record's reservation intact", async t => {
  const state = fixture(t); const guest = await newGuest(state);
  const record = await capture(state, guest.owner, "delete-overlap"); const live = await capture(state, guest.owner, "delete-overlap-live");
  state.obs.native.prepare("UPDATE biosecurity_record_contexts SET expires_at = ? WHERE record_id = ?").run(PAST, record.id);
  let deletionStarted!: () => void; let releaseDeletion!: () => void;
  const entered = new Promise<void>(resolve => { deletionStarted = resolve; });
  const release = new Promise<void>(resolve => { releaseDeletion = resolve; });
  state.bucket.onDelete = async () => { deletionStarted(); await release; };
  const first = request(state, `/records/${record.id}`, { method: "DELETE", cookie: guest.cookie });
  await entered;
  try {
    const overlapping = await request(state, `/records/${record.id}`, { method: "DELETE", cookie: guest.cookie });
    assert.equal(overlapping.status, 409);
    await expireBiosecurityRecords(state.env);
    assert.deepEqual({ ...usage(state.obs) }, { count: 2, bytes: 2 * PNG.byteLength });
  } finally { releaseDeletion(); }
  assert.equal((await first).status, 200); state.bucket.onDelete = null;
  await expireBiosecurityRecords(state.env);
  assert.deepEqual({ ...usage(state.obs) }, { count: 1, bytes: PNG.byteLength });
  assert.equal((await state.store.receipt(live.id, guest.owner)).status, "saved"); assert.equal(state.bucket.objects.size, 1);
});

test("challenge cleanup is bounded and leaves active proofs available", async t => {
  const state = fixture(t);
  const insert = state.core.native.prepare("INSERT INTO municipal_email_challenges(challenge_id,municipality_code,email,browser_hash,code_hash,send_state,expires_at,created_at) VALUES (?,?,?,?,?,'sent',?,?)");
  for (let index = 0; index < 102; index++) insert.run("expired-" + index, MUNICIPALITY.code, "fixture@example.test", "digest", "digest", PAST, PAST);
  insert.run("active", MUNICIPALITY.code, "fixture@example.test", "digest", "digest", FUTURE, PAST);
  await expireBiosecurityRecords(state.env);
  assert.equal(count(state.core, "municipal_email_challenges"), 3);
  assert.ok(state.core.native.prepare("SELECT challenge_id FROM municipal_email_challenges WHERE challenge_id = 'active'").get());
});
