import type { FastifyInstance } from "fastify";
import { registerMaterializationInjectPatch } from "./lightPostingHtmlPatch.js";

const SYNC_ANCHOR = `  const syncPhotoDraftControls = (message) => {
    const files = selectedPhotoDraftFiles();
    const [primaryFile] = files;
    capturedReviewFile = primaryFile || null;
    photoDraftSubmitConfirmUntil = 0;
    renderPhotoTray();`;

const RESET_ANCHOR = `  const resetPhotoDraftAfterDirectPost = (message) => {
    capturedReviewFile = null;`;

const PREVIEW_DRAFT_HELPERS = `  const PREVIEW_DRAFT_HISTORY_KEY = 'ikimonRecordPreviewDraftV1';
  let previewDraftWriteChain = Promise.resolve();
  let previewDraftRestoreInFlight = false;
  const previewDraftMarker = () => {
    const state = history.state && typeof history.state === 'object' ? history.state : {};
    const marker = state[PREVIEW_DRAFT_HISTORY_KEY];
    return marker && typeof marker === 'object' ? marker : null;
  };
  const setPreviewDraftMarker = (context, savedAt) => {
    if (!context || !context.draftKey || !context.ownerKey) return;
    const state = Object.assign({}, history.state && typeof history.state === 'object' ? history.state : {});
    state[PREVIEW_DRAFT_HISTORY_KEY] = {
      draftKey: String(context.draftKey),
      ownerKey: String(context.ownerKey),
      continuationToken: String(context.continuationToken || ''),
      savedAt: Number(savedAt) || Date.now(),
    };
    history.replaceState(state, '', window.location.href);
  };
  const clearPreviewDraftMarker = () => {
    const current = history.state && typeof history.state === 'object' ? history.state : {};
    if (!(PREVIEW_DRAFT_HISTORY_KEY in current)) return;
    const state = Object.assign({}, current);
    delete state[PREVIEW_DRAFT_HISTORY_KEY];
    history.replaceState(state, '', window.location.href);
  };
  const markerMatchesContext = (marker, context) => Boolean(
    marker && context
    && String(marker.draftKey || '') === String(context.draftKey || '')
    && String(marker.ownerKey || '') === String(context.ownerKey || '')
    && String(marker.continuationToken || '') === String(context.continuationToken || '')
  );
  const readPreviewDraftByKey = async (draftKey) => {
    const db = await openDraftDb();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const request = transaction.objectStore(STORE_NAME).get(String(draftKey));
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error || new Error('indexeddb_read_failed'));
      });
    } finally {
      db.close();
    }
  };
  const removePersistedPhotoPreviewDraft = async () => {
    const marker = previewDraftMarker();
    let context = null;
    try {
      context = await draftOwnerContext();
      if (marker && !markerMatchesContext(marker, context)) {
        if (String(marker.ownerKey || '').startsWith('user:') && String(context.ownerKey || '').startsWith('user:')) clearPreviewDraftMarker();
        return;
      }
      const db = await openDraftDb();
      try {
        await new Promise((resolve, reject) => {
          const transaction = db.transaction(STORE_NAME, 'readwrite');
          transaction.objectStore(STORE_NAME).delete(String(context.draftKey));
          transaction.oncomplete = () => resolve(true);
          transaction.onerror = () => reject(transaction.error || new Error('indexeddb_delete_failed'));
        });
      } finally {
        db.close();
      }
      if (window.ikimonAppOutbox && typeof window.ikimonAppOutbox.remove === 'function') {
        await window.ikimonAppOutbox.remove('record:' + String(context.draftKey)).catch(() => undefined);
      }
    } catch (_) {
      // Best-effort cleanup; explicit discard/success has already retired the history marker.
    }
  };
  const queuePhotoPreviewDraftClear = () => {
    clearPreviewDraftMarker();
    previewDraftWriteChain = previewDraftWriteChain.catch(() => undefined).then(() => removePersistedPhotoPreviewDraft());
    return previewDraftWriteChain;
  };
  const persistPhotoPreviewDraft = (files) => {
    const draftFiles = normalizeDraftFiles(files).filter((file) => file.type && file.type.indexOf('image/') === 0);
    if (!draftFiles.length) return queuePhotoPreviewDraftClear();
    const metadata = capturedReviewMeta && typeof capturedReviewMeta === 'object' ? Object.assign({}, capturedReviewMeta) : {};
    previewDraftWriteChain = previewDraftWriteChain.catch(() => undefined).then(async () => {
      const savedAt = Date.now();
      const [primaryFile = null] = draftFiles;
      const context = await saveDraft({
        file: primaryFile,
        files: draftFiles,
        kind: 'photo',
        savedAt,
        metadata: Object.assign({}, metadata, { recoverySource: 'draft_restore' }),
      });
      setPreviewDraftMarker(context, savedAt);
    });
    return previewDraftWriteChain;
  };
  const restorePhotoPreviewDraft = async () => {
    if (previewDraftRestoreInFlight) return;
    const marker = previewDraftMarker();
    if (!marker || !marker.draftKey || !marker.ownerKey) return;
    if ((window.location.pathname === '/record' || window.location.pathname === '/record/')
      && new URLSearchParams(window.location.search).get('draft') === '1') return;
    previewDraftRestoreInFlight = true;
    try {
      const context = await draftOwnerContext();
      if (!markerMatchesContext(marker, context)) {
        if (String(marker.ownerKey || '').startsWith('user:') && String(context.ownerKey || '').startsWith('user:')) clearPreviewDraftMarker();
        return;
      }
      const candidate = await readPreviewDraftByKey(marker.draftKey);
      if (!candidate) {
        clearPreviewDraftMarker();
        return;
      }
      if (String(candidate.ownerKey || '') !== String(context.ownerKey || '')) return;
      if (String(context.continuationToken || '') && String(candidate.continuationToken || '') !== String(context.continuationToken || '')) return;
      const files = normalizeDraftFiles(Array.isArray(candidate.files) ? candidate.files : candidate.file ? [candidate.file] : [])
        .filter((file) => file.type && file.type.indexOf('image/') === 0);
      if (!files.length) {
        clearPreviewDraftMarker();
        return;
      }
      capturedReviewMeta = candidate.metadata && typeof candidate.metadata === 'object' ? candidate.metadata : {};
      openSheet('photo', { reviewOnly: true, keepReview: true });
      addPhotoDraftFiles(files, capturedReviewMeta);
      setStatus('端末に残っていた写真を復元しました。内容を確認して記録へ進めます。');
    } catch (_) {
      // Keep the marker so a signed-in draft can retry after connectivity/session recovery.
    } finally {
      previewDraftRestoreInFlight = false;
    }
  };
  window.addEventListener('pageshow', () => { void restorePhotoPreviewDraft(); }, { once: true });
  window.addEventListener('online', () => { void restorePhotoPreviewDraft(); });
`;
const PREVIEW_DRAFT_INJECT_PATCH_FLAG = "__ikimonGlobalRecordPreviewDraftInjectPatched";

