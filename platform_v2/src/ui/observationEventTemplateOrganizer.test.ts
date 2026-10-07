import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import {
  observationEventTemplateOrganizerScript,
  renderObservationEventTemplateOrganizer,
} from "./observationEventTemplateOrganizer.js";

type JsonObject = Record<string, any>;
type FetchCall = { url: string; method: string; options: JsonObject; body: JsonObject | null };
type Reply = { ok: boolean; status: number; json: () => Promise<unknown> };
const reply = (body: unknown, status = 200): Reply => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => structuredClone(body),
});

class TestElement {
  dataset: Record<string, string> = {};
  attributes = new Map<string, string>();
  listeners = new Map<string, Array<(event: any) => unknown>>();
  innerHTML = "";
  textContent = "";
  value = "";
  disabled = false;
  hidden = false;
  focused = false;
  parentForm: TestForm | null = null;
  selector = "";
  addEventListener(name: string, listener: (event: any) => unknown) {
    const listeners = this.listeners.get(name) ?? [];
    listeners.push(listener);
    this.listeners.set(name, listeners);
  }
  dispatch(name: string, event: JsonObject = {}) {
    for (const listener of this.listeners.get(name) ?? []) listener({ target: this, preventDefault() {}, ...event });
  }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
  removeAttribute(name: string) { this.attributes.delete(name); }
  closest(selector: string): TestElement | null {
    if (selector === this.selector) return this;
    if (selector === "form[data-organizer-edit]") return this.parentForm;
    return null;
  }
  focus() { this.focused = true; }
}

class TestForm extends TestElement {
  controls = new Map<string, TestElement>();
  elements = { namedItem: (name: string) => this.controls.get(name) ?? null };
  constructor(missionId: string, fields: { title: string; target: string; goal_count: string }) {
    super();
    this.selector = "form[data-organizer-edit]";
    this.dataset.missionId = missionId;
    this.setAttribute("data-mission-id", missionId);
    for (const [name, value] of Object.entries(fields)) {
      const control = new TestElement();
      control.value = value;
      control.parentForm = this;
      this.controls.set(name, control);
    }
  }
}

function initialRally() {
  return {
    course: { courseId: "course-fixture", title: "主催者の企画", status: "draft" } as JsonObject | null,
    missions: Array.from({ length: 9 }, (_, index) => ({
      missionId: `mission-${index + 1}`,
      title: `観察下書き ${index + 1}`,
      target: `確認する内容 ${index + 1}`,
      goalCount: 1,
      countUnit: "scene",
      status: "draft",
      verificationPolicy: "organizer_review",
      scope: index < 6 ? "participant" : "event",
      locationBinding: "none",
    })) as JsonObject[],
    reviewQueue: [{
      submissionId: "review-one", missionId: "mission-1", countValue: 1,
      reviewStatus: "pending", createdAt: "2026-10-06T12:00:00.000Z",
    }] as JsonObject[],
    reviewQueueHasMore: false,
  };
}

