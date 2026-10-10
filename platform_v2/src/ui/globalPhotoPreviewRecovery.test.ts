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

type CameraFixtureOptions = {
  confirm?: (message: string) => boolean;
  fetch?: (url: string, init?: { method?: string; body?: string }) => Promise<{ ok: boolean; status?: number; json: () => Promise<unknown> }>;
};

function cameraFixture(drafts: Map<string, Draft>, userId: string, pathname = "/ja/learn/field-loop", options: CameraFixtureOptions = {}) {
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
    crypto: webcrypto,
    confirm: options.confirm ?? (() => true),
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
    FileReader: FixtureFileReader,
    TextEncoder,
    URL,
    navigator: { geolocation: { getCurrentPosition(success: (position: unknown) => void) {
      success({ coords: { latitude: 34.7, longitude: 137.8, accuracy: 12 } });
    } } },
    setTimeout,
    clearTimeout,
    fetch: async (url: string, init?: { method?: string; body?: string }) => {
      if (url === "/api/v1/auth/session") return {
        ok: true,
        json: async () => ({ ok: true, session: { userId: currentUserId } }),
      };
      if (url === "/api/v1/ui-kpi/events") return { ok: true };
      if (options.fetch) return options.fetch(url, init);
      throw new Error("Unexpected network call: " + url);
    },
  });
  return { sheet, submit, input, trigger, close, photoGrid, status,
    switchUserId(nextUserId: string) { currentUserId = nextUserId; },
  };
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

  const saved = drafts.get("global-photo-preview:latest:user:owner-A");
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

  let confirmMessage = "";
  const restored = cameraFixture(drafts, "owner-A", "/ja/learn/field-loop", { confirm: (message) => { confirmMessage = message; return true; } });
  await drain();
  assert.equal(restored.sheet.hidden, false, "same owner's preview is reopened");
  assert.equal(restored.submit.hidden, false, "recovered photo can be submitted");

  restored.close.click();
  await drain();
  assert.match(confirmMessage, /写真/);
  assert.equal(drafts.has("global-photo-preview:latest:user:owner-A"), false, "explicit discard removes preview bytes");
  assert.equal(drafts.get("latest:user:owner-A")?.files?.[0]?.name, "record.jpg", "discard leaves the existing /record draft intact");
});

test("lost Record and photo responses recover the same submission and same media without duplicates", async () => {
  const drafts = new Map<string, Draft>();
  const server = recoveryServer();
  const first = cameraFixture(drafts, "owner-A", "/ja/learn/field-loop", { fetch: server.fetch });
  first.input.files = [new File(["fixture-image-bytes"], "capture.gif", { type: "image/gif" })];
  first.input.dispatch("change");
  await drain();
  assert.ok(drafts.has("global-photo-preview:latest:user:owner-A"), "bytes are persisted before the first request");

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
  assert.equal(drafts.get("global-photo-preview:latest:user:owner-A")?.retryVisitId, "visit-1");

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
  assert.equal(drafts.has("global-photo-preview:latest:user:owner-A"), false, "confirmed success retires the local recovery draft");
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
  assert.equal(drafts.has("global-photo-preview:latest:user:owner-A"), true, "the durable preview remains available");
});

test("a persisted preview whose ownerKey disagrees with the scoped key is rejected", async () => {
  const drafts = new Map<string, Draft>();
  drafts.set("global-photo-preview:latest:user:owner-B", {
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
  drafts.set("global-photo-preview:latest:user:owner-A", { ...valid, previewCompleted: true });
  const complete = cameraFixture(drafts, "owner-A");
  await drain();
  assert.equal(complete.sheet.hidden, true);
  drafts.set("global-photo-preview:latest:user:owner-A", { ...valid, savedAt: Date.now() - 8 * 86400000 });
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
  assert.equal(drafts.get("global-photo-preview:latest:user:owner-A")?.files?.length, 1);

  browser.switchUserId("owner-B");
  browser.input.files = [new File(["second"], "two.jpg", { type: "image/jpeg" })];
  browser.input.dispatch("change");
  await drain();
  assert.equal(drafts.has("global-photo-preview:latest:user:owner-B"), false, "the next owner's key must never receive prior bytes");
  assert.equal(drafts.get("global-photo-preview:latest:user:owner-A")?.files?.length, 1, "the original owner's draft remains intact");
});
