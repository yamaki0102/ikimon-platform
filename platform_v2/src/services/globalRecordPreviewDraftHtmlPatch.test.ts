import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import Fastify from "fastify";
import { renderSiteDocument } from "../ui/siteShell.js";
import { patchGlobalRecordPreviewDraftHtml, registerGlobalRecordPreviewDraftHtmlPatch } from "./globalRecordPreviewDraftHtmlPatch.js";

function realShell(): string {
  return renderSiteDocument({
    basePath: "",
    title: "ZUKAN preview draft recovery contract",
    body: "<main>fixture</main>",
    lang: "ja",
    currentPath: "/",
  });
}

function legacyShell(): string {
  // Exercise the fallback patch against a shell that predates native preview
  // persistence without changing the current renderer's active implementation.
  return realShell().replace(
    "const photoPreviewDraftKey = (owner) => 'global-photo-preview:'",
    "const legacyPhotoPreviewDraftKey = (owner) => 'global-photo-preview:'",
  );
}

function previewRuntime(options: { candidate?: Record<string, unknown>; ownerKey?: string } = {}) {
  const html = patchGlobalRecordPreviewDraftHtml(legacyShell());
  const start = html.indexOf("  const PREVIEW_DRAFT_HISTORY_KEY");
  const end = html.indexOf(SYNC_RUNTIME_ANCHOR, start);
  assert.ok(start >= 0 && end > start);
  const ownerKey = options.ownerKey ?? "user:fixture-owner";
  const ownerContext = { ownerKey, draftKey: "latest:" + ownerKey, continuationToken: "" };
  const writes: Record<string, unknown>[] = [];
  const restored: unknown[] = [];
  const history = {
    state: { ikimonRecordPreviewDraftV1: { ownerKey: "user:fixture-owner", draftKey: "latest:user:fixture-owner", continuationToken: "", savedAt: 1 } } as Record<string, unknown>,
    replaceState(value: Record<string, unknown>) { this.state = value; },
  };
  const context = {
    history,
    window: { location: { href: "http://localhost/", pathname: "/", search: "" }, addEventListener() {} },
    document: { visibilityState: "visible" },
    STORE_NAME: "drafts", URLSearchParams,
    capturedReviewMeta: { capturedAt: "2026-10-08T00:00:00Z" },
    photoDraftRetryDetailId: "occ:fixture-visit:0",
    photoDraftRetryVisitId: "fixture-visit",
    photoDraftRetryHasUploadedPhoto: true,
    normalizeDraftFiles: (files: unknown[]) => files,
    draftOwnerContext: async () => ownerContext,
    saveDraft: async (draft: Record<string, unknown>) => { writes.push(draft); return ownerContext; },
    openDraftDb: async () => ({ close() {}, transaction: () => ({ objectStore: () => ({ get() {
      const request: { result: unknown; onsuccess?: () => void } = { result: options.candidate };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    } }) }) }),
    openSheet() {},
    addPhotoDraftFiles(files: unknown[]) { restored.push(...files); },
    setStatus() {},
    visitIdFromObservationTargetId: (id: string) => id.replace(/^occ:([^:]+):\d+$/, "$1"),
  };
  const runtime = runInNewContext(html.slice(start, end) + "\n({persistPhotoPreviewDraft,restorePhotoPreviewDraft})", context) as {
    persistPhotoPreviewDraft(files: unknown[]): Promise<void>;
    restorePhotoPreviewDraft(): Promise<void>;
  };
  return { runtime, context, writes, restored };
}

const SYNC_RUNTIME_ANCHOR = "  const syncPhotoDraftControls = (message) => {";

test("preview persistence keeps the saved Record target and existing primary photo for partial media retry", async () => {
  const { runtime, writes } = previewRuntime();
  await runtime.persistPhotoPreviewDraft([{ type: "image/png" }]);
  assert.deepEqual(JSON.parse(JSON.stringify(writes[0]?.retryState)), {
    detailId: "occ:fixture-visit:0", visitId: "fixture-visit", hasUploadedPhoto: true,
  });
});

