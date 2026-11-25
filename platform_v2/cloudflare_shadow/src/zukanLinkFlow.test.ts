import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import worker from "./index";

type Row = Record<string, unknown>;

function d1(sqlite: DatabaseSync) {
  return {
    prepare(query: string) {
      let values: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          values = args;
          return stmt;
        },
        async first() {
          return (sqlite.prepare(query).get(...(values as never[])) as Row | undefined) ?? null;
        },
        async all() {
          return { results: sqlite.prepare(query).all(...(values as never[])) as Row[] };
        },
        async run() {
          sqlite.prepare(query).run(...(values as never[]));
          return { success: true };
        },
      };
      return stmt;
    },
  };
}

function setup() {
  const core = new DatabaseSync(":memory:");
  const obs = new DatabaseSync(":memory:");
  core.exec(`CREATE TABLE auth_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT, display_name TEXT, role_name TEXT, rank_label TEXT, banned INTEGER, expires_at TEXT, last_used_at TEXT)`);
  const token = "link-flow-token";
  core.prepare("INSERT INTO auth_sessions VALUES (?,?,?,?,?,?,?,?)").run(
    createHash("sha256").update(token).digest("hex"), "u1", "はまっこ", "Observer", null, 0, "2099-01-01T00:00:00.000Z", null
  );
  obs.exec(`
    CREATE TABLE observations (observation_id TEXT PRIMARY KEY, owner_user_id TEXT, observed_at TEXT, taxon_label TEXT, public_area_label TEXT);
    CREATE TABLE asset_ledger (asset_id TEXT, observation_id TEXT, mime TEXT, processing_state TEXT, public_derivative_key TEXT, public_derivative_verified_at TEXT, public_derivative_metadata_json TEXT, exif_scrub_state TEXT, public_ready_at TEXT, uploaded_at TEXT);
    CREATE TABLE observation_event_sessions (session_id TEXT PRIMARY KEY, event_code TEXT, title TEXT, organizer_user_id TEXT, started_at TEXT, ended_at TEXT);
    CREATE TABLE observation_event_participants (session_id TEXT, user_id TEXT);
  `);
  for (const [id, label] of [["o1", "アオサギ"], ["o2", "カワセミ"], ["o3", "ススキ"]] as const) {
    obs.prepare("INSERT INTO observations VALUES (?,?,?,?,?)").run(id, "u1", "2026-11-15T09:00:00.000Z", label, "東川の河川敷");
    obs.prepare("INSERT INTO asset_ledger VALUES (?,?,?,?,?,?,?,?,?,?)").run(
      `a-${id}`, id, "image/jpeg", "uploaded", `derived/${id}/display.webp`, "2026-11-15T09:01:00.000Z", "{}", "scrubbed", "2026-11-15T09:01:00.000Z", "2026-11-15T09:00:30.000Z"
    );
  }
  obs.prepare("INSERT INTO observation_event_sessions VALUES (?,?,?,?,?,?)").run("s1", "HIGASHI", "自然観察会", "u1", "2026-11-15T08:00:00.000Z", "2026-11-15T12:00:00.000Z");
  const store = new Map<string, string>();
  const env = {
    CORE_DB: d1(core),
    OBS_DB: d1(obs),
    ASSET_BUCKET: {
      async get(key: string) {
        const v = store.get(key);
        return v === undefined ? null : { json: async () => JSON.parse(v), body: new Response(v).body };
      },
      async put(key: string, value: string) {
        store.set(key, value);
      },
    },
  } as never;
  return { env, core, store, cookie: `ikimon_v2_session=${token}` };
}

const GROUP = "2026-11-15__東川の河川敷";
const base = "https://zukan.earth";

