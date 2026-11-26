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
  const token = "org-album-token";
  core.prepare("INSERT INTO auth_sessions VALUES (?,?,?,?,?,?,?,?)").run(
    createHash("sha256").update(token).digest("hex"), "u1", "はまっこ", "Observer", null, 0, "2099-01-01T00:00:00.000Z", null
  );
  obs.exec(`
    CREATE TABLE observations (observation_id TEXT PRIMARY KEY, owner_user_id TEXT, observed_at TEXT, taxon_label TEXT, public_area_label TEXT, note TEXT, visibility TEXT, emergency_hidden INTEGER DEFAULT 0, exact_lat REAL, exact_lng REAL);
    CREATE TABLE asset_ledger (asset_id TEXT, observation_id TEXT, mime TEXT, processing_state TEXT, public_derivative_key TEXT, public_derivative_verified_at TEXT, public_derivative_metadata_json TEXT, exif_scrub_state TEXT, public_ready_at TEXT, uploaded_at TEXT);
  `);
  for (const id of ["o1", "o2", "o3"]) {
    obs.prepare("INSERT INTO observations (observation_id, owner_user_id, observed_at, taxon_label, public_area_label, note, visibility) VALUES (?,?,?,?,?,?,?)")
      .run(id, "u1", "2026-11-22T09:00:00.000Z", `生きもの${id}`, "みなと通り", "", "public");
    obs.prepare("INSERT INTO asset_ledger VALUES (?,?,?,?,?,?,?,?,?,?)").run(
      `a-${id}`, id, "image/jpeg", "uploaded", `derived/${id}/display.webp`, "2026-11-22T09:01:00.000Z", "{}", "scrubbed", "2026-11-22T09:01:00.000Z", "2026-11-22T09:00:30.000Z"
    );
  }
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
  return { env, obs, store, cookie: `ikimon_v2_session=${token}` };
}

