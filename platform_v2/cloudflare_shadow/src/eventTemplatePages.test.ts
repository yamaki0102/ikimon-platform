import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import {
  COMMON_EVENT_TEMPLATE_CONTRACT_VERSION,
  COMMON_EVENT_TEMPLATE_KEYS,
} from "../../src/services/commonEventTemplateContract";
import { EVENT_TEMPLATE_PREVIEW_ROUTES, handleEventTemplatePreviewPage } from "./eventTemplatePages";
import { worker } from "./index";

const TOKEN = "0b3a17b7a9a754ec7f68e7ed92d1bf48";
const OTHER_TOKEN = "20c7a0e8e71545a09c35f0e33179045b";
const storageKey = (key: string, token = TOKEN) => "zukan:event-template-demo:v1:" + token + ":" + key;

async function page(route: string, query = "") {
  const response = handleEventTemplatePreviewPage(new Request("https://zukan.test" + route + query), route);
  assert.ok(response);
  return { response, html: await response.text() };
}

test("four design preview routes use the existing shared contract and generate uncached 128-bit demo links", async () => {
  const routes = Object.values(EVENT_TEMPLATE_PREVIEW_ROUTES);
  assert.equal(routes.length, 4);
  const tokens = new Set<string>();
  for (let index = 0; index < routes.length; index += 1) {
    const route = routes[index]!;
    const key = COMMON_EVENT_TEMPLATE_KEYS[index]!;
    const { response, html } = await page(route);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.match(response.headers.get("x-robots-tag") ?? "", /noindex, nofollow, noarchive/u);
    assert.match(html, /name="robots" content="noindex,nofollow,noarchive"/u);
    assert.ok(html.includes('data-event-template-contract="' + COMMON_EVENT_TEMPLATE_CONTRACT_VERSION + '"'));
    assert.ok(html.includes('data-template-key="' + key + '"'));
    assert.ok(html.includes("/community/events/new?event_template=" + key));
    assert.doesNotMatch(html, /<form\b|<input\b|data-event-demo|site-nav|site-record-link/u);
    const token = html.match(/\?demo=([a-f0-9]{32})"/u)?.[1];
    assert.ok(token, route);
    tokens.add(token);
    const second = await page(route);
    assert.notEqual(second.html.match(/\?demo=([a-f0-9]{32})"/u)?.[1], token);
  }
  assert.equal(tokens.size, 4, "demo identifiers must not be hardcoded template keys");
});

test("all four interactive variants are unlisted, local-only and permit only nonce script and local Blob media", async () => {
  for (const route of Object.values(EVENT_TEMPLATE_PREVIEW_ROUTES)) {
    const { response, html } = await page(route, "?demo=" + TOKEN);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.equal(response.headers.get("permissions-policy"), "camera=(), microphone=(), geolocation=()");
    const csp = response.headers.get("content-security-policy") ?? "";
    assert.match(csp, /connect-src 'none'; img-src blob:; media-src blob:/u);
    assert.match(csp, /form-action 'none'; frame-ancestors 'none'; script-src 'nonce-([a-f0-9]+)'/u);
    const nonce = csp.match(/script-src 'nonce-([a-f0-9]+)'/u)![1];
    assert.equal((html.match(new RegExp('<script nonce="' + nonce + '"', "gu")) ?? []).length, 2);
    assert.match(html, /data-event-demo="local-only"/u);
    assert.equal((html.match(/<main\b/gu) ?? []).length, 1);
    assert.equal((html.match(/<h1\b/gu) ?? []).length, 1);
    assert.doesNotMatch(html, /<form\b|fetch\(|XMLHttpRequest|sendBeacon|getUserMedia|geolocation\.|<script[^>]+src=|site-nav/u);
    assert.match(html, /type="file"[^>]*capture="environment"/u);
    assert.doesNotMatch(html, /type="file"[^>]*required/u);
    assert.match(html, /@media\(prefers-reduced-motion:reduce\)/u);
    assert.match(html, /@media print/u);
    assert.match(html, /min-height:44px/u);
    assert.match(html, /このブラウザだけで試す体験版/u);
    assert.match(html, /写真・動画は集計や公開ギャラリーに含めません|写真・動画は保存・送信・集計しません/u);
    for (const linkedRoute of Object.values(EVENT_TEMPLATE_PREVIEW_ROUTES)) {
      assert.ok(html.includes('href="' + linkedRoute + "?demo=" + TOKEN + '"'));
    }
  }
});

test("Worker dispatch serves design and interactive URLs without event data bindings", async () => {
  for (const route of Object.values(EVENT_TEMPLATE_PREVIEW_ROUTES)) {
    for (const query of ["", "?demo=" + TOKEN]) {
      const response = await worker.fetch(new Request("https://zukan.test" + route + query), {} as never);
      assert.equal(response.status, 200, route + query);
      assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/u);
      const html = await response.text();
      assert.match(html, /data-event-template-contract="event-template-v1"/u);
      if (query) assert.match(html, /data-event-demo="local-only"/u);
    }
  }
});

test("Ryuyo keeps unconfirmed facts honest and reuses the known place in the creation handoff", async () => {
  for (const query of ["", "?demo=" + TOKEN]) {
    const { html } = await page(EVENT_TEMPLATE_PREVIEW_ROUTES.ryuyo, query);
    assert.match(html, /竜洋昆虫自然観察公園/u);
    assert.match(html, /公園の公式告知や、開催決定を示すものではありません/u);
    assert.match(html, /開催日・時間<\/dt><dd>未登録/u);
    assert.match(html, /申込み<\/dt><dd>受付なし/u);
    assert.match(html, /費用・定員<\/dt><dd>未確認/u);
    assert.ok(html.includes("/community/events/new?event_template=ryuyo&amp;field_id=372eafbd-ea9c-4b2f-ab5f-434b81b928b2"));
    assert.ok(html.includes("/ja/community/fields/372eafbd-ea9c-4b2f-ab5f-434b81b928b2"));
    assert.doesNotMatch(html, /受付中|公式イベント|参加者\s*\d|定員\s*\d|無料/u);
  }
});

test("handler only serves GET or HEAD exact paths and rejects malformed or duplicate share tokens without reflecting them", async () => {
  const route = EVENT_TEMPLATE_PREVIEW_ROUTES.stampRally;
  assert.equal(handleEventTemplatePreviewPage(new Request("https://zukan.test" + route, { method: "POST" }), route), null);
  assert.equal(handleEventTemplatePreviewPage(new Request("https://zukan.test/preview/events/unknown"), "/preview/events/unknown"), null);
  assert.equal(handleEventTemplatePreviewPage(new Request("https://zukan.test" + route + "/"), route + "/"), null);
  for (const query of ["?demo=", "?demo=stamp-rally", "?demo=%3Cscript%3E", "?demo=" + TOKEN + "&demo=" + OTHER_TOKEN, "?demo=" + "a".repeat(500)]) {
    const { response, html } = await page(route, query);
    assert.equal(response.status, 404, query);
    assert.doesNotMatch(html, /data-event-demo|event-demo-config|%3Cscript|<script>/u);
  }
});

test("HEAD design and interactive pages retain metadata and return no body", async () => {
  const route = EVENT_TEMPLATE_PREVIEW_ROUTES.missionQuest;
  for (const query of ["", "?demo=" + TOKEN]) {
    const response = handleEventTemplatePreviewPage(new Request("https://zukan.test" + route + query, { method: "HEAD" }), route);
    assert.ok(response);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/u);
    assert.equal(await response.text(), "");
  }
});

// Executes the exact script emitted in the response. The fixture only substitutes
// DOM/storage/media primitives, so state tests do not duplicate the demo logic.
class ElementFixture {
  attrs = new Map<string, string>();
  listeners = new Map<string, Array<(event: unknown) => unknown>>();
  children: ElementFixture[] = [];
  value = "";
  textContent = "";
  hidden = false;
  disabled = false;
  files: Array<{ type: string; size: number; name?: string }> | null = null;
  src = "";
  alt = "";
  controls = false;
  playsInline = false;
  preload = "";
  selected = false;
  paused = false;
  onFocus: (() => void) | undefined;

  constructor(public tagName: string, attributes = "") {
    this.tagName = tagName.toUpperCase();
    for (const match of attributes.matchAll(/([:\w-]+)(?:="([^"]*)")?/gu)) {
      this.attrs.set(match[1]!, (match[2] ?? "").replace(/&amp;/gu, "&").replace(/&quot;/gu, '"'));
    }
    this.value = this.attrs.get("value") ?? "";
    this.hidden = this.attrs.has("hidden");
  }
  getAttribute(name: string) { return this.attrs.get(name) ?? null; }
  setAttribute(name: string, value: string) { this.attrs.set(name, value); }
  removeAttribute(name: string) { this.attrs.delete(name); if (name === "src") this.src = ""; }
  addEventListener(name: string, listener: (event: unknown) => unknown) {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]);
  }
  fire(name: string) { for (const listener of this.listeners.get(name) ?? []) listener({ target: this, currentTarget: this }); }
  focus() { this.onFocus?.(); }
  select() { this.selected = true; }
  append(element: ElementFixture) { this.children.push(element); }
  replaceChildren() { this.children = []; }
  pause() { this.paused = true; }
}

