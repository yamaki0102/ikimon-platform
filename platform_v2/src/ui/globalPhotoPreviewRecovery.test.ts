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
  listeners = new Map<string, Array<(event?: unknown) => void>>();
  classList = { add() {}, remove() {} };
  style = { setProperty() {}, removeProperty() {} };
  setAttribute(key: string, value: string) { this.attributes.set(key, value); }
  getAttribute(key: string) { return this.attributes.get(key) ?? null; }
  removeAttribute(key: string) { this.attributes.delete(key); }
  addEventListener(event: string, fn: (event?: unknown) => void) {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), fn]);
  }
  dispatch(event: string, target: Element = this) {
    for (const handler of this.listeners.get(event) ?? []) handler({ preventDefault() {}, target } as never);
  }
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

function previewKey(userId: string, pathname = "/ja/learn/field-loop") {
  return "global-photo-preview:latest:user:" + userId + ":" + encodeURIComponent(pathname || "/");
}

function indexedDbFixture(drafts: Map<string, Draft>, options: { failDelete?: boolean } = {}) {
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
            if (options.failDelete) {
              transaction.error = new Error("indexeddb_delete_failed");
              transaction.onerror?.();
              return;
            }
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

function cameraFixture(
  drafts: Map<string, Draft>,
  userId: string,
  pathname = "/ja/learn/field-loop",
  options: { failDelete?: boolean } = {},
) {
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
  const status = node("[data-global-record-camera-status]");
  node("[data-global-record-camera-empty]");
  node("[data-global-record-camera-start]");
  const submit = node("[data-global-record-camera-capture]");
  const input = node('[data-global-record-input="photo"]', "data-global-record-input", "photo");
  const trigger = node('[data-global-record-trigger="photo"]', "data-global-record-trigger", "photo");
  const close = node("[data-global-record-camera-cancel]");
  const photoTrayCount = node("[data-global-record-photo-tray-count]");
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
    indexedDB: indexedDbFixture(drafts, options),
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
    HTMLElement: Element,
    URL,
    navigator: {},
    setTimeout,
    clearTimeout,
    fetch: async (url: string) => {
      const requestUserId = currentUserId;
      if (url === "/api/v1/auth/session") return {
        ok: true,
        json: async () => ({ ok: true, session: { userId: requestUserId } }),
      };
      if (url === "/api/v1/ui-kpi/events") return { ok: true };
      throw new Error("Unexpected network call: " + url);
    },
  });
  return { sheet, submit, input, trigger, close, photoGrid, photoTrayCount, status,
    switchUserId(nextUserId: string) { currentUserId = nextUserId; },
  };
}

async function drain() {
  for (let i = 0; i < 15; i += 1) await new Promise<void>((resolve) => setImmediate(resolve));
}

test("global photo preview persists before upload, survives page reload and stays owner-scoped", async () => {
  const drafts = new Map<string, Draft>();
  // Existing /record draft lives under the original key and must never be replaced.
  drafts.set("latest:user:owner-A", {
    ownerKey: "user:owner-A",
    kind: "photo",
    savedAt: Date.now(),
    files: [new File(["existing-record"], "record.jpg", { type: "image/jpeg" })],
  });
  const first = cameraFixture(drafts, "owner-A");
  first.input.files = [new File(["fixture-image"], "one.jpg", { type: "image/jpeg" })];
  first.input.dispatch("change");
  await drain();

  const saved = drafts.get(previewKey("owner-A"));
  assert.ok(saved, "photo must be durable before submitting a Record");
  assert.equal(saved?.globalPhotoPreview, true);
  assert.equal(saved?.ownerKey, "user:owner-A");
  assert.equal(saved?.files?.length, 1);
  assert.equal(saved?.files?.[0]?.name, "one.jpg");
  assert.equal(drafts.get("latest:user:owner-A")?.files?.[0]?.name, "record.jpg", "existing record draft is untouched");

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
  assert.equal(drafts.has(previewKey("owner-A")), false, "explicit discard removes preview bytes");
  assert.equal(drafts.get("latest:user:owner-A")?.files?.[0]?.name, "record.jpg", "discard leaves the existing /record draft intact");
});