const base = "https://zukan.earth";
const GROUP = "2026-11-22__みなと通り";
const post = (cookie: string, path: string, body: Record<string, string>, origin = base) =>
  new Request(`${base}/ja/library/link/${path}`, {
    method: "POST",
    headers: { cookie, origin, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });

test("J6/J7: 団体へのお願いは許可待ちで出て、取り消せ、許可されるとつなげる", async () => {
  const { env, store, cookie } = setup();

  const anon = await worker.fetch(post("", "org-request", { group: GROUP, org: "東川自然観察会" }), env);
  assert.equal(anon.status, 302);

  const cross = await worker.fetch(post(cookie, "org-request", { group: GROUP, org: "東川自然観察会" }, "https://evil.example"), env);
  assert.equal(cross.status, 403);

  const created = await worker.fetch(post(cookie, "org-request", { group: GROUP, org: "東川自然観察会" }), env);
  assert.equal(created.status, 303);
  const location = created.headers.get("location") ?? "";
  assert.match(location, /\/ja\/library\/link\/request\?id=req_[a-f0-9]{32}/);
  const id = /id=(req_[a-f0-9]{32})/.exec(location)![1]!;

  const j6 = await worker.fetch(new Request(`${base}${location}`, { headers: { cookie } }), env);
  assert.equal(j6.status, 200);
  const j6Html = await j6.text();
  assert.match(j6Html, /許可を待っています/);
  assert.match(j6Html, /「東川自然観察会」のホームページへ<br>写真 3枚をつなぐお願いを送りました。/);
  assert.match(j6Html, /お願いを送った/);
  assert.match(j6Html, /団体が受け取った/);
  assert.match(j6Html, /許可の確認中/);
  assert.match(j6Html, /結果はお知らせで届きます/);
  assert.match(j6Html, />ライブラリへ戻る</);
  assert.match(j6Html, />お願いを取り消す</);

  const stranger = await worker.fetch(new Request(`${base}${location}`), env);
  assert.equal(stranger.status, 302);

  const key = `zukan-org-link-requests/u1/${id}.json`;
  store.set(key, JSON.stringify({ ...JSON.parse(store.get(key)!), status: "approved", receivedAt: "2026-11-24T11:13:00.000Z" }));
  const j7 = await worker.fetch(new Request(`${base}${location}`, { headers: { cookie } }), env);
  const j7Html = await j7.text();
  assert.match(j7Html, /許可されました/);
  assert.match(j7Html, /写真 3枚をつなげるようになりました。/);
  assert.match(j7Html, />今すぐつなぐ</);
  assert.match(j7Html, />あとで</);
  assert.match(j7Html, />お知らせ</);
  assert.match(j7Html, /11月22日 ・ みなと通り/);

  const connect = await worker.fetch(post(cookie, "request/connect", { id }), env);
  assert.equal(connect.status, 303);
  assert.equal(JSON.parse(store.get(key)!).status, "linked");
  const linked = await worker.fetch(new Request(`${base}${location}`, { headers: { cookie } }), env);
  assert.match(await linked.text(), /つなぎました/);

  const second = await worker.fetch(post(cookie, "org-request", { group: GROUP, org: "別の団体" }), env);
  const id2 = /id=(req_[a-f0-9]{32})/.exec(second.headers.get("location") ?? "")![1]!;
  const cancel = await worker.fetch(post(cookie, "request/cancel", { id: id2 }), env);
  assert.equal(cancel.status, 303);
  assert.equal(JSON.parse(store.get(`zukan-org-link-requests/u1/${id2}.json`)!).status, "cancelled");
  const gone = await worker.fetch(new Request(`${base}/ja/library/link/request?id=${id2}`, { headers: { cookie } }), env);
  assert.equal(gone.status, 302);
});

test("J8: 共有アルバムはログインなしで見られ、期限切れ・非表示は見られない", async () => {
  const { env, obs, store, cookie } = setup();

  const page = await worker.fetch(new Request(`${base}/ja/library/link/album?group=${encodeURIComponent(GROUP)}`, { headers: { cookie } }), env);
  assert.equal(page.status, 200);
  const pageHtml = await page.text();
  assert.match(pageHtml, /見られる期間/);
  assert.match(pageHtml, />リンクを作る</);

  const created = await worker.fetch(post(cookie, "album", { group: GROUP, expires: "30d" }), env);
  assert.equal(created.status, 303);
  const location = created.headers.get("location") ?? "";
  const token = /token=(share_[a-f0-9]{32})/.exec(location)![1]!;

  const shown = await worker.fetch(new Request(`${base}${location}`, { headers: { cookie } }), env);
  assert.match(await shown.text(), new RegExp(`value="https://zukan.earth/ja/share/${token}"`));

  const guest = await worker.fetch(new Request(`${base}/ja/share/${token}`), env);
  assert.equal(guest.status, 200);
  assert.equal(guest.headers.get("referrer-policy"), "no-referrer");
  const j8 = await guest.text();
  assert.match(j8, /みなと通り のアルバム/);
  assert.match(j8, /2026年11月22日（日） ・ 写真 3枚 ・ 共有リンクで見られます/);
  assert.match(j8, /このアルバムは、リンクを知っている人だけが見られます。/);
  assert.match(j8, />登録して、自分の写真も加える</);
  assert.match(j8, />みなと通りの図鑑を見る</);
  assert.match(j8, />ログイン</);
  assert.doesNotMatch(j8, /はまっこ/);
  assert.equal((j8.match(/<img /g) ?? []).length, 3);

  obs.prepare("UPDATE observations SET emergency_hidden = 1 WHERE observation_id = 'o1'").run();
  const hidden = await (await worker.fetch(new Request(`${base}/ja/share/${token}`), env)).text();
  assert.match(hidden, /写真 2枚/);

  const key = `observation-share-links/${token}.json`;
  store.set(key, JSON.stringify({ ...JSON.parse(store.get(key)!), expiresAt: "2020-01-01T00:00:00.000Z" }));
  const expired = await worker.fetch(new Request(`${base}/ja/share/${token}`), env);
  assert.equal(expired.status, 404);

  const unknown = await worker.fetch(new Request(`${base}/ja/share/share_${"0".repeat(32)}`), env);
  assert.equal(unknown.status, 404);

  const lib = await worker.fetch(new Request(`${base}/ja/library`, { headers: { cookie } }), env);
  assert.match(await lib.text(), /library\/link\/album\?group=/);
});

test("J8: 非公開の記録は共有アルバムに入らず、あとで非公開にすると消え、取り消すと見られない", async () => {
  const { env, obs, cookie } = setup();
  obs.prepare("UPDATE observations SET visibility = 'private' WHERE observation_id = 'o3'").run();
  const created = await worker.fetch(post(cookie, "album", { group: GROUP }), env);
  assert.equal(created.status, 303);
  const location = created.headers.get("location") ?? "";
  const token = /token=(share_[a-f0-9]{32})/.exec(location)![1]!;
  const guestHtml = await (await worker.fetch(new Request(`${base}/ja/share/${token}`), env)).text();
  assert.match(guestHtml, /写真 2枚/);
  assert.equal((guestHtml.match(/<img /g) ?? []).length, 2);
  assert.doesNotMatch(guestHtml, /derived\/o3|a-o3|はまっこ|exact_l|"lat"|"lng"|u1/);

  obs.prepare("UPDATE observations SET visibility = 'private' WHERE observation_id = 'o2'").run();
  assert.match(await (await worker.fetch(new Request(`${base}/ja/share/${token}`), env)).text(), /写真 1枚/);

  const shown = await (await worker.fetch(new Request(`${base}${location}`, { headers: { cookie } }), env)).text();
  assert.match(shown, /value="30d" checked/);
  assert.match(shown, /このリンクを取り消す/);

  const stranger = await worker.fetch(new Request(`${base}/ja/library/link/album/revoke`, {
    method: "POST",
    headers: { cookie: "ikimon_v2_session=none", origin: base, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  }), env);
  assert.equal(stranger.status, 302);
  assert.equal((await worker.fetch(new Request(`${base}/ja/share/${token}`), env)).status, 200);

  const revoked = await worker.fetch(post(cookie, "album/revoke", { token, group: GROUP }), env);
  assert.equal(revoked.status, 303);
  assert.equal((await worker.fetch(new Request(`${base}/ja/share/${token}`), env)).status, 404);
});

test("J8: 全部が非公開なら共有リンクを作らない", async () => {
  const { env, obs, store, cookie } = setup();
  obs.prepare("UPDATE observations SET visibility = 'private'").run();
  const created = await worker.fetch(post(cookie, "album", { group: GROUP }), env);
  assert.equal(created.status, 303);
  assert.doesNotMatch(created.headers.get("location") ?? "", /token=/);
  assert.equal([...store.keys()].filter((k) => k.startsWith("observation-share-links/")).length, 0);
});