interface RuntimeOptions {
  storage?: Map<string, string>;
  denyStorage?: boolean;
  failWrite?: boolean;
  failRemove?: boolean;
  token?: string;
}
async function runtime(route: string, options: RuntimeOptions = {}) {
  const { html } = await page(route, "?demo=" + (options.token ?? TOKEN));
  const configText = html.match(/<script[^>]*id="event-demo-config"[^>]*>([\s\S]*?)<\/script>/u)?.[1];
  const script = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gu)].at(-1)?.[1];
  assert.ok(configText);
  assert.ok(script);
  const elements: ElementFixture[] = [];
  const ids = new Map<string, ElementFixture>();
  let focused = "";
  let prints = 0;
  let nextBlob = 0;
  const revoked: string[] = [];
  const windowListeners = new Map<string, () => void>();
  for (const match of html.matchAll(/<(?!\/)([\w-]+)\b([^<>]*)>/gu)) {
    const element = new ElementFixture(match[1]!, match[2]!);
    const id = element.getAttribute("id");
    if (id) {
      ids.set(id, element);
      element.onFocus = () => { focused = id; };
    }
    elements.push(element);
  }
  ids.get("event-demo-config")!.textContent = configText;
  const storage = options.storage ?? new Map<string, string>();
  const localStorage = {
    getItem(key: string) { return storage.get(key) ?? null; },
    setItem(key: string, value: string) { if (options.failWrite) throw new Error("quota"); storage.set(key, value); },
    removeItem(key: string) { if (options.failRemove) throw new Error("denied"); storage.delete(key); },
  };
  const window = {
    get localStorage() { if (options.denyStorage) throw new Error("denied"); return localStorage; },
    addEventListener(name: string, listener: () => void) { windowListeners.set(name, listener); },
    print() { prints += 1; },
  };
  const document = {
    getElementById(id: string) { return ids.get(id) ?? null; },
    querySelectorAll(selector: string) {
      assert.equal(selector, "[data-demo-action]");
      return elements.filter((element) => element.attrs.has("data-demo-action"));
    },
    createElement(tag: string) { return new ElementFixture(tag); },
  };
  vm.runInNewContext(script, {
    window, document, navigator: {}, URL: {
      createObjectURL() { return "blob:fixture/" + ++nextBlob; },
      revokeObjectURL(url: string) { revoked.push(url); },
    },
    fetch() { throw new Error("demo must never fetch"); },
  }, { timeout: 1000 });
  const element = (id: string) => { const value = ids.get(id); assert.ok(value, id); return value; };
  return {
    html, storage, revoked, element, elements,
    click(id: string) { element(id).fire("click"); },
    choose(id: string, value: string) { const node = element(id); node.value = value; node.fire("change"); },
    attach(file: { type: string; size: number; name?: string }) { element("demo-media").files = [file]; element("demo-media").fire("change"); },
    pagehide() { windowListeners.get("pagehide")?.(); },
    focused: () => focused,
    prints: () => prints,
    saved(key: string) { const raw = storage.get(storageKey(key, options.token ?? TOKEN)); return raw ? JSON.parse(raw) : null; },
  };
}

