import type { FastifyInstance } from "fastify";

const OLD_MISSING_LOCATION_FALLBACK = `    if (!photoDraftRetryDetailId && !photoDraftRetryVisitId && !(metadata.location && Number.isFinite(Number(metadata.location.latitude)) && Number.isFinite(Number(metadata.location.longitude)))) {
      setStatus('位置情報を取得できなかったため、写真を保持して記録画面へ移動します。');
      await navigateWithDraft(files, 'photo', metadata, 'location_denied');
      return;
    }`;

const NEW_MISSING_LOCATION_FALLBACK = `    if (!photoDraftRetryDetailId && !photoDraftRetryVisitId && !(metadata.location && Number.isFinite(Number(metadata.location.latitude)) && Number.isFinite(Number(metadata.location.longitude)))) {
      metadata.location = null;
      metadata.locationPending = false;
      setStatus('場所なしで投稿します...');
    }`;

const OLD_LOCATION_NORMALIZATION = `        const location = metadata.location || null;
        if (!location || !Number.isFinite(Number(location.latitude)) || !Number.isFinite(Number(location.longitude))) {
          throw new Error('location_required');
        }`;

const NEW_LOCATION_NORMALIZATION = `        const rawLocation = metadata.location || null;
        const location = rawLocation && Number.isFinite(Number(rawLocation.latitude)) && Number.isFinite(Number(rawLocation.longitude))
          ? rawLocation
          : null;`;

const OLD_SUBMISSION_SEED_COORDINATES = `          Number(location.latitude).toFixed(6),
          Number(location.longitude).toFixed(6),`;

const NEW_SUBMISSION_SEED_COORDINATES = `          location ? Number(location.latitude).toFixed(6) : 'unlocated',
          location ? Number(location.longitude).toFixed(6) : 'unlocated',`;

const OLD_UPSERT_COORDINATES = `            latitude: Number(location.latitude),
            longitude: Number(location.longitude),`;

const NEW_UPSERT_COORDINATES = `            latitude: location ? Number(location.latitude) : null,
            longitude: location ? Number(location.longitude) : null,`;

const OLD_PHOTO_SUBMIT_LABEL = `  const photoDraftSubmitLabel = () => {
    const count = selectedPhotoDraftFiles().length;
    return count > 0 ? 'この' + String(count) + '枚を記録' : '写真を撮る';
  };`;

const NEW_PHOTO_SUBMIT_LABEL = `  const photoDraftSubmitLabel = () => selectedPhotoDraftFiles().length > 0 ? '投稿' : '写真を撮る';`;

const OLD_SUCCESS_MESSAGE = "resetPhotoDraftAfterDirectPost('記録を保存しました。AIが写真を見て主役と周囲を整理します。続けて撮れます。');";
const NEW_SUCCESS_MESSAGE = "resetPhotoDraftAfterDirectPost('投稿しました。続けて撮れます。');";

const OLD_PHOTO_TRAY_HELP = "右で記録、左でもう1枚撮れます。";
const NEW_PHOTO_TRAY_HELP = "右で投稿、左でもう1枚撮れます。";

function removePassiveIdentificationPressure(html: string): string {
  return html
    .replace(/\s*<div class="obs-card-species[^"]*\bis-awaiting\b[^"]*">[\s\S]*?<\/div>/g, "")
    .replace(/\s*<span class="obs-card-sketch-name">(?:名前待ち|Awaiting ID)<\/span>/g, "")
    .replace(/\s*<a href="[^"]*#identify[^"]*">(?:名前を手伝う|Identify)<\/a>/g, "")
    .replace(/\s*<div class="obs-card-actions">\s*<\/div>/g, "");
}

export function patchLightPostingHtml(html: string): string {
  return removePassiveIdentificationPressure(html)
    .replace(OLD_MISSING_LOCATION_FALLBACK, NEW_MISSING_LOCATION_FALLBACK)
    .replace(OLD_LOCATION_NORMALIZATION, NEW_LOCATION_NORMALIZATION)
    .replace(OLD_SUBMISSION_SEED_COORDINATES, NEW_SUBMISSION_SEED_COORDINATES)
    .replace(OLD_UPSERT_COORDINATES, NEW_UPSERT_COORDINATES)
    .replace(OLD_PHOTO_SUBMIT_LABEL, NEW_PHOTO_SUBMIT_LABEL)
    .replace(OLD_SUCCESS_MESSAGE, NEW_SUCCESS_MESSAGE)
    .replaceAll(OLD_PHOTO_TRAY_HELP, NEW_PHOTO_TRAY_HELP);
}

export function registerLightPostingHtmlPatch(app: FastifyInstance): void {
  app.addHook("onSend", (_request, reply, payload, done) => {
    const contentType = String(reply.getHeader("content-type") ?? "").toLowerCase();
    if (!contentType.includes("text/html")) {
      done(null, payload);
      return;
    }

    if (typeof payload === "string") {
      const patched = patchLightPostingHtml(payload);
      if (patched !== payload) reply.removeHeader("content-length");
      done(null, patched);
      return;
    }

    if (Buffer.isBuffer(payload)) {
      const original = payload.toString("utf8");
      const patched = patchLightPostingHtml(original);
      if (patched !== original) {
        reply.removeHeader("content-length");
        done(null, Buffer.from(patched, "utf8"));
        return;
      }
    }

    done(null, payload);
  });
}
