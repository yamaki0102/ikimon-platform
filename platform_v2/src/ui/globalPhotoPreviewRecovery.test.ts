import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { renderSiteDocument } from "./siteShell.js";
import { patchGlobalRecordSourceChoiceHtml } from "../services/globalRecordSourceChoiceHtmlPatch.js";

// The actual rendered global capture script is exercised. All network writes and
// device access are fixture-only: no real login, camera, database or upload.
class Element {
  hidden = false;
  disabled = false;
  value = "";
  textContent = "";
  innerHTML = "";
  files: File[] = [];
  attributes = new Map<string, string>();
  listeners = new Map<string, Array<() => void>>();
  classList = { add() {}, remove() {} };
  style = { setProperty() {}, removeProperty() {} };
  setAttribute(key: string, value: string) { this.attributes.set(key, value); }
  getAttribute(key: string) { return this.attributes.get(key) ?? null; }
  removeAttribute(key: string) { this.attributes.delete(key); }
  addEventListener(event: string, fn: () => void) {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), fn]);
  }
  dispatch(event: string) { for (const handler of this.listeners.get(event) ?? []) handler(); }
  click() { this.dispatch("click"); }
  appendChild(_child: Element) {}
}

type Draft = {
  ownerKey: string;
  kind: string;
  globalPhotoPreview?: boolean;
  files?: File[];
  savedAt?: number;
  [key: string]: unknown;
};

function indexedDbFixture(drafts: Map<string, Draft>) {
  const db = {
    objectStoreNames: { contains: () => true },
    close() {},
    transaction(_store: string, _mode: string) {
      const transaction: {
        oncomplete?: () => void;
        onerror?: () => void;
        error?: Error;
        objectStore?: (name: string) => unknown;
      } = {};
      const objectStore = {
        get(key: string) {
          const req: { result?: Draft; onsuccess?: () => void; onerror?: () => void; error?: Error } = {};
          queueMicrotask(() => {
            req.result = drafts.get(key);
            req.onsuccess?.();
          });
          return req;
        },
        put(value: Draft, key: string) {
          queueMicrotask(() => {
            drafts.set(key, value);
            transaction.oncomplete?.();
          });
        },
        delete(key: string) {
          queueMicrotask(() => {
            drafts.delete(key);
            transaction.oncomplete?.();
          });
        },
      };
      transaction.objectStore = () => objectStore;
      return transaction;
    },
  };
  return {
    open() {
      const req: { result?: typeof db; onsuccess?: () => void; onerror?: () => void; error?: Error } = {};
      queueMicrotask(() => { req.result = db; req.onsuccess?.(); });
      return req;
    },
  };
}

function cameraFixture(drafts: Map<string, Draft>, userId: string, pathname = "/ja/learn/field-loop") {
  let currentUserId = userId;
  const html = patchGlobalRecordSourceChoiceHtml(renderSiteDocument({
    basePath: "",
    title: "Capture preview",
    body: "<p>Fixture</p>",
    lang: "ja",
    currentPath: pathname,
  }));
  const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
    .map((match) => match[1]!).find((value) => value.includes("const CAMERA_START_TIMEOUT_MS"));
  assert.ok(script);
  const elements = new Map<string, Element>();
  const node = (selector: string, attr?: string, value?: string) => {
    const result = new Element();
    if (attr) result.setAttribute(attr, value || "");
    elements.set(selector, result);
    return result;
  };
  const sheet = node("[data-global-record-camera-sheet]");
  const backdrop = node("[data-global-record-camera-close].global-record-camera-backdrop");
  node("[data-global-record-camera-status]");
  node("[data-global-record-camera-empty]");
  node("[data-global-record-camera-start]");
  const submit = node("[data-global-record-camera-capture]");
  const input = node('[data-global-record-input="photo"]', "data-global-record-input", "photo");
  const trigger = node('[data-global-record-trigger="photo"]', "data-global-record-trigger", "photo");
  const close = node("[data-global-record-camera-cancel]");
  const photoGrid = node("[data-global-record-photo-grid]");
  sheet.hidden = backdrop.hidden = submit.hidden = true;
  const document = {
    documentElement: Object.assign(new Element(), { lang: "ja" }),
    querySelector: (selector: string) => elements.get(selector) ?? null,
    querySelectorAll(selector: string) {
      if (selector === "[data-global-record-trigger]") return [trigger];
      if (selector === "[data-global-record-input]") return [input];
      if (selector === "[data-global-record-camera-close]") return [close];
      return [];
    },
    addEventListener() {},
    createElement: () => new Element(),
  };
  const location = { pathname, search: "", origin: "https://fixture.invalid" };
  const window = {
    location,
    indexedDB: indexedDbFixture(drafts),
    isSecureContext: true,
    innerWidth: 390,
    innerHeight: 844,
    addEventListener() {},
  };
  runInNewContext(script, {
    window,
    document,
    location,
    indexedDB: window.indexedDB,
    Blob,
    File,
    URL,
    navigator: {},
    setTimeout,
    clearTimeout,
    fetch: async (url: string) => {
      if (url === "/api/v1/auth/session") return {
        ok: true,
        json: async () => ({ ok: true, session: { userId: currentUserId } }),
      };
      if (url === "/api/v1/ui-kpi/events") return { ok: true };
      throw new Error("Unexpected network call: " + url);
    },
  });
  return { sheet, submit, input, trigger, close, photoGrid,
    switchUserId(nextUserId: string) { currentUserId = nextUserId; },
  };
}