test("same-owner reload restores partial media retry without creating a fresh Record", async () => {
  const candidate = {
    ownerKey: "user:fixture-owner", files: [{ type: "image/png" }],
    retryState: { detailId: "occ:fixture-visit:0", visitId: "fixture-visit", hasUploadedPhoto: true },
  };
  const { runtime, context, restored } = previewRuntime({ candidate });
  context.photoDraftRetryDetailId = "";
  context.photoDraftRetryVisitId = "";
  context.photoDraftRetryHasUploadedPhoto = false;
  await runtime.restorePhotoPreviewDraft();
  assert.equal(restored.length, 1);
  assert.equal(context.photoDraftRetryDetailId, "occ:fixture-visit:0");
  assert.equal(context.photoDraftRetryVisitId, "fixture-visit");
  assert.equal(context.photoDraftRetryHasUploadedPhoto, true);
});

test("another owner cannot restore the persisted retry target", async () => {
  const candidate = {
    ownerKey: "user:fixture-owner", files: [{ type: "image/png" }],
    retryState: { detailId: "occ:fixture-visit:0", visitId: "fixture-visit", hasUploadedPhoto: true },
  };
  const { runtime, context, restored } = previewRuntime({ candidate, ownerKey: "user:different-owner" });
  context.photoDraftRetryDetailId = "";
  context.photoDraftRetryVisitId = "";
  context.photoDraftRetryHasUploadedPhoto = false;
  await runtime.restorePhotoPreviewDraft();
  assert.equal(restored.length, 0);
  assert.equal(context.photoDraftRetryDetailId, "");
  assert.equal(context.photoDraftRetryVisitId, "");
  assert.equal(context.photoDraftRetryHasUploadedPhoto, false);
});

test("older preview drafts without retry state still restore as an unsubmitted photo", async () => {
  const candidate = { ownerKey: "user:fixture-owner", files: [{ type: "image/png" }] };
  const { runtime, context, restored } = previewRuntime({ candidate });
  context.photoDraftRetryDetailId = "";
  context.photoDraftRetryVisitId = "";
  context.photoDraftRetryHasUploadedPhoto = false;
  await runtime.restorePhotoPreviewDraft();
  assert.equal(restored.length, 1);
  assert.equal(context.photoDraftRetryDetailId, "");
  assert.equal(context.photoDraftRetryVisitId, "");
});