export function patchGlobalRecordPreviewDraftHtml(html: string): string {
  if (!html.includes("data-global-record-camera-sheet")) return html;
  if (html.includes("ikimonRecordPreviewDraftV1")) return html;
  if (!html.includes(SYNC_ANCHOR) || !html.includes(RESET_ANCHOR)) return html;

  let patched = html.replace(SYNC_ANCHOR, `${PREVIEW_DRAFT_HELPERS}${SYNC_ANCHOR}
    void persistPhotoPreviewDraft(files);`);
  patched = patched.replace(
    RESET_ANCHOR,
    `  const resetPhotoDraftAfterDirectPost = (message) => {
    void queuePhotoPreviewDraftClear();
    capturedReviewFile = null;`,
  );
  return patched;
}

export function registerGlobalRecordPreviewDraftHtmlPatch(app: FastifyInstance): void {
  registerMaterializationInjectPatch(
    app,
    (html) => patchGlobalRecordPreviewDraftHtml(html),
    PREVIEW_DRAFT_INJECT_PATCH_FLAG,
  );

  app.addHook("onSend", (_request, reply, payload, done) => {
    const contentType = String(reply.getHeader("content-type") ?? "").toLowerCase();
    if (!contentType.includes("text/html")) {
      done(null, payload);
      return;
    }
    if (typeof payload === "string") {
      const patched = patchGlobalRecordPreviewDraftHtml(payload);
      if (patched !== payload) reply.removeHeader("content-length");
      done(null, patched);
      return;
    }
    if (Buffer.isBuffer(payload)) {
      const original = payload.toString("utf8");
      const patched = patchGlobalRecordPreviewDraftHtml(original);
      if (patched !== original) {
        reply.removeHeader("content-length");
        done(null, Buffer.from(patched, "utf8"));
        return;
      }
    }
    done(null, payload);
  });
}
