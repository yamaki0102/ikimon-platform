import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { Env } from "./core/env";
import { renderZukanWelcomeAndInvitePage, resolveInviteTarget } from "./zukanInviteAndWelcome";

function sqliteObsDb(sqlite: DatabaseSync): Env["OBS_DB"] {
  return {
    prepare(query: string) {
      let values: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          values = args;
          return stmt;
        },
        async first<T>() {
          return (sqlite.prepare(query).get(...(values as never[])) as T | undefined) ?? null;
        },
      };
      return stmt as unknown as ReturnType<Env["OBS_DB"]["prepare"]>;
    },
  } as unknown as Env["OBS_DB"];
}

test("resolveInviteTarget resolves published places and observation events while failing closed on unpublished places", async (t) => {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec(`
    CREATE TABLE observation_event_sessions (session_id TEXT PRIMARY KEY, event_code TEXT NOT NULL, title TEXT NOT NULL);
    CREATE TABLE places (place_id TEXT PRIMARY KEY, canonical_name TEXT NOT NULL, prefecture TEXT, municipality TEXT, locality_label TEXT, public_profile_status TEXT NOT NULL);
  `);
  sqlite.prepare("INSERT INTO observation_event_sessions (session_id, event_code, title) VALUES (?, ?, ?)").run(
    "evt-1",
    "RYUYO2026",
    "竜洋の野鳥観察会"
  );
  sqlite.prepare("INSERT INTO places (place_id, canonical_name, prefecture, municipality, public_profile_status) VALUES (?, ?, ?, ?, ?)").run(
    "place-sanaru",
    "佐鳴湖公園",
    "静岡県",
    "浜松市",
    "published"
  );
  sqlite.prepare("INSERT INTO places (place_id, canonical_name, prefecture, municipality, public_profile_status) VALUES (?, ?, ?, ?, ?)").run(
    "place-private",
    "非公開の庭",
    null,
    null,
    "draft"
  );

  const db = sqliteObsDb(sqlite);
  assert.deepEqual(await resolveInviteTarget(db, "   "), { ok: false, error: "invalid_invite_code" });

  const eventTarget = await resolveInviteTarget(db, "ryuyo2026");
  assert.deepEqual(eventTarget, {
    ok: true,
    kind: "event",
    id: "evt-1",
    code: "RYUYO2026",
    title: "竜洋の野鳥観察会",
    subtitle: "観察会への招待",
    targetHref: "/ja/community/events/RYUYO2026/join",
  });

  const placeTarget = await resolveInviteTarget(db, "place-sanaru");
  assert.deepEqual(placeTarget, {
    ok: true,
    kind: "place",
    id: "place-sanaru",
    code: "place-sanaru",
    title: "佐鳴湖公園",
    subtitle: "静岡県浜松市の観察場所",
    targetHref: "/ja/places/place-sanaru",
  });

  assert.deepEqual(await resolveInviteTarget(db, "place-private"), { ok: false, error: "invite_not_found" });
  assert.deepEqual(await resolveInviteTarget(db, "unknown-code"), { ok: false, error: "invite_not_found" });
});

test("welcome and invite screens render A5-A8 flows", () => {
  const a5 = renderZukanWelcomeAndInvitePage({ mode: "registered", lang: "ja", fieldName: "アオサギ太郎" });
  assert.match(a5, /data-zukan-welcome-invite="registered"/);
  assert.match(a5, /アオサギ太郎/);

  const a6 = renderZukanWelcomeAndInvitePage({ mode: "onboarding", lang: "ja" });
  assert.match(a6, /data-zukan-welcome-invite="onboarding"/);

  const a7 = renderZukanWelcomeAndInvitePage({ mode: "place_invite", lang: "ja", targetTitle: "佐鳴湖公園", targetHref: "/ja/places/place-sanaru" });
  assert.match(a7, /佐鳴湖公園 への招待/);

  const a8 = renderZukanWelcomeAndInvitePage({ mode: "event_invite", lang: "ja", targetTitle: "竜洋の野鳥観察会", targetHref: "/ja/community/events/RYUYO2026/join" });
  assert.match(a8, /竜洋の野鳥観察会 への招待/);
});

test("A6 onboarding pages by step and A7/A8 invites match the mock layout", () => {
  const s1 = renderZukanWelcomeAndInvitePage({ mode: "onboarding", lang: "ja", step: 1 });
  assert.match(s1, /href="\/ja\/welcome\?step=2"/);
  assert.match(s1, /スキップ/);
  const s3 = renderZukanWelcomeAndInvitePage({ mode: "onboarding", lang: "ja", step: 3, authenticated: false });
  assert.match(s3, /href="\/ja\/register"/);
  assert.doesNotMatch(s3, /スキップ/);
  const a7 = renderZukanWelcomeAndInvitePage({ mode: "place_invite", lang: "ja", targetTitle: "連理の木の下で", targetHref: "/ja/places/p1" });
  assert.match(a7, /参加する/);
  assert.match(a7, /ログインして参加/);
  assert.match(a7, /href="\/ja\/login\?redirect=%2Fplaces%2Fp1"/);
  const member = renderZukanWelcomeAndInvitePage({ mode: "event_invite", lang: "ja", targetTitle: "秋まつり", targetHref: "/ja/community/events/X/join", authenticated: true });
  assert.doesNotMatch(member, /ログインして参加/);
});
