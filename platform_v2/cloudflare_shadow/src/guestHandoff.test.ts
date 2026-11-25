import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { Env } from "./core/env";
import { GUEST_PASS_COOKIE_NAME, findActiveGuestPass, issueGuestPass } from "./guestPosting";
import {
  getClaimedGuestOwnerKeysForUser,
  handleClaimGuestHandoff,
  handleIssueGuestHandoffCode,
  handleRecoverGuestPass,
} from "./guestHandoff";

function sqliteObsDb(sqlite: DatabaseSync): Env["OBS_DB"] {
  return {
    prepare(query: string) {
      let values: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          values = args;
          return stmt;
        },
        async run() {
          return { meta: { changes: Number(sqlite.prepare(query).run(...(values as never[])).changes) } };
        },
        async first<T>() {
          return (sqlite.prepare(query).get(...(values as never[])) as T | undefined) ?? null;
        },
        async all<T>() {
          return { results: sqlite.prepare(query).all(...(values as never[])) as T[] };
        },
      };
      return stmt as unknown as ReturnType<Env["OBS_DB"]["prepare"]>;
    },
  } as unknown as Env["OBS_DB"];
}

async function setupDb(t: test.TestContext) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  for (const rel of [
    "../migrations/observations/0078_guest_posting_core.sql",
    "../migrations/observations/0080_guest_owner_claims.sql",
  ]) {
    sqlite.exec(await readFile(new URL(rel, import.meta.url), "utf8"));
  }
  return { sqlite, db: sqliteObsDb(sqlite) };
}

test("guest handoff endpoints return 404 when GUEST_POSTING_ENABLED is off", async (t) => {
  const { db } = await setupDb(t);
  const env = { OBS_DB: db, GUEST_POSTING_ENABLED: "false" } as unknown as Env;

  const issueRes = await handleIssueGuestHandoffCode(
    new Request("https://ikimon.life/api/v1/guest/handoff-code", { method: "POST" }),
    env
  );
  assert.equal(issueRes.status, 404);

  const claimRes = await handleClaimGuestHandoff(
    new Request("https://ikimon.life/api/v1/guest/handoff/claim", { method: "POST", body: "{}" }),
    env,
    { userId: "user-1", banned: false }
  );
  assert.equal(claimRes.status, 404);
});

test("guest handoff enforces handoff code, 3 conditions, first-claimer-wins race, pass revocation, and recovery", async (t) => {
  const { sqlite, db } = await setupDb(t);
  const env = { OBS_DB: db, GUEST_POSTING_ENABLED: "true" } as unknown as Env;

  // Unauthenticated claim -> 401
  const unauthClaim = await handleClaimGuestHandoff(
    new Request("https://ikimon.life/api/v1/guest/handoff/claim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ handoffCode: "ZKN-1234-5678-9ABC" }),
    }),
    env,
    null
  );
  assert.equal(unauthClaim.status, 401);

  const pass = await issueGuestPass(db, { destination: { kind: "event", id: "evt-1" } });

  // Issue handoff code
  const codeRes = await handleIssueGuestHandoffCode(
    new Request("https://ikimon.life/api/v1/guest/handoff-code", {
      method: "POST",
      headers: { cookie: `${GUEST_PASS_COOKIE_NAME}=${pass.rawToken}` },
    }),
    env
  );
  assert.equal(codeRes.status, 201);
  const { code } = await codeRes.json() as { ok: boolean; code: string };
  assert.match(code, /^ZKN-/);

  // Raw code is hashed in DB
  const codeRow = sqlite.prepare("SELECT code_hash FROM guest_handoff_codes WHERE pass_id = ?").get(pass.passId) as { code_hash: string };
  assert.notEqual(codeRow.code_hash, code);

  // Recovery works before claim and rotates pass cookie
  const recoverRes = await handleRecoverGuestPass(
    new Request("https://ikimon.life/api/v1/guest/handoff/recover", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ handoffCode: code }),
    }),
    env
  );
  assert.equal(recoverRes.status, 200);
  const setCookie = recoverRes.headers.get("set-cookie") ?? "";
  assert.match(setCookie, /zukan_guest_pass=/);

  // Old token is now invalid, recovered token is active
  const oldActive = await findActiveGuestPass(
    db,
    new Request("https://ikimon.life/", { headers: { cookie: `${GUEST_PASS_COOKIE_NAME}=${pass.rawToken}` } })
  );
  assert.equal(oldActive, null);

  // First-claimer-wins: concurrent claims with the same code -> only 1 succeeds (200), second gets 409
  const [claimA, claimB] = await Promise.all([
    handleClaimGuestHandoff(
      new Request("https://ikimon.life/api/v1/guest/handoff/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handoffCode: code }),
      }),
      env,
      { userId: "user-alice", banned: false }
    ),
    handleClaimGuestHandoff(
      new Request("https://ikimon.life/api/v1/guest/handoff/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handoffCode: code }),
      }),
      env,
      { userId: "user-bob", banned: false }
    ),
  ]);
  const statuses = [claimA.status, claimB.status].sort();
  assert.deepEqual(statuses, [200, 409]);

  const winnerId = claimA.status === 200 ? "user-alice" : "user-bob";
  const loserId = claimA.status === 200 ? "user-bob" : "user-alice";

  assert.deepEqual(await getClaimedGuestOwnerKeysForUser(db, winnerId), [`guest:${pass.passId}`]);
  assert.deepEqual(await getClaimedGuestOwnerKeysForUser(db, loserId), []);

  // Pass is revoked after claim, and recovery is rejected after claim
  const passRow = sqlite.prepare("SELECT status, revoked_reason FROM guest_passes WHERE pass_id = ?").get(pass.passId) as {
    status: string;
    revoked_reason: string;
  };
  assert.equal(passRow.status, "revoked");
  assert.equal(passRow.revoked_reason, "claimed");

  const recoverAfterClaim = await handleRecoverGuestPass(
    new Request("https://ikimon.life/api/v1/guest/handoff/recover", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ handoffCode: code }),
    }),
    env
  );
  assert.equal(recoverAfterClaim.status, 409);
});