function organizerRuntime(options: {
  sessionId?: string;
  discoveryJournalEnabled?: boolean;
  rally?: ReturnType<typeof initialRally>;
  mutation?: (call: FetchCall, apply: () => Reply) => Promise<Reply>;
} = {}) {
  const state = options.rally ?? initialRally();
  const sessionId = options.sessionId ?? "event-fixture";
  const base = `/api/v1/observation-events/${encodeURIComponent(sessionId)}/rally`;
  const nodes = new Map<string, TestElement>();
  for (const name of ["course", "missions", "reviews", "status", "refresh"]) {
    nodes.set(`[data-organizer-${name}]`, new TestElement());
  }
  const refreshButton = nodes.get("[data-organizer-refresh]")!;
  refreshButton.selector = "button[data-organizer-action]";
  refreshButton.dataset.organizerAction = "refresh";
  const root = new TestElement() as TestElement & {
    querySelector: (selector: string) => TestElement | null;
    querySelectorAll: (selector: string) => TestElement[];
    contains: (target: TestElement) => boolean;
  };
  root.dataset = { sessionId, sessionClosed: "false", templateKey: "ryuyo", discoveryJournalEnabled: String(options.discoveryJournalEnabled === true) };
  root.querySelector = (selector) => nodes.get(selector) ?? null;
  root.querySelectorAll = () => [];
  root.contains = () => true;
  const calls: FetchCall[] = [];
  const copied: string[] = [];
  const timers = new Map<number, () => unknown>();
  let timerId = 0;
  let readFailure = false;
  let nextReadBody: unknown | undefined;
  function applyMutation(call: FetchCall): Reply {
    if (call.url === `${base}/course`) {
      if (call.body?.action === "prepare_template") {
        state.course = { courseId: "course-fixture", title: "主催者の企画", status: "draft" };
        state.missions = initialRally().missions;
      } else {
        assert.ok(state.course);
        state.course.status = call.body?.status;
      }
      return reply({ course: state.course });
    }
    const missionMatch = call.url.match(/\/missions\/([^/]+)$/);
    if (missionMatch?.[1]) {
      const mission = state.missions.find((item) => item.missionId === decodeURIComponent(missionMatch[1]!));
      assert.ok(mission);
      if (call.body?.action === "edit") {
        mission.title = call.body.title;
        mission.target = call.body.target;
        mission.goalCount = call.body.goal_count;
      } else {
        mission.status = call.body?.action === "publish" ? "published" : "paused";
      }
      return reply({ mission });
    }
    const reviewMatch = call.url.match(/\/submissions\/([^/]+)\/review$/);
    if (reviewMatch?.[1]) {
      const submission = state.reviewQueue.find((item) => item.submissionId === decodeURIComponent(reviewMatch[1]!));
      assert.ok(submission);
      submission.reviewStatus = call.body?.review_status;
      state.reviewQueue = state.reviewQueue.filter((item) => item !== submission);
      return reply({ submission });
    }
    assert.fail(`Unexpected mutation endpoint: ${call.url}`);
  }
  const globals = {
    document: {
      querySelector: (selector: string) => selector === "[data-event-template-organizer]" ? root : null,
      querySelectorAll: (selector: string) => selector === "[data-event-template-organizer]" ? [root] : [],
    },
    navigator: { clipboard: { writeText: async (text: string) => { copied.push(text); } } },
    Element: TestElement,
    HTMLElement: TestElement,
    AbortController,
    URL,
    URLSearchParams,
    setTimeout: (callback: () => unknown) => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: (id: number) => timers.delete(id),
    fetch: async (url: string, request: JsonObject = {}) => {
      const call: FetchCall = {
        url: String(url), method: String(request.method ?? "GET"), options: request,
        body: typeof request.body === "string" ? JSON.parse(request.body) : null,
      };
      calls.push(call);
      if (call.method === "GET") {
        assert.equal(call.url, base);
        if (readFailure) throw new Error("network unavailable");
        if (nextReadBody !== undefined) {
          const body = nextReadBody;
          nextReadBody = undefined;
          return reply(body);
        }
        return reply({ rally: state });
      }
      return options.mutation ? options.mutation(call, () => applyMutation(call)) : applyMutation(call);
    },
  };
  runInNewContext(observationEventTemplateOrganizerScript(), globals);
  return {
    state, calls, base, copied,
    writes: () => calls.filter((call) => call.method !== "GET"),
    status: () => nodes.get("[data-organizer-status]")!.textContent,
    missionHtml: () => nodes.get("[data-organizer-missions]")!.innerHTML,
    courseHtml: () => nodes.get("[data-organizer-course]")!.innerHTML,
    reviewHtml: () => nodes.get("[data-organizer-reviews]")!.innerHTML,
    click(action: string, id?: string) {
      const button = new TestElement();
      button.selector = "button[data-organizer-action]";
      button.dataset.organizerAction = action;
      button.setAttribute("data-organizer-action", action);
      if (id !== undefined) { button.dataset.id = id; button.setAttribute("data-id", id); }
      root.dispatch("click", { target: button });
    },
    edit(missionId: string, fields: { title: string; target: string; goal_count: string }) {
      const form = new TestForm(missionId, fields);
      root.dispatch("input", { target: form.controls.get("title") });
      return { submit: () => root.dispatch("submit", { target: form }) };
    },
    refresh: () => root.dispatch("click", { target: refreshButton }),
    setReadFailure: (value: boolean) => { readFailure = value; },
    setNextReadBody: (value: unknown) => { nextReadBody = value; },
    rerun: () => runInNewContext(observationEventTemplateOrganizerScript(), globals),
  };
}

