import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { renderSiteDocument } from "../ui/siteShell.js";
import { patchGlobalRecordSourceChoiceHtml, registerGlobalRecordSourceChoiceHtmlPatch } from "./globalRecordSourceChoiceHtmlPatch.js";

function shellFixture(lang = "ja"): string {
  return `<html lang="${lang}">
  <body>
    <nav class="global-record-launcher">
      <input class="global-record-input" data-global-record-input="gallery" type="file" accept="image/*" multiple hidden />
    </nav>
    <section class="global-record-camera-sheet" data-global-record-camera-sheet hidden>
      <div class="global-record-camera-actions" aria-label="撮影操作">
        <button type="button" class="global-record-camera-action is-primary" data-global-record-camera-start>カメラを起動</button>
        <button type="button" class="global-record-camera-action" data-global-record-camera-capture hidden>写真を撮る</button>
      </div>
      <button type="button" class="global-record-gallery-select" data-global-record-gallery-select>写真から選ぶ</button>
    </section>
    <script>
    const labels = {
    photo: {
      title: '写真を撮る',
      help: '',
      start: 'カメラを起動',
      capture: '写真を撮る',
    },
    };
    const openSheet = (kind, options) => {
    setStatus(kind === 'photo' && options && options.reviewOnly ? '写真を確認しています。追加撮影してから記録へ進めます。' : 'カメラを起動しています...');
    if (kind === 'photo') {
      latestCaptureLocation = null;
      latestCaptureLocationAt = 0;
      void requestCaptureLocation(true);
    }
    if (!(options && options.reviewOnly)) void startCamera();
    };
  document.querySelectorAll('[data-global-record-gallery-select]').forEach((button) => {
    button.addEventListener('click', (event) => event.preventDefault());
  });
  document.querySelectorAll('[data-global-record-input]').forEach((input) => {
    input.addEventListener('change', async () => {
      const files = input.files ? Array.from(input.files) : [];
      const kind = input.getAttribute('data-global-record-input') || 'gallery';
      if (!files.length) return;
      if (kind === 'photo') {
        openSheet('photo', { reviewOnly: true, keepReview: true });
      }
    });
  });
    </script>
  </body>
</html>`;
}

test("photo source choice exposes native camera without pre-requesting camera or location", () => {
  const patched = patchGlobalRecordSourceChoiceHtml(shellFixture());
  assert.match(patched, /data-global-record-input="photo"[^>]*capture="environment"/);
  assert.match(patched, /data-global-record-os-camera>標準カメラ<\/button>/);
  assert.match(patched, /start: '接写カメラ'/);
  assert.match(patched, /kind !== 'photo'\) void startCamera\(\)/);
  assert.match(patched, /撮影方法を選ぶ/);
  assert.match(patched, /標準カメラ、接写カメラ、写真から選ぶ/);
  assert.match(patched, /clickFallbackInput\('photo'\)/);
  assert.match(patched, /native_camera_tap/);
  assert.match(patched, /latestCaptureLocationAt = 0;\n    }\n    if \(!\(options && options\.reviewOnly\) && kind !== 'photo'\) void startCamera\(\)/);
  assert.doesNotMatch(patched, /latestCaptureLocationAt = 0;\n      void requestCaptureLocation\(true\);/);
});

test("patch anchors stay compatible with the real site shell output", () => {
  const original = renderSiteDocument({
    basePath: "",
    title: "ZUKAN source choice contract",
    body: "<main>fixture</main>",
    lang: "ja",
    currentPath: "/",
  });
  assert.match(original, /data-global-record-camera-sheet/);
  assert.doesNotMatch(original, /data-global-record-os-camera/);

  const patched = patchGlobalRecordSourceChoiceHtml(original);
  assert.notEqual(patched, original, "site-shell drift must not silently turn the source-choice patch into a no-op");
  assert.match(patched, /data-global-record-input="photo"[^>]*capture="environment"/);
  assert.match(patched, /data-global-record-os-camera>標準カメラ<\/button>/);
  assert.match(patched, /kind !== 'photo'\) void startCamera\(\)/);
  assert.match(patched, /if \(kind === 'photo' \|\| kind === 'gallery'\)/);
  assert.match(patched, /latestCaptureLocationAt = 0;\n    }\n    if \(!\(options && options\.reviewOnly\) && kind !== 'photo'\) void startCamera\(\)/);
  assert.match(patched, /captureSource: 'gallery'/);
  assert.match(patched, /metadata && metadata\.captureSource === 'gallery'/);
});

test("gallery selections do not infer capture time or current location", () => {
  const original = renderSiteDocument({
    basePath: "",
    title: "ZUKAN gallery metadata contract",
    body: "<main>fixture</main>",
    lang: "ja",
    currentPath: "/",
  });
  const patched = patchGlobalRecordSourceChoiceHtml(original);

  assert.match(patched, /const metadata = kind === 'gallery'[\s\S]*capturedAt: null,[\s\S]*location: null,[\s\S]*locationPending: true/);
  assert.match(patched, /if \(metadata && metadata\.captureSource === 'gallery'\) \{[\s\S]*navigateWithDraft\(files, 'photo', metadata, 'global_capture'\)/);
});

test("native camera and photo library both enter the existing immediate-preview path", () => {
  const patched = patchGlobalRecordSourceChoiceHtml(shellFixture());
  assert.match(patched, /if \(kind === 'photo' \|\| kind === 'gallery'\)/);
  assert.match(patched, /openSheet\('photo', \{ reviewOnly: true, keepReview: true \}\)/);
});

test("source choice patch keeps localized native-camera labels", () => {
  assert.match(patchGlobalRecordSourceChoiceHtml(shellFixture("en")), /data-global-record-os-camera>Device camera<\/button>/);
  assert.match(patchGlobalRecordSourceChoiceHtml(shellFixture("es")), /data-global-record-os-camera>Cámara del dispositivo<\/button>/);
  assert.match(patchGlobalRecordSourceChoiceHtml(shellFixture("pt-BR")), /data-global-record-os-camera>Câmera do aparelho<\/button>/);
});

test("source choice patch is idempotent", () => {
  const once = patchGlobalRecordSourceChoiceHtml(shellFixture());
  assert.equal(patchGlobalRecordSourceChoiceHtml(once), once);
  assert.equal((once.match(/data-global-record-os-camera/g) ?? []).length, 2, "button and listener selector only");
  assert.equal((once.match(/capture="environment"/g) ?? []).length, 1);
});

test("source choice patch reaches the root route materialization", async () => {
  const app = Fastify();
  const rootHtml = renderSiteDocument({
    basePath: "",
    title: "ZUKAN root source choice contract",
    body: "<main>fixture</main>",
    lang: "ja",
    currentPath: "/",
  });
  app.get("/", async (_request, reply) => reply.type("text/html").send(rootHtml));
  registerGlobalRecordSourceChoiceHtmlPatch(app);

  try {
    const root = await app.inject({ method: "GET", url: "/" });
    assert.equal(root.statusCode, 200);
    assert.match(root.body, /data-global-record-input="photo"[^>]*capture="environment"/);
    assert.match(root.body, /data-global-record-os-camera>標準カメラ<\/button>/);
    assert.match(root.body, /if \(kind === 'photo' \|\| kind === 'gallery'\)/);
  } finally {
    await app.close();
  }
});

test("source choice patch leaves pages without the global camera sheet unchanged", () => {
  const html = '<html lang="ja"><body><main>plain page</main></body></html>';
  assert.equal(patchGlobalRecordSourceChoiceHtml(html), html);
});
