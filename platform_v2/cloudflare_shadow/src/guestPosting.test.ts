import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { Env } from "./core/env";
import {
  GUEST_PASS_COOKIE_NAME,
  GUEST_PASS_TTL_MS,
  guestAdmit,
  isGuestPostingEnabled,
  issueGuestPass,
  revokeGuestPass,
  setDestinationQrStopped,
} from "./guestPosting";

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

test("guest posting feature flag is OFF by default", () => {
  assert.equal(isGuestPostingEnabled({} as Env), false);
  assert.equal(isGuestPostingEnabled({ GUEST_POSTING_ENABLED: "false" } as Env), false);
  assert.equal(isGuestPostingEnabled({ GUEST_POSTING_ENABLED: "true" } as Env), true);
});

test("guest pass issuance, 90-day TTL, revocation, and guestAdmit quotas/QR stop work across 6 additive tables", async (t) => {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  const migrationSql = await readFile(
    new URL("../migrations/observations/0078_guest_posting_core.sql", import.meta.url),
    "utf8"
  );
  sqlite.exec(migrationSql);
  const db = sqliteObsDb(sqlite);

  const t0 = 1_700_000_000_000;
  const issued = await issueGuestPass(db, {
    destination: { kind: "place", id: "place-sanaru" },
    now: t0,
  });
  assert.equal(issued.rawToken.length, 64);
  assert.equal(issued.expiresAt, t0 + GUEST_PASS_TTL_MS);

  // Raw token is never stored in DB
  const stored = sqlite.prepare("SELECT token_hash, status FROM guest_passes WHERE pass_id = ?").get(issued.passId) as {
    token_hash: string;
    status: string;
  };
  assert.notEqual(stored.token_hash, issued.rawToken);
  assert.equal(stored.status, "active");

  // Missing cookie -> 401
  const noCookie = await guestAdmit(db, new Request("https://ikimon.life/"), { kind: "place", id: "place-sanaru" }, { now: t0 + 1000 });
  assert.deepEqual(noCookie, { admitted: false, status: 401, error: "guest_pass_required" });

  // Valid cookie -> admitted & refreshes sliding 90d expiry, supports multiple destinations
  const reqWithCookie = new Request("https://ikimon.life/", {
    headers: { cookie: `${GUEST_PASS_COOKIE_NAME}=${issued.rawToken}` },
  });
  const admit1 = await guestAdmit(db, reqWithCookie, { kind: "place", id: "place-sanaru" }, { now: t0 + 5000, defaultMaxCount: 2 });
  assert.equal(admit1.admitted, true);
  if (admit1.admitted) {
    assert.equal(admit1.ownerKey, `guest:${issued.passId}`);
  }

  const admit2 = await guestAdmit(db, reqWithCookie, { kind: "place", id: "place-sanaru" }, { now: t0 + 6000, defaultMaxCount: 2 });
  assert.equal(admit2.admitted, true);

  // 3rd attempt exceeds maxCount=2 -> 429
  const admit3 = await guestAdmit(db, reqWithCookie, { kind: "place", id: "place-sanaru" }, { now: t0 + 7000, defaultMaxCount: 2 });
  assert.deepEqual(admit3, { admitted: false, status: 429, error: "destination_quota_exceeded" });

  // Same pass can still join another event destination
  const admitEvent = await guestAdmit(db, reqWithCookie, { kind: "event", id: "evt-1" }, { now: t0 + 8000 });
  assert.equal(admitEvent.admitted, true);

  // QR stop -> 403
  await setDestinationQrStopped(db, { kind: "event", id: "evt-1" }, true, 50, t0 + 9000);
  const stoppedAdmit = await guestAdmit(db, reqWithCookie, { kind: "event", id: "evt-1" }, { now: t0 + 10_000 });
  assert.deepEqual(stoppedAdmit, { admitted: false, status: 403, error: "qr_stopped" });

  // Revoking pass -> 401
  const revoked = await revokeGuestPass(db, issued.passId, "user_discarded", "guest", t0 + 11_000);
  assert.equal(revoked, true);
  const afterRevoke = await guestAdmit(db, reqWithCookie, { kind: "place", id: "place-sanaru" }, { now: t0 + 12_000 });
  assert.deepEqual(afterRevoke, { admitted: false, status: 401, error: "guest_pass_required" });
});
