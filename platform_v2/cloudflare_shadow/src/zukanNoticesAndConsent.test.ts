import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import worker from "./index";
import { formatMaintenanceRange, parseNotices } from "./zukanNoticesAndConsent";

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
  const token = "notices-consent-token";
  core.prepare("INSERT INTO auth_sessions VALUES (?,?,?,?,?,?,?,?)").run(
    createHash("sha256").update(token).digest("hex"), "u1", "はまっこ", "Observer", null, 0, "2099-01-01T00:00:00.000Z", null
  );
  obs.exec(`
    CREATE TABLE observations (observation_id TEXT PRIMARY KEY, owner_user_id TEXT, observed_at TEXT, taxon_label TEXT, public_area_label TEXT);
    CREATE TABLE asset_ledger (asset_id TEXT, observation_id TEXT, mime TEXT, processing_state TEXT, public_derivative_key TEXT, public_derivative_verified_at TEXT, public_derivative_metadata_json TEXT, exif_scrub_state TEXT, public_ready_at TEXT, uploaded_at TEXT);
  `);
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
  return { env, store, cookie: `ikimon_v2_session=${token}` };
}

const base = "https://zukan.earth";
// 2026-11-28 02:00〜04:00 JST
const MAINT = { startsAt: "2026-11-27T17:00:00.000Z", endsAt: "2026-11-27T19:00:00.000Z" };

test("K5: メンテナンスと、そのほかのお知らせが見本どおりに出る", async () => {
  const { env, store } = setup();
  store.set(
    "zukan-notices/current.json",
    JSON.stringify({
      maintenance: { startsAt: new Date(Date.now() + 86400000).toISOString(), endsAt: new Date(Date.now() + 3 * 86400000).toISOString(), message: "11月28日（土）2:00〜4:00 のあいだ、一部の機能が使えません。撮った写真は端末に保存され、終わると自動で送られます。" },
      items: [
        { id: "a", title: "新しい場所が増えました", summary: "佐鳴湖の西岸 ほか 3か所", href: "/ja/map" },
        { id: "b", title: "年末のイベント特集", summary: "歳の市・冬の観察会など", href: "https://evil.example/x" },
      ],
    })
  );
  const res = await worker.fetch(new Request(`${base}/ja/notices`), env);
  assert.equal(res.status, 200);
  const page = await res.text();
  assert.match(page, /メンテナンスのお知らせ/);
  assert.match(page, /11月28日（土）2:00〜4:00 のあいだ、一部の機能が使えません。撮った写真は端末に保存され、終わると自動で送られます。/);
  assert.match(page, /そのほかのお知らせ/);
  assert.match(page, /新しい場所が増えました/);
  assert.match(page, /佐鳴湖の西岸 ほか 3か所/);
  assert.match(page, /href="\/ja\/map"/);
  assert.doesNotMatch(page, /evil\.example/);
  assert.match(page, />分かりました</);
  assert.match(page, /href="\/ja\/">分かりました/);
});

test("K5: 文面の自動生成・期間外は出さない・お知らせが空でも崩れない", async () => {
  assert.equal(formatMaintenanceRange(MAINT.startsAt, MAINT.endsAt), "11月28日（土）2:00〜4:00");
  const now = Date.parse("2026-11-25T00:00:00.000Z");
  assert.equal(parseNotices({ maintenance: MAINT }, now).maintenance?.startsAt, MAINT.startsAt);
  assert.equal(parseNotices({ maintenance: MAINT }, Date.parse("2026-11-27T18:00:00.000Z")).maintenance?.startsAt, MAINT.startsAt);
  assert.equal(parseNotices({ maintenance: MAINT }, Date.parse("2026-11-28T00:00:00.000Z")).maintenance, null);
  assert.equal(parseNotices({ maintenance: MAINT }, Date.parse("2026-11-01T00:00:00.000Z")).maintenance, null);
  assert.deepEqual(parseNotices("x", now), { maintenance: null, items: [] });

  const { env } = setup();
  const empty = await worker.fetch(new Request(`${base}/ja/notices`), env);
  const emptyHtml = await empty.text();
  assert.equal(empty.status, 200);
  assert.match(emptyHtml, /いまのところ、お知らせはありません。/);
  assert.doesNotMatch(emptyHtml, /data-zukan-maintenance/);
});

