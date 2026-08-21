import type { FastifyInstance } from "fastify";
import { registerMaterializationInjectPatch } from "./lightPostingHtmlPatch.js";

type SourceChoiceLang = "ja" | "en" | "es" | "pt-BR";

const GALLERY_INPUT = '<input class="global-record-input" data-global-record-input="gallery" type="file" accept="image/*" multiple hidden />';
const NATIVE_CAMERA_INPUT = '<input class="global-record-input" data-global-record-input="photo" type="file" accept="image/*" capture="environment" hidden />';
const PHOTO_LABELS = `    photo: {
      title: '写真を撮る',
      help: '',
      start: 'カメラを起動',
      capture: '写真を撮る',
    },`;
const PHOTO_LABELS_WITH_MACRO = `    photo: {
      title: '撮影方法を選ぶ',
      help: '',
      start: '接写カメラ',
      capture: '写真を撮る',
    },`;
const PHOTO_OPEN_STATUS = `    setStatus(kind === 'photo' && options && options.reviewOnly ? '写真を確認しています。追加撮影してから記録へ進めます。' : 'カメラを起動しています...');`;
const PHOTO_SOURCE_STATUS = `    setStatus(kind === 'photo'
      ? options && options.reviewOnly
        ? '写真を確認しています。追加撮影してから記録へ進めます。'
        : '標準カメラ、接写カメラ、写真から選ぶ、のいずれかを選んでください。'
      : 'カメラを起動しています...');`;
const PHOTO_LOCATION_PREFETCH = `    if (kind === 'photo') {
      latestCaptureLocation = null;
      latestCaptureLocationAt = 0;
      void requestCaptureLocation(true);
    }`;
const PHOTO_LOCATION_DEFERRED = `    if (kind === 'photo') {
      latestCaptureLocation = null;
      latestCaptureLocationAt = 0;
    }`;
const AUTO_START_CAMERA = `    if (!(options && options.reviewOnly)) void startCamera();`;
const PHOTO_MANUAL_START = `    if (!(options && options.reviewOnly) && kind !== 'photo') void startCamera();`;
const INPUT_HANDLER = `      const kind = input.getAttribute('data-global-record-input') || 'gallery';
      if (!files.length) return;
      if (kind === 'photo') {`;
const INPUT_HANDLER_WITH_PREVIEW = `      const kind = input.getAttribute('data-global-record-input') || 'gallery';
      if (!files.length) return;
      if (kind === 'photo' || kind === 'gallery') {`;
const GALLERY_METADATA_INPUT = `        const metadata = buildCaptureMetadata();
        addPhotoDraftFiles(files, metadata);`;
const GALLERY_METADATA_INPUT_WITHOUT_INFERENCE = `        const metadata = kind === 'gallery'
          ? {
              captureSource: 'gallery',
              capturedAt: null,
              location: null,
              locationPending: true,
            }
          : buildCaptureMetadata();
        addPhotoDraftFiles(files, metadata);`;
const DIRECT_POST_METADATA_GUARD = `    const metadata = capturedReviewMeta || {};
    if (!photoDraftRetryDetailId && !photoDraftRetryVisitId && !(metadata.location && Number.isFinite(Number(metadata.location.latitude)) && Number.isFinite(Number(metadata.location.longitude)))) {`;
const DIRECT_POST_METADATA_GUARD_WITH_GALLERY_HANDOFF = `    const metadata = capturedReviewMeta || {};
    if (metadata && metadata.captureSource === 'gallery') {
      setStatus('写真の撮影時刻と場所を確認するため、記録画面へ移動します。');
      await navigateWithDraft(files, 'photo', metadata, 'global_capture');
      return;
    }
    if (!photoDraftRetryDetailId && !photoDraftRetryVisitId && !(metadata.location && Number.isFinite(Number(metadata.location.latitude)) && Number.isFinite(Number(metadata.location.longitude)))) {`;
const GALLERY_LISTENER = `  document.querySelectorAll('[data-global-record-gallery-select]').forEach((button) => {`;
const SHEET_KIND_SOURCE_VISIBILITY_ANCHOR = `    if (kind) sheet.setAttribute('data-active-kind', kind);
    else sheet.removeAttribute('data-active-kind');`;
const SHEET_KIND_WITH_SOURCE_VISIBILITY = `${SHEET_KIND_SOURCE_VISIBILITY_ANCHOR}
    document.querySelectorAll('[data-global-record-os-camera]').forEach((button) => {
      button.hidden = kind !== 'photo';
    });`;
const SOURCE_CHOICE_INJECT_PATCH_FLAG = "__ikimonGlobalRecordSourceChoiceInjectPatched";

