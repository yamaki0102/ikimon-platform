import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { renderSiteDocument } from "./siteShell.js";

const expectedRetryLabels: Record<string, { general: string; permission: string }> = {
  ja: { general: "カメラを再試行", permission: "設定後に再試行" },
  en: { general: "Retry camera", permission: "Retry after changing settings" },
  es: { general: "Reintentar cámara", permission: "Reintentar después de cambiar los ajustes" },
  "pt-BR": { general: "Tentar novamente", permission: "Tentar novamente após alterar as configurações" },
};

test("camera recovery uses a settings-specific label only for permission denial", () => {
  for (const [lang, labels] of Object.entries(expectedRetryLabels)) {
    const html = renderSiteDocument({
      basePath: "",
      title: "Camera recovery",
      body: "<p>Camera</p>",
      lang: lang as "ja" | "en" | "es" | "pt-BR",
      currentPath: `/${lang}/learn/field-loop`,
    });
    const error = html.match(/<div class="global-record-camera-error"[\s\S]*?<\/div>\s*<\/div>/)?.[0] ?? "";
    assert.match(error, /role="alert"/);
    assert.ok(error.includes(labels.general), `${lang}: non-permission failures need a general retry label`);
    assert.ok(html.includes(labels.permission), `${lang}: permission failure needs a settings-specific retry label`);
    assert.match(error, /data-global-record-gallery-select/);
    assert.match(html, /permissionDenied\s*\?\s*CAMERA_COPY\.permissionRetry\s*:\s*CAMERA_COPY\.retry/);
    const config = html.match(/const CAMERA_COPY = (\{[^\n]+\});/);
    const handler = html.match(/const showCameraError = \(permissionDenied\) => \{([\s\S]*?)\n  \};/);
    assert.ok(config && handler, "exercise the generated localized error handler");
    const cameraErrorBody = { textContent: "" };
    const cameraRetryButton = { textContent: "" };
    const cameraError = { hidden: true };
    const copy = JSON.parse(config[1]!);
    const context = vm.createContext({
      CAMERA_COPY: copy, cameraErrorBody, cameraRetryButton, cameraError,
      sheet: { setAttribute() {} }, startButton: { hidden: false, disabled: true },
      captureButton: { hidden: false }, stopActiveStream() {}, setFooterActionMode() {}, setStatus() {},
    });
    new vm.Script(`const showCameraError = (permissionDenied) => {${handler[1]}};
      globalThis.showCameraError = showCameraError;`).runInContext(context);
    for (const denied of [true, false, true]) {
      context.showCameraError(denied);
      assert.equal(cameraRetryButton.textContent, denied ? labels.permission : labels.general);
      assert.equal(cameraErrorBody.textContent, denied ? copy.permissionBody : copy.errorBody);
      assert.equal(cameraError.hidden, false);
    }
  }
});