test("preview draft patch binds to the real photo-draft controls and success reset", () => {
  const original = realShell();
  assert.match(original, /const syncPhotoDraftControls = \(message\) =>/);
  assert.match(original, /const resetPhotoDraftAfterDirectPost = \(message\) =>/);
  assert.doesNotMatch(original, /ikimonRecordPreviewDraftV1/);
  assert.match(original, /global-photo-preview:/);
  assert.match(original, /queuePhotoPreviewWrite/);
  assert.equal(patchGlobalRecordPreviewDraftHtml(original), original, "native persistence must not receive a second legacy writer");

  const patched = patchGlobalRecordPreviewDraftHtml(legacyShell());
  assert.notEqual(patched, original, "site-shell drift must not silently disable preview-draft recovery");
  assert.match(patched, /const PREVIEW_DRAFT_HISTORY_KEY = 'ikimonRecordPreviewDraftV1'/);
  assert.match(patched, /void persistPhotoPreviewDraft\(files\)/);
  assert.match(patched, /void queuePhotoPreviewDraftClear\(\)/);
  assert.match(patched, /saveDraft\(\{/);
  assert.match(patched, /kind: 'photo'/);
  assert.match(patched, /recoverySource: 'draft_restore'/);
});

test("preview draft restore remains owner-scoped and fail-closed", () => {
  const patched = patchGlobalRecordPreviewDraftHtml(legacyShell());
  assert.match(patched, /markerMatchesContext/);
  assert.match(patched, /String\(marker\.draftKey \|\| ''\) === String\(context\.draftKey \|\| ''\)/);
  assert.match(patched, /String\(marker\.ownerKey \|\| ''\) === String\(context\.ownerKey \|\| ''\)/);
  assert.match(patched, /String\(marker\.continuationToken \|\| ''\) === String\(context\.continuationToken \|\| ''\)/);
  assert.match(patched, /String\(candidate\.ownerKey \|\| ''\) !== String\(context\.ownerKey \|\| ''\)/);
  assert.match(patched, /window\.addEventListener\('online', \(\) => \{ void restorePhotoPreviewDraft\(\); \}\)/);
  assert.match(patched, /Keep the marker so a signed-in draft can retry after connectivity\/session recovery/);
});

test("guest preview drafts hand off through the existing record claim flow after session recovery", () => {
  const patched = patchGlobalRecordPreviewDraftHtml(legacyShell());
  assert.match(patched, /markerOwnerKey\.startsWith\('guest:'\)/);
  assert.match(patched, /contextOwnerKey\.startsWith\('user:'\)/);
  assert.match(patched, /withDraftParams\(RECORD_TARGETS\.photo, 'photo', 'login_required', marker\.continuationToken\)/);
  assert.match(patched, /window\.location\.href = withDraftParams\(RECORD_TARGETS\.photo/);
  assert.match(patched, /marker\.draftKey === 'latest:guest:' \+ String\(marker\.continuationToken \|\| ''\)/);
});

test("preview draft restore retries after visibility or focus changes without duplicating the preview", () => {
  const patched = patchGlobalRecordPreviewDraftHtml(legacyShell());
  assert.match(patched, /let previewDraftRestoredInPage = false/);
  assert.match(patched, /if \(previewDraftRestoredInPage\) return/);
  assert.match(patched, /previewDraftRestoredInPage = true/);
  assert.match(patched, /window\.addEventListener\('visibilitychange', \(\) => \{ if \(document\.visibilityState === 'visible'\) void restorePhotoPreviewDraft\(\); \}\)/);
  assert.match(patched, /window\.addEventListener\('focus', \(\) => \{ void restorePhotoPreviewDraft\(\); \}\)/);
});

test("history state stores only a draft locator, never media or coordinates", () => {
  const patched = patchGlobalRecordPreviewDraftHtml(legacyShell());
  const markerStart = patched.indexOf("state[PREVIEW_DRAFT_HISTORY_KEY] = {");
  const markerEnd = patched.indexOf("history.replaceState(state, '', window.location.href);", markerStart);
  assert.ok(markerStart >= 0 && markerEnd > markerStart);
  const markerBlock = patched.slice(markerStart, markerEnd);
  assert.match(markerBlock, /draftKey:/);
  assert.match(markerBlock, /ownerKey:/);
  assert.match(markerBlock, /continuationToken:/);
  assert.match(markerBlock, /savedAt:/);
  assert.doesNotMatch(markerBlock, /\bfile\b|files|base64|latitude|longitude|metadata/);
  assert.match(patched, /history\.replaceState\(state, '', window\.location\.href\)/);
});

test("empty draft and direct-post success retire the restore marker before async cleanup", () => {
  const patched = patchGlobalRecordPreviewDraftHtml(legacyShell());
  assert.match(patched, /const queuePhotoPreviewDraftClear = \(\) => \{\n    clearPreviewDraftMarker\(\);/);
  assert.match(patched, /if \(!draftFiles\.length\) return queuePhotoPreviewDraftClear\(\)/);
  assert.match(patched, /const resetPhotoDraftAfterDirectPost = \(message\) => \{\n    void queuePhotoPreviewDraftClear\(\);/);
  assert.match(patched, /window\.ikimonAppOutbox\.remove\('record:' \+ String\(context\.draftKey\)\)/);
});

test("preview draft patch is idempotent and leaves unrelated HTML unchanged", () => {
  const once = patchGlobalRecordPreviewDraftHtml(legacyShell());
  assert.equal(patchGlobalRecordPreviewDraftHtml(once), once);

  const unrelated = "<html lang=\"ja\"><body><main>plain page</main></body></html>";
  assert.equal(patchGlobalRecordPreviewDraftHtml(unrelated), unrelated);
});

test("preview draft patch reaches the root route materialization", async () => {
  const app = Fastify();
  const rootHtml = realShell();
  app.get("/", async (_request, reply) => reply.type("text/html").send(rootHtml));
  registerGlobalRecordPreviewDraftHtmlPatch(app);

  try {
    const root = await app.inject({ method: "GET", url: "/" });
    assert.equal(root.statusCode, 200);
    assert.match(root.body, /global-photo-preview:/);
    assert.match(root.body, /queuePhotoPreviewWrite/);
    assert.doesNotMatch(root.body, /ikimonRecordPreviewDraftV1/);
  } finally {
    await app.close();
  }
});