test("stamp progress is idempotent, reload-safe and isolated by viewer, token and template", async () => {
  const storage = new Map<string, string>();
  const fixture = await runtime(EVENT_TEMPLATE_PREVIEW_ROUTES.stampRally, { storage });
  fixture.click("demo-save-stamp-compare");
  fixture.click("demo-save-stamp-compare");
  assert.equal(fixture.element("demo-progress-stamp-rally").textContent, "1 / 3 スタンプ");
  assert.equal(Object.keys(fixture.saved("stamp-rally").steps).length, 1);
  const resumed = await runtime(EVENT_TEMPLATE_PREVIEW_ROUTES.stampRally, { storage });
  assert.equal(resumed.element("demo-progress-stamp-rally").textContent, "1 / 3 スタンプ");
  assert.match(resumed.element("demo-state-stamp-compare").textContent, /チェック済み/u);
  const differentToken = await runtime(EVENT_TEMPLATE_PREVIEW_ROUTES.stampRally, { storage, token: OTHER_TOKEN });
  const differentViewer = await runtime(EVENT_TEMPLATE_PREVIEW_ROUTES.stampRally);
  const differentTemplate = await runtime(EVENT_TEMPLATE_PREVIEW_ROUTES.ryuyo, { storage });
  for (const other of [differentToken, differentViewer, differentTemplate]) {
    assert.equal(other.element("demo-progress-stamp-rally").textContent, "0 / 3 スタンプ");
  }
  resumed.click("demo-save-stamp-look");
  resumed.click("demo-save-stamp-remember");
  assert.equal(resumed.element("demo-complete-stamp-rally").hidden, false);
  assert.match(resumed.element("demo-recap-stamp-rally").textContent, /3 \/ 3/u);
  assert.match(resumed.element("demo-status").textContent, /サーバーには送信していません/u);
});

