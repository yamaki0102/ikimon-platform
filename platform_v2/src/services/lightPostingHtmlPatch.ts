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
const INJECT_PATCH_FLAG = "__ikimonLightPostingInjectPatched";

type LightPostingPatchOptions = {
  suppressPassiveIdentification?: boolean;
};

type MutableInjectResponse = {
  headers?: Record<string, unknown>;
  body?: unknown;
  rawPayload?: unknown;
};

type MaterializationHtmlPatch = (html: string, urlValue: string) => string;

function removePassiveIdentificationPressure(html: string): string {
  return html
    .replace(/\s*<div class="obs-card-species[^"]*\bis-awaiting\b[^"]*">[\s\S]*?<\/div>/g, "")
    .replace(/\s*<span class="obs-card-sketch-name">(?:名前待ち|同定待ち|Awaiting ID)<\/span>/gi, "")
    .replace(/\s*<a href="[^"]*#identify[^"]*">(?:名前を手伝う|Identify)<\/a>/gi, "")
    .replace(/\s*<strong>(?:名前待ち|同定待ち|Awaiting ID)<\/strong>/gi, "")
    .replace(/\s*<span[^>]*>(?:名前待ちの(?:写真|動画|音|記録)|Awaiting ID(?: photo| video| sound| record)?)<\/span>/gi, "")
    .replace(/\s*<span><strong>\d+<\/strong><small>(?:名前確認中|Names in review)<\/small><\/span>/gi, "")
    .replace(/\s*<span>(?:名前は後で確かめる|Confirm names later)<\/span>/gi, "")
    .replace(/\s*<div class="obs-card-actions">\s*<\/div>/g, "");
}

function normalizeProductPath(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0]?.toLowerCase();
  if (first === "ja" || first === "en" || first === "es" || first === "pt-br") {
    segments.shift();
  }
  return `/${segments.join("/")}`.replace(/\/+$/, "") || "/";
}

function shouldSuppressPassiveIdentification(urlValue: string): boolean {
  try {
    const url = new URL(urlValue || "/", "https://ikimon.local");
    const pathname = normalizeProductPath(url.pathname);
    if (pathname === "/" || pathname === "/home") return true;
    if (pathname === "/records") return url.searchParams.get("view") !== "needs_id";
    return pathname === "/profile" || pathname.startsWith("/profile/");
  } catch {
    return false;
  }
}

function injectRequestUrl(args: unknown[]): string {
  const input = args[0];
  if (typeof input === "string") return input;
  if (!input || typeof input !== "object") return "/";
  const request = input as { url?: unknown; path?: unknown };
  return typeof request.url === "string"
    ? request.url
    : typeof request.path === "string"
      ? request.path
      : "/";
}

function setMutableResponseValue(response: MutableInjectResponse, key: "body" | "rawPayload", value: string | Buffer): void {
  try {
    response[key] = value;
  } catch {
    Object.defineProperty(response, key, {
      configurable: true,
      enumerable: true,
      value,
      writable: true,
    });
  }
}

function patchInjectedHtmlResponse(value: unknown, urlValue: string, patchHtml: MaterializationHtmlPatch): unknown {
  if (!value || typeof value !== "object") return value;
  const response = value as MutableInjectResponse;
  const contentType = String(response.headers?.["content-type"] ?? response.headers?.["Content-Type"] ?? "").toLowerCase();
  if (!contentType.includes("text/html") || typeof response.body !== "string") return value;

  const patched = patchHtml(response.body, urlValue);
  if (patched === response.body) return value;

  const rawPayload = Buffer.from(patched, "utf8");
  setMutableResponseValue(response, "body", patched);
  setMutableResponseValue(response, "rawPayload", rawPayload);
  if (response.headers) {
    const contentLengthKey = Object.keys(response.headers).find((key) => key.toLowerCase() === "content-length");
    if (contentLengthKey) response.headers[contentLengthKey] = String(rawPayload.byteLength);
  }
  return value;
}

