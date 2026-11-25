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
  const token = "share-unlink-token";
  core.prepare("INSERT INTO auth_sessions VALUES (?,?,?,?,?,?,?,?)").run(
    createHash("sha256").update(token).digest("hex"), "u1", "はまっこ", "Observer", null, 0, "2099-01-01T00:00:00.000Z", null
  );
  obs.exec(`
    CREATE TABLE observations (observation_id TEXT PRIMARY KEY, owner_user_id TEXT, observed_at TEXT, taxon_label TEXT, public_area_label TEXT, note TEXT, visibility TEXT);
    CREATE TABLE asset_ledger (asset_id TEXT, observation_id TEXT, mime TEXT, processing_state TEXT, public_derivative_key TEXT, public_derivative_verified_at TEXT, public_derivative_metadata_json TEXT, exif_scrub_state TEXT, public_ready_at TEXT, uploaded_at TEXT);
  `);
  obs.prepare("INSERT INTO observations VALUES (?,?,?,?,?,?,?)").run("o1", "u1", "2026-11-20T09:00:00.000Z", "朝の光のクスノキ", "連理の木の下で", "朝のクスノキ", "public");
  obs.prepare("INSERT INTO observations VALUES (?,?,?,?,?,?,?)").run("o2", "u1", "2026-11-21T09:00:00.000Z", "ひみつ", "別の場所", "メモ", "private");
  obs.prepare("INSERT INTO observations VALUES (?,?,?,?,?,?,?)").run("o3", "u2", "2026-11-21T09:00:00.000Z", "他人", "別の場所", "メモ", "public");
  for (const id of ["o1", "o2"]) {
    obs.prepare("INSERT INTO asset_ledger VALUES (?,?,?,?,?,?,?,?,?,?)").run(
      `a-${id}`, id, "image/jpeg", "uploaded", `derived/${id}/display.webp`, "2026-11-20T09:01:00.000Z", "{}", "scrubbed", "2026-11-20T09:01:00.000Z", "2026-11-20T09:00:30.000Z"
    );
  }
  core.exec(`
    CREATE TABLE zukan_observation_publications (user_id TEXT NOT NULL, observation_id TEXT NOT NULL, place_id TEXT, legacy_group_key TEXT, published INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL, PRIMARY KEY (user_id, observation_id));
    CREATE TABLE zukan_book_publications (group_key TEXT PRIMARY KEY, user_id TEXT NOT NULL, place_name TEXT NOT NULL, observation_ids_json TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL);
  `);
  core.prepare("INSERT INTO zukan_observation_publications VALUES (?,?,?,?,?,?)").run("u1", "o1", null, "2026-11-20__連理の木の下で", 1, 1);
  const store = new Map<string, string>();
  const env = {
    CORE_DB: d1(core),
    OBS_DB: d1(obs),
    ASSET_BUCKET: {
      async get(key: string) {
        const v = store.get(key);
        return v === undefined ? null : { body: new Response(v).body };
      },
      async put(key: string, value: string) {
        store.set(key, value);
      },
      async delete(key: string) {
        store.delete(key);
      },
    },
  } as never;
  return { env, core, store, cookie: `ikimon_v2_session=${token}` };
}