test("mission records and condition checks are separate and incorrect answers cannot unlock later missions", async () => {
  const fixture = await runtime(EVENT_TEMPLATE_PREVIEW_ROUTES.missionQuest);
  fixture.click("demo-save-mission-shape");
  assert.equal(fixture.saved("mission-quest"), null);
  assert.equal(fixture.element("demo-save-mission-shape").disabled, true);
  fixture.click("demo-save-mission-distance");
  assert.match(fixture.element("demo-error-mission-distance").textContent, /選択肢/u);
  assert.equal(fixture.focused(), "demo-choice-mission-distance");
  fixture.choose("demo-choice-mission-distance", "chase");
  fixture.click("demo-save-mission-distance");
  assert.equal(fixture.saved("mission-quest").steps["mission-distance"].stage, "saved");
  fixture.click("demo-check-mission-distance");
  assert.match(fixture.element("demo-error-mission-distance").textContent, /選び直して/u);
  assert.equal(fixture.element("demo-save-mission-shape").disabled, true);
  fixture.choose("demo-choice-mission-distance", "watch");
  fixture.click("demo-save-mission-distance");
  assert.equal(fixture.saved("mission-quest").steps["mission-distance"].stage, "saved");
  fixture.click("demo-check-mission-distance");
  assert.equal(fixture.saved("mission-quest").steps["mission-distance"].stage, "checked");
  assert.equal(fixture.element("demo-save-mission-shape").disabled, false);
  assert.equal(fixture.focused(), "demo-choice-mission-shape");
  fixture.choose("demo-choice-mission-shape", "round");
  fixture.click("demo-save-mission-shape");
  fixture.click("demo-check-mission-shape");
  fixture.choose("demo-choice-mission-tell", "color");
  fixture.click("demo-save-mission-tell");
  fixture.click("demo-check-mission-tell");
  assert.equal(fixture.element("demo-complete-mission-quest").hidden, false, "all steps complete without selecting media");
  assert.equal(fixture.element("demo-progress-mission-quest").textContent, "3 / 3 条件確認");
});

