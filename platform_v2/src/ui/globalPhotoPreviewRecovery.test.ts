import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { webcrypto } from "node:crypto";
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
  listeners = new Map<string, Array<(event?: { preventDefault?: () => void }) => void>>();
  classList = { add() {}, remove() {} };
  style = { setProperty() {}, removeProperty() {} };
  videoWidth = 1280;
  videoHeight = 960;
  srcObject: unknown = null;
  muted = false;
  playsInline = false;
  controls = false;
  loop = false;
  toBlob?: (callback: (blob: Blob | null) => void) => void;
  getContext() { return { drawImage() {} }; }
  play() { return Promise.resolve(); }
  pause() {}
  load() {}
  setAttribute(key: string, value: string) { this.attributes.set(key, value); }
  getAttribute(key: string) { return this.attributes.get(key) ?? null; }
  removeAttribute(key: string) { this.attributes.delete(key); }
  addEventListener(event: string, fn: (event?: { preventDefault?: () => void }) => void) {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), fn]);
  }
  dispatch(event: string) {
    const payload = { preventDefault() {} };
    for (const handler of this.listeners.get(event) ?? []) handler(payload);
  }
  click() { this.dispatch("click"); }
  appendChild(_child: Element) {}
}

class FixtureFileReader {
  result: string | null = null;
  error: Error | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readAsDataURL(file: File) {
    void file.arrayBuffer().then((bytes) => {
      this.result = `data:${file.type};base64,${Buffer.from(bytes).toString("base64")}`;
      this.onload?.();
    }, (error: unknown) => {
      this.error = error instanceof Error ? error : new Error("file_read_failed");
      this.onerror?.();
    });
  }
}

type Draft = {
  ownerKey: string;
  kind: string;
  globalPhotoPreview?: boolean;
  files?: File[];
  savedAt?: number;
  [key: string]: unknown;
};

function indexedDbFixture(
  drafts: Map<string, Draft>,
  shouldFailDelete: () => boolean = () => false,
  deferFirstGet = false,
) {
  let shouldDeferGet = deferFirstGet;
  let pendingGet: (() => void) | null = null;
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
          const complete = () => {
            req.result = drafts.get(key);
            req.onsuccess?.();
          };
          if (shouldDeferGet) {
            shouldDeferGet = false;
            pendingGet = complete;
          } else queueMicrotask(complete);
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
            if (shouldFailDelete()) {
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
    completePendingGet() {
      const complete = pendingGet;
      pendingGet = null;
      assert.ok(complete, "an IndexedDB get is pending");
      complete();
    },
  };
}

type CameraFixtureOptions = {
  confirm?: (message: string) => boolean;
  fetch?: (url: string, init?: { method?: string; body?: string }) => Promise<{ ok: boolean; status?: number; json: () => Promise<unknown> }>;
  session?: "user" | "guest" | "unavailable";
  deleteFailures?: number;
  deferCanvasBlob?: boolean;
  deferDraftRead?: boolean;
};