const SOURCE_LABELS: Record<SourceChoiceLang, { native: string }> = {
  ja: { native: "標準カメラ" },
  en: { native: "Device camera" },
  es: { native: "Cámara del dispositivo" },
  "pt-BR": { native: "Câmera do aparelho" },
};

function resolveLang(html: string): SourceChoiceLang {
  const raw = html.match(/<html[^>]*\blang=["']([^"']+)["']/i)?.[1] ?? "ja";
  if (raw === "en" || raw === "es" || raw === "pt-BR") return raw;
  return "ja";
}

function nativeCameraButton(html: string): string {
  const label = SOURCE_LABELS[resolveLang(html)].native;
  return `<button type="button" class="global-record-camera-action" data-global-record-os-camera>${label}</button>`;
}

function addSourceChoiceButton(html: string): string {
  if (html.includes("data-global-record-os-camera")) return html;
  const startButton = /(<button type="button" class="global-record-camera-action is-primary" data-global-record-camera-start>[^<]*<\/button>)/;
  if (!startButton.test(html)) return html;
  return html.replace(startButton, `$1\n      ${nativeCameraButton(html)}`);
}

function addNativeCameraListener(html: string): string {
  if (html.includes("native_camera_tap")) return html;
  if (!html.includes(GALLERY_LISTENER)) return html;
  const listener = `  document.querySelectorAll('[data-global-record-os-camera]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      sendGlobalRecordEvent('native_camera_tap', 'native_camera_tap', { source: 'camera_sheet' });
      clickFallbackInput('photo');
    });
  });
`;
  return html.replace(GALLERY_LISTENER, `${listener}${GALLERY_LISTENER}`);
}

export function patchGlobalRecordSourceChoiceHtml(html: string): string {
  if (!html.includes("data-global-record-camera-sheet")) return html;
  let patched = html;

  if (!patched.includes(NATIVE_CAMERA_INPUT) && patched.includes(GALLERY_INPUT)) {
    patched = patched.replace(GALLERY_INPUT, `${GALLERY_INPUT}\n    ${NATIVE_CAMERA_INPUT}`);
  }
  patched = addSourceChoiceButton(patched);
  patched = addNativeCameraListener(patched);
  if (patched.includes(PHOTO_LABELS)) patched = patched.replace(PHOTO_LABELS, PHOTO_LABELS_WITH_MACRO);
  if (patched.includes(PHOTO_OPEN_STATUS)) patched = patched.replace(PHOTO_OPEN_STATUS, PHOTO_SOURCE_STATUS);
  if (patched.includes(PHOTO_LOCATION_PREFETCH)) patched = patched.replace(PHOTO_LOCATION_PREFETCH, PHOTO_LOCATION_DEFERRED);
  if (patched.includes(AUTO_START_CAMERA)) patched = patched.replace(AUTO_START_CAMERA, PHOTO_MANUAL_START);
  if (patched.includes(INPUT_HANDLER)) patched = patched.replace(INPUT_HANDLER, INPUT_HANDLER_WITH_PREVIEW);
  if (patched.includes(GALLERY_METADATA_INPUT)) {
    patched = patched.replace(GALLERY_METADATA_INPUT, GALLERY_METADATA_INPUT_WITHOUT_INFERENCE);
  }
  if (patched.includes(DIRECT_POST_METADATA_GUARD)) {
    patched = patched.replace(DIRECT_POST_METADATA_GUARD, DIRECT_POST_METADATA_GUARD_WITH_GALLERY_HANDOFF);
  }
  if (patched.includes(SHEET_KIND_SOURCE_VISIBILITY_ANCHOR)) {
    patched = patched.replace(SHEET_KIND_SOURCE_VISIBILITY_ANCHOR, SHEET_KIND_WITH_SOURCE_VISIBILITY);
  }
  return patched;
}

export function registerGlobalRecordSourceChoiceHtmlPatch(app: FastifyInstance): void {
  registerMaterializationInjectPatch(
    app,
    (html) => patchGlobalRecordSourceChoiceHtml(html),
    SOURCE_CHOICE_INJECT_PATCH_FLAG,
  );

  app.addHook("onSend", (_request, reply, payload, done) => {
    const contentType = String(reply.getHeader("content-type") ?? "").toLowerCase();
    if (!contentType.includes("text/html")) {
      done(null, payload);
      return;
    }
    if (typeof payload === "string") {
      const patched = patchGlobalRecordSourceChoiceHtml(payload);
      if (patched !== payload) reply.removeHeader("content-length");
      done(null, patched);
      return;
    }
    if (Buffer.isBuffer(payload)) {
      const original = payload.toString("utf8");
      const patched = patchGlobalRecordSourceChoiceHtml(original);
      if (patched !== original) {
        reply.removeHeader("content-length");
        done(null, Buffer.from(patched, "utf8"));
        return;
      }
    }
    done(null, payload);
  });
}