test("collaborative demo separates saved, checked and included facts and never includes local media in its gallery", async () => {
  const fixture = await runtime(EVENT_TEMPLATE_PREVIEW_ROUTES.collaborativeObservation);
  fixture.attach({ type: "image/jpeg", size: 20, name: "person-and-location.jpg" });
  fixture.choose("demo-choice-together-color", "green");
  fixture.click("demo-save-together-color");
  assert.equal(fixture.saved("collaborative-observation").steps["together-color"].stage, "saved");
  assert.equal(fixture.element("demo-gallery").children.length, 0);
  assert.match(fixture.element("demo-recap-collaborative-observation").textContent, /記録 1 件 \/ 集計プレビュー 0 件/u);
  fixture.click("demo-include-together-color");
  assert.equal(fixture.element("demo-gallery").children.length, 0, "include before checking is ignored");
  fixture.click("demo-check-together-color");
  assert.equal(fixture.saved("collaborative-observation").steps["together-color"].stage, "checked");
  assert.equal(fixture.element("demo-gallery").children.length, 0);
  fixture.click("demo-include-together-color");
  fixture.click("demo-include-together-color");
  assert.equal(fixture.element("demo-gallery").children.length, 1);
  assert.equal(fixture.element("demo-gallery").children[0]!.tagName, "LI");
  assert.match(fixture.element("demo-gallery").children[0]!.textContent, /色の発見：緑/u);
  assert.doesNotMatch(JSON.stringify(fixture.saved("collaborative-observation")), /person|location|\.jpg|blob:|media|src/u);
  const resumed = await runtime(EVENT_TEMPLATE_PREVIEW_ROUTES.collaborativeObservation, { storage: fixture.storage });
  assert.equal(resumed.element("demo-gallery").children.length, 1);
  assert.equal(resumed.element("demo-media-preview").children.length, 0);
});

test("disabled storage and quota failures remain usable and do not claim saved progress", async () => {
  for (const options of [{ denyStorage: true }, { failWrite: true }]) {
    const fixture = await runtime(EVENT_TEMPLATE_PREVIEW_ROUTES.stampRally, options);
    fixture.click("demo-save-stamp-look");
    assert.equal(fixture.element("demo-progress-stamp-rally").textContent, "1 / 3 スタンプ");
    assert.match(fixture.element("demo-storage").textContent, /保存できません/u);
    assert.match(fixture.element("demo-storage").textContent, /再読み込み/u);
    assert.match(fixture.element("demo-state-stamp-look").textContent, /この画面/u);
    assert.equal(fixture.storage.size, 0);
    assert.doesNotMatch(fixture.element("demo-status").textContent, /端末に保存しました/u);
  }
});

test("malformed, oversized or incompatible stored JSON is recoverable and cannot inject content", async () => {
  for (const raw of ["{", "[]", "x".repeat(8193), JSON.stringify({ version: 22, steps: {} })]) {
    const storage = new Map([[storageKey("stamp-rally"), raw]]);
    const fixture = await runtime(EVENT_TEMPLATE_PREVIEW_ROUTES.stampRally, { storage });
    assert.match(fixture.element("demo-storage").textContent, /読み込めませんでした/u);
    assert.equal(fixture.element("demo-progress-stamp-rally").textContent, "0 / 3 スタンプ");
    fixture.click("demo-save-stamp-look");
    assert.equal(fixture.saved("stamp-rally").version, 1);
    assert.equal(fixture.element("demo-progress-stamp-rally").textContent, "1 / 3 スタンプ");
  }
  const unsafe = {
    version: 1, mode: "unknown", active: "<script>", phase: "public", secret: "must-not-persist",
    steps: { "together-color": { stage: "included", choice: "<img src=x>", filename: "private.jpg" },
      "together-shape": { stage: "included", choice: "round", privateNote: "not allowed" },
      unknown: { stage: "included", choice: "green" } },
  };
  const storage = new Map([[storageKey("collaborative-observation"), JSON.stringify(unsafe)]]);
  const fixture = await runtime(EVENT_TEMPLATE_PREVIEW_ROUTES.collaborativeObservation, { storage });
  assert.equal(fixture.element("demo-gallery").children.length, 1);
  assert.match(fixture.element("demo-gallery").children[0]!.textContent, /形の発見：まるい/u);
  fixture.choose("demo-mode", "paper");
  assert.doesNotMatch(JSON.stringify(fixture.saved("collaborative-observation")), /private|secret|<img|unknown/u);
});