async function settle() { await new Promise<void>((resolve) => setImmediate(resolve)); }

test("organizer renderer scopes its script and escapes untrusted session attributes", () => {
  const sessionId = 'event"><img src=x onerror=alert(1)>/next';
  const html = renderObservationEventTemplateOrganizer({ sessionId, templateKey: "ryuyo" });
  assert.match(html, /data-event-template-organizer/);
  assert.match(html, /data-organizer-(?:course|missions|reviews|status|refresh)/);
  assert.doesNotMatch(html, /<img src=x|data-session-id="event"><|onerror=alert\(1\)>\/next/);
  assert.match(html, /&quot;&gt;&lt;img/);
});

test("initialization performs only credentialed reads, displays all nine drafts, and binds once", async () => {
  const runtime = organizerRuntime();
  await settle();
  assert.ok(runtime.calls.length > 0);
  assert.equal(runtime.writes().length, 0);
  for (const call of runtime.calls) assert.equal(call.options.credentials, "include");
  for (let index = 1; index <= 9; index += 1) assert.match(runtime.missionHtml(), new RegExp(`観察下書き ${index}`));
  assert.equal((runtime.missionHtml().match(/data-organizer-edit/g) ?? []).length, 9);
  assert.match(runtime.reviewHtml(), /review-one/);
  const initialReads = runtime.calls.length;
  runtime.rerun();
  await settle();
  assert.equal(runtime.calls.length, initialReads);
  runtime.click("publish", "mission-1");
  await settle();
  assert.equal(runtime.writes().length, 1);
});

test("prepare creates a template only after an explicit action and verified read-back", async () => {
  const rally = initialRally();
  rally.course = null;
  rally.missions = [];
  rally.reviewQueue = [];
  const runtime = organizerRuntime({ rally });
  await settle();
  assert.equal(runtime.writes().length, 0);
  runtime.click("prepare");
  await settle();
  assert.deepEqual(runtime.writes().map((call) => ({ url: call.url, method: call.method, body: call.body })), [
    { url: `${runtime.base}/course`, method: "POST", body: { action: "prepare_template" } },
  ]);
  assert.equal(runtime.calls.at(-1)?.method, "GET");
  assert.match(runtime.missionHtml(), /観察下書き 9/);
  assert.equal(runtime.state.course?.status, "draft");
});

test("prepare must acknowledge the same safe course that is read back", async () => {
  for (const course of [
    { courseId: "wrong-course", title: "Unknown course", status: "draft" },
    { courseId: "course-fixture", title: "Unexpectedly live", status: "live" },
  ]) {
    const rally = initialRally();
    rally.course = null;
    rally.missions = [];
    rally.reviewQueue = [];
    const runtime = organizerRuntime({ rally, mutation: async (_call, apply) => {
      apply();
      return reply({ course });
    } });
    await settle();
    runtime.click("prepare");
    await settle();
    assert.match(runtime.status(), /確認できません|確認してください/);
    runtime.click("publish", "mission-1");
    await settle();
    assert.equal(runtime.writes().length, 1);
  }
});

test("explicit start and pause send only course state and preserve organizer configuration", async () => {
  const rally = initialRally();
  assert.ok(rally.course);
  rally.course.status = "preflight";
  for (const mission of rally.missions) mission.status = "published";
  const runtime = organizerRuntime({ rally });
  await settle();
  runtime.click("start");
  await settle();
  assert.equal(runtime.state.course?.status, "live");
  runtime.click("pause-course");
  await settle();
  assert.equal(runtime.state.course?.status, "preflight");
  assert.deepEqual(runtime.writes().map((call) => ({ method: call.method, url: call.url, body: call.body })), [
    { method: "POST", url: `${runtime.base}/course`, body: { status: "live" } },
    { method: "POST", url: `${runtime.base}/course`, body: { status: "preflight" } },
  ]);
  assert.equal(runtime.state.course?.title, "主催者の企画");
});

