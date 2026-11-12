import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { handleStampRally, runStampRallyRetention, STAMP_RALLY_CONSENT_VERSION, sweepExpiredStampRallies } from "./stampRally";
import publicPresentationEntry from "./publicPresentationEntry";

const nowMs = Date.parse("2026-11-20T03:00:00.000Z");
const secret = "fixture-hmac-secret";
const route = "/api/v1/integrations/nocosil/stamp-rallies";
const environment = "staging";
const audience = "https://staging.zukan.earth";
const scopeDigest = createHash("sha256").update("workspace_org_fixture").digest("hex");
const sourceRallyId = "life-spiral-up";
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const rallyId = "sr_" + sha(JSON.stringify(["nocosil-stamp-rally", environment, scopeDigest, sourceRallyId])).slice(0, 32);
const migration = (name: string) => readFileSync(new URL(`../migrations/core/${name}`, import.meta.url), "utf8");

function fixture(t: TestContext, flag: string | null = "true") {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(migration("0002_auth_session_contract.sql"));
  sqlite.exec(migration("0025_stamp_rallies.sql"));
  t.after(() => sqlite.close());
  const db = {
    prepare(sql: string) {
      const statement = sqlite.prepare(sql);
      const query = (values: SQLInputValue[] = []): any => ({
        bind: (...bound: SQLInputValue[]) => query(bound),
        first: async <T>() => (statement.get(...values) ?? null) as T | null,
        all: async <T>() => ({ results: statement.all(...values) as T[] }),
        run: async () => ({ meta: { changes: Number(statement.run(...values).changes) } }),
      });
      return query();
    },
  };
  const env: any = { CORE_DB: db, NOCOSIL_INTEGRATION_HMAC_SECRET: secret, ENVIRONMENT: environment };
  if (flag !== null) env.ZUKAN_STAMP_RALLY_ENABLED = flag;
  return { sqlite, env };
}

const baseSpots = [
  { spotKey: "tree", name: "大きな木" },
  { spotKey: "sign", name: "看板" },
  { spotKey: "statue", name: "造形物", spotKind: "qr" },
];
function body(action: "upsert" | "close" | "status", options: Record<string, unknown> = {}) {
  const common = { schema: "nocosil.stamp-rally-handoff/v1", action, environment, audience, scopeDigest, sourceRallyId, rallyId };
  if (action === "status") return { ...common, ...options };
  const operation = { operationId: "op_1", expectedOperationId: null, issuedAt: "2026-11-20T02:59:00.000Z" };
  if (action === "close") return { ...common, ...operation, ...options };
  return { ...common, ...operation, title: "LIFE SPIRAL UP", prizeMode: "none", spots: baseSpots, ...options };
}
function signed(value: unknown, options: { ts?: string; signingSecret?: string; at?: number } = {}) {
  const raw = JSON.stringify(value);
  const ts = options.ts ?? String(Math.floor((options.at ?? nowMs) / 1000));
  const signature = createHmac("sha256", options.signingSecret ?? secret).update(`${ts}.${raw}`).digest("hex");
  return new Request(new URL(route, "https://staging.zukan.earth"), { method: "POST", body: raw, headers: {
    "content-type": "application/json", "x-nocosil-timestamp": ts, "x-nocosil-signature": "v1=" + signature,
  } });
}
const call = (env: any, request: Request, at = nowMs) => handleStampRally(request, env, at);
async function organizer(env: any, value: unknown, at = nowMs) {
  const response = await call(env, signed(value, { at }), at);
  return { status: response.status, data: await response.json() as Record<string, any> };
}
const origin = "https://staging.zukan.earth";
const get = (env: any, path: string, cookie?: string, at = nowMs) =>
  call(env, new Request(origin + path, { headers: cookie ? { cookie } : {} }), at);
const post = (env: any, path: string, options: { cookie?: string; form?: Record<string, string>; origin?: string | null } = {}, at = nowMs) => {
  const headers: Record<string, string> = {};
  if (options.cookie) headers.cookie = options.cookie;
  if (options.origin !== null) headers.origin = options.origin ?? origin;
  const form = new URLSearchParams(options.form ?? {});
  headers["content-type"] = "application/x-www-form-urlencoded";
  return call(env, new Request(origin + path, { method: "POST", headers, body: form.toString() }), at);
};
const deviceCookie = (response: Response) => /zukan_stamp_device=([A-Za-z0-9_-]{22})/.exec(response.headers.get("set-cookie") ?? "")?.[1];
const codeOf = (url: string) => new URL(url).pathname.replace("/stamp/", "");