test("a persisted preview whose ownerKey disagrees with the scoped key is rejected", async () => {
  const drafts = new Map<string, Draft>();
  drafts.set(previewKey("owner-B"), {
    ownerKey: "user:owner-A",
    kind: "photo",
    globalPhotoPreview: true,
    savedAt: Date.now(),
    capturePagePath: "/ja/learn/field-loop",
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
  drafts.set(previewKey("owner-A"), { ...valid, capturePagePath: "/ja/learn/field-loop", previewCompleted: true });
  const complete = cameraFixture(drafts, "owner-A");
  await drain();
  assert.equal(complete.sheet.hidden, true);
  drafts.set(previewKey("owner-A"), { ...valid, capturePagePath: "/ja/learn/field-loop", savedAt: Date.now() - 8 * 86400000 });
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
  assert.equal(drafts.get(previewKey("owner-A"))?.files?.length, 1);

  browser.switchUserId("owner-B");
  browser.input.files = [new File(["second"], "two.jpg", { type: "image/jpeg" })];
  browser.input.dispatch("change");
  await drain();
  assert.equal(drafts.has(previewKey("owner-B")), false, "the next owner's key must never receive prior bytes");
  assert.equal(drafts.get(previewKey("owner-A"))?.files?.length, 1, "the original owner's draft remains intact");
});

test("an account change before the first async write cannot reassign the captured photo", async () => {
  const drafts = new Map<string, Draft>();
  const browser = cameraFixture(drafts, "owner-A");
  await drain();
  browser.input.files = [new File(["captured-under-first-session"], "one.jpg", { type: "image/jpeg" })];
  browser.input.dispatch("change");
  browser.switchUserId("owner-B");
  await drain();

  assert.equal(drafts.has(previewKey("owner-B")), false, "a later account must never receive the photo");
  assert.equal(drafts.has(previewKey("owner-A")), false, "a changed session fails closed before the original write is confirmed");
});

test("closing an empty sheet releases a pending owner pin before the next account captures", async () => {
  const drafts = new Map<string, Draft>();
  const browser = cameraFixture(drafts, "owner-A");
  await drain();
  browser.trigger.click();
  browser.close.click();
  browser.switchUserId("owner-B");
  browser.trigger.click();
  browser.input.files = [new File(["second-owner"], "two.jpg", { type: "image/jpeg" })];
  browser.input.dispatch("change");
  await drain();

  assert.equal(drafts.has(previewKey("owner-A")), false, "the prior account's pending pin must not block or receive the new capture");
  assert.equal(drafts.get(previewKey("owner-B"))?.files?.[0]?.name, "two.jpg");
});

test("captures on another page keep both page-scoped previews without overwriting", async () => {
  const drafts = new Map<string, Draft>();
  const firstPage = cameraFixture(drafts, "owner-A", "/ja/learn/first");
  firstPage.input.files = [new File(["first-page"], "first.jpg", { type: "image/jpeg" })];
  firstPage.input.dispatch("change");
  await drain();

  const secondPage = cameraFixture(drafts, "owner-A", "/ja/learn/second");
  await drain();
  assert.equal(secondPage.sheet.hidden, true, "a pending preview on another page does not interrupt navigation");
  secondPage.input.files = [new File(["second-page"], "second.jpg", { type: "image/jpeg" })];
  secondPage.input.dispatch("change");
  await drain();

  const savedPreviews = [...drafts.values()].filter((draft) => draft.globalPhotoPreview === true);
  assert.equal(savedPreviews.length, 2, "each capture page keeps its own recovery slot");
  assert.deepEqual(savedPreviews.map((draft) => draft.capturePagePath).sort(), ["/ja/learn/first", "/ja/learn/second"]);
  assert.deepEqual(savedPreviews.map((draft) => draft.files?.[0]?.name).sort(), ["first.jpg", "second.jpg"]);

  const restoredFirst = cameraFixture(drafts, "owner-A", "/ja/learn/first");
  await drain();
  assert.equal(restoredFirst.sheet.hidden, false);
  const restoredSecond = cameraFixture(drafts, "owner-A", "/ja/learn/second");
  await drain();
  assert.equal(restoredSecond.sheet.hidden, false);
});

test("legacy owner-only previews restore only on their page and survive another page's capture", async () => {
  const drafts = new Map<string, Draft>();
  const legacyKey = "global-photo-preview:latest:user:owner-A";
  drafts.set(legacyKey, {
    ownerKey: "user:owner-A",
    kind: "photo",
    globalPhotoPreview: true,
    savedAt: Date.now(),
    capturePagePath: "/ja/learn/legacy-source",
    files: [new File(["legacy"], "legacy.jpg", { type: "image/jpeg" })],
  });

  const otherPage = cameraFixture(drafts, "owner-A", "/ja/learn/new-source");
  await drain();
  assert.equal(otherPage.sheet.hidden, true, "a legacy draft does not interrupt a different page");
  otherPage.input.files = [new File(["new"], "new.jpg", { type: "image/jpeg" })];
  otherPage.input.dispatch("change");
  await drain();

  assert.equal(drafts.get(legacyKey)?.files?.[0]?.name, "legacy.jpg", "the old page's stored image is not overwritten");
  assert.equal(drafts.get(previewKey("owner-A", "/ja/learn/new-source"))?.files?.[0]?.name, "new.jpg");
  const legacyPage = cameraFixture(drafts, "owner-A", "/ja/learn/legacy-source");
  await drain();
  assert.equal(legacyPage.sheet.hidden, false, "the original page can still recover the legacy image");
});

test("failed preview deletion keeps the sheet open and explains the failure", async () => {
  const drafts = new Map<string, Draft>();
  const browser = cameraFixture(drafts, "owner-A", "/ja/learn/field-loop", { failDelete: true });
  browser.input.files = [new File(["still-saved"], "saved.jpg", { type: "image/jpeg" })];
  browser.input.dispatch("change");
  await drain();

  browser.close.click();
  await drain();

  assert.equal(browser.sheet.hidden, false, "failed discard must not pretend the saved preview was closed");
  assert.match(browser.status.textContent, /削除に失敗|削除できません/);
  assert.equal([...drafts.values()].some((draft) => draft.globalPhotoPreview === true), true);
});

test("failed deletion while removing the last photo keeps it in the preview", async () => {
  const drafts = new Map<string, Draft>();
  const browser = cameraFixture(drafts, "owner-A", "/ja/learn/field-loop", { failDelete: true });
  browser.input.files = [new File(["still-saved"], "saved.jpg", { type: "image/jpeg" })];
  browser.input.dispatch("change");
  await drain();

  const removeButton = new Element();
  removeButton.setAttribute("data-global-record-photo-remove", "0");
  browser.photoGrid.dispatch("click", removeButton);
  await drain();

  assert.equal(browser.photoTrayCount.textContent, "写真1枚", "the still-persisted photo remains visible after deletion fails");
  assert.match(browser.status.textContent, /削除に失敗|削除できません/);
  assert.equal([...drafts.values()].some((draft) => draft.globalPhotoPreview === true), true);
});
