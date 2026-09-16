import { ZUKAN_DESIGN_FOUNDATION_STYLES } from "../../src/ui/appExperience";

const FOUNDATION_STYLE_ID = "zukan-design-foundation-v1";
const INTERNAL_PATH = /^\/(?:admin|api|debug|ops|internal|smoke|synthetic)(?:\/|$)|^\/(?:__|_)/i;

/**
 * The public presentation entry owns the final HTML boundary for the Worker.
 * Keep administrative, diagnostic, synthetic and API routes outside the
 * public design contract; their rendering is deliberately separate.
 */
export function isPublicUserFacingHtmlRequest(request: Request): boolean {
  if (request.method.toUpperCase() !== "GET") return false;
  try {
    return !INTERNAL_PATH.test(new URL(request.url).pathname);
  } catch {
    return false;
  }
}

export function applyPublicDesignFoundation(html: string): string {
  if (!/<html\b/i.test(html) || !/<head\b/i.test(html) || !/<body\b/i.test(html)) return html;

  let patched = html;
  if (!patched.includes(`id="${FOUNDATION_STYLE_ID}"`)) {
    const style = `<style id="${FOUNDATION_STYLE_ID}">${ZUKAN_DESIGN_FOUNDATION_STYLES}</style>`;
    patched = patched.replace(/<\/head>/i, `${style}</head>`);
  }
  return patched.replace(/<body\b([^>]*)>/i, (body, attributes: string) => (
    /\bdata-zukan-design(?:\s|=|>)/i.test(body)
      ? body
      : `<body${attributes} data-zukan-design="v1">`
  ));
}

export async function ensurePublicDesignFoundation(request: Request, response: Response): Promise<Response> {
  if (!isPublicUserFacingHtmlRequest(request) || response.status < 200 || response.status >= 500) return response;
  if (!String(response.headers.get("content-type") ?? "").toLowerCase().includes("text/html")) return response;

  const html = await response.text();
  const patched = applyPublicDesignFoundation(html);
  if (patched === html) return new Response(html, { status: response.status, statusText: response.statusText, headers: response.headers });

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("etag");
  headers.delete("last-modified");
  headers.set("x-zukan-design-foundation", "v1");
  return new Response(patched, { status: response.status, statusText: response.statusText, headers });
}