async function openRally(env: any, options: Record<string, unknown> = {}) {
  const created = await organizer(env, body("upsert", options));
  assert.equal(created.status, 200, JSON.stringify(created.data));
  return created.data as { spots: { spotKey: string; stampUrl: string }[]; counts: any };
}
async function stampAll(env: any, codes: string[], cookie?: string, at = nowMs) {
  let current = cookie;
  let last!: Response;
  for (const code of codes) {
    last = await post(env, `/stamp/${code}`, { cookie: current }, at);
    assert.equal(last.status, 303);
    current = `zukan_stamp_device=${deviceCookie(last) ?? current!.split("=")[1]}`;
  }
  return { cookie: current!, last };
}
function addSession(sqlite: DatabaseSync, token: string, userId: string, extra: { role?: string; banned?: number; expires?: string } = {}) {
  sqlite.prepare("INSERT INTO auth_sessions (token_hash,user_id,display_name,role_name,banned,expires_at) VALUES (?,?,?,?,?,?)")
    .run(sha(token), userId, "秘密の名前", extra.role ?? "Observer", extra.banned ?? 0, extra.expires ?? "2027-01-01T00:00:00.000Z");
}

test("signature: valid accepted, bad signature / wrong secret / stale / future timestamp rejected", async t => {
  const { env } = fixture(t);
  assert.equal((await organizer(env, body("upsert"))).status, 200);
  const tampered = signed(body("upsert", { operationId: "op_9", expectedOperationId: "op_1" }), { signingSecret: "other" });
  assert.equal((await call(env, tampered)).status, 401);
  const unsigned = new Request(new URL(route, origin), { method: "POST", body: JSON.stringify(body("status")) });
  assert.equal((await call(env, unsigned)).status, 401);
  assert.equal((await call(env, signed(body("status"), { ts: String(nowMs / 1000 - 301) }))).status, 401);
  assert.equal((await call(env, signed(body("status"), { ts: String(nowMs / 1000 + 301) }))).status, 401);
  assert.equal((await call(env, signed(body("status"), { ts: String(nowMs / 1000 - 299) }))).status, 200);
  assert.equal((await call(env, new Request(new URL(route, origin)))).status, 405);
});

test("audience, environment, rally id and unknown keys are rejected", async t => {
  const { env } = fixture(t);
  assert.equal((await organizer(env, body("upsert", { audience: "https://zukan.earth" }))).data.error, "invalid_audience");
  assert.equal((await organizer(env, body("upsert", { environment: "production" }))).data.error, "invalid_audience");
  assert.equal((await organizer(env, body("upsert", { rallyId: "sr_" + "0".repeat(32) }))).data.error, "invalid_rally_id");
  assert.equal((await organizer(env, body("upsert", { displayName: "x" }))).data.error, "invalid_payload");
  assert.equal((await organizer(env, body("status", { operationId: "x" }))).data.error, "invalid_payload");
});

test("upsert creates the rally once, spot codes stay stable, removed spots lose their URL", async t => {
  const { env } = fixture(t);
  const first = await organizer(env, body("upsert"));
  assert.equal(first.status, 200);
  assert.equal(first.data.rallyId, rallyId);
  assert.equal(first.data.state, "open");
  assert.equal(first.data.spots.length, 3);
  const urls = Object.fromEntries(first.data.spots.map((s: any) => [s.spotKey, s.stampUrl]));
  for (const url of Object.values(urls) as string[]) assert.match(url, /^https:\/\/staging\.zukan\.earth\/stamp\/[A-Za-z0-9_-]{22}$/);

  const replay = await organizer(env, body("upsert"));
  assert.deepEqual(replay.data.spots, first.data.spots);
  assert.equal(replay.data.lastOperationId, "op_1");

  const conflict = await organizer(env, body("upsert", { title: "別の名前" }));
  assert.equal(conflict.status, 409);
  assert.equal(conflict.data.error, "operation_conflict");

  const stale = await organizer(env, body("upsert", { operationId: "op_2", expectedOperationId: "op_x" }));
  assert.equal(stale.data.error, "stale_operation");

  const second = await organizer(env, body("upsert", {
    operationId: "op_2", expectedOperationId: "op_1", title: "LIFE SPIRAL UP 2",
    spots: [{ spotKey: "sign", name: "看板（新）" }, { spotKey: "tree", name: "大きな木" }, { spotKey: "gate", name: "門" }],
  }));
  assert.equal(second.status, 200);
  assert.equal(second.data.title, "LIFE SPIRAL UP 2");
  const byKey = Object.fromEntries(second.data.spots.map((s: any) => [s.spotKey, s]));
  assert.equal(byKey.tree.stampUrl, urls.tree);
  assert.equal(byKey.sign.stampUrl, urls.sign);
  assert.equal(byKey.sign.name, "看板（新）");
  assert.equal(byKey.statue.state, "removed");
  assert.equal(byKey.statue.stampUrl, null);
  assert.equal(byKey.gate.state, "active");
  assert.notEqual(byKey.gate.stampUrl, urls.statue);
});