test("K5: ライブラリの上にメンテナンスの案内が出て、お知らせへ行ける", async () => {
  const { env, store, cookie } = setup();
  store.set(
    "zukan-notices/current.json",
    JSON.stringify({ maintenance: { startsAt: new Date(Date.now() + 86400000).toISOString(), endsAt: new Date(Date.now() + 2 * 86400000).toISOString() } })
  );
  const lib = await worker.fetch(new Request(`${base}/ja/library`, { headers: { cookie } }), env);
  assert.equal(lib.status, 200);
  const libHtml = await lib.text();
  assert.match(libHtml, /data-library-maintenance="1"/);
  assert.match(libHtml, /href="\/ja\/notices">くわしく</);
});

test("K6: 初回同意の画面、2つ同意しないと進めない、同意すると記録して先へ、あとでで案内が引っ込む", async () => {
  const { env, store, cookie } = setup();

  const anon = await worker.fetch(new Request(`${base}/ja/welcome/consent`), env);
  assert.equal(anon.status, 302);

  const lib0 = await worker.fetch(new Request(`${base}/ja/library`, { headers: { cookie } }), env);
  assert.match(await lib0.text(), /data-library-consent-prompt="1"/);

  const page = await worker.fetch(new Request(`${base}/ja/welcome/consent`, { headers: { cookie } }), env);
  assert.equal(page.status, 200);
  const pageHtml = await page.text();
  assert.match(pageHtml, /撮った写真は、<br>場所と日付でたまります/);
  assert.match(pageHtml, /カメラで撮るだけ。あとから見返したり、その場所の図鑑に載せたりできます。/);
  assert.match(pageHtml, /はじめる前に/);
  assert.match(pageHtml, /写真の場所の情報は、その場所の記録のために使います。公開する範囲は、毎回あなたが選べます。/);
  assert.match(pageHtml, /利用規約<\/a>に同意します/);
  assert.match(pageHtml, /プライバシーポリシー<\/a>に同意します/);
  assert.match(pageHtml, />同意してはじめる</);
  assert.match(pageHtml, />あとで</);
  assert.doesNotMatch(pageHtml, /<input[^>]* checked/);

  const post = (body: Record<string, string>, origin = base) =>
    new Request(`${base}/ja/welcome/consent`, {
      method: "POST",
      headers: { cookie, origin, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
    });

  assert.equal((await worker.fetch(post({ terms: "1", privacy: "1" }, "https://evil.example"), env)).status, 403);
  const partial = await worker.fetch(post({ terms: "1" }), env);
  assert.equal(partial.status, 400);
  assert.match(await partial.text(), /2つとも確認して、チェックを入れてください。/);
  assert.equal(store.size, 0);

  const later = await worker.fetch(new Request(`${base}/ja/welcome/consent/later`, { headers: { cookie } }), env);
  assert.equal(later.status, 302);
  assert.match(later.headers.get("set-cookie") ?? "", /zukan_consent_later=1/);
  const lib1 = await worker.fetch(new Request(`${base}/ja/library`, { headers: { cookie: `${cookie}; zukan_consent_later=1` } }), env);
  assert.doesNotMatch(await lib1.text(), /data-library-consent-prompt/);

  const ok = await worker.fetch(post({ terms: "1", privacy: "1", next: "//evil.example" }), env);
  assert.equal(ok.status, 303);
  assert.equal(ok.headers.get("location"), "/ja/record");
  const record = JSON.parse(store.get("zukan-consent/u1.json")!);
  assert.equal(record.version, "2026-11-25");
  assert.ok(record.termsAt && record.privacyAt);

  const lib2 = await worker.fetch(new Request(`${base}/ja/library`, { headers: { cookie } }), env);
  assert.doesNotMatch(await lib2.text(), /data-library-consent-prompt/);
});

test("K5 お知らせ: ロゴは画像、背景は白に固定", async () => {
  const { renderNoticesPage } = await import("./zukanNoticesAndConsent");
  const page = renderNoticesPage({ lang: "ja", notices: { maintenance: null, items: [] }, backHref: "/ja/" });
  assert.match(page, /<img src="\/assets\/brand\/zukan-lockup\.svg" alt="ZUKAN"/);
  assert.match(page, /html body\[data-zukan-design\],body\{margin:0;background:#fff/);
});
