import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { Env } from "./core/env";
import { GUEST_PASS_COOKIE_NAME, issueGuestPass } from "./guestPosting";
import {
  handleCreateGuestObservation,
  handleListGuestObservations,
  handleUploadGuestObservationPhoto,
} from "./guestObservationPost";

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
    async delete(key: string) {
      objects.delete(key);
    },
  };
  return { bucket: bucket as unknown as Env["ASSET_BUCKET"], objects };
}

async function setupDb(t: test.TestContext) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  const sql0001 = await readFile(new URL("../migrations/observations/0001_observation_write_contract.sql", import.meta.url), "utf8");
  const sql0011 = await readFile(new URL("../migrations/observations/0011_logical_partition_month.sql", import.meta.url), "utf8");
  const sql0078 = await readFile(new URL("../migrations/observations/0078_guest_posting_core.sql", import.meta.url), "utf8");
  sqlite.exec(sql0001);
  sqlite.exec(sql0011);
  sqlite.exec(sql0078);
  return { sqlite, db: sqliteObsDb(sqlite) };
}

test("guest observation endpoints return 404 when GUEST_POSTING_ENABLED is off", async (t) => {
  const { db } = await setupDb(t);
  const { bucket } = createMemoryBucket();
  const env = { OBS_DB: db, ASSET_BUCKET: bucket, GUEST_POSTING_ENABLED: "false" } as unknown as Env;

  const createRes = await handleCreateGuestObservation(
    new Request("https://ikimon.life/api/v1/guest/observations", { method: "POST", body: "{}" }),
    env
  );
  assert.equal(createRes.status, 404);

  const photoRes = await handleUploadGuestObservationPhoto(
    "obs_1",
    new Request("https://ikimon.life/api/v1/guest/observations/obs_1/photos", { method: "POST", body: "{}" }),
    env
  );
  assert.equal(photoRes.status, 404);

  const listRes = await handleListGuestObservations(
    new Request("https://ikimon.life/api/v1/guest/observations"),
    env
  );
  assert.equal(listRes.status, 404);
});

test("guest observation post enforces 401/403, forces guest:<passId> & private, and marks photo pending_inspection", async (t) => {
  const { sqlite, db } = await setupDb(t);
  const { bucket, objects } = createMemoryBucket();
  const env = { OBS_DB: db, ASSET_BUCKET: bucket, GUEST_POSTING_ENABLED: "true", ENVIRONMENT: "staging" } as unknown as Env;

  // No cookie -> 401
  const noAuth = await handleCreateGuestObservation(
    new Request("https://ikimon.life/api/v1/guest/observations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ destinationKind: "event", destinationId: "evt-1", taxonLabel: "カワセミ" }),
    }),
    env
  );
  assert.equal(noAuth.status, 401);

  const passA = await issueGuestPass(db, { destination: { kind: "event", id: "evt-1" } });
  const passB = await issueGuestPass(db, { destination: { kind: "event", id: "evt-1" } });

  // Spoofed visibility/owner/id in body are ignored; server sets guest:<passId> and private
  const createRes = await handleCreateGuestObservation(
    new Request("https://ikimon.life/api/v1/guest/observations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `${GUEST_PASS_COOKIE_NAME}=${passA.rawToken}`,
      },
      body: JSON.stringify({
        id: "obs_spoof",
        ownerUserId: "user_admin",
        visibility: "public",
        destinationKind: "event",
        destinationId: "evt-1",
        taxonLabel: "カワセミ",
        note: "川沿いで見かけた",
      }),
    }),
    env
  );
  assert.equal(createRes.status, 201);
  const created = await createRes.json() as {
    ok: boolean;
    observationId: string;
    ownerKey: string;
    visibility: string;
    inspectionStatus: string;
  };
  assert.equal(created.ok, true);
  assert.notEqual(created.observationId, "obs_spoof");
  assert.equal(created.ownerKey, `guest:${passA.passId}`);
  assert.equal(created.visibility, "private");
  assert.equal(created.inspectionStatus, "pending");

  const obsRow = sqlite.prepare("SELECT owner_user_id, visibility FROM observations WHERE observation_id = ?").get(created.observationId) as {
    owner_user_id: string;
    visibility: string;
  };
  assert.equal(obsRow.owner_user_id, `guest:${passA.passId}`);
  assert.equal(obsRow.visibility, "private");

  // Never published to readmodel_public_observations
  const pubCount = sqlite.prepare("SELECT COUNT(*) AS cnt FROM readmodel_public_observations").get() as { cnt: number };
  assert.equal(pubCount.cnt, 0);

  // Reservation committed -> used_count = 1, reserved_count = 0
  const quotaRow = sqlite.prepare("SELECT reserved_count, used_count FROM guest_destination_quotas WHERE destination_key = 'event:evt-1'").get() as {
    reserved_count: number;
    used_count: number;
  };
  assert.equal(quotaRow.reserved_count, 0);
  assert.equal(quotaRow.used_count, 1);

  // Minimal valid JPEG bytes (FF D8 FF E0)
  const jpegBase64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]).toString("base64");

  // Other guest -> 403
  const otherPhotoRes = await handleUploadGuestObservationPhoto(
    created.observationId,
    new Request(`https://ikimon.life/api/v1/guest/observations/${created.observationId}/photos`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `${GUEST_PASS_COOKIE_NAME}=${passB.rawToken}`,
      },
      body: JSON.stringify({ mimeType: "image/jpeg", filename: "bird.jpg", base64Data: jpegBase64 }),
    }),
    env
  );
  assert.equal(otherPhotoRes.status, 403);

  // Owner guest -> 201, stored in R2 + asset_ledger with pending_inspection
  const photoRes = await handleUploadGuestObservationPhoto(
    created.observationId,
    new Request(`https://ikimon.life/api/v1/guest/observations/${created.observationId}/photos`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `${GUEST_PASS_COOKIE_NAME}=${passA.rawToken}`,
      },
      body: JSON.stringify({ mimeType: "image/jpeg", filename: "bird.jpg", base64Data: jpegBase64 }),
    }),
    env
  );
  assert.equal(photoRes.status, 201);
  const photoJson = await photoRes.json() as {
    ok: boolean;
    assetId: string;
    visibility: string;
    processingState: string;
    inspectionStatus: string;
  };
  assert.equal(photoJson.ok, true);
  assert.equal(photoJson.visibility, "private");
  assert.equal(photoJson.processingState, "pending_inspection");
  assert.equal(photoJson.inspectionStatus, "pending");
  assert.equal(objects.size, 1);

  // List only shows own private observations
  const listA = await handleListGuestObservations(
    new Request("https://ikimon.life/api/v1/guest/observations", {
      headers: { cookie: `${GUEST_PASS_COOKIE_NAME}=${passA.rawToken}` },
    }),
    env
  );
  assert.equal(listA.status, 200);
  const listAJson = await listA.json() as { observations: Array<{ observationId: string; inspectionStatus: string; photoCount: number }> };
  assert.equal(listAJson.observations.length, 1);
  assert.equal(listAJson.observations[0]?.observationId, created.observationId);
  assert.equal(listAJson.observations[0]?.inspectionStatus, "pending");
  assert.equal(listAJson.observations[0]?.photoCount, 1);

  const listB = await handleListGuestObservations(
    new Request("https://ikimon.life/api/v1/guest/observations", {
      headers: { cookie: `${GUEST_PASS_COOKIE_NAME}=${passB.rawToken}` },
    }),
    env
  );
  assert.equal(listB.status, 200);
  const listBJson = await listB.json() as { observations: unknown[] };
  assert.equal(listBJson.observations.length, 0);
});