function cameraFixture(drafts: Map<string, Draft>, userId: string, pathname = "/ja/learn/field-loop", options: CameraFixtureOptions = {}) {
  let currentUserId = userId;
  let currentSession: NonNullable<CameraFixtureOptions["session"]> = options.session ?? "user";
  let deleteFailures = options.deleteFailures ?? 0;
  let pendingCanvasBlob: ((blob: Blob | null) => void) | null = null;
  const sessionStorageValues = new Map<string, string>();
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
  const cameraErrorBody = node("[data-global-record-camera-error-body]");
  node("[data-global-record-camera-empty]");
  const start = node("[data-global-record-camera-start]");
  node("[data-global-record-camera-video]");
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
    createElement: (tagName: string) => {
      const element = new Element();
      if (tagName === "canvas") {
        element.toBlob = (callback) => {
          if (options.deferCanvasBlob) pendingCanvasBlob = callback;
          else callback(new Blob(["fixture-camera-image"], { type: "image/jpeg" }));
        };
      }
      return element;
    },
  };
  const location = { pathname, search: "", origin: "https://fixture.invalid" };
  const shouldFailDelete = () => {
    if (deleteFailures <= 0) return false;
    deleteFailures -= 1;
    return true;
  };
  const indexedDB = indexedDbFixture(drafts, shouldFailDelete, options.deferDraftRead);
  const window = {
    location,
    indexedDB,
    crypto: webcrypto,
    confirm: options.confirm ?? (() => true),
    isSecureContext: true,
    innerWidth: 390,
    innerHeight: 844,
    addEventListener() {},
  };
  const sessionStorage = {
    getItem(key: string) { return sessionStorageValues.get(key) ?? null; },
    setItem(key: string, value: string) { sessionStorageValues.set(key, String(value)); },
  };
  const track = { stop() {}, getCapabilities() { return { focusMode: ["continuous"] }; }, getSettings() { return {}; } };
  const stream = { getTracks() { return [track]; }, getVideoTracks() { return [track]; } };
  runInNewContext(script, {
    window,
    document,
    location,
    indexedDB: window.indexedDB,
    sessionStorage,
    Blob,
    File,
    FileReader: FixtureFileReader,
    TextEncoder,
    URL,
    navigator: {
      mediaDevices: { getUserMedia: async () => stream },
      geolocation: { getCurrentPosition(success: (position: unknown) => void) {
        success({ coords: { latitude: 34.7, longitude: 137.8, accuracy: 12 } });
      } },
    },
    setTimeout,
    clearTimeout,
    fetch: async (url: string, init?: { method?: string; body?: string }) => {
      if (url.startsWith("/api/v1/auth/session")) {
        if (currentSession === "unavailable") throw new Error("session_check_network_failure");
        if (currentSession === "guest") return {
          ok: true,
          json: async () => ({ ok: false, error: "session_not_found", session: null }),
        };
        const requestUserId = currentUserId;
        return { ok: true, json: async () => ({ ok: true, session: { userId: requestUserId } }) };
      }
      if (url === "/api/v1/ui-kpi/events") return { ok: true };
      if (options.fetch) return options.fetch(url, init);
      throw new Error("Unexpected network call: " + url);
    },
  });
  return { sheet, submit, input, trigger, close, start, photoGrid, status, cameraErrorBody,
    resolveCanvasBlob(blob: Blob | null) {
      const callback = pendingCanvasBlob;
      pendingCanvasBlob = null;
      assert.ok(callback, "a delayed canvas blob callback is pending");
      callback(blob);
    },
    resolveDraftRead() { indexedDB.completePendingGet(); },
    switchUserId(nextUserId: string) { currentUserId = nextUserId; currentSession = "user"; },
    switchToGuest() { currentSession = "guest"; },
    navigateToPath(nextPath: string) { location.pathname = nextPath; },
  };
}

function photoPreviewKey(ownerId: string, pagePath: string) {
  return `global-photo-preview:latest:user:${ownerId}:page:${encodeURIComponent(pagePath)}`;
}

async function drain() {
  for (let i = 0; i < 40; i += 1) await new Promise<void>((resolve) => setImmediate(resolve));
  // WebCrypto digest and FileReader callbacks are host tasks, not only microtasks.
  await new Promise<void>((resolve) => setTimeout(resolve, 25));
}

