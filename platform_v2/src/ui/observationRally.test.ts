import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import type { ObservationEventSessionRow } from "../services/observationEventModeManager.js";
import { OBSERVATION_EVENT_STYLES } from "./observationEventStyles.js";
import { observationRallyScript, renderObservationRallyBody } from "./observationRally.js";

const session: ObservationEventSessionRow = {
  sessionId: "evt-rally-test",
  legacyEventId: null,
  eventCode: "RALLY1",
  title: "街なか観察ラリー",
  organizerUserId: "organizer-1",
  corporationId: null,
  plan: "community",
  primaryMode: "discovery",
  activeModes: ["discovery"],
  locationLat: 34.7,
  locationLng: 137.7,
  locationRadiusM: 30,
  startedAt: "2026-05-16T09:00:00.000Z",
  endedAt: null,
  targetSpecies: [],
  config: {},
  fieldId: null,
  templateSourceSessionId: null,
  createdAt: "2026-05-16T09:00:00.000Z",
  updatedAt: "2026-05-16T09:00:00.000Z",
};

test("rally participant screen mixes bound and unbound missions without navigation", () => {
  const html = renderObservationRallyBody({ session, isOrganizer: false });
  const script = observationRallyScript();

  assert.match(html, /data-rally-next-action/);
  assert.match(html, /data-rally-live-bars/);
  assert.match(html, /data-rally-missions/);
  assert.match(html, /data-rally-stations/);
  assert.match(html, /data-rally-location-start/);
  assert.match(html, /evt-rally-consent/);
  assert.match(html, /位置共有は任意です/);
  assert.match(html, /開催中だけ使います/);
  assert.match(html, /evt-rally-action-dock/);
  assert.match(html, /evt-rally-action-btn is-primary/);
  assert.doesNotMatch(html, /evt-live-actions/);
  assert.match(script, /station_required/);
  assert.match(script, /none: "どこでも"/);
  assert.match(script, /rally_goal_exceeded/);
  assert.match(script, /\/api\/v1\/observation-events\/" \+ sessionId \+ "\/location/);
  assert.match(script, /params\.set\("start", "photo"\)/);
  assert.doesNotMatch(html, /data-guest-token/);
  assert.doesNotMatch(script, /guest_token|guestToken|Math\.random|localStorage/);
  assert.match(script, /credentials: "include"/);
});

test("rally participant screen has a solo fallback loop when no missions exist", () => {
  const html = renderObservationRallyBody({
    session: {
      ...session,
      config: { solo_observation: true, place_event: { event_kind: "solo_micro_observation" } },
      locationRadiusM: 80,
    },
    isOrganizer: false,
  });
  const script = observationRallyScript();

  assert.match(html, /data-solo-observation="true"/);
  assert.match(html, /一人観察会/);
  assert.match(script, /まず1枚、名前不明のまま写真で記録する/);
  assert.match(script, /evt-solo-loop-grid/);
  assert.match(script, /危険なら中止/);
});

test("rally participant capture retains the event private media destination and rejects external redirects", () => {
  const html = renderObservationRallyBody({ session, isOrganizer: false, recordHref: "#event-private-media" });
  assert.match(html, /data-record-href="#event-private-media"/);
  for (const recordHref of ["https://example.com", "//example.com", "/\\example.com", "javascript:alert(1)"]) {
    assert.match(renderObservationRallyBody({ session, isOrganizer: false, recordHref }), /data-record-href=""/);
  }
  assert.match(observationRallyScript(), /window\.location\.href = root\.dataset\.recordHref/);
});