test("stored mission states cannot skip the ordered condition check or keep a wrong answer marked checked", async () => {
  const storage = new Map([[storageKey("mission-quest"), JSON.stringify({
    version: 1, steps: {
      "mission-distance": { stage: "checked", choice: "chase" },
      "mission-shape": { stage: "checked", choice: "round" },
      "mission-tell": { stage: "checked", choice: "color" },
    },
  })]]);
  const fixture = await runtime(EVENT_TEMPLATE_PREVIEW_ROUTES.missionQuest, { storage });
  assert.equal(fixture.element("demo-progress-mission-quest").textContent, "0 / 3 条件確認");
  assert.match(fixture.element("demo-state-mission-distance").textContent, /確認はこれから/u);
  assert.equal(fixture.element("demo-choice-mission-shape").disabled, true);
  fixture.choose("demo-mode", "paper");
  assert.deepEqual(Object.keys(fixture.saved("mission-quest").steps), ["mission-distance"]);
});

test("paper mode is reload-safe, never auto-completes, and reset removes only this viewer's current template key", async () => {
  const unrelatedKey = storageKey("mission-quest");
  const otherDemoKey = storageKey("stamp-rally", OTHER_TOKEN);
  const storage = new Map([[unrelatedKey, "keep-me"], [otherDemoKey, "also-keep-me"], ["real-event-progress", "keep-real"]]);
  const fixture = await runtime(EVENT_TEMPLATE_PREVIEW_ROUTES.stampRally, { storage });
  fixture.attach({ type: "video/mp4", size: 200, name: "do-not-persist.mp4" });
  fixture.choose("demo-mode", "paper");
  assert.equal(fixture.element("demo-media-panel").hidden, true);
  assert.equal(fixture.element("demo-media-preview").children.length, 0);
  assert.deepEqual(fixture.revoked, ["blob:fixture/1"]);
  assert.equal(fixture.element("demo-progress-stamp-rally").textContent, "0 / 3 スタンプ");
  assert.match(fixture.element("demo-save-stamp-look").textContent, /紙に印/u);
  fixture.click("demo-save-stamp-look");
  fixture.click("demo-print");
  assert.equal(fixture.prints(), 1);
  const resumed = await runtime(EVENT_TEMPLATE_PREVIEW_ROUTES.stampRally, { storage });
  assert.equal(resumed.element("demo-mode").value, "paper");
  assert.equal(resumed.element("demo-progress-stamp-rally").textContent, "1 / 3 スタンプ");
  resumed.click("demo-reset");
  assert.equal(resumed.element("demo-reset-confirm").hidden, false);
  resumed.click("demo-reset-cancel");
  assert.equal(resumed.element("demo-reset-confirm").hidden, true);
  assert.equal(resumed.element("demo-progress-stamp-rally").textContent, "1 / 3 スタンプ");
  resumed.click("demo-reset");
  resumed.click("demo-reset-confirm-button");
  assert.equal(storage.has(storageKey("stamp-rally")), false);
  assert.equal(storage.get(unrelatedKey), "keep-me");
  assert.equal(storage.get(otherDemoKey), "also-keep-me");
  assert.equal(storage.get("real-event-progress"), "keep-real");
  assert.equal(resumed.element("demo-progress-stamp-rally").textContent, "0 / 3 スタンプ");
});

test("reset failure tells the viewer that old stored progress may return", async () => {
  const fixture = await runtime(EVENT_TEMPLATE_PREVIEW_ROUTES.stampRally, { failRemove: true });
  fixture.click("demo-save-stamp-look");
  fixture.click("demo-reset-confirm-button");
  assert.equal(fixture.element("demo-progress-stamp-rally").textContent, "0 / 3 スタンプ");
  assert.match(fixture.element("demo-storage").textContent, /消せませんでした/u);
  assert.match(fixture.element("demo-storage").textContent, /以前の状態が戻る/u);
  assert.ok(fixture.storage.has(storageKey("stamp-rally")));
});