function recoveryServer() {
  const records = new Map<string, string>();
  const assets = new Map<string, string>();
  const upserts: string[] = [];
  const uploads: Array<{ visitId: string; base64Data: string }> = [];
  let loseFirstUpsertResponse = true;
  let loseFirstUploadResponse = true;
  const response = (status: number, payload: unknown) => ({ ok: status < 400, status, json: async () => payload });
  const fetch = async (url: string, init?: { method?: string; body?: string }) => {
    if (url === "/api/v1/observations/upsert") {
      const body = JSON.parse(init?.body || "{}") as { clientSubmissionId?: string };
      const submissionId = String(body.clientSubmissionId || "");
      upserts.push(submissionId);
      let visitId = records.get(submissionId);
      if (!visitId) {
        visitId = `visit-${records.size + 1}`;
        records.set(submissionId, visitId);
      }
      if (loseFirstUpsertResponse) {
        loseFirstUpsertResponse = false;
        throw new Error("network_lost_after_record_save");
      }
      return response(200, { ok: true, visitId, occurrenceIds: [`occ:${visitId}:0`] });
    }
    const uploadMatch = url.match(/^\/api\/v1\/observations\/([^/]+)\/photos\/upload$/);
    if (uploadMatch) {
      const body = JSON.parse(init?.body || "{}") as { base64Data?: string };
      const visitId = decodeURIComponent(uploadMatch[1]!);
      const base64Data = String(body.base64Data || "");
      uploads.push({ visitId, base64Data });
      const key = `${visitId}:${base64Data}`;
      if (!assets.has(key)) assets.set(key, visitId);
      if (loseFirstUploadResponse) {
        loseFirstUploadResponse = false;
        throw new Error("network_lost_after_media_save");
      }
      return response(200, { ok: true, visitId, idempotency: { reused: uploads.length > 1 } });
    }
    throw new Error("Unexpected network call: " + url);
  };
  return { fetch, records, assets, upserts, uploads };
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

  const fieldLoopKey = photoPreviewKey("owner-A", "/ja/learn/field-loop");
  const mapKey = photoPreviewKey("owner-A", "/ja/map");
  const saved = drafts.get(fieldLoopKey);
  assert.ok(saved, "photo must be durable before submitting a Record");
  assert.equal(saved?.globalPhotoPreview, true);
  assert.equal(saved?.ownerKey, "user:owner-A");
  assert.equal(saved?.files?.length, 1);
  assert.equal(saved?.files?.[0]?.name, "one.jpg");
  assert.equal(drafts.get("latest:user:owner-A")?.files?.[0]?.name, "record.jpg", "existing record draft is untouched");

  const differentPage = cameraFixture(drafts, "owner-A", "/ja/map");
  await drain();
  assert.equal(differentPage.sheet.hidden, true, "navigation does not interrupt another screen");
  differentPage.input.files = [new File(["map-image"], "map.jpg", { type: "image/jpeg" })];
  differentPage.input.dispatch("change");
  await drain();
  assert.equal(drafts.get(fieldLoopKey)?.files?.[0]?.name, "one.jpg", "another page cannot overwrite the original preview");
  assert.equal(drafts.get(mapKey)?.files?.[0]?.name, "map.jpg", "each page owns its own durable preview");

  const restoredMap = cameraFixture(drafts, "owner-A", "/ja/map");
  await drain();
  assert.equal(restoredMap.sheet.hidden, false, "the second page can restore its own preview");
  assert.equal(drafts.get(mapKey)?.files?.[0]?.name, "map.jpg", "the restored screen is bound to its page's photo draft");

  const differentOwner = cameraFixture(drafts, "owner-B");
  await drain();
  assert.equal(differentOwner.sheet.hidden, true, "other accounts cannot restore this preview");

  let confirmMessage = "";
  const restored = cameraFixture(drafts, "owner-A", "/ja/learn/field-loop", { confirm: (message) => { confirmMessage = message; return true; } });
  await drain();
  assert.equal(restored.sheet.hidden, false, "same owner's preview is reopened");
  assert.equal(restored.submit.hidden, false, "recovered photo can be submitted");

  restored.close.click();
  await drain();
  assert.match(confirmMessage, /写真/);
  assert.equal(drafts.has(fieldLoopKey), false, "explicit discard removes this page's preview bytes");
  assert.equal(drafts.has(mapKey), true, "discard on one page preserves the other page's preview");
  assert.equal(drafts.get("latest:user:owner-A")?.files?.[0]?.name, "record.jpg", "discard leaves the existing /record draft intact");
});

test("preview writes require an explicit guest session result when auth lookup is unavailable", async () => {
  const unavailableDrafts = new Map<string, Draft>();
  const unavailable = cameraFixture(unavailableDrafts, "owner-A", "/ja/learn/field-loop", { session: "unavailable" });
  unavailable.input.files = [new File(["image"], "private.jpg", { type: "image/jpeg" })];
  unavailable.input.dispatch("change");
  await drain();
  assert.equal(unavailableDrafts.size, 0, "a network/auth failure must not silently re-scope bytes to a guest key");
  assert.match(unavailable.status.textContent, /保存に失敗/);

  const guestDrafts = new Map<string, Draft>();
  const guest = cameraFixture(guestDrafts, "", "/ja/learn/field-loop", { session: "guest" });
  guest.input.files = [new File(["guest-image"], "guest.jpg", { type: "image/jpeg" })];
  guest.input.dispatch("change");
  await drain();
  const guestEntry = [...guestDrafts.entries()].find(([key]) => key.startsWith("global-photo-preview:latest:guest:"));
  assert.ok(guestEntry, "only a positively confirmed missing session may use guest storage");
  assert.equal(guestEntry?.[1].ownerKey.startsWith("guest:"), true);
});

