import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { Env } from "./core/env";
import { GUEST_PASS_COOKIE_NAME, issueGuestPass } from "./guestPosting";
import { handleCreateGuestObservation, handleUploadGuestObservationPhoto } from "./guestObservationPost";
import {
  buildGuestObservationGeminiPayload,
  handleGetEventGuestPhoto,
  handleListEventGuestObservations,
  handleOrganizerRemoveGuestObservation,
  handleSetGuestObservationShareScope,
} from "./guestEventShare";

function sqliteObsDb(sqlite: DatabaseSync): Env["OBS_DB"] {
  const wrapStmt = (query: string, values: unknown[]) => ({
    runSync: () => ({ meta: { changes: Number(sqlite.prepare(query).run(...(values as never[])).changes) } }),
  });
  return {
    prepare(query: string) {
      let values: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          values = args;
          return stmt;
        },
        async run() {
          return wrapStmt(query, values).runSync();
        },
        async first<T>() {
          return (sqlite.prepare(query).get(...(values as never[])) as T | undefined) ?? null;
        },
        async all<T>() {
          return { results: sqlite.prepare(query).all(...(values as never[])) as T[] };
        },
        __raw: () => wrapStmt(query, values),
      };
      return stmt as unknown as ReturnType<Env["OBS_DB"]["prepare"]>;
    },
    async batch(stmts: Array<{ __raw?: () => { runSync: () => unknown }; run: () => Promise<unknown> }>) {
      const results: unknown[] = [];
      for (const s of stmts) {
        results.push(s.__raw ? s.__raw().runSync() : await s.run());
      }
      return results;
    },
  } as unknown as Env["OBS_DB"];
}

function createMemoryBucket() {
  const objects = new Map<string, { bytes: Uint8Array; contentType?: string }>();
  const bucket = {
    async put(key: string, value: ArrayBuffer | Uint8Array, options?: { httpMetadata?: { contentType?: string } }) {
      const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
      objects.set(key, { bytes, contentType: options?.httpMetadata?.contentType });
    },
    async get(key: string) {
      const entry = objects.get(key);
      if (!entry) return null;
      return {
        body: entry.bytes,
        httpMetadata: { contentType: entry.contentType ?? "application/octet-stream" },
        async arrayBuffer() {
          return entry.bytes.buffer.slice(entry.bytes.byteOffset, entry.bytes.byteOffset + entry.bytes.byteLength);
        },
      };
    },
    async delete(key: string) {
      objects.delete(key);
    },
  };
  return { bucket: bucket as unknown as Env["ASSET_BUCKET"], objects };
}