test("J1-J3: 未ログインはログインへ戻し、ログイン済みは選択→確認→完了まで通り、図鑑に載る", async () => {
  const { env, core, store, cookie } = setup();

  const anon = await worker.fetch(new Request(`${base}/ja/library/link?group=${encodeURIComponent(GROUP)}`), env);
  assert.equal(anon.status, 302);
  assert.match(anon.headers.get("location") ?? "", /\/ja\/login/);

  const j1 = await worker.fetch(new Request(`${base}/ja/library/link?group=${encodeURIComponent(GROUP)}`, { headers: { cookie } }), env);
  assert.equal(j1.status, 200);
  const j1Html = await j1.text();
  assert.match(j1Html, /つなぐ先を選ぶ/);
  assert.match(j1Html, /写真 3枚 ・ 11月15日 自然観察会/);
  assert.match(j1Html, /場所のページ/);
  assert.match(j1Html, /東川の河川敷 の図鑑に載ります/);
  assert.match(j1Html, /イベントのページ/);
  assert.match(j1Html, /自然観察会 のアルバムに入ります/);
  assert.match(j1Html, />次へ</);
  assert.match(j1Html, /prefers-reduced-motion/);

  const j2 = await worker.fetch(new Request(`${base}/ja/library/link/confirm?group=${encodeURIComponent(GROUP)}&target=place`, { headers: { cookie } }), env);
  assert.equal(j2.status, 200);
  const j2Html = await j2.text();
  assert.match(j2Html, /つなぐ確認/);
  assert.match(j2Html, /東川の河川敷 の図鑑/);
  assert.match(j2Html, /フィールドネーム「はまっこ」が一緒に出ます/);
  assert.match(j2Html, /名前なしで載せる/);
  assert.doesNotMatch(j2Html, /本名/);

  const crossSite = await worker.fetch(new Request(`${base}/ja/library/link/confirm`, {
    method: "POST",
    headers: { cookie, origin: "https://evil.example", "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ group: GROUP, target: "place" }),
  }), env);
  assert.equal(crossSite.status, 403);

  const post = await worker.fetch(new Request(`${base}/ja/library/link/confirm`, {
    method: "POST",
    headers: { cookie, origin: base, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ group: GROUP, target: "place", visibility: "anonymous" }),
  }), env);
  assert.equal(post.status, 303);
  assert.match(post.headers.get("location") ?? "", /\/ja\/library\/link\/done\?group=/);
  const published = core.prepare("SELECT observation_id, published FROM zukan_observation_publications ORDER BY observation_id").all();
  assert.deepEqual(published.map((r) => ({ ...r })), [
    { observation_id: "o1", published: 1 },
    { observation_id: "o2", published: 1 },
    { observation_id: "o3", published: 1 },
  ]);
  const ledger = JSON.parse([...store.values()][0]!);
  assert.equal(ledger.visibility, "anonymous");

  const j3 = await worker.fetch(new Request(`${base}/ja/library/link/done?group=${encodeURIComponent(GROUP)}`, { headers: { cookie } }), env);
  assert.equal(j3.status, 200);
  const j3Html = await j3.text();
  assert.match(j3Html, /つなぎました/);
  assert.match(j3Html, /写真 3枚が「東川の河川敷 の図鑑」に載りました。/);
  assert.match(j3Html, />図鑑を見る</);
  assert.match(j3Html, />ライブラリへ戻る</);
});

test("J1: 無効な組と未対応のつなぎ先はライブラリ・選択画面へ戻す", async () => {
  const { env, cookie } = setup();
  const noGroup = await worker.fetch(new Request(`${base}/ja/library/link?group=nope`, { headers: { cookie } }), env);
  assert.equal(noGroup.status, 302);
  assert.match(noGroup.headers.get("location") ?? "", /\/ja\/library$/);
  const badTarget = await worker.fetch(new Request(`${base}/ja/library/link/confirm?group=${encodeURIComponent(GROUP)}&target=org`, { headers: { cookie } }), env);
  assert.equal(badTarget.status, 302);
  assert.match(badTarget.headers.get("location") ?? "", /\/ja\/library\/link\?group=/);
});

test("ライブラリの未公開の束から J1 へ入れる", async () => {
  const { env, cookie } = setup();
  const lib = await worker.fetch(new Request(`${base}/ja/library`, { headers: { cookie } }), env);
  assert.equal(lib.status, 200);
  const libHtml = await lib.text();
  assert.match(libHtml, new RegExp(`/ja/library/link\\?group=${encodeURIComponent(GROUP).replace(/%/g, "%")}`));
  assert.match(libHtml, /まとめて確認・公開/);
});

test("名前なしでつないだ後、公開の面（未ログイン）にフィールドネームが出ない", async () => {
  const { env, cookie } = setup();
  await worker.fetch(new Request(`${base}/ja/library/link/confirm`, {
    method: "POST",
    headers: { cookie, origin: base, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ group: GROUP, target: "place", visibility: "anonymous" }),
  }), env);
  const paths = [
    "/ja/", "/ja/records", "/ja/map", "/ja/places/higashikawa-riverside", "/ja/observations/o1", "/ja/observations/o2",
    "/ja/community/events/HIGASHI", "/ja/community/events/HIGASHI/album",
    "/api/v1/observations/o1", "/api/v1/zukan/places", "/api/v1/places", "/api/v1/map/places", "/api/v1/areas/observations?place_id=higashikawa-riverside",
  ];
  for (const path of paths) {
    const res = await worker.fetch(new Request(`${base}${path}`), env).catch(() => null);
    if (!res) continue;
    const body = await res.text();
    assert.doesNotMatch(body, /はまっこ/, `${path} が名前を出している`);
  }
});