test("cancel reports an IndexedDB delete failure and keeps the selected preview available for retry", async () => {
  const drafts = new Map<string, Draft>();
  const browser = cameraFixture(drafts, "owner-A", "/ja/learn/field-loop", { deleteFailures: 1 });
  browser.input.files = [new File(["keep-until-delete"], "keep.jpg", { type: "image/jpeg" })];
  browser.input.dispatch("change");
  await drain();
  const key = photoPreviewKey("owner-A", "/ja/learn/field-loop");

  browser.close.click();
  await drain();
  assert.equal(browser.sheet.hidden, false, "the sheet stays open if durable deletion fails");
  assert.match(browser.status.textContent, /削除できませんでした/);
  assert.equal(drafts.has(key), true, "the preview remains present until deletion succeeds");

  browser.close.click();
  await drain();
  assert.equal(browser.sheet.hidden, true, "retrying cancel closes only after deletion succeeds");
  assert.equal(drafts.has(key), false);
});

test("cancel does not delete or hide an existing preview when the session check is offline", async () => {
  const drafts = new Map<string, Draft>();
  const key = photoPreviewKey("owner-A", "/ja/learn/field-loop");
  const original = new File(["saved-before-offline"], "saved.jpg", { type: "image/jpeg" });
  drafts.set(key, {
    ownerKey: "user:owner-A",
    kind: "photo",
    globalPhotoPreview: true,
    savedAt: Date.now(),
    capturePagePath: "/ja/learn/field-loop",
    files: [original],
  });
  const browser = cameraFixture(drafts, "owner-A", "/ja/learn/field-loop", { session: "unavailable" });
  await drain();
  browser.input.files = [new File(["new-selection"], "new.jpg", { type: "image/jpeg" })];
  browser.input.dispatch("change");
  await drain();

  browser.close.click();
  await drain();
  assert.equal(browser.sheet.hidden, false, "auth lookup failure leaves the user on the preview screen");
  assert.match(browser.status.textContent, /削除できませんでした/);
  assert.equal(drafts.get(key)?.files?.[0]?.name, "saved.jpg", "offline auth must not redirect deletion to a guest key");
});

test("a delayed camera blob callback after cancel cannot recreate a discarded preview", async () => {
  const drafts = new Map<string, Draft>();
  const browser = cameraFixture(drafts, "owner-A", "/ja/learn/field-loop", { deferCanvasBlob: true });
  browser.trigger.click();
  browser.start.click();
  await drain();
  assert.equal(browser.submit.hidden, false, `the camera fixture reaches capture state (${browser.status.textContent}; ${browser.cameraErrorBody.textContent})`);
  browser.submit.click();
  browser.close.click();
  await drain();
  browser.resolveCanvasBlob(new Blob(["late-camera-image"], { type: "image/jpeg" }));
  await drain();
  assert.equal(browser.sheet.hidden, true);
  assert.equal(drafts.size, 0, "stale canvas completion cannot add or persist a photo after close");
});

test("a camera blob is discarded if the authenticated owner changes before encoding finishes", async () => {
  const drafts = new Map<string, Draft>();
  const browser = cameraFixture(drafts, "owner-A", "/ja/learn/field-loop", { deferCanvasBlob: true });
  browser.trigger.click();
  browser.start.click();
  await drain();
  browser.submit.click();
  browser.switchUserId("owner-B");
  browser.resolveCanvasBlob(new Blob(["wrong-owner-image"], { type: "image/jpeg" }));
  await drain();
  assert.equal(drafts.size, 0, `neither the prior nor the next user's preview receives a cross-account capture: ${[...drafts.keys()].join(",")}`);
  assert.match(browser.status.textContent, /アカウントが切り替わりました/);
});

