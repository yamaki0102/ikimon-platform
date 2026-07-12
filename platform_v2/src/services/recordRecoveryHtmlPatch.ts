import type { FastifyInstance } from "fastify";

const OLD_RECOVERY_PICKER = `        const chooseRecordRecoveryMedia = () => {
          const preferred = captureButtons.find((button) => button.getAttribute('data-capture-action') === recordRecoveryStart)
            || captureButtons.find((button) => button.getAttribute('data-capture-action') === 'gallery')
            || captureButtons[0];
          if (preferred && typeof preferred.click === 'function') preferred.click();
        };`;

const NEW_RECOVERY_PICKER = `        const chooseRecordRecoveryMedia = () => {
          const action = recordRecoveryStart === 'video'
            ? 'video'
            : recordRecoveryStart === 'photo'
              ? 'photo'
              : 'gallery';
          const target = document.querySelector('[data-record-media-input][data-capture-kind="' + action + '"]') || mediaInput;
          if (target && typeof target.click === 'function') target.click();
        };`;

const OLD_LOCATION_REQUIRED = `        } else if (message === 'location_required') setStatus('直接記録には地点が必要です。位置情報を許可してからもう一度試してください。');`;

const NEW_LOCATION_REQUIRED = `        } else if (message === 'location_required') {
          setStatus('写真を残したまま場所を選べる画面へ移動します...');
          await navigateWithDraft(selectedPhotoDraftFiles(), 'photo', capturedReviewMeta || {}, 'location_denied');
          return;
        }`;

export function patchRecordRecoveryHtml(html: string): string {
  let patched = html;
  if (patched.includes(OLD_RECOVERY_PICKER)) {
    patched = patched.replace(OLD_RECOVERY_PICKER, NEW_RECOVERY_PICKER);
  }
  if (patched.includes(OLD_LOCATION_REQUIRED)) {
    patched = patched.replace(OLD_LOCATION_REQUIRED, NEW_LOCATION_REQUIRED);
  }
  return patched;
}

function isRecordHtmlRequest(urlValue: string): boolean {
  try {
    const pathname = new URL(urlValue || "/", "https://ikimon.local").pathname.replace(/\/+$/, "");
    return pathname === "/record" || pathname.endsWith("/record");
  } catch {
    return false;
  }
}

export function registerRecordRecoveryHtmlPatch(app: FastifyInstance): void {
  app.addHook("onSend", (request, reply, payload, done) => {
    if (!isRecordHtmlRequest(request.url)) {
      done(null, payload);
      return;
    }
    const contentType = String(reply.getHeader("content-type") ?? "").toLowerCase();
    if (!contentType.includes("text/html")) {
      done(null, payload);
      return;
    }

    if (typeof payload === "string") {
      const patched = patchRecordRecoveryHtml(payload);
      if (patched !== payload) reply.removeHeader("content-length");
      done(null, patched);
      return;
    }
    if (Buffer.isBuffer(payload)) {
      const original = payload.toString("utf8");
      const patched = patchRecordRecoveryHtml(original);
      if (patched !== original) {
        reply.removeHeader("content-length");
        done(null, Buffer.from(patched, "utf8"));
        return;
      }
    }
    done(null, payload);
  });
}
