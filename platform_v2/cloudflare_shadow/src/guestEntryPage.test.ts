import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { Env } from "./core/env";
import { GUEST_PASS_COOKIE_NAME, issueGuestPass, setDestinationQrStopped } from "./guestPosting";
import { handleGuestEntryPageRoute, isInAppBrowserUserAgent } from "./guestEntryPage";

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
  sqlite.exec(await readFile(new URL("../migrations/observations/0078_guest_posting_core.sql", import.meta.url), "utf8"));
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS places (
      place_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'public'
    );
    CREATE TABLE IF NOT EXISTS observation_event_sessions (
      session_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      organizer_user_id TEXT NOT NULL,
      started_at TEXT NOT NULL
    );
  `);
  sqlite.prepare("INSERT INTO places (place_id, name, visibility) VALUES (?, ?, 'public')").run("place-sanaru", "佐鳴湖公園");
  sqlite.prepare("INSERT INTO places (place_id, name, visibility) VALUES (?, ?, 'private')").run("place-secret", "非公開の場所");
  sqlite.prepare("INSERT INTO observation_event_sessions (session_id, title, organizer_user_id, started_at) VALUES (?, ?, ?, ?)").run(
    "evt-1",
    "冬の野鳥観察会",
    "org-1",
    "2026-11-25T09:00:00Z"
  );
  return { sqlite, db: sqliteObsDb(sqlite) };
}

test("guest entry page returns 404 when GUEST_POSTING_ENABLED is off or target is private/invalid", async (t) => {
  const { db } = await setupDb(t);
  const envOff = { OBS_DB: db, GUEST_POSTING_ENABLED: "false" } as unknown as Env;
  const offRes = await handleGuestEntryPageRoute("place", "place-sanaru", "ja", new Request("https://ikimon.life/ja/guest/place/place-sanaru"), envOff);
  assert.equal(offRes.status, 404);

  const envOn = { OBS_DB: db, GUEST_POSTING_ENABLED: "true" } as unknown as Env;
  const privRes = await handleGuestEntryPageRoute("place", "place-secret", "ja", new Request("https://ikimon.life/ja/guest/place/place-secret"), envOn);
  assert.equal(privRes.status, 404);

  const badKind = await handleGuestEntryPageRoute("other", "place-sanaru", "ja", new Request("https://ikimon.life/ja/guest/other/place-sanaru"), envOn);
  assert.equal(badKind.status, 404);
});

test("guest entry page renders single place/event without issuing pass on GET, warns in-app browser, and shows handoff code panel when active", async (t) => {
  const { db } = await setupDb(t);
  const env = { OBS_DB: db, GUEST_POSTING_ENABLED: "true" } as unknown as Env;

  assert.equal(isInAppBrowserUserAgent("Mozilla/5.0 Line/14.0.0"), true);
  assert.equal(isInAppBrowserUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1"), false);

  // Opening QR page does NOT set guest pass cookie
  const qrRes = await handleGuestEntryPageRoute(
    "event",
    "evt-1",
    "ja",
    new Request("https://ikimon.life/ja/guest/event/evt-1", {
      headers: { "user-agent": "Mozilla/5.0 Line/14.0.0" },
    }),
    env
  );
  assert.equal(qrRes.status, 200);
  assert.equal(qrRes.headers.get("set-cookie"), null);
  const qrHtml = await qrRes.text();
  assert.match(qrHtml, /冬の野鳥観察会/);
  assert.match(qrHtml, /ここで投稿する/);
  assert.match(qrHtml, /data-guest-inapp-warning="1"/);
  assert.match(qrHtml, /data-guest-recover-form="1"/);

  // With active guest pass -> shows post form and handoff code generator
  const pass = await issueGuestPass(db, { destination: { kind: "place", id: "place-sanaru" } });
  const activeRes = await handleGuestEntryPageRoute(
    "place",
    "place-sanaru",
    "ja",
    new Request("https://ikimon.life/ja/guest/place/place-sanaru", {
      headers: { cookie: `${GUEST_PASS_COOKIE_NAME}=${pass.rawToken}` },
    }),
    env
  );
  assert.equal(activeRes.status, 200);
  const activeHtml = await activeRes.text();
  assert.match(activeHtml, /佐鳴湖公園/);
  assert.match(activeHtml, /data-guest-post-form="1"/);
  assert.match(activeHtml, /data-guest-handoff-panel="1"/);
  assert.match(activeHtml, /引き継ぎコード/);

  // QR stopped -> shows stopped notice and hides/disables start button
  await setDestinationQrStopped(db, { kind: "event", id: "evt-1" }, true);
  const stoppedRes = await handleGuestEntryPageRoute(
    "event",
    "evt-1",
    "ja",
    new Request("https://ikimon.life/ja/guest/event/evt-1"),
    env
  );
  assert.equal(stoppedRes.status, 200);
  const stoppedHtml = await stoppedRes.text();
  assert.match(stoppedHtml, /data-guest-qr-stopped="1"/);
});