test("event action bars make the first participant action dominant", () => {
  assert.match(OBSERVATION_EVENT_STYLES, /\.evt-live-actions \{[\s\S]*grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(OBSERVATION_EVENT_STYLES, /\.evt-live-action-btn:first-child \{[\s\S]*grid-column: 1 \/ -1/);
  assert.match(OBSERVATION_EVENT_STYLES, /\.evt-rally-action-dock \{[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(OBSERVATION_EVENT_STYLES, /\.evt-rally-action-btn\.is-primary \{[\s\S]*grid-column: 1 \/ -1/);
});

type RallyFetchCall = { url: string; options: Record<string, any>; body: Record<string, any> | null };

const rallyReply = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300, status, json: async () => data,
});
let generatedRequestIds = 0;

function rallyRuntime(options: {
  storage?: Map<string, string>;
  readOnly?: boolean;
  snapshotError?: boolean;
  endedAt?: string;
  needsStation?: boolean;
  missionCount?: number;
  missionStatus?: string;
  acceptedCount?: number;
  pendingSubmissions?: Array<{ submissionId: string; missionId: string; countValue: number; reviewStatus: string; createdAt: string }>;
  pendingSubmissionsHasMore?: boolean;
  submit?: (call: RallyFetchCall) => Promise<ReturnType<typeof rallyReply>>;
} = {}) {
  class Node {
    dataset: Record<string, string> = {};
    textContent = "";
    innerHTML = "";
    disabled = false;
    value = "";
    attributes = new Map<string, string>();
    listeners = new Map<string, Function>();
    selector = "";
    addEventListener(name: string, fn: Function) { this.listeners.set(name, fn); }
    setAttribute(name: string, value: string) { this.attributes.set(name, value); }
    getAttribute(name: string) { return this.attributes.get(name) ?? null; }
    closest(selector: string) { return this.selector === selector ? this : null; }
    focus() {}
  }
  const nodes = new Map<string, Node>();
  for (const name of ["live-bars", "missions", "stations", "next-action", "momentum", "top-percent", "status", "refresh", "location-start"]) {
    nodes.set("[data-rally-" + name + "]", new Node());
  }
  nodes.get("[data-rally-status]")!.textContent = "進み具合を確認しています。";
  const root = new Node() as Node & { querySelector: (selector: string) => Node | null; querySelectorAll: (selector: string) => Node[] };
  root.dataset = { sessionId: "event-fixture", eventCode: "RALLY1", radiusM: "80", endedAt: options.endedAt ?? "" };
  root.querySelector = (selector) => nodes.get(selector) ?? null;
  const stationSelect = new Node();
  stationSelect.setAttribute("data-rally-station-for", "mission-one");
  root.querySelectorAll = (selector) => selector === "[data-rally-station-for]" ? [stationSelect] : [];
  const storage = options.storage ?? new Map<string, string>();
  const calls: RallyFetchCall[] = [];
  const documentListeners = new Map<string, Function>();
  const windowListeners = new Map<string, Function>();
  const document = {
    hidden: false,
    querySelector: () => root,
    addEventListener: (name: string, fn: Function) => documentListeners.set(name, fn),
  };
  let readOnly = options.readOnly ?? false;
  let snapshotError = options.snapshotError ?? false;
  const timers = new Map<number, { callback: Function; delay: number }>();
  let timerId = 0;
  const geo = { count: 0, cleared: [] as number[], success: null as Function | null, error: null as Function | null };
  const liveSources: Array<{ close: () => void; closed: boolean; handlers: Map<string, Function> }> = [];
  const globals = {
    document,
    window: {
      location: { href: "" },
      addEventListener: (name: string, fn: Function) => windowListeners.set(name, fn),
    },
    Element: Node,
    URLSearchParams,
    AbortController,
    crypto: { randomUUID: () => "00000000-0000-4000-8000-" + String(++generatedRequestIds).padStart(12, "0") },
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
    navigator: {
      geolocation: {
        watchPosition: (success: Function, error: Function) => {
          geo.success = success;
          geo.error = error;
          return ++geo.count;
        },
        clearWatch: (id: number) => geo.cleared.push(id),
      },
    },
    EventSource: class {
      closed = false;
      handlers = new Map<string, Function>();
      constructor() { liveSources.push(this); }
      addEventListener(name: string, fn: Function) { this.handlers.set(name, fn); }
      close() { this.closed = true; }
    },
    setTimeout: (callback: Function, delay: number) => {
      timers.set(++timerId, { callback, delay });
      return timerId;
    },
    clearTimeout: (id: number) => timers.delete(id),
    fetch: async (url: string, requestOptions: Record<string, any>) => {
      const call = { url, options: requestOptions, body: requestOptions.body ? JSON.parse(requestOptions.body) : null };
      calls.push(call);
      if (url.endsWith("/rally/submissions")) {
        return options.submit ? options.submit(call) : rallyReply({ submission: { reviewStatus: "auto_accepted" }, replayed: false }, 201);
      }
      if (url.endsWith("/rally")) {
        if (snapshotError) throw new Error("offline");
        return rallyReply({ rally: {
          readOnly,
          course: { status: "live" },
          stations: options.needsStation ? [{ stationId: "station-one", name: "足もとの観察地点", status: "open" }] : [],
          missions: Array.from({ length: options.missionCount ?? 1 }, (_, index) => ({ missionId: index === 0 ? "mission-one" : "mission-" + (index + 1), title: index === 0 ? "足もとを観察する" : "観察ミッション " + (index + 1), status: options.missionStatus ?? "published", goalCount: 2, countUnit: "scene", locationBinding: options.needsStation ? "any_registered_station" : "none" })),
          progress: [{ missionId: "mission-one", progressScope: "event", actualCount: options.acceptedCount ?? 5, percent: (options.acceptedCount ?? 5) * 50 }],
          pendingSubmissions: options.pendingSubmissions ?? [],
          pendingSubmissionsHasMore: options.pendingSubmissionsHasMore ?? false,
        } });
      }
      return rallyReply({});
    },
  };
  runInNewContext(observationRallyScript(), globals);
  return {
    calls, storage, geo, liveSources, timers,
    status: () => nodes.get("[data-rally-status]")!.textContent,
    missionHtml: () => nodes.get("[data-rally-missions]")!.innerHTML,
    barHtml: () => nodes.get("[data-rally-live-bars]")!.innerHTML,
    nextAction: () => nodes.get("[data-rally-next-action]")!.textContent,
    locationButton: nodes.get("[data-rally-location-start]")!,
    submit: (missionId = "mission-one") => {
      const button = new Node();
      button.selector = "[data-rally-submit]";
      button.setAttribute("data-rally-submit", missionId);
      root.listeners.get("click")!({ target: button, preventDefault() {} });
    },
    refresh: () => nodes.get("[data-rally-refresh]")!.listeners.get("click")!(),
    shareLocation: () => nodes.get("[data-rally-location-start]")!.listeners.get("click")!(),
    setReadOnly: (value: boolean) => { readOnly = value; },
    setSnapshotError: (value: boolean) => { snapshotError = value; },
    chooseStation: (value: string) => { stationSelect.value = value; },
    hide: () => { document.hidden = true; documentListeners.get("visibilitychange")!(); },
    show: () => { document.hidden = false; documentListeners.get("visibilitychange")!(); },
    pagehide: () => windowListeners.get("pagehide")!(),
    rerun: () => runInNewContext(observationRallyScript(), globals),
  };
}

async function settleRally() {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

test("rally participant can reach and submit every mission in the nine-step Ryuuyo program", async () => {
  const runtime = rallyRuntime({ missionCount: 9 });
  await settleRally();
  assert.equal((runtime.missionHtml().match(/data-rally-submit=/g) ?? []).length, 9);
  assert.match(runtime.missionHtml(), /data-rally-submit="mission-9"/);
  assert.match(runtime.missionHtml(), /観察ミッション 9/);
  runtime.submit("mission-9");
  await settleRally();
  assert.equal(runtime.calls.find((call) => call.url.endsWith("/rally/submissions"))?.body?.mission_id, "mission-9");
});

test("rally runtime prevents concurrent clicks and gives each acknowledged new discovery a new request id", async () => {
  let acknowledge!: (reply: ReturnType<typeof rallyReply>) => void;
  const result = new Promise<ReturnType<typeof rallyReply>>((resolve) => { acknowledge = resolve; });
  const runtime = rallyRuntime({ submit: () => result });
  await settleRally();
  runtime.submit();
  runtime.submit();
  await settleRally();
  const posts = () => runtime.calls.filter((call) => call.body?.request_id);
  assert.equal(posts().length, 1);
  assert.match(posts()[0].body!.request_id, /^[A-Za-z0-9_-]{16,128}$/);
  assert.match(runtime.missionHtml(), /disabled[^>]*>送信を確認中/);
  acknowledge(rallyReply({ submission: { reviewStatus: "auto_accepted" }, replayed: false }, 201));
  await settleRally();
  assert.equal(runtime.storage.size, 0);
  runtime.submit();
  await settleRally();
  assert.equal(posts().length, 2);
  assert.notEqual(posts()[0].body!.request_id, posts()[1].body!.request_id);
});

test("rally runtime preserves an uncertain request across reload and acknowledges a replay without another increment", async () => {
  const storage = new Map<string, string>();
  const first = rallyRuntime({ storage, submit: async () => { throw new Error("connection lost after write"); } });
  await settleRally();
  first.submit();
  await settleRally();
  const firstId = first.calls.find((call) => call.body?.request_id)!.body!.request_id;
  assert.match(first.status(), /送信結果を確認できません/);
  assert.match(first.missionHtml(), /同じ発見の送信を再確認/);
  const resumed = rallyRuntime({ storage, submit: async () => rallyReply({ submission: { reviewStatus: "auto_accepted" }, replayed: true }) });
  await settleRally();
  resumed.submit();
  await settleRally();
  assert.equal(resumed.calls.find((call) => call.body?.request_id)!.body!.request_id, firstId);
  assert.match(resumed.status(), /重ねて加算していません/);
  assert.equal(storage.size, 0);
});

test("rally runtime times out a stalled submission and retains the same request for safe retry", async () => {
  const runtime = rallyRuntime({
    submit: (call) => new Promise((_resolve, reject) => call.options.signal.addEventListener("abort", () => reject(new Error("aborted")))),
  });
  await settleRally();
  runtime.submit();
  await settleRally();
  const requestTimer = [...runtime.timers.values()].find((timer) => timer.delay === 12000);
  assert.ok(requestTimer);
  requestTimer.callback();
  await settleRally();
  assert.equal(runtime.storage.size, 1);
  assert.match(runtime.status(), /送信結果を確認できません/);
  assert.match(runtime.missionHtml(), /同じ発見の送信を再確認/);
  assert.doesNotMatch(runtime.missionHtml(), /disabled[^>]*>送信を確認中/);
});

test("rally runtime can recheck an uncertain saved receipt after the event closes", async () => {
  const storage = new Map<string, string>();
  const first = rallyRuntime({ storage, submit: async () => { throw new Error("lost receipt"); } });
  await settleRally();
  first.submit();
  await settleRally();
  const original = first.calls.find((call) => call.body?.request_id)!.body!;
  const ended = rallyRuntime({ storage, readOnly: true, submit: async () => rallyReply({ submission: { reviewStatus: "auto_accepted" }, replayed: true }) });
  await settleRally();
  assert.match(ended.missionHtml(), /同じ発見の送信を再確認/);
  assert.doesNotMatch(ended.missionHtml(), /disabled[^>]*>同じ発見/);
  ended.submit();
  await settleRally();
  assert.equal(ended.calls.find((call) => call.body?.request_id)!.body!.request_id, original.request_id);
  assert.match(ended.status(), /重ねて加算していません/);
  assert.match(ended.missionHtml(), /disabled[^>]*>現在は受付していません/);
});

test("rally runtime requires an available station and preserves its selected id when a receipt is retried after reload", async () => {
  const storage = new Map<string, string>();
  const first = rallyRuntime({ storage, needsStation: true, submit: async () => { throw new Error("lost receipt"); } });
  await settleRally();
  assert.match(first.missionHtml(), /観察した地点/);
  first.submit();
  await settleRally();
  assert.equal(first.calls.filter((call) => call.body?.request_id).length, 0);
  assert.match(first.status(), /地点を選んで/);
  first.chooseStation("station-one");
  first.submit();
  await settleRally();
  const original = first.calls.find((call) => call.body?.request_id)!.body!;
  assert.equal(original.station_id, "station-one");
  const resumed = rallyRuntime({ storage, needsStation: true, readOnly: true });
  await settleRally();
  assert.match(resumed.missionHtml(), /value="station-one" selected/);
  resumed.submit();
  await settleRally();
  const retried = resumed.calls.find((call) => call.body?.request_id)!.body!;
  assert.equal(retried.request_id, original.request_id);
  assert.equal(retried.station_id, original.station_id);
});

test("rally runtime keeps review pending distinct from accepted progress and bounds progress bar width", async () => {
  const runtime = rallyRuntime({ submit: async () => rallyReply({ submission: { reviewStatus: "pending", submissionId: "rally_receipt_123456789abc" } }, 201) });
  await settleRally();
  assert.match(runtime.barHtml(), /width:100%/);
  assert.match(runtime.barHtml(), /aria-valuenow="100"/);
  assert.match(runtime.barHtml(), /250%/);
  runtime.submit();
  await settleRally();
  assert.match(runtime.status(), /主催者の確認後/);
  assert.match(runtime.status(), /受付番号: 123456789abc/);
});

test("rally runtime restores own pending receipts from the server without counting them as accepted", async () => {
  const pendingSubmissions = [{ submissionId: "rally_receipt_123456789abc", missionId: "mission-one", countValue: 1, reviewStatus: "pending", createdAt: "2026-10-06T00:00:00Z" }];
  for (let visit = 0; visit < 2; visit++) {
    const runtime = rallyRuntime({ pendingSubmissions, acceptedCount: 0 });
    await settleRally();
    assert.match(runtime.missionHtml(), /あなたの発見 1件 は主催者の確認待ち/);
    assert.match(runtime.missionHtml(), /<code>123456789abc<\/code>/);
    assert.match(runtime.missionHtml(), /目標: 0\/2件/);
    assert.equal(runtime.calls.filter((call) => call.body).length, 0);
  }
  const paused = rallyRuntime({ pendingSubmissions, missionStatus: "paused", pendingSubmissionsHasMore: true });
  await settleRally();
  assert.match(paused.missionHtml(), /確認待ちの受付がほかにもあります/);
  assert.match(paused.missionHtml(), /disabled[^>]*>現在は受付していません/);
  paused.submit();
  await settleRally();
  assert.equal(paused.calls.filter((call) => call.body).length, 0);
});

test("rally runtime exposes initial load errors and recovers through the existing refresh control", async () => {
  const runtime = rallyRuntime({ snapshotError: true });
  await settleRally();
  assert.match(runtime.nextAction(), /読み込めません/);
  assert.match(runtime.status(), /「更新」/);
  assert.equal(runtime.missionHtml(), "");
  runtime.setSnapshotError(false);
  runtime.refresh();
  await settleRally();
  assert.match(runtime.missionHtml(), /足もとを観察する/);
  assert.match(runtime.status(), /更新しました/);
});

test("rally runtime stops location on denial, hidden pages and read-only snapshots without automatically restarting", async () => {
  const runtime = rallyRuntime();
  await settleRally();
  runtime.shareLocation();
  runtime.geo.error!({ code: 1 });
  assert.match(runtime.status(), /許可しなくても/);
  assert.deepEqual(runtime.geo.cleared, [1]);
  runtime.shareLocation();
  const latePosition = runtime.geo.success!;
  runtime.hide();
  await latePosition({ coords: { latitude: 34, longitude: 137 } });
  assert.equal(runtime.calls.filter((call) => call.url.endsWith("/location")).length, 0);
  assert.deepEqual(runtime.geo.cleared, [1, 2]);
  assert.ok(runtime.liveSources[0].closed);
  runtime.show();
  await settleRally();
  assert.equal(runtime.geo.count, 2);
  runtime.shareLocation();
  runtime.setReadOnly(true);
  runtime.refresh();
  await settleRally();
  assert.deepEqual(runtime.geo.cleared, [1, 2, 3]);
  assert.equal(runtime.locationButton.disabled, true);
  runtime.submit();
  assert.equal(runtime.calls.filter((call) => call.body?.request_id).length, 0);
  assert.match(runtime.missionHtml(), /disabled[^>]*>現在は受付していません/);
});

test("rally runtime keeps ended results visible and binds its listeners only once", async () => {
  const runtime = rallyRuntime({ endedAt: "2020-01-01T00:00:00.000Z", missionStatus: "closed" });
  await settleRally();
  assert.match(runtime.missionHtml(), /足もとを観察する/);
  assert.match(runtime.missionHtml(), /目標: 5\/2件/);
  assert.match(runtime.missionHtml(), /disabled[^>]*>現在は受付していません/);
  assert.equal(runtime.locationButton.disabled, true);
  runtime.submit();
  assert.equal(runtime.calls.filter((call) => call.body?.request_id).length, 0);
  const count = runtime.calls.length;
  runtime.rerun();
  await settleRally();
  assert.equal(runtime.calls.length, count);
  runtime.pagehide();
  assert.ok(runtime.liveSources[0].closed);
});
