import assert from "node:assert/strict";
import test from "node:test";
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

test("preview draft patch binds to the real photo-draft controls and success reset", () => {
  const original = realShell();
  assert.match(original, /const syncPhotoDraftControls = \(message\) =>/);
  assert.match(original, /const resetPhotoDraftAfterDirectPost = \(message\) =>/);
  assert.doesNotMatch(original, /ikimonRecordPreviewDraftV1/);

  const patched = patchGlobalRecordPreviewDraftHtml(original);
  assert.notEqual(patched, original, "site-shell drift must not silently disable preview-draft recovery");
  assert.match(patched, /const PREVIEW_DRAFT_HISTORY_KEY = 'ikimonRecordPreviewDraftV1'/);
  assert.match(patched, /void persistPhotoPreviewDraft\(files\)/);
  assert.match(patched, /void queuePhotoPreviewDraftClear\(\)/);
  assert.match(patched, /saveDraft\(\{/);
  assert.match(patched, /kind: 'photo'/);
  assert.match(patched, /recoverySource: 'draft_restore'/);
});

test("preview draft restore remains owner-scoped and fail-closed", () => {
  const patched = patchGlobalRecordPreviewDraftHtml(realShell());
  assert.match(patched, /markerMatchesContext/);
  assert.match(patched, /String\(marker\.draftKey \|\| ''\) === String\(context\.draftKey \|\| ''\)/);
  assert.match(patched, /String\(marker\.ownerKey \|\| ''\) === String\(context\.ownerKey \|\| ''\)/);
  assert.match(patched, /String\(marker\.continuationToken \|\| ''\) === String\(context\.continuationToken \|\| ''\)/);
  assert.match(patched, /String\(candidate\.ownerKey \|\| ''\) !== String\(context\.ownerKey \|\| ''\)/);
  assert.match(patched, /window\.addEventListener\('online', \(\) => \{ void restorePhotoPreviewDraft\(\); \}\)/);
  assert.match(patched, /Keep the marker so a signed-in draft can retry after connectivity\/session recovery/);
});

test("history state stores only a draft locator, never media or coordinates", () => {
  const patched = patchGlobalRecordPreviewDraftHtml(realShell());
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
  const patched = patchGlobalRecordPreviewDraftHtml(realShell());
  assert.match(patched, /const queuePhotoPreviewDraftClear = \(\) => \{\n    clearPreviewDraftMarker\(\);/);
  assert.match(patched, /if \(!draftFiles\.length\) return queuePhotoPreviewDraftClear\(\)/);
  assert.match(patched, /const resetPhotoDraftAfterDirectPost = \(message\) => \{\n    void queuePhotoPreviewDraftClear\(\);/);
  assert.match(patched, /window\.ikimonAppOutbox\.remove\('record:' \+ String\(context\.draftKey\)\)/);
});

test("preview draft patch is idempotent and leaves unrelated HTML unchanged", () => {
  const once = patchGlobalRecordPreviewDraftHtml(realShell());
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
    assert.match(root.body, /ikimonRecordPreviewDraftV1/);
    assert.match(root.body, /void persistPhotoPreviewDraft\(files\)/);
  } finally {
    await app.close();
  }
});