test("upsert validation: prize mode, spots, colors, logo, area geometry, period", async t => {
  const { env } = fixture(t);
  const bad = async (options: Record<string, unknown>) => (await organizer(env, body("upsert", options))).data.error;
  assert.equal(await bad({ prizeMode: "offline" }), "invalid_rally");
  assert.equal(await bad({ prizeMode: "none", prizeInstructions: "x" }), "invalid_rally");
  assert.equal(await bad({ prizeMode: "lottery" }), "invalid_rally");
  assert.equal(await bad({ spots: [] }), "invalid_rally");
  assert.equal(await bad({ spots: [{ spotKey: "a", name: "A" }, { spotKey: "a", name: "B" }] }), "invalid_rally");
  assert.equal(await bad({ spots: [{ spotKey: "a", name: "A", extra: 1 }] }), "invalid_rally");
  assert.equal(await bad({ spots: [{ spotKey: "a", name: "A", spotKind: "area" }] }), "invalid_rally");
  assert.equal(await bad({ spots: [{ spotKey: "a", name: "A", spotKind: "area", areaCenter: { lat: 91, lng: 0 }, radiusM: 50 }] }), "invalid_rally");
  assert.equal(await bad({ spots: [{ spotKey: "a", name: "A", spotKind: "area", areaCenter: { lat: 34.7, lng: 137.7 }, radiusM: 5 }] }), "invalid_rally");
  assert.equal(await bad({ spots: [{ spotKey: "a", name: "A", spotKind: "qr", radiusM: 50 }] }), "invalid_rally");
  assert.equal(await bad({ theme: { primaryColor: "red" } }), "invalid_rally");
  assert.equal(await bad({ theme: { logoUrl: "http://example.com/a.png" } }), "invalid_rally");
  assert.equal(await bad({ theme: { logoUrl: "https://example.com/a.png\" onerror=\"x" } }), "invalid_rally");
  assert.equal(await bad({ startsAt: "2026-12-01T00:00:00.000Z", endsAt: "2026-11-01T00:00:00.000Z" }), "invalid_rally");
  assert.equal(await bad({ startsAt: "yesterday" }), "invalid_rally");
  assert.equal(await bad({ expectedParticipants: 0 }), "invalid_rally");
  assert.equal(await bad({ title: "" }), "invalid_rally");
  const ok = await organizer(env, body("upsert", {
    prizeMode: "offline", prizeInstructions: "本部テントで係の人に画面を見せてください。", expectedParticipants: 300,
    startsAt: "2026-11-01T00:00:00.000Z", endsAt: "2026-12-01T00:00:00.000Z",
    theme: { logoUrl: "https://zukan.earth/logo.png", primaryColor: "#112233", backgroundColor: "#FFFFFF" },
    spots: [{ spotKey: "a", name: "A" }, { spotKey: "area1", name: "広場", spotKind: "area", areaCenter: { lat: 34.7, lng: 137.7 }, radiusM: 80 }],
  }));
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  assert.equal(ok.data.prizeMode, "offline");
  assert.equal(ok.data.expectedParticipants, 300);
  assert.equal(ok.data.spots[1].spotKind, "area");
});

test("stamping is idempotent per device and spot; completion needs every active spot", async t => {
  const { env, sqlite } = fixture(t);
  const rally = await openRally(env);
  const codes = rally.spots.map(s => codeOf(s.stampUrl));
  const page = await get(env, `/stamp/${codes[0]}`);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /大きな木/);
  assert.match(html, /スタンプを押す/);
  assert.equal(page.headers.get("cache-control"), "no-store");
  assert.equal(page.headers.get("x-robots-tag"), "noindex, nofollow");
  assert.match(page.headers.get("content-security-policy") ?? "", /form-action 'self'/);
  assert.match(page.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);

  const first = await post(env, `/stamp/${codes[0]}`);
  assert.equal(first.status, 303);
  assert.equal(first.headers.get("location"), `/stamp/r/${rallyId}`);
  const cookie = deviceCookie(first)!;
  assert.match(first.headers.get("set-cookie")!, /HttpOnly/);
  assert.match(first.headers.get("set-cookie")!, /SameSite=Lax/);
  assert.match(first.headers.get("set-cookie")!, /Path=\/stamp;/);
  assert.match(first.headers.get("set-cookie")!, /Secure/);
  const jar = `zukan_stamp_device=${cookie}`;

  const again = await post(env, `/stamp/${codes[0]}`, { cookie: jar });
  assert.equal(again.status, 303);
  assert.equal(Number((sqlite.prepare("SELECT COUNT(*) n FROM stamp_rally_stamps").get() as any).n), 1);
  assert.equal(Number((sqlite.prepare("SELECT COUNT(*) n FROM stamp_rally_devices").get() as any).n), 1);
  assert.equal((sqlite.prepare("SELECT device_id FROM stamp_rally_devices").get() as any).device_id === cookie, false);

  const alreadyPage = await (await get(env, `/stamp/${codes[0]}`, jar)).text();
  assert.match(alreadyPage, /もう押してあります/);
  assert.doesNotMatch(alreadyPage, /type="submit"/);

  await post(env, `/stamp/${codes[1]}`, { cookie: jar });
  const midBoard = await (await get(env, `/stamp/r/${rallyId}`, jar)).text();
  assert.match(midBoard, /スタンプ 2 \/ 3/);
  assert.doesNotMatch(midBoard, /コンプリート/);
  assert.equal((sqlite.prepare("SELECT completed_at FROM stamp_rally_devices").get() as any).completed_at, null);

  await post(env, `/stamp/${codes[2]}`, { cookie: jar });
  assert.notEqual((sqlite.prepare("SELECT completed_at FROM stamp_rally_devices").get() as any).completed_at, null);

  const other = await post(env, `/stamp/${codes[0]}`);
  assert.notEqual(deviceCookie(other), cookie);
  assert.equal(Number((sqlite.prepare("SELECT COUNT(*) n FROM stamp_rally_devices").get() as any).n), 2);
  assert.equal(Number((sqlite.prepare("SELECT COUNT(*) n FROM stamp_rally_stamps").get() as any).n), 4);
});