test("a successful upload followed by delete failure starts a fresh submission after cancel", async () => {
  const drafts = new Map<string, Draft>();
  const upserts: string[] = [];
  const uploads: string[] = [];
  const response = (payload: unknown) => ({ ok: true, status: 200, json: async () => payload });
  const fetch = async (url: string, init?: { method?: string; body?: string }) => {
    if (url === "/api/v1/observations/upsert") {
      upserts.push(String(JSON.parse(init?.body || "{}").clientSubmissionId || ""));
      return response({ ok: true, visitId: `visit-${upserts.length}`, occurrenceIds: [`occ:visit-${upserts.length}:0`] });
    }
    const match = url.match(/^\/api\/v1\/observations\/([^/]+)\/photos\/upload$/);
    if (match) {
      uploads.push(decodeURIComponent(match[1]!));
      return response({ ok: true });
    }
    throw new Error("Unexpected network call: " + url);
  };
  const browser = cameraFixture(drafts, "owner-A", "/ja/learn/field-loop", { fetch, deleteFailures: 1 });
  browser.input.files = [new File(["saved-photo"], "saved.jpg", { type: "image/jpeg" })];
  browser.input.dispatch("change");
  await drain();
  browser.submit.click();
  await drain();
  assert.deepEqual(upserts.length, 1);
  assert.deepEqual(uploads, ["visit-1"]);
  assert.match(browser.status.textContent, /削除だけ失敗/);
  assert.equal(drafts.get(photoPreviewKey("owner-A", "/ja/learn/field-loop"))?.previewCompleted, true);

  browser.close.click();
  await drain();
  assert.equal(browser.sheet.hidden, true, "closing retries cleanup of the already-saved preview");
  assert.equal(drafts.has(photoPreviewKey("owner-A", "/ja/learn/field-loop")), false);

  browser.input.files = [new File(["new-photo"], "new.jpg", { type: "image/jpeg" })];
  browser.input.dispatch("change");
  await drain();
  browser.submit.click();
  await drain();
  assert.equal(upserts.length, 2, "the next photo performs a new Record upsert");
  assert.deepEqual(uploads, ["visit-1", "visit-2"], "the next photo is uploaded instead of cleanup-only handling");
});

test("lost Record and photo responses recover the same submission and same media without duplicates", async () => {
  const drafts = new Map<string, Draft>();
  const server = recoveryServer();
  const first = cameraFixture(drafts, "owner-A", "/ja/learn/field-loop", { fetch: server.fetch });
  first.input.files = [new File(["fixture-image-bytes"], "capture.gif", { type: "image/gif" })];
  first.input.dispatch("change");
  await drain();
  const previewKey = photoPreviewKey("owner-A", "/ja/learn/field-loop");
  assert.ok(drafts.has(previewKey), "bytes are persisted before the first request");

  first.submit.click();
  first.submit.click();
  await drain();
  assert.equal(server.records.size, 1, "an accepted upsert with a lost response is one logical Record");
  assert.equal(server.upserts.length, 1, "repeated taps while pending do not start a second request");
  assert.equal(server.uploads.length, 0, "the first response was lost before media upload began");

  const afterRecordResponseLoss = cameraFixture(drafts, "owner-A", "/ja/learn/field-loop", { fetch: server.fetch });
  await drain();
  assert.equal(afterRecordResponseLoss.sheet.hidden, false);
  afterRecordResponseLoss.submit.click();
  await drain();
  assert.equal(server.records.size, 1, "retry reuses the client submission id after reload");
  assert.equal(server.upserts.length, 2, afterRecordResponseLoss.status.textContent);
  assert.equal(server.uploads.length, 1);
  assert.equal(server.assets.size, 1, "the first photo response was lost after the server accepted it");
  assert.equal(drafts.get(previewKey)?.retryVisitId, "visit-1");

  const afterPhotoResponseLoss = cameraFixture(drafts, "owner-A", "/ja/learn/field-loop", { fetch: server.fetch });
  await drain();
  assert.equal(afterPhotoResponseLoss.sheet.hidden, false);
  afterPhotoResponseLoss.submit.click();
  await drain();
  assert.equal(server.records.size, 1);
  assert.equal(server.upserts.length, 2, "a known Record target avoids a fresh upsert");
  assert.equal(server.uploads.length, 2, "same media is replayed once to retrieve the saved response");
  assert.equal(server.uploads[0]?.visitId, server.uploads[1]?.visitId);
  assert.equal(server.uploads[0]?.base64Data, server.uploads[1]?.base64Data);
  assert.equal(server.assets.size, 1, "replaying a saved photo does not create a duplicate asset");
  assert.equal(drafts.has(previewKey), false, "confirmed success retires the local recovery draft");
  assert.equal(afterPhotoResponseLoss.submit.hidden, true, "saved media returns the capture action to its idle state");
});

test("cancel keeps an in-progress preview when the user declines discard", async () => {
  const drafts = new Map<string, Draft>();
  const browser = cameraFixture(drafts, "owner-A", "/ja/learn/field-loop", { confirm: () => false });
  browser.input.files = [new File(["keep-me"], "keep.jpg", { type: "image/jpeg" })];
  browser.input.dispatch("change");
  await drain();
  browser.close.click();
  await drain();
  assert.equal(browser.sheet.hidden, false, "declining discard leaves the preview open");
  assert.equal(drafts.has(photoPreviewKey("owner-A", "/ja/learn/field-loop")), true, "the durable preview remains available");
});

