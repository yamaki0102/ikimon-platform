export const POST_CAPTURE_VALUE_LOOP_COMPATIBILITY = "post-capture-value-loop-compat-v1";

const PATCH_MARKER = 'data-ikimon-post-capture-value-loop-compat="v1"';

const INJECTED_SCRIPT = String.raw`
(function () {
  if (window.__ikimonPostCaptureValueLoopCompatV1) return;
  window.__ikimonPostCaptureValueLoopCompatV1 = true;

  var reconcile = function () {
    var enhanced = document.querySelector('[data-ikimon-record-value-loop-panel]');
    if (!enhanced) return;

    var originals = document.querySelectorAll('[data-observation-processing-status]');
    originals.forEach(function (original) {
      if (original === enhanced) return;
      original.remove();
    });

    if (!document.querySelector('[data-observation-processing-status]')) {
      var originalStyle = document.querySelector('style[data-observation-processing-status-style]');
      if (originalStyle) originalStyle.remove();
      var originalScript = document.querySelector('script[data-observation-reassess-script]');
      if (originalScript) originalScript.remove();
    }
  };

  var observer = new MutationObserver(reconcile);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', reconcile, { once: true });
  } else {
    reconcile();
  }
})();
`;

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function nonceAttribute(html: string): string {
  const match = html.match(/<script\b[^>]*\bnonce=(["'])([^"']+)\1/iu);
  return match?.[2] ? ` nonce="${escapeAttribute(match[2])}"` : "";
}

export function applyPostCaptureValueLoopCompatibilityPatch(html: string): string {
  if (html.includes(PATCH_MARKER) || !html.includes("data-observation-first-record-detail")) return html;
  const nonce = nonceAttribute(html);
  const payload = `<script ${PATCH_MARKER}${nonce}>${INJECTED_SCRIPT}</script>`;
  if (html.includes("</head>")) return html.replace("</head>", `${payload}\n</head>`);
  return `${payload}${html}`;
}

export async function enforcePostCaptureValueLoopCompatibility(
  request: Request,
  response: Response,
): Promise<Response> {
  if (request.method.toUpperCase() !== "GET" || response.status < 200 || response.status >= 300) return response;
  const contentType = String(response.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.includes("text/html")) return response;

  const html = await response.text();
  const patched = applyPostCaptureValueLoopCompatibilityPatch(html);
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  if (patched !== html) {
    headers.delete("etag");
    headers.delete("last-modified");
    headers.set("x-ikimon-post-capture-value-loop-compat", POST_CAPTURE_VALUE_LOOP_COMPATIBILITY);
  }
  return new Response(patched, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
