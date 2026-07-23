import {
  applyFocusedPublicHomeRedesign,
  FOCUSED_PUBLIC_HOME_PRESENTATION,
} from "./publicFocusedHomeRedesign";

const NORMAL_HOME_PATHS = new Set(["/", "/home"]);
const LANGUAGE_SEGMENTS = new Set(["ja", "en", "es", "pt-br"]);
const FOCUSED_HOME_LANGUAGE_SEGMENTS = new Set(["ja", "en"]);

function normalizedProductPath(url: URL): string {
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments[0] && LANGUAGE_SEGMENTS.has(segments[0].toLowerCase())) {
    segments.shift();
  }
  return `/${segments.join("/")}`.replace(/\/+$/u, "") || "/";
}

function supportsFocusedHomeRedesign(request: Request): boolean {
  try {
    const firstSegment = new URL(request.url).pathname.split("/").filter(Boolean)[0]?.toLowerCase() ?? "";
    return !firstSegment || firstSegment === "home" || FOCUSED_HOME_LANGUAGE_SEGMENTS.has(firstSegment);
  } catch {
    return false;
  }
}

export function isNormalPublicHomeRequest(request: Request): boolean {
  if (request.method.toUpperCase() !== "GET") return false;
  try {
    return NORMAL_HOME_PATHS.has(normalizedProductPath(new URL(request.url)));
  } catch {
    return false;
  }
}

export function stripPassiveIdentificationFromHomeHtml(html: string): string {
  return html
    .replace(
      /\s*<strong>(?:名前待ち(?:の(?:写真|動画|音|メモ|記録))?|同定待ち|Awaiting ID(?: (?:photo|video|sound|record))?)<\/strong>/giu,
      "",
    )
    .replace(
      /\s*<span[^>]*>(?:名前待ち(?:の(?:写真|動画|音|メモ|記録))?|同定待ち|Awaiting ID(?: (?:photo|video|sound|record))?)<\/span>/giu,
      "",
    )
    .replace(
      /\s*<span>\s*<strong>\d+<\/strong>\s*<small>(?:名前確認中|Names in review)<\/small>\s*<\/span>/giu,
      "",
    )
    .replace(/\s*<span>(?:名前は後で確かめる|Confirm names later)<\/span>/giu, "")
    .replace(/\s*<a\b[^>]*href="[^"]*#identify[^"]*"[^>]*>(?:名前を手伝う|Identify)<\/a>/giu, "");
}

export function routeFocusedHomePrimaryCtaToPhotoCamera(html: string): string {
  return html.replace(
    /<a\b[^>]*\bclass="[^"]*\bprototype-guest-home-primary\b[^"]*"[^>]*>/gu,
    (tag) => {
      const hrefMatch = tag.match(/\bhref="([^"]*\/record)\?start=gallery"/u);
      if (!hrefMatch) return tag;

      const photoHref = `${hrefMatch[1] ?? "/record"}?start=photo`;
      let patched = tag.replace(hrefMatch[0], `href="${photoHref}"`);
      const additions: string[] = [];

      if (/\bdata-kpi-target="[^"]*"/u.test(patched)) {
        patched = patched.replace(/\bdata-kpi-target="[^"]*"/u, `data-kpi-target="${photoHref}"`);
      }
      if (/\bdata-global-record-trigger="[^"]*"/u.test(patched)) {
        patched = patched.replace(/\bdata-global-record-trigger="[^"]*"/u, 'data-global-record-trigger="photo"');
      } else {
        additions.push('data-global-record-trigger="photo"');
      }
      if (/\bdata-record-target="[^"]*"/u.test(patched)) {
        patched = patched.replace(/\bdata-record-target="[^"]*"/u, `data-record-target="${photoHref}"`);
      } else {
        additions.push(`data-record-target="${photoHref}"`);
      }

      return additions.length > 0
        ? patched.replace(/>$/u, ` ${additions.join(" ")}>`)
        : patched;
    },
  );
}

export async function patchPublicHomePresentation(request: Request, response: Response): Promise<Response> {
  if (!isNormalPublicHomeRequest(request) || response.status < 200 || response.status >= 300) {
    return response;
  }

  const contentType = String(response.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.includes("text/html")) return response;

  const html = await response.text();
  const stateSplitHome = html.includes('data-home-contract="state-split-v1"');
  if (stateSplitHome) {
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    headers.delete("etag");
    headers.delete("last-modified");
    headers.set("cache-control", "no-cache, no-store, must-revalidate");
    headers.set("x-ikimon-presentation-contract", "state-split-home-v1");
    return new Response(html, { status: response.status, statusText: response.statusText, headers });
  }
  const withoutPassiveIdentification = stripPassiveIdentificationFromHomeHtml(html);
  const focusedRedesign = supportsFocusedHomeRedesign(request);
  const patched = focusedRedesign
    ? routeFocusedHomePrimaryCtaToPhotoCamera(applyFocusedPublicHomeRedesign(withoutPassiveIdentification))
    : withoutPassiveIdentification;
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("etag");
  headers.delete("last-modified");
  headers.set("cache-control", "no-cache, no-store, must-revalidate");
  headers.set("x-ikimon-presentation-contract", "light-home-v2");
  if (focusedRedesign) {
    headers.set("x-ikimon-home-redesign", FOCUSED_PUBLIC_HOME_PRESENTATION);
    headers.set("x-ikimon-home-capture-contract", "camera-first-v1");
  }

  return new Response(patched, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