test("completion page: prize_mode none shows only completion; offline shows organizer instructions", async t => {
  for (const mode of ["none", "offline"] as const) {
    const { env } = fixture(t);
    const rally = await openRally(env, mode === "offline"
      ? { prizeMode: "offline", prizeInstructions: "本部テントで画面を見せてください。\n<b>午後3時まで</b>" } : {});
    const { cookie } = await stampAll(env, rally.spots.map(s => codeOf(s.stampUrl)));
    const html = await (await get(env, `/stamp/r/${rallyId}`, cookie)).text();
    assert.match(html, /コンプリート/);
    assert.match(html, /達成：2026-11-20 12:00（日本時間）/);
    if (mode === "none") assert.doesNotMatch(html, /受け取り方法/);
    else {
      assert.match(html, /受け取り方法/);
      assert.match(html, /本部テントで画面を見せてください。<br>&lt;b&gt;午後3時まで&lt;\/b&gt;/);
    }
    assert.doesNotMatch(html, /name="name"|type="text"/);
  }
});

test("removed spots do not block completion and the stored completion stays", async t => {
  const { env } = fixture(t);
  const rally = await openRally(env);
  const codes = rally.spots.map(s => codeOf(s.stampUrl));
  const { cookie } = await stampAll(env, codes.slice(0, 2));
  await organizer(env, body("upsert", { operationId: "op_2", expectedOperationId: "op_1", spots: baseSpots.slice(0, 2) }));
  const removed = await get(env, `/stamp/${codes[2]}`, cookie);
  assert.equal(removed.status, 410);
  assert.equal((await post(env, `/stamp/${codes[2]}`, { cookie })).status, 410);
  await post(env, `/stamp/${codes[0]}`, { cookie });
  const finalBoard = await (await get(env, `/stamp/r/${rallyId}`, cookie)).text();
  assert.match(finalBoard, /コンプリート/);
  assert.doesNotMatch(finalBoard, /造形物/);
});

test("closed, not-started and ended rallies refuse stamps but the board stays readable", async t => {
  const { env, sqlite } = fixture(t);
  const rally = await openRally(env, { startsAt: "2026-11-20T03:30:00.000Z", endsAt: "2026-11-25T00:00:00.000Z" });
  const codes = rally.spots.map(s => codeOf(s.stampUrl));
  const early = await post(env, `/stamp/${codes[0]}`);
  assert.equal(early.status, 403);
  assert.match(await early.text(), /まだ始まっていません/);
  assert.equal(Number((sqlite.prepare("SELECT COUNT(*) n FROM stamp_rally_stamps").get() as any).n), 0);
  assert.match(await (await get(env, `/stamp/${codes[0]}`)).text(), /まだ始まっていません/);

  const inside = Date.parse("2026-11-21T00:00:00.000Z");
  const { cookie } = await stampAll(env, [codes[0]!], undefined, inside);

  const late = Date.parse("2026-11-26T00:00:00.000Z");
  const ended = await post(env, `/stamp/${codes[1]}`, { cookie }, late);
  assert.equal(ended.status, 403);
  assert.match(await ended.text(), /終了しました/);

  const closed = await organizer(env, body("close", { operationId: "op_2", expectedOperationId: "op_1" }), inside);
  assert.equal(closed.data.state, "closed");
  const afterClose = await post(env, `/stamp/${codes[1]}`, { cookie }, inside);
  assert.equal(afterClose.status, 403);
  assert.equal(Number((sqlite.prepare("SELECT COUNT(*) n FROM stamp_rally_stamps").get() as any).n), 1);
  const board = await get(env, `/stamp/r/${rallyId}`, cookie, inside);
  assert.equal(board.status, 200);
  assert.match(await board.text(), /スタンプ 1 \/ 3/);
  assert.equal((await organizer(env, body("upsert", { operationId: "op_3", expectedOperationId: "op_2" }), inside)).data.error, "rally_closed");
  assert.equal((await organizer(env, body("close", { operationId: "op_2", expectedOperationId: "op_1" }), inside)).data.state, "closed");
});