test("photo/video previews reject unsupported/large files and revoke only viewer Blob URLs on replace, reset and leave", async () => {
  const fixture = await runtime(EVENT_TEMPLATE_PREVIEW_ROUTES.collaborativeObservation);
  fixture.attach({ type: "image/svg+xml", size: 100 });
  assert.equal(fixture.element("demo-media-preview").children.length, 0);
  assert.match(fixture.element("demo-media-status").textContent, /表示できません/u);
  fixture.attach({ type: "image/jpeg", size: 12 * 1024 * 1024 + 1 });
  assert.equal(fixture.element("demo-media-preview").children.length, 0);
  fixture.attach({ type: "image/jpeg", size: 200 });
  const photo = fixture.element("demo-media-preview").children[0]!;
  assert.equal(photo.tagName, "IMG");
  assert.equal(photo.src, "blob:fixture/1");
  fixture.attach({ type: "video/webm", size: 300 });
  const video = fixture.element("demo-media-preview").children[0]!;
  assert.equal(video.tagName, "VIDEO");
  assert.equal(video.controls, true);
  assert.equal(video.playsInline, true);
  assert.deepEqual(fixture.revoked, ["blob:fixture/1"]);
  photo.fire("error");
  assert.equal(fixture.element("demo-media-preview").children[0], video, "an older preview error must not clear its replacement");
  fixture.pagehide();
  assert.equal(video.paused, true);
  assert.deepEqual(fixture.revoked, ["blob:fixture/1", "blob:fixture/2"]);
  fixture.attach({ type: "video/mp4", size: 400 });
  fixture.element("demo-media-preview").children[0]!.fire("error");
  assert.equal(fixture.element("demo-media-preview").children.length, 0);
  assert.match(fixture.element("demo-media-status").textContent, /写真なしで続けられます/u);
  fixture.attach({ type: "image/png", size: 400 });
  fixture.click("demo-reset-confirm-button");
  assert.deepEqual(fixture.revoked, ["blob:fixture/1", "blob:fixture/2", "blob:fixture/3", "blob:fixture/4"]);
  assert.equal(fixture.element("demo-media-preview").children.length, 0);
});

test("Ryuyo switches lifecycle views and all three shared activities while retaining only its own local progress", async () => {
  const fixture = await runtime(EVENT_TEMPLATE_PREVIEW_ROUTES.ryuyo);
  assert.equal(fixture.element("demo-before").hidden, false);
  assert.equal(fixture.element("demo-day").hidden, true);
  fixture.click("demo-start");
  assert.equal(fixture.element("demo-day").hidden, false);
  assert.equal(fixture.element("demo-before").hidden, true);
  fixture.click("demo-save-stamp-look");
  fixture.click("demo-select-mission-quest");
  assert.equal(fixture.element("demo-activity-stamp-rally").hidden, true);
  assert.equal(fixture.element("demo-activity-mission-quest").hidden, false);
  fixture.choose("demo-choice-mission-distance", "watch");
  fixture.click("demo-save-mission-distance");
  fixture.click("demo-check-mission-distance");
  fixture.click("demo-select-collaborative-observation");
  fixture.choose("demo-choice-together-color", "green");
  fixture.click("demo-save-together-color");
  fixture.click("demo-check-together-color");
  fixture.click("demo-include-together-color");
  fixture.click("demo-phase-after");
  assert.equal(fixture.element("demo-recap").hidden, false);
  assert.equal(fixture.element("demo-day").hidden, true);
  assert.match(fixture.element("demo-recap-stamp-rally").textContent, /1 \/ 3/u);
  assert.match(fixture.element("demo-recap-mission-quest").textContent, /1 \/ 3/u);
  assert.match(fixture.element("demo-recap-collaborative-observation").textContent, /集計プレビュー 1 件/u);
  const resumed = await runtime(EVENT_TEMPLATE_PREVIEW_ROUTES.ryuyo, { storage: fixture.storage });
  assert.equal(resumed.element("demo-recap").hidden, false);
  resumed.click("demo-phase-day");
  assert.equal(resumed.element("demo-activity-collaborative-observation").hidden, false);
  assert.equal(resumed.element("demo-gallery").children.length, 1);
  resumed.click("demo-phase-after");
  resumed.click("demo-reset-confirm-button");
  assert.equal(resumed.element("demo-before").hidden, false);
  assert.equal(resumed.focused(), "facts-heading");
});

test("copy without clipboard permission selects the exact share URL and has no storage effect", async () => {
  const fixture = await runtime(EVENT_TEMPLATE_PREVIEW_ROUTES.stampRally);
  fixture.click("demo-copy");
  assert.equal(fixture.focused(), "demo-link");
  assert.equal(fixture.element("demo-link").selected, true);
  assert.equal(fixture.element("demo-link").value, "https://zukan.test" + EVENT_TEMPLATE_PREVIEW_ROUTES.stampRally + "?demo=" + TOKEN);
  assert.equal(fixture.storage.size, 0);
});