async function drain() {
  for (let i = 0; i < 15; i += 1) await new Promise<void>((resolve) => setImmediate(resolve));
}

test("global photo preview persists before upload, survives page reload and stays owner-scoped", async () => {
  const drafts = new Map<string, Draft>();
  const first = cameraFixture(drafts, "owner-A");
  first.input.files = [new File(["fixture-image"], "one.jpg", { type: "image/jpeg" })];
  first.input.dispatch("change");
  await drain();

  const saved = drafts.get("latest:user:owner-A");
  assert.ok(saved, "photo must be durable before submitting a Record");
  assert.equal(saved?.globalPhotoPreview, true);
  assert.equal(saved?.ownerKey, "user:owner-A");
  assert.equal(saved?.files?.length, 1);
  assert.equal(saved?.files?.[0]?.name, "one.jpg");

  const differentPage = cameraFixture(drafts, "owner-A", "/ja/map");
  await drain();
  assert.equal(differentPage.sheet.hidden, true, "navigation does not interrupt another screen");

  const differentOwner = cameraFixture(drafts, "owner-B");
  await drain();
  assert.equal(differentOwner.sheet.hidden, true, "other accounts cannot restore this preview");

  const restored = cameraFixture(drafts, "owner-A");
  await drain();
  assert.equal(restored.sheet.hidden, false, "same owner's preview is reopened");
  assert.equal(restored.submit.hidden, false, "recovered photo can be submitted");

  restored.close.click();
  await drain();
  assert.equal(drafts.has("latest:user:owner-A"), false, "explicit discard removes preview bytes");
});

test("a persisted preview whose ownerKey disagrees with the scoped key is rejected", async () => {
  const drafts = new Map<string, Draft>();
  drafts.set("latest:user:owner-B", {
    ownerKey: "user:owner-A",
    kind: "photo",
    globalPhotoPreview: true,
    savedAt: Date.now(),
    files: [new File(["not-yours"], "foreign.jpg", { type: "image/jpeg" })],
  });
  const browser = cameraFixture(drafts, "owner-B");
  await drain();
  assert.equal(browser.sheet.hidden, true);
});

test("completed preview tombstones and stale drafts do not reopen", async () => {
  const drafts = new Map<string, Draft>();
  const valid = {
    ownerKey: "user:owner-A",
    kind: "photo",
    globalPhotoPreview: true,
    savedAt: Date.now(),
    files: [new File(["image"], "one.jpg", { type: "image/jpeg" })],
  };
  drafts.set("latest:user:owner-A", { ...valid, previewCompleted: true });
  const complete = cameraFixture(drafts, "owner-A");
  await drain();
  assert.equal(complete.sheet.hidden, true);
  drafts.set("latest:user:owner-A", { ...valid, savedAt: Date.now() - 8 * 86400000 });
  const stale = cameraFixture(drafts, "owner-A");
  await drain();
  assert.equal(stale.sheet.hidden, true);
});

test("account changes cannot write a prior user's photo into the next user's draft", async () => {
  const drafts = new Map<string, Draft>();
  const browser = cameraFixture(drafts, "owner-A");
  browser.input.files = [new File(["first"], "one.jpg", { type: "image/jpeg" })];
  browser.input.dispatch("change");
  await drain();
  assert.equal(drafts.get("latest:user:owner-A")?.files?.length, 1);

  browser.switchUserId("owner-B");
  browser.input.files = [new File(["second"], "two.jpg", { type: "image/jpeg" })];
  browser.input.dispatch("change");
  await drain();
  assert.equal(drafts.has("latest:user:owner-B"), false, "the next owner's key must never receive prior bytes");
  assert.equal(drafts.get("latest:user:owner-A")?.files?.length, 1, "the original owner's draft remains intact");
});