test("status exposes counts only: no names, emails, account ids or device ids", async t => {
  const { env, sqlite } = fixture(t);
  const rally = await openRally(env);
  const codes = rally.spots.map(s => codeOf(s.stampUrl));
  const a = await stampAll(env, codes);
  await stampAll(env, [codes[0]!, codes[1]!]);
  addSession(sqlite, "session-token-a", "user_secret_123");
  const jar = `${a.cookie}; ikimon_v2_session=session-token-a`;
  const linked = await post(env, `/stamp/r/${rallyId}/link`, { cookie: jar, form: { consent: "1", notify: "1" } });
  assert.equal(linked.status, 303);

  const status = await call(env, signed(body("status")));
  const text = await status.text();
  const data = JSON.parse(text);
  assert.equal(data.counts.participants, 2);
  assert.equal(data.counts.completions, 1);
  assert.equal(data.counts.stamps, 5);
  assert.deepEqual(data.counts.perSpot, [{ spotKey: "tree", stamps: 2 }, { spotKey: "sign", stamps: 2 }, { spotKey: "statue", stamps: 1 }]);
  assert.equal(data.counts.linkedParticipants, 1);
  assert.equal(data.counts.notifyOptIns, 1);
  for (const forbidden of ["user_secret_123", "秘密の名前", "@", a.cookie.split("=")[1]!, "device", "email"]) assert.equal(text.includes(forbidden), false, forbidden);
  assert.equal((await call(env, signed(body("status", { sourceRallyId: "other-rally", rallyId: "sr_" + "1".repeat(32) })))).status, 400);
});

test("account link needs explicit consent and login; revoke and delete are user-driven", async t => {
  const { env, sqlite } = fixture(t);
  const rally = await openRally(env);
  const codes = rally.spots.map(s => codeOf(s.stampUrl));
  const { cookie } = await stampAll(env, [codes[0]!]);
  addSession(sqlite, "tok-user", "user_1");
  addSession(sqlite, "tok-user2", "user_2");
  addSession(sqlite, "tok-banned", "user_3", { banned: 1 });
  addSession(sqlite, "tok-mail", "user_4", { role: "MunicipalInbox" });
  addSession(sqlite, "tok-expired", "user_5", { expires: "2026-01-01T00:00:00.000Z" });
  const withSession = (token: string) => `${cookie}; ikimon_v2_session=${token}`;

  const anonymousBoard = await (await get(env, `/stamp/r/${rallyId}`, cookie)).text();
  assert.doesNotMatch(anonymousBoard, /同意してひも付ける/);
  for (const token of ["tok-banned", "tok-mail", "tok-expired", "nope"]) {
    assert.doesNotMatch(await (await get(env, `/stamp/r/${rallyId}`, withSession(token))).text(), /同意してひも付ける/, token);
  }
  const board = await (await get(env, `/stamp/r/${rallyId}`, withSession("tok-user"))).text();
  assert.match(board, /同意してひも付ける/);
  assert.match(board, /名前・メールアドレス・アカウントは渡りません/);

  assert.equal((await post(env, `/stamp/r/${rallyId}/link`, { cookie, form: { consent: "1" } })).status, 401);
  assert.equal((await post(env, `/stamp/r/${rallyId}/link`, { cookie: withSession("tok-user"), form: {} })).status, 400);
  assert.equal((await post(env, `/stamp/r/${rallyId}/link`, { cookie: withSession("tok-user"), form: { consent: "1" }, origin: "https://evil.example" })).status, 403);
  assert.equal((await post(env, `/stamp/r/${rallyId}/link`, { cookie: withSession("tok-user"), form: { consent: "1" }, origin: null })).status, 403);
  assert.equal(Number((sqlite.prepare("SELECT COUNT(*) n FROM stamp_account_links").get() as any).n), 0);

  const linked = await post(env, `/stamp/r/${rallyId}/link`, { cookie: withSession("tok-user"), form: { consent: "1" } });
  assert.equal(linked.status, 303);
  const row = sqlite.prepare("SELECT * FROM stamp_account_links").get() as any;
  assert.equal(row.user_id, "user_1");
  assert.equal(row.consent_version, STAMP_RALLY_CONSENT_VERSION);
  assert.equal(row.notify_opt_in, 0);
  assert.equal(row.revoked_at, null);
  assert.equal(row.consent_at, "2026-11-20T03:00:00.000Z");
  assert.equal(row.device_id === cookie.split("=")[1], false);

  assert.equal((await post(env, `/stamp/r/${rallyId}/link`, { cookie: withSession("tok-user2"), form: { consent: "1" } })).status, 409);
  assert.match(await (await get(env, `/stamp/r/${rallyId}`, withSession("tok-user"))).text(), /ひも付いています/);

  await post(env, `/stamp/r/${rallyId}/link`, { cookie: withSession("tok-user"), form: { consent: "1", notify: "1" } });
  assert.equal((sqlite.prepare("SELECT notify_opt_in FROM stamp_account_links").get() as any).notify_opt_in, 1);

  assert.equal((await post(env, `/stamp/r/${rallyId}/unlink`, { cookie: withSession("tok-user2"), form: { mode: "revoke" } })).status, 303);
  assert.equal((sqlite.prepare("SELECT revoked_at FROM stamp_account_links").get() as any).revoked_at, null);

  const revoked = await post(env, `/stamp/r/${rallyId}/unlink`, { cookie: withSession("tok-user"), form: { mode: "revoke" } });
  assert.equal(revoked.status, 303);
  const after = sqlite.prepare("SELECT * FROM stamp_account_links").get() as any;
  assert.equal(after.revoked_at, "2026-11-20T03:00:00.000Z");
  assert.equal(after.notify_opt_in, 0);
  const status = await organizer(env, body("status"));
  assert.equal(status.data.counts.linkedParticipants, 0);
  assert.equal(status.data.counts.notifyOptIns, 0);

  assert.equal((await post(env, `/stamp/r/${rallyId}/link`, { cookie: withSession("tok-user2"), form: { consent: "1" } })).status, 303);
  assert.equal((sqlite.prepare("SELECT user_id FROM stamp_account_links").get() as any).user_id, "user_2");

  assert.equal((await post(env, `/stamp/r/${rallyId}/unlink`, { cookie: withSession("tok-user2"), form: { mode: "delete" } })).status, 303);
  assert.equal(Number((sqlite.prepare("SELECT COUNT(*) n FROM stamp_account_links").get() as any).n), 0);
  assert.equal((await post(env, `/stamp/r/${rallyId}/unlink`, { cookie: withSession("tok-user2"), form: { mode: "other" } })).status, 400);
});