async function setupDb(t: test.TestContext) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  for (const rel of [
    "../migrations/observations/0001_observation_write_contract.sql",
    "../migrations/observations/0011_logical_partition_month.sql",
    "../migrations/observations/0078_guest_posting_core.sql",
    "../migrations/observations/0079_guest_event_share.sql",
  ]) {
    sqlite.exec(await readFile(new URL(rel, import.meta.url), "utf8"));
  }
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS observation_event_sessions (
      session_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      organizer_user_id TEXT NOT NULL,
      started_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS observation_event_participants (
      participant_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      user_id TEXT,
      status TEXT NOT NULL DEFAULT 'checked_in'
    );
  `);
  sqlite.prepare("INSERT INTO observation_event_sessions (session_id, title, organizer_user_id, started_at) VALUES (?, ?, ?, ?)").run(
    "evt-1",
    "冬の野鳥観察会",
    "organizer-1",
    "2026-11-25T09:00:00Z"
  );
  sqlite.prepare("INSERT INTO observation_event_participants (participant_id, session_id, user_id, status) VALUES (?, ?, ?, 'checked_in')").run(
    "part-1",
    "evt-1",
    "member-1"
  );
  return { sqlite, db: sqliteObsDb(sqlite) };
}

test("guest event share returns 404 when GUEST_POSTING_ENABLED is off", async (t) => {
  const { db } = await setupDb(t);
  const { bucket } = createMemoryBucket();
  const env = { OBS_DB: db, ASSET_BUCKET: bucket, GUEST_POSTING_ENABLED: "false" } as unknown as Env;

  const res = await handleSetGuestObservationShareScope(
    "obs_1",
    new Request("https://ikimon.life/api/v1/guest/observations/obs_1/share-scope", { method: "POST", body: "{}" }),
    env
  );
  assert.equal(res.status, 404);
});

test("guest event share enforces inspected-only visibility, participant access, organizer removal, and Gemini consent/location drop", async (t) => {
  const { sqlite, db } = await setupDb(t);
  const { bucket } = createMemoryBucket();
  const env = { OBS_DB: db, ASSET_BUCKET: bucket, GUEST_POSTING_ENABLED: "true", ENVIRONMENT: "staging" } as unknown as Env;

  const passA = await issueGuestPass(db, { destination: { kind: "event", id: "evt-1" } });
  const passOtherEvent = await issueGuestPass(db, { destination: { kind: "event", id: "evt-2" } });

  // Create observation + photo (pending_inspection)
  const createRes = await handleCreateGuestObservation(
    new Request("https://ikimon.life/api/v1/guest/observations", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `${GUEST_PASS_COOKIE_NAME}=${passA.rawToken}` },
      body: JSON.stringify({
        destinationKind: "event",
        destinationId: "evt-1",
        taxonLabel: "アオサギ",
        note: "水辺にいた",
        latitude: 34.7123,
        longitude: 137.7261,
      }),
    }),
    env
  );
  assert.equal(createRes.status, 201);
  const { observationId } = await createRes.json() as { observationId: string };

  const jpegBase64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]).toString("base64");
  const photoRes = await handleUploadGuestObservationPhoto(
    observationId,
    new Request(`https://ikimon.life/api/v1/guest/observations/${observationId}/photos`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `${GUEST_PASS_COOKIE_NAME}=${passA.rawToken}` },
      body: JSON.stringify({ mimeType: "image/jpeg", filename: "heron.jpg", base64Data: jpegBase64 }),
    }),
    env
  );
  assert.equal(photoRes.status, 201);
  const { assetId } = await photoRes.json() as { assetId: string };

  // Public share_scope is rejected
  const publicAttempt = await handleSetGuestObservationShareScope(
    observationId,
    new Request(`https://ikimon.life/api/v1/guest/observations/${observationId}/share-scope`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `${GUEST_PASS_COOKIE_NAME}=${passA.rawToken}` },
      body: JSON.stringify({ eventId: "evt-1", shareScope: "public" }),
    }),
    env
  );
  assert.equal(publicAttempt.status, 403);

  // Without Gemini consent -> buildGuestObservationGeminiPayload rejects
  const beforeConsent = await buildGuestObservationGeminiPayload(db, observationId);
  assert.equal(beforeConsent.ok, false);

  // Share to event_members with Gemini consent
  const shareRes = await handleSetGuestObservationShareScope(
    observationId,
    new Request(`https://ikimon.life/api/v1/guest/observations/${observationId}/share-scope`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `${GUEST_PASS_COOKIE_NAME}=${passA.rawToken}` },
      body: JSON.stringify({ eventId: "evt-1", shareScope: "event_members", geminiConsent: true }),
    }),
    env
  );
  assert.equal(shareRes.status, 200);

  // Gemini payload now allowed AND strips exact coordinates
  const geminiOut = await buildGuestObservationGeminiPayload(db, observationId);
  assert.equal(geminiOut.ok, true);
  if (geminiOut.ok) {
    assert.equal(geminiOut.payload.taxonLabel, "アオサギ");
    assert.equal("latitude" in geminiOut.payload, false);
    assert.equal("longitude" in geminiOut.payload, false);
    assert.equal("exact_lat" in geminiOut.payload, false);
  }

  // While photo is pending_inspection, event feed & direct image link do NOT return it
  const pendingList = await handleListEventGuestObservations(
    "evt-1",
    new Request("https://ikimon.life/api/v1/events/evt-1/guest-observations", {
      headers: { cookie: `${GUEST_PASS_COOKIE_NAME}=${passA.rawToken}` },
    }),
    env,
    { sessionUserId: "member-1", isAdmin: false }
  );
  assert.equal(pendingList.status, 200);
  const pendingJson = await pendingList.json() as { observations: unknown[]; summary: { totalInspectedCount: number } };
  assert.equal(pendingJson.observations.length, 0);
  assert.equal(pendingJson.summary.totalInspectedCount, 0);

  const pendingPhoto = await handleGetEventGuestPhoto(
    "evt-1",
    observationId,
    assetId,
    new Request(`https://ikimon.life/api/v1/events/evt-1/guest-observations/${observationId}/photos/${assetId}`),
    env,
    { sessionUserId: "member-1", isAdmin: false }
  );
  assert.equal(pendingPhoto.status, 404);

  // Mark photo as inspected -> now visible to evt-1 participants & direct photo link works, but NOT to other event guest
  sqlite.prepare("UPDATE asset_ledger SET processing_state = 'inspected' WHERE asset_id = ?").run(assetId);

  const otherEventDeny = await handleListEventGuestObservations(
    "evt-1",
    new Request("https://ikimon.life/api/v1/events/evt-1/guest-observations", {
      headers: { cookie: `${GUEST_PASS_COOKIE_NAME}=${passOtherEvent.rawToken}` },
    }),
    env,
    { sessionUserId: null, isAdmin: false }
  );
  assert.equal(otherEventDeny.status, 403);

  const inspectedList = await handleListEventGuestObservations(
    "evt-1",
    new Request("https://ikimon.life/api/v1/events/evt-1/guest-observations"),
    env,
    { sessionUserId: "member-1", isAdmin: false }
  );
  assert.equal(inspectedList.status, 200);
  const inspectedJson = await inspectedList.json() as { observations: Array<{ observationId: string }>; summary: { totalInspectedCount: number } };
  assert.equal(inspectedJson.observations.length, 1);
  assert.equal(inspectedJson.observations[0]?.observationId, observationId);
  assert.equal(inspectedJson.summary.totalInspectedCount, 1);

  const inspectedPhoto = await handleGetEventGuestPhoto(
    "evt-1",
    observationId,
    assetId,
    new Request(`https://ikimon.life/api/v1/events/evt-1/guest-observations/${observationId}/photos/${assetId}`),
    env,
    { sessionUserId: "member-1", isAdmin: false }
  );
  assert.equal(inspectedPhoto.status, 200);

  // Non-organizer cannot remove -> 403
  const nonOrgRemove = await handleOrganizerRemoveGuestObservation(
    "evt-1",
    observationId,
    new Request(`https://ikimon.life/api/v1/events/evt-1/guest-observations/${observationId}/remove`, { method: "POST" }),
    env,
    { sessionUserId: "member-1", isAdmin: false }
  );
  assert.equal(nonOrgRemove.status, 403);

  // Organizer removes -> 200, and observation disappears from event feed & direct photo link
  const orgRemove = await handleOrganizerRemoveGuestObservation(
    "evt-1",
    observationId,
    new Request(`https://ikimon.life/api/v1/events/evt-1/guest-observations/${observationId}/remove`, { method: "POST" }),
    env,
    { sessionUserId: "organizer-1", isAdmin: false }
  );
  assert.equal(orgRemove.status, 200);

  const afterRemoveList = await handleListEventGuestObservations(
    "evt-1",
    new Request("https://ikimon.life/api/v1/events/evt-1/guest-observations"),
    env,
    { sessionUserId: "member-1", isAdmin: false }
  );
  const afterRemoveJson = await afterRemoveList.json() as { observations: unknown[]; summary: { totalInspectedCount: number } };
  assert.equal(afterRemoveJson.observations.length, 0);
  assert.equal(afterRemoveJson.summary.totalInspectedCount, 0);
});