test("a persisted preview whose ownerKey disagrees with the scoped key is rejected", async () => {
  const drafts = new Map<string, Draft>();
  drafts.set(photoPreviewKey("owner-B", "/ja/learn/field-loop"), {
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
  drafts.set(photoPreviewKey("owner-A", "/ja/learn/field-loop"), { ...valid, previewCompleted: true });
  const complete = cameraFixture(drafts, "owner-A");
  await drain();
  assert.equal(complete.sheet.hidden, true);
  drafts.set(photoPreviewKey("owner-A", "/ja/learn/field-loop"), { ...valid, savedAt: Date.now() - 8 * 86400000 });
  const stale = cameraFixture(drafts, "owner-A");
  await drain();
  assert.equal(stale.sheet.hidden, true);
});

test("preview restore is abandoned if the authenticated owner changes during the IndexedDB read", async () => {
  const drafts = new Map<string, Draft>();
  const pagePath = "/ja/learn/field-loop";
  const key = photoPreviewKey("owner-A", pagePath);
  drafts.set(key, {
    ownerKey: "user:owner-A",
    kind: "photo",
    globalPhotoPreview: true,
    savedAt: Date.now(),
    capturePagePath: pagePath,
    files: [new File(["owner-A-photo"], "owner-A.jpg", { type: "image/jpeg" })],
  });
  const browser = cameraFixture(drafts, "owner-A", pagePath, { deferDraftRead: true });
  await drain();
  browser.switchUserId("owner-B");
  browser.resolveDraftRead();
  await drain();

  assert.equal(browser.sheet.hidden, true, "a stale owner read cannot reopen the global capture sheet");
  assert.equal(drafts.has(key), true, "the original user's preview remains in its own key");
});

test("preview restore is abandoned if the session becomes a guest during the IndexedDB read", async () => {
  const drafts = new Map<string, Draft>();
  const pagePath = "/ja/learn/field-loop";
  const key = photoPreviewKey("owner-A", pagePath);
  drafts.set(key, {
    ownerKey: "user:owner-A",
    kind: "photo",
    globalPhotoPreview: true,
    savedAt: Date.now(),
    capturePagePath: pagePath,
    files: [new File(["private-photo"], "private.jpg", { type: "image/jpeg" })],
  });
  const browser = cameraFixture(drafts, "owner-A", pagePath, { deferDraftRead: true });
  await drain();
  browser.switchToGuest();
  browser.resolveDraftRead();
  await drain();

  assert.equal(browser.sheet.hidden, true, "an explicit logout while reading prevents private photos from rendering");
  assert.equal(drafts.has(key), true, "the former user's preview is neither revealed nor removed");
});

test("preview restore is abandoned if the page changes during the IndexedDB read", async () => {
  const drafts = new Map<string, Draft>();
  const pagePath = "/ja/learn/field-loop";
  drafts.set(photoPreviewKey("owner-A", pagePath), {
    ownerKey: "user:owner-A",
    kind: "photo",
    globalPhotoPreview: true,
    savedAt: Date.now(),
    capturePagePath: pagePath,
    files: [new File(["page-photo"], "page.jpg", { type: "image/jpeg" })],
  });
  const browser = cameraFixture(drafts, "owner-A", pagePath, { deferDraftRead: true });
  await drain();
  browser.navigateToPath("/ja/map");
  browser.resolveDraftRead();
  await drain();
  assert.equal(browser.sheet.hidden, true, "a draft read started on one page cannot affect another page");
});

test("account changes cannot write a prior user's photo into the next user's draft", async () => {
  const drafts = new Map<string, Draft>();
  const browser = cameraFixture(drafts, "owner-A");
  browser.input.files = [new File(["first"], "one.jpg", { type: "image/jpeg" })];
  browser.input.dispatch("change");
  await drain();
  assert.equal(drafts.get(photoPreviewKey("owner-A", "/ja/learn/field-loop"))?.files?.length, 1);

  browser.switchUserId("owner-B");
  browser.input.files = [new File(["second"], "two.jpg", { type: "image/jpeg" })];
  browser.input.dispatch("change");
  await drain();
  assert.equal(drafts.has(photoPreviewKey("owner-B", "/ja/learn/field-loop")), false, "the next owner's key must never receive prior bytes");
  assert.equal(drafts.get(photoPreviewKey("owner-A", "/ja/learn/field-loop"))?.files?.length, 1, "the original owner's draft remains intact");
});