test("draft edit, publish, and pause use the existing mission endpoint with escaped IDs", async () => {
  const rally = initialRally();
  const missionId = 'mission/one"><img src=x onerror=alert(1)>';
  const mission = rally.missions[0];
  assert.ok(mission);
  mission.missionId = missionId;
  mission.title = '観察 <img src=x onerror="alert(1)">';
  const runtime = organizerRuntime({ rally, sessionId: "event/with space" });
  await settle();
  assert.doesNotMatch(runtime.missionHtml(), /<img/);
  const form = runtime.edit(missionId, { title: "主催者が確認した課題", target: "紙で見くらべて確認する", goal_count: "4" });
  assert.equal(runtime.writes().length, 0);
  form.submit();
  await settle();
  runtime.click("publish", missionId);
  await settle();
  runtime.click("pause", missionId);
  await settle();
  assert.deepEqual(runtime.writes().map((call) => ({ url: call.url, method: call.method, body: call.body })), [
    { url: `${runtime.base}/missions/${encodeURIComponent(missionId)}`, method: "PATCH", body: { action: "edit", title: "主催者が確認した課題", target: "紙で見くらべて確認する", goal_count: 4 } },
    { url: `${runtime.base}/missions/${encodeURIComponent(missionId)}`, method: "PATCH", body: { action: "publish" } },
    { url: `${runtime.base}/missions/${encodeURIComponent(missionId)}`, method: "PATCH", body: { action: "pause" } },
  ]);
  assert.equal(mission.status, "paused");
  assert.equal(mission.goalCount, 4);
});

test("explicit review accepts or rejects only the chosen pending submission", async () => {
  const rally = initialRally();
  const rejectedId = 'review/two"><img src=x>';
  rally.reviewQueue.push({ submissionId: rejectedId, missionId: "mission-2", countValue: 2, reviewStatus: "pending", createdAt: "2026-10-06T12:01:00.000Z" });
  const runtime = organizerRuntime({ rally });
  await settle();
  assert.equal(runtime.writes().length, 0);
  assert.doesNotMatch(runtime.reviewHtml(), /<img/);
  runtime.click("review-accept", "review-one");
  await settle();
  assert.equal(runtime.state.reviewQueue.length, 1);
  runtime.click("review-reject", rejectedId);
  await settle();
  assert.equal(runtime.state.reviewQueue.length, 0);
  assert.deepEqual(runtime.writes().map((call) => ({ method: call.method, url: call.url, body: call.body })), [
    { method: "PATCH", url: `${runtime.base}/submissions/review-one/review`, body: { review_status: "accepted" } },
    { method: "PATCH", url: `${runtime.base}/submissions/${encodeURIComponent(rejectedId)}/review`, body: { review_status: "rejected" } },
  ]);
});

test("failed or unacknowledged writes require explicit refresh and preserve unsaved draft input", async () => {
  for (const failure of [reply({ error: "temporary_failure" }, 500), reply({ ok: true }), reply({ mission: { missionId: "wrong-mission", status: "published" } }), new Error("offline")]) {
    let firstWrite = true;
    const runtime = organizerRuntime({ mutation: async (_call, apply) => {
      if (firstWrite) {
        firstWrite = false;
        if (failure instanceof Error) throw failure;
        return failure;
      }
      return apply();
    } });
    await settle();
    runtime.edit("mission-2", { title: "まだ保存していない主催者の入力", target: "手元の下書きを保持", goal_count: "7" });
    runtime.click("publish", "mission-1");
    await settle();
    runtime.click("publish", "mission-1");
    await settle();
    assert.equal(runtime.writes().length, 1, "uncertain state must prevent another write before explicit read-back");
    assert.match(runtime.status(), /確認|再読込|失敗|読み込/);
    runtime.refresh();
    await settle();
    assert.match(runtime.missionHtml(), /まだ保存していない主催者の入力/);
    assert.match(runtime.missionHtml(), /手元の下書きを保持/);
    runtime.click("publish", "mission-1");
    await settle();
    assert.equal(runtime.writes().length, 2);
    assert.equal(runtime.state.missions[0]?.status, "published");
    for (const call of runtime.calls) assert.equal(call.options.credentials, "include");
  }
});

