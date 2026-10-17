import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { PUBLIC_PROGRAM_SCHEMA, type PublicProgram } from "../../src/services/publicProgram";
import { publicProgramConfirmationTitle, renderPublicProgramConfirmationBody } from "./publicProgramConfirmation";

const program: PublicProgram = { schema: PUBLIC_PROGRAM_SCHEMA, requestId: "42345678-1234-4123-8123-123456789abc",
  profile: "event", title: "地域の企画 <文化>", startsAt: "2026-10-21T01:00:00.000Z", endsAt: "",
  timezone: "Asia/Tokyo", placeLabel: "浜松", description: "", conditions: "無料", stations: [] };
const render = (lang: "ja" | "en" | "es" | "pt-br" = "ja", authenticated = true, value = program) =>
  renderPublicProgramConfirmationBody({ program: value, authenticated, loginHref: "/auth?redirect=exact-program", lang });

test("confirmation uses the event time zone, not the server or viewer time zone", () => {
  const html = render("en", true, { ...program, timezone: "America/Los_Angeles" });
  assert.match(html, /Oct 20, 2026, 06:00 PM/);
  assert.match(html, /America\/Los_Angeles/);
  assert.match(html, /datetime="2026-10-21T01:00:00.000Z"/);
  assert.match(html, /地域の企画 &lt;文化&gt;/);
  assert.match(html, /Not set/);
});

test("all supported languages explain the handoff and preserve the login destination", () => {
  for (const [lang, title, login] of [["ja", "公開内容を確認", "ZUKANにログインして確認する"],
    ["en", "Review publication", "Sign in to ZUKAN and review"],
    ["es", "Revisar publicación", "Iniciar sesión en ZUKAN y revisar"],
    ["pt-br", "Revisar publicação", "Entrar no ZUKAN e revisar"]] as const) {
    assert.equal(publicProgramConfirmationTitle(lang), title);
    const html = render(lang, false);
    assert.ok(html.includes(login));
    assert.match(html, /href="\/auth\?redirect=exact-program"/);
    assert.doesNotMatch(html, /data-program-confirm>|<script>/);
  }
});

function runtime(responses: Array<{ status: number; body?: unknown }>, pending = false, lang: "ja" | "en" | "es" | "pt-br" = "ja", value = program) {
  let click: (() => Promise<void>) | undefined;
  let expire: (() => void) | undefined;
  const status = { textContent: "" };
  const login = { hidden: true };
  const button = { disabled: false, addEventListener(_: string, listener: () => Promise<void>) { click = listener; } };
  const bodies: string[] = [], destinations: string[] = [];
  const html = render(lang, true, value);
  const script = html.match(/<script>([\s\S]*?)<\/script>/u)?.[1];
  assert.ok(script);
  runInNewContext(script, {
    AbortController,
    setTimeout(fn: () => void, ms: number) { assert.equal(ms, 15000); expire = fn; return 1; },
    clearTimeout() { expire = undefined; },
    document: { querySelector(selector: string) { return selector.includes("-status") ? status : selector.includes("-login") ? login : button; } },
    window: { location: { assign(url: string) { destinations.push(url); } } },
    fetch: async (_: string, options: { body: string; signal: AbortSignal; credentials: string }) => {
      assert.equal(options.credentials, "same-origin"); bodies.push(options.body);
      if (pending) return new Promise((_, reject) => options.signal.addEventListener("abort", () => reject(new Error("timeout"))));
      const response = responses.shift(); assert.ok(response);
      return { status: response.status, ok: response.status >= 200 && response.status < 300, json: async () => response.body };
    },
  });
  assert.ok(click);
  return { click, expire: () => { assert.ok(expire); expire(); }, status, login, button, bodies, destinations };
}

test("uncertain responses can retry the exact same request without manufacturing a new program", async () => {
  const f = runtime([{ status: 500 }, { status: 200, body: { programId: program.requestId, publicationState: "public" } }]);
  await f.click();
  assert.equal(f.destinations.length, 0);
  assert.match(f.status.textContent, /作成結果を確認できません/);
  assert.equal(f.button.disabled, false);
  await f.click();
  assert.equal(f.bodies[0], f.bodies[1]);
  assert.equal(JSON.parse(f.bodies[0]!).program.requestId, program.requestId);
  assert.deepEqual(f.destinations, [`/events/${program.requestId}/edit`]);
  assert.equal(f.button.disabled, true);
});

test("a 2xx response for a private or different program cannot be shown as publication success", async () => {
  for (const body of [{ programId: program.requestId, publicationState: "created_private" },
    { programId: "another-program", publicationState: "public" }]) {
    const f = runtime([{ status: 200, body }]); await f.click();
    assert.equal(f.destinations.length, 0);
    assert.match(f.status.textContent, /作成結果を確認できません/);
    assert.equal(f.button.disabled, false);
  }
});

test("confirmed event and rally destinations retain every supported language", async () => {
  for (const lang of ["ja", "en", "es", "pt-br"] as const) {
    for (const profile of ["event", "observation_event", "stamp_rally"] as const) {
      const f = runtime([{ status: 200, body: { programId: program.requestId, publicationState: "public" } }], false, lang, { ...program, profile });
      await f.click();
      const prefix = lang === "ja" ? "" : `/${lang}`;
      const page = profile === "stamp_rally" ? "rally" : "edit";
      assert.deepEqual(f.destinations, [`${prefix}/events/${program.requestId}/${page}`]);
      assert.equal(f.button.disabled, true);
      assert.equal(JSON.parse(f.bodies[0]!).program.requestId, program.requestId);
    }
  }
});

test("expired sessions have a login recovery and conflict is distinct from an unknown result", async () => {
  for (const code of [401, 403, 409]) {
    const f = runtime([{ status: code }]); await f.click();
    assert.equal(f.destinations.length, 0);
    assert.equal(f.login.hidden, code === 409);
    assert.match(f.status.textContent, code === 409 ? /既存の企画と一致しません/ : /ログイン状態または権限/);
    assert.equal(f.button.disabled, false);
  }
});

test("publication timeout is bounded, reports an unknown result and never automatically resubmits", async () => {
  const f = runtime([], true);
  const first = f.click(); const duplicate = f.click();
  assert.equal(f.bodies.length, 1);
  f.expire(); await Promise.all([first, duplicate]);
  assert.equal(f.bodies.length, 1);
  assert.equal(f.destinations.length, 0);
  assert.equal(f.button.disabled, false);
  assert.match(f.status.textContent, /作成結果を確認できません/);
});