test("no raw coordinates are stored; area stamping is not implemented yet", async t => {
  const { env, sqlite } = fixture(t);
  const rally = await openRally(env, {
    spots: [{ spotKey: "a", name: "A" }, { spotKey: "plaza", name: "広場", spotKind: "area", areaCenter: { lat: 34.7123, lng: 137.7456 }, radiusM: 80 }],
  });
  const plaza = codeOf(rally.spots[1]!.stampUrl);
  const stampColumns = (sqlite.prepare("PRAGMA table_info(stamp_rally_stamps)").all() as any[]).map(c => c.name).sort();
  assert.deepEqual(stampColumns, ["accuracy_m", "area_result", "device_id", "rally_id", "spot_id", "stamped_at"]);
  const deviceColumns = (sqlite.prepare("PRAGMA table_info(stamp_rally_devices)").all() as any[]).map(c => c.name).sort();
  assert.deepEqual(deviceColumns, ["completed_at", "created_at", "device_id", "rally_id"]);
  const spot = sqlite.prepare("SELECT spot_kind,area_center_lat,area_center_lng,radius_m FROM stamp_rally_spots WHERE spot_key='plaza'").get() as any;
  assert.deepEqual({ ...spot }, { spot_kind: "area", area_center_lat: 34.7123, area_center_lng: 137.7456, radius_m: 80 });

  const page = await (await get(env, `/stamp/${plaza}`)).text();
  assert.doesNotMatch(page, /type="submit"/);
  assert.equal((await post(env, `/stamp/${plaza}`)).status, 400);
  const areaPost = await post(env, `/stamp/${plaza}/area`, { form: { lat: "34.7", lng: "137.7" } });
  assert.equal(areaPost.status, 501);
  assert.equal(Number((sqlite.prepare("SELECT COUNT(*) n FROM stamp_rally_stamps").get() as any).n), 0);
  assert.equal((await get(env, `/stamp/${plaza}/area`)).status, 405);
});

test("cross-origin or origin-less stamp posts are refused without writing", async t => {
  const { env, sqlite } = fixture(t);
  const rally = await openRally(env);
  const code = codeOf(rally.spots[0]!.stampUrl);
  assert.equal((await post(env, `/stamp/${code}`, { origin: "https://evil.example" })).status, 403);
  assert.equal((await post(env, `/stamp/${code}`, { origin: null })).status, 403);
  assert.equal(Number((sqlite.prepare("SELECT COUNT(*) n FROM stamp_rally_stamps").get() as any).n), 0);
});

test("unknown spot codes, rallies and malformed paths return 404 without leaking", async t => {
  const { env } = fixture(t);
  await openRally(env);
  for (const path of ["/stamp/AAAAAAAAAAAAAAAAAAAAAA", "/stamp/r/sr_" + "0".repeat(32), "/stamp/short", "/stamp/", "/stamp/r/x"]) {
    const response = await get(env, path);
    assert.equal(response.status, 404, path);
  }
});