const base = "https://zukan.earth";
const GROUP = "2026-11-20__連理の木の下で";
const post = (cookie: string, path: string, body: Record<string, string>, origin = base) =>
  new Request(`${base}/ja/library/link/${path}`, {
    method: "POST",
    headers: { cookie, origin, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });

test("J4: つなぎの取り消し確認が出て、取り消すと図鑑から外れ、写真は残る", async () => {
  const { env, core, store, cookie } = setup();
  store.set(`zukan-link-ledger/u1/${encodeURIComponent(GROUP)}.json`, "{}");

  const anon = await worker.fetch(new Request(`${base}/ja/library/link/cancel?group=${encodeURIComponent(GROUP)}`), env);
  assert.equal(anon.status, 302);

  const page = await worker.fetch(new Request(`${base}/ja/library/link/cancel?group=${encodeURIComponent(GROUP)}`, { headers: { cookie } }), env);
  assert.equal(page.status, 200);
  const pageHtml = await page.text();
  assert.match(pageHtml, /つなぎを取り消しますか？/);
  assert.match(pageHtml, /「連理の木の下で の図鑑」から見えなくなります。/);
  assert.match(pageHtml, /写真そのものは、あなたのライブラリに残ります。/);
  assert.match(pageHtml, />取り消す</);
  assert.match(pageHtml, />やめる</);

  const lib = await worker.fetch(new Request(`${base}/ja/library`, { headers: { cookie } }), env);
  assert.match(await lib.text(), /library\/link\/cancel\?group=/);

  const cross = await worker.fetch(post(cookie, "cancel", { group: GROUP }, "https://evil.example"), env);
  assert.equal(cross.status, 403);

  const done = await worker.fetch(post(cookie, "cancel", { group: GROUP }), env);
  assert.equal(done.status, 303);
  assert.equal((core.prepare("SELECT published FROM zukan_observation_publications WHERE observation_id = 'o1'").get() as { published: number }).published, 0);
  assert.equal(store.size, 0);

  const again = await worker.fetch(new Request(`${base}/ja/library/link/cancel?group=${encodeURIComponent(GROUP)}`, { headers: { cookie } }), env);
  assert.equal(again.status, 302);
});

test("J5: 共有リンクを期間つきで作り、誰でも開け、期限が過ぎると開けない", async () => {
  const { env, store, cookie } = setup();

  const empty = await worker.fetch(new Request(`${base}/ja/library/link/share?observation=o1`, { headers: { cookie } }), env);
  assert.equal(empty.status, 200);
  const emptyHtml = await empty.text();
  assert.match(emptyHtml, /リンクを知っている人が、この記録を見られます。/);
  assert.match(emptyHtml, /無期限/);
  assert.match(emptyHtml, /30日たつと見られなくなります/);
  assert.match(emptyHtml, /リンクは「公開先」からいつでも取り消せます。/);
  assert.match(emptyHtml, />リンクを作る</);

  const created = await worker.fetch(post(cookie, "share", { observation: "o1", expires: "30d" }), env);
  assert.equal(created.status, 303);
  const location = created.headers.get("location") ?? "";
  assert.match(location, /token=share_[a-f0-9]{32}/);
  const token = /token=(share_[a-f0-9]{32})/.exec(location)![1]!;
  const record = JSON.parse(store.get(`observation-share-links/${token}.json`)!);
  const days = (Date.parse(record.expiresAt) - Date.parse(record.createdAt)) / 86400000;
  assert.ok(Math.abs(days - 30) < 0.01);

  const shown = await worker.fetch(new Request(`${base}${location}`, { headers: { cookie } }), env);
  const shownHtml = await shown.text();
  assert.match(shownHtml, new RegExp(`value="https://zukan.earth/ja/share/${token}"`));
  assert.match(shownHtml, />コピー</);
  assert.match(shownHtml, /まで見られます/);

  const guest = await worker.fetch(new Request(`${base}/ja/share/${token}`), env);
  assert.equal(guest.status, 200);

  store.set(`observation-share-links/${token}.json`, JSON.stringify({ ...record, expiresAt: "2020-01-01T00:00:00.000Z" }));
  const expired = await worker.fetch(new Request(`${base}/ja/share/${token}`), env);
  assert.equal(expired.status, 404);

  const unlimited = await worker.fetch(post(cookie, "share", { observation: "o1", expires: "none" }), env);
  const t2 = /token=(share_[a-f0-9]{32})/.exec(unlimited.headers.get("location") ?? "")![1]!;
  assert.equal(JSON.parse(store.get(`observation-share-links/${t2}.json`)!).expiresAt, null);
});

test("J5: 非公開の記録と他人の記録ではリンクを作らせない", async () => {
  const { env, store, cookie } = setup();
  const priv = await worker.fetch(new Request(`${base}/ja/library/link/share?observation=o2`, { headers: { cookie } }), env);
  assert.match(await priv.text(), /まだ公開されていません/);
  const postPriv = await worker.fetch(post(cookie, "share", { observation: "o2", expires: "none" }), env);
  assert.equal(postPriv.status, 303);
  assert.doesNotMatch(postPriv.headers.get("location") ?? "", /token=/);
  const other = await worker.fetch(new Request(`${base}/ja/library/link/share?observation=o3`, { headers: { cookie } }), env);
  assert.equal(other.status, 302);
  assert.equal([...store.keys()].filter((k) => k.startsWith("observation-share-links/")).length, 0);
});