export function registerMaterializationInjectPatch(
  app: FastifyInstance,
  patchHtml: MaterializationHtmlPatch,
  patchFlag: string,
): void {
  const patchableApp = app as FastifyInstance & Record<string, unknown>;
  if (patchableApp[patchFlag]) return;
  patchableApp[patchFlag] = true;

  const originalInject = app.inject.bind(app) as (...args: unknown[]) => unknown;
  const wrappedInject = (...args: unknown[]): unknown => {
    if (args.length === 0) return originalInject(...args);
    const urlValue = injectRequestUrl(args);
    const callbackIndex = typeof args[args.length - 1] === "function" ? args.length - 1 : -1;

    if (callbackIndex >= 0) {
      const callback = args[callbackIndex] as (error: unknown, response: unknown) => unknown;
      const callbackArgs = [...args];
      callbackArgs[callbackIndex] = (error: unknown, response: unknown) => callback(
        error,
        error ? response : patchInjectedHtmlResponse(response, urlValue, patchHtml),
      );
      return originalInject(...callbackArgs);
    }

    const result = originalInject(...args);
    if (result && typeof result === "object" && "then" in result && typeof (result as { then?: unknown }).then === "function") {
      return (result as Promise<unknown>).then((response) => patchInjectedHtmlResponse(response, urlValue, patchHtml));
    }
    return result;
  };

  Object.defineProperty(app, "inject", {
    configurable: true,
    value: wrappedInject,
    writable: true,
  });
}

export function patchLightPostingHtml(html: string, options: LightPostingPatchOptions = {}): string {
  let patched = html
    .replace(OLD_MISSING_LOCATION_FALLBACK, NEW_MISSING_LOCATION_FALLBACK)
    .replace(OLD_LOCATION_NORMALIZATION, NEW_LOCATION_NORMALIZATION)
    .replace(OLD_SUBMISSION_SEED_COORDINATES, NEW_SUBMISSION_SEED_COORDINATES)
    .replace(OLD_UPSERT_COORDINATES, NEW_UPSERT_COORDINATES)
    .replace(OLD_PHOTO_SUBMIT_LABEL, NEW_PHOTO_SUBMIT_LABEL)
    .replace(OLD_SUCCESS_MESSAGE, NEW_SUCCESS_MESSAGE)
    .replaceAll(OLD_PHOTO_TRAY_HELP, NEW_PHOTO_TRAY_HELP)
    .replace(/\s*<div class="obs-card-place">\s*<\/div>/g, "");

  if (options.suppressPassiveIdentification !== false) {
    patched = removePassiveIdentificationPressure(patched);
  }
  return patched;
}

export function registerLightPostingHtmlPatch(app: FastifyInstance): void {
  // The root route is registered before registerHealthRoutes(). Fastify route hooks
  // therefore cannot retroactively attach to it. Production HTML is materialized via
  // app.inject(), so patch that path as well while keeping the normal onSend hook for
  // routes registered after this function.
  registerMaterializationInjectPatch(
    app,
    (html, urlValue) => patchLightPostingHtml(html, {
      suppressPassiveIdentification: shouldSuppressPassiveIdentification(urlValue),
    }),
    INJECT_PATCH_FLAG,
  );

  app.addHook("onSend", (request, reply, payload, done) => {
    const contentType = String(reply.getHeader("content-type") ?? "").toLowerCase();
    if (!contentType.includes("text/html")) {
      done(null, payload);
      return;
    }

    const options: LightPostingPatchOptions = {
      suppressPassiveIdentification: shouldSuppressPassiveIdentification(request.url),
    };

    if (typeof payload === "string") {
      const patched = patchLightPostingHtml(payload, options);
      if (patched !== payload) reply.removeHeader("content-length");
      done(null, patched);
      return;
    }

    if (Buffer.isBuffer(payload)) {
      const original = payload.toString("utf8");
      const patched = patchLightPostingHtml(original, options);
      if (patched !== original) {
        reply.removeHeader("content-length");
        done(null, Buffer.from(patched, "utf8"));
        return;
      }
    }

    done(null, payload);
  });
}