test("organizer logo and colors render only after validation; html is escaped", async t => {
  const { env } = fixture(t);
  const rally = await openRally(env, {
    title: "<script>alert(1)</script>祭り",
    theme: { logoUrl: "https://zukan.earth/assets/logo.png?x=1", primaryColor: "#ffffff", backgroundColor: "#101010" },
  });
  const response = await get(env, `/stamp/${codeOf(rally.spots[0]!.stampUrl)}`);
  const html = await response.text();
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;祭り/);
  assert.match(html, /<img class="logo" src="https:\/\/zukan\.earth\/assets\/logo\.png\?x=1" alt="">/);
  assert.match(response.headers.get("content-security-policy") ?? "", /img-src 'self' data: https:\/\/zukan\.earth;/);
  assert.match(html, /background:#101010/);
  assert.match(html, /\.btn\{[^}]*background:#ffffff;color:#1d1d1f/);
});

test("flag off: every new route is 404, including through the public entry", async t => {
  for (const flag of [null, "false", "off", ""]) {
    const { env, sqlite } = fixture(t, flag);
    assert.equal((await call(env, signed(body("upsert")))).status, 404);
    assert.equal((await get(env, "/stamp/AAAAAAAAAAAAAAAAAAAAAA")).status, 404);
    assert.equal((await get(env, `/stamp/r/${rallyId}`)).status, 404);
    assert.equal((await post(env, "/stamp/AAAAAAAAAAAAAAAAAAAAAA")).status, 404);
    const viaEntry = await publicPresentationEntry.fetch(signed(body("upsert"), { at: Date.now() }), env, { waitUntil() {} });
    assert.equal(viaEntry.status, 404);
    const viaEntryPage = await publicPresentationEntry.fetch(new Request(origin + "/stamp/AAAAAAAAAAAAAAAAAAAAAA"), env, { waitUntil() {} });
    assert.equal(viaEntryPage.status, 404);
    assert.equal(Number((sqlite.prepare("SELECT COUNT(*) n FROM stamp_rallies").get() as any).n), 0);
  }
});

test("flag on: the public entry routes organizer and participant paths before the base worker", async t => {
  const { env } = fixture(t);
  const created = await publicPresentationEntry.fetch(signed(body("upsert"), { at: Date.now() }), env, { waitUntil() {} });
  assert.equal(created.status, 200);
  const data = await created.json() as any;
  const page = await publicPresentationEntry.fetch(new Request(data.spots[0].stampUrl), env, { waitUntil() {} });
  assert.equal(page.status, 200);
  assert.match(await page.text(), /スタンプを押す/);
});

test("retention: ended rallies are deleted 90 days after the end, consent records are kept", async t => {
  const { env, sqlite } = fixture(t);
  const endedOld = await openRally(env, { endsAt: "2026-08-01T00:00:00.000Z", startsAt: "2026-07-01T00:00:00.000Z" });
  const { cookie } = await stampAll(env, [codeOf(endedOld.spots[0]!.stampUrl)], undefined, Date.parse("2026-07-15T00:00:00.000Z"));
  addSession(sqlite, "tok", "user_1");
  await post(env, `/stamp/r/${rallyId}/link`, { cookie: `${cookie}; ikimon_v2_session=tok`, form: { consent: "1", notify: "1" } }, Date.parse("2026-07-16T00:00:00.000Z"));

  const otherScope = sha("another-scope");
  const otherRallyId = "sr_" + sha(JSON.stringify(["nocosil-stamp-rally", environment, otherScope, "recent"])).slice(0, 32);
  const recent = await organizer(env, { ...body("upsert", { endsAt: "2026-11-10T00:00:00.000Z" }), scopeDigest: otherScope, sourceRallyId: "recent", rallyId: otherRallyId });
  assert.equal(recent.status, 200);
  const openScope = sha("open-scope");
  const openRallyId = "sr_" + sha(JSON.stringify(["nocosil-stamp-rally", environment, openScope, "forever"])).slice(0, 32);
  await organizer(env, { ...body("upsert"), scopeDigest: openScope, sourceRallyId: "forever", rallyId: openRallyId });
  const closedScope = sha("closed-scope");
  const closedRallyId = "sr_" + sha(JSON.stringify(["nocosil-stamp-rally", environment, closedScope, "closed-early"])).slice(0, 32);
  await organizer(env, { ...body("upsert", { endsAt: "2027-06-01T00:00:00.000Z" }), scopeDigest: closedScope, sourceRallyId: "closed-early", rallyId: closedRallyId }, Date.parse("2026-08-01T00:00:00.000Z"));
  await organizer(env, { ...body("close", { operationId: "op_2", expectedOperationId: "op_1" }), scopeDigest: closedScope, sourceRallyId: "closed-early", rallyId: closedRallyId }, Date.parse("2026-08-05T00:00:00.000Z"));

  assert.deepEqual(await sweepExpiredStampRallies(env, Date.parse("2026-10-30T00:00:00.000Z")), { rallies: 0, stamps: 0, devices: 0, spots: 0 });
  const swept = await sweepExpiredStampRallies(env, nowMs);
  assert.deepEqual(swept, { rallies: 2, stamps: 1, devices: 1, spots: 6 });
  const ids = (sqlite.prepare("SELECT rally_id FROM stamp_rallies ORDER BY rally_id").all() as any[]).map(r => r.rally_id).sort();
  assert.deepEqual(ids, [openRallyId, otherRallyId].sort());
  assert.equal(Number((sqlite.prepare("SELECT COUNT(*) n FROM stamp_rally_stamps").get() as any).n), 0);
  const link = sqlite.prepare("SELECT user_id,revoked_at FROM stamp_account_links").get() as any;
  assert.equal(link.user_id, "user_1");
  assert.equal(link.revoked_at, null);
  assert.deepEqual(await sweepExpiredStampRallies(env, nowMs), { rallies: 0, stamps: 0, devices: 0, spots: 0 });
  assert.equal((await call(env, signed(body("status")))).status, 404);
});

test("retention does nothing while the flag is off and never throws from the scheduled hook", async t => {
  const off = fixture(t, null);
  assert.deepEqual(await sweepExpiredStampRallies(off.env, nowMs), { rallies: 0, stamps: 0, devices: 0, spots: 0 });
  await runStampRallyRetention(off.env, nowMs);
  const broken: any = { ENVIRONMENT: environment, ZUKAN_STAMP_RALLY_ENABLED: "true", CORE_DB: { prepare() { throw new Error("db down"); } } };
  await assert.doesNotReject(runStampRallyRetention(broken, nowMs));
});

test("board link/unlink/delete forms post to the rally path", async t => {
  const { env, sqlite } = fixture(t);
  const rally = await openRally(env);
  const { cookie } = await stampAll(env, [codeOf(rally.spots[0]!.stampUrl)]);
  addSession(sqlite, "tok-form", "user_1");
  const withSession = `${cookie}; ikimon_v2_session=tok-form`;
  const before = await (await get(env, `/stamp/r/${rallyId}`, withSession)).text();
  assert.ok(before.includes(`action="/stamp/r/${rallyId}/link"`));
  await post(env, `/stamp/r/${rallyId}/link`, { cookie: withSession, form: { consent: "1" } });
  const after = await (await get(env, `/stamp/r/${rallyId}`, withSession)).text();
  assert.equal(after.split(`action="/stamp/r/${rallyId}/unlink"`).length - 1, 2);
  assert.doesNotMatch(after, /=>/);
});

test("device id is salted per rally", async t => {
  const { env, sqlite } = fixture(t);
  const first = await openRally(env);
  const otherScope = sha("salt-scope");
  const otherRallyId = "sr_" + sha(JSON.stringify(["nocosil-stamp-rally", environment, otherScope, "second"])).slice(0, 32);
  const second = await organizer(env, { ...body("upsert"), scopeDigest: otherScope, sourceRallyId: "second", rallyId: otherRallyId });
  assert.equal(second.status, 200);
  const { cookie } = await stampAll(env, [codeOf(first.spots[0]!.stampUrl)]);
  await stampAll(env, [codeOf(second.data.spots[0].stampUrl)], cookie);
  const ids = (sqlite.prepare("SELECT DISTINCT device_id FROM stamp_rally_devices").all() as any[]).map(r => r.device_id);
  assert.equal(ids.length, 2);
});

test("external logo urls are dropped and never reach the CSP", async t => {
  const { env } = fixture(t);
  const rally = await openRally(env, { theme: { logoUrl: "https://tracker.example.com/logo.png", primaryColor: "#112233" } });
  const response = await get(env, `/stamp/${codeOf(rally.spots[0]!.stampUrl)}`);
  const html = await response.text();
  assert.doesNotMatch(html, /<img/);
  assert.doesNotMatch(html, /tracker\.example\.com/);
  assert.match(response.headers.get("content-security-policy") ?? "", /img-src 'self' data:;/);
});

test("retention deletes rallies without an end date after 90 idle days", async t => {
  const { env } = fixture(t);
  await openRally(env);
  const day = 24 * 3600 * 1000;
  assert.deepEqual(await sweepExpiredStampRallies(env, nowMs + 89 * day), { rallies: 0, stamps: 0, devices: 0, spots: 0 });
  const swept = await sweepExpiredStampRallies(env, nowMs + 91 * day);
  assert.equal(swept.rallies, 1);
});

test("a one-byte body change with the same signature is rejected", async t => {
  const { env } = fixture(t);
  const raw = JSON.stringify(body("upsert"));
  const ts = String(Math.floor(nowMs / 1000));
  const signature = createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex");
  const tampered = raw.replace("LIFE SPIRAL UP", "LIFE SPIRAL UQ");
  const response = await call(env, new Request(new URL(route, "https://staging.zukan.earth"), { method: "POST", body: tampered, headers: {
    "content-type": "application/json", "x-nocosil-timestamp": ts, "x-nocosil-signature": "v1=" + signature,
  } }));
  assert.equal(response.status, 401);
});

test("flag off: scheduled cleanup returns 0 without touching the database", async () => {
  const touching: any = { ENVIRONMENT: environment, CORE_DB: new Proxy({}, { get() { throw new Error("db touched"); } }) };
  assert.deepEqual(await sweepExpiredStampRallies(touching, nowMs), { rallies: 0, stamps: 0, devices: 0, spots: 0 });
  await assert.doesNotReject(runStampRallyRetention(touching, nowMs));
});