test("a successful response without a valid follow-up snapshot remains unconfirmed", async () => {
  const runtime = organizerRuntime();
  await settle();
  runtime.setNextReadBody({ rally: { course: null, missions: [] } });
  runtime.click("publish", "mission-1");
  await settle();
  assert.equal(runtime.writes().length, 1);
  runtime.click("publish", "mission-2");
  await settle();
  assert.equal(runtime.writes().length, 1);
  assert.match(runtime.status(), /確認|再読込|失敗|読み込/);
  runtime.refresh();
  await settle();
  runtime.click("publish", "mission-2");
  await settle();
  assert.equal(runtime.writes().length, 2);
});

test("repeated clicks cannot duplicate an in-flight mutation", async () => {
  let finish: (() => void) | undefined;
  const runtime = organizerRuntime({ mutation: async (_call, apply) => new Promise<Reply>((resolve) => {
    finish = () => resolve(apply());
  }) });
  await settle();
  runtime.click("publish", "mission-1");
  await settle();
  runtime.click("publish", "mission-1");
  await settle();
  assert.equal(runtime.writes().length, 1);
  assert.ok(finish);
  finish();
  await settle();
  assert.equal(runtime.state.missions[0]?.status, "published");
  assert.equal(runtime.calls.at(-1)?.method, "GET");
});

test("a closed course retains receipt review while blocking preparation and activity changes", async () => {
  const rally = initialRally();
  assert.ok(rally.course);
  rally.course.status = "closed";
  rally.reviewQueueHasMore = true;
  const runtime = organizerRuntime({ rally });
  await settle();
  assert.match(runtime.courseHtml(), /終了/);
  assert.match(runtime.reviewHtml(), /100件|続き/);
  assert.match(runtime.reviewHtml(), /review-one/);
  runtime.click("start");
  runtime.click("pause-course");
  runtime.click("publish", "mission-1");
  runtime.edit("mission-1", { title: "終了後の変更", target: "変更しない", goal_count: "2" }).submit();
  await settle();
  assert.equal(runtime.writes().length, 0);
  runtime.click("review-accept", "review-one");
  await settle();
  assert.equal(runtime.writes().length, 1);
  assert.equal(runtime.writes()[0]?.url, `${runtime.base}/submissions/review-one/review`);
  assert.equal(runtime.state.course?.status, "closed");
});

test("stale unsaved draft input does not prevent an explicitly paused mission from being republished", async () => {
  const runtime = organizerRuntime();
  await settle();
  runtime.edit("mission-1", { title: "保存していない変更", target: "再公開では送らない内容", goal_count: "8" });
  const mission = runtime.state.missions[0];
  assert.ok(mission);
  // Another organizer action has changed the stored state while this tab stayed open.
  mission.status = "paused";
  runtime.refresh();
  await settle();
  runtime.click("publish", "mission-1");
  await settle();
  assert.equal(runtime.writes().length, 1);
  assert.deepEqual(runtime.writes()[0]?.body, { action: "publish" });
  assert.equal(mission.status, "published");
  assert.equal(mission.title, "観察下書き 1");
  assert.equal(mission.target, "確認する内容 1");
  assert.equal(mission.goalCount, 1);
});

test("discovery event can start natively with optional missions still in draft", async () => {
  const runtime = organizerRuntime({ discoveryJournalEnabled: true });
  await settle();
  assert.ok(runtime.state.missions.every(mission => mission.status === "draft"));
  assert.match(runtime.courseHtml(), /発見ノートの受付を開始/);
  runtime.click("start");
  await settle();
  assert.equal(runtime.state.course?.status, "live");
  assert.deepEqual(runtime.writes().map(call => call.body), [{ status: "live" }]);
  assert.ok(runtime.state.missions.every(mission => mission.status === "draft"));
});

test("discovery controls appear only for explicitly enabled journal events", () => {
  const ordinary = renderObservationEventTemplateOrganizer({ sessionId: "ordinary", templateKey: "ryuyo" });
  assert.doesNotMatch(ordinary, /data-event-discovery="organizer"/);
  const discovery = renderObservationEventTemplateOrganizer({ sessionId: "discovery", templateKey: "ryuyo", discoveryJournalEnabled: true });
  assert.match(discovery, /data-event-discovery="organizer"/);
  assert.match(discovery, /追加の観察ミッションを使う（任意）/);
});
