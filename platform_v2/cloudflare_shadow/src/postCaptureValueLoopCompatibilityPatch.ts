export const POST_CAPTURE_VALUE_LOOP_COMPATIBILITY = "post-capture-value-loop-compat-v2";

const PATCH_MARKER = 'data-ikimon-post-capture-value-loop-compat="v2"';
const STYLE_ID = "ikimon-post-capture-value-loop-compact-style";

const INJECTED_STYLE = `
  .of-record-info .of-meta {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      "date scope"
      "place privacy";
    column-gap: 12px;
    row-gap: 3px;
    margin: 10px 0 12px;
  }
  .of-record-info .of-meta p {
    min-width: 0;
    font-size: 14px;
    line-height: 1.45;
  }
  .of-record-info .of-meta p:nth-child(1) { grid-area: date; }
  .of-record-info .of-meta p:nth-child(2) { grid-area: place; }
  .of-record-info .of-meta p:nth-child(3) { grid-area: privacy; }
  .of-record-info .of-meta p:nth-child(4) { grid-area: scope; justify-self: end; }
  .of-record-info .of-actions { margin-bottom: 12px; }
  .ikimon-record-value-loop[data-compact="v2"] {
    gap: 8px;
    margin: 0 0 12px;
    padding: 11px 12px;
    border-radius: 14px;
    box-shadow: none;
    background: #f3faf6;
  }
  .ikimon-record-value-loop[data-compact="v2"] .ikimon-record-value-loop__head {
    align-items: center;
    gap: 8px;
  }
  .ikimon-record-value-loop[data-compact="v2"] .ikimon-record-value-loop__head h2 {
    font-size: 15px;
    line-height: 1.35;
  }
  .ikimon-record-value-loop[data-compact="v2"] .ikimon-record-value-loop__updated {
    font-size: 10px;
    line-height: 1.35;
  }
  .ikimon-record-value-loop[data-compact="v2"] .ikimon-record-value-loop__states {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 5px;
  }
  .ikimon-record-value-loop[data-compact="v2"] .ikimon-record-value-loop__state {
    min-height: 0;
    padding: 6px 7px;
    border: 1px solid #dce9e2;
    border-radius: 10px;
    background: #fff;
  }
  .ikimon-record-value-loop[data-compact="v2"] .ikimon-record-value-loop__state span {
    font-size: 10px;
    line-height: 1.25;
  }
  .ikimon-record-value-loop[data-compact="v2"] .ikimon-record-value-loop__state strong {
    font-size: 13px;
    line-height: 1.3;
  }
  .ikimon-record-value-loop[data-compact="v2"] .ikimon-record-value-loop__actions.has-primary {
    display: flex;
    margin: 0;
  }
  .ikimon-record-value-loop[data-compact="v2"] .ikimon-record-value-loop__actions.has-primary .ikimon-record-value-loop__action {
    min-height: 44px;
    padding: 8px 13px;
  }
  .ikimon-record-value-loop__details {
    border-top: 1px solid #dce7e0;
  }
  .ikimon-record-value-loop__details > summary {
    display: flex;
    align-items: center;
    min-height: 44px;
    cursor: pointer;
    color: #365848;
    font-size: 13px;
    font-weight: 850;
  }
  .ikimon-record-value-loop__details-body {
    display: grid;
    gap: 9px;
    padding: 0 1px 3px;
  }
  .ikimon-record-value-loop[data-compact="v2"] .ikimon-record-value-loop__message,
  .ikimon-record-value-loop[data-compact="v2"] .ikimon-record-value-loop__place {
    font-size: 13px;
    line-height: 1.6;
  }
  .ikimon-record-value-loop[data-compact="v2"] .ikimon-record-value-loop__place {
    padding-top: 8px;
  }
  .ikimon-record-value-loop__details-body .ikimon-record-value-loop__actions {
    display: flex;
    margin: 0;
  }
  .ikimon-record-value-loop__details-body .ikimon-record-value-loop__action {
    width: auto;
    min-height: 44px;
  }
  .ikimon-record-value-loop[data-compact="v2"] .ikimon-record-value-loop__result:empty {
    display: none;
  }
  @media (max-width: 560px) {
    .of-panel { padding-top: 18px; }
    .ikimon-record-value-loop[data-compact="v2"] { padding: 10px 11px; }
    .ikimon-record-value-loop[data-compact="v2"] .ikimon-record-value-loop__head { display: flex; }
    .ikimon-record-value-loop[data-compact="v2"] .ikimon-record-value-loop__updated { text-align: right; }
    .ikimon-record-value-loop[data-compact="v2"] .ikimon-record-value-loop__states { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .ikimon-record-value-loop[data-compact="v2"] .ikimon-record-value-loop__state {
      display: grid;
      grid-template-columns: 1fr;
      align-items: start;
      min-height: 0;
    }
    .ikimon-record-value-loop[data-compact="v2"] .ikimon-record-value-loop__actions.has-primary { display: flex; }
    .ikimon-record-value-loop[data-compact="v2"] .ikimon-record-value-loop__actions.has-primary .ikimon-record-value-loop__action {
      width: auto;
      flex: 1 1 auto;
    }
  }
  @media (max-width: 360px) {
    .of-record-info .of-meta {
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas:
        "date scope"
        "place place"
        "privacy privacy";
    }
    .of-record-info .of-meta p:nth-child(3) { justify-self: start; }
  }
`;

const INJECTED_SCRIPT = String.raw`
(function () {
  if (window.__ikimonPostCaptureValueLoopCompatV2) return;
  window.__ikimonPostCaptureValueLoopCompatV2 = true;

  var COPY = {
    ja: { details: '保存・解析の詳細' },
    en: { details: 'Save and analysis details' },
    es: { details: 'Detalles de guardado y analisis' },
    'pt-br': { details: 'Detalhes de salvamento e analise' },
  };
  var currentLang = String(document.documentElement.lang || 'ja').toLowerCase();
  var copy = COPY[currentLang] || COPY.ja;

  var isCaptureReturn = function () {
    try { return new URLSearchParams(location.search).get('source') === 'capture_saved'; } catch (_) { return false; }
  };

  var removeDuplicateStatus = function () {
    document.querySelectorAll('.of-record-info > .of-status[aria-live="polite"]').forEach(function (status) {
      status.remove();
    });
  };

  var removeOriginalStatus = function (enhanced) {
    document.querySelectorAll('[data-observation-processing-status]').forEach(function (original) {
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

  var prioritizeContent = function (enhanced) {
    var panel = document.querySelector('.of-panel');
    var note = panel && panel.querySelector('.of-note');
    var summary = panel && panel.querySelector('.of-summary');
    if (panel && note && summary && note.previousElementSibling !== summary) {
      panel.insertBefore(summary, note);
    }
    if (summary && !isCaptureReturn() && summary.nextElementSibling !== enhanced) {
      summary.insertAdjacentElement('afterend', enhanced);
    }
  };

  var compactPanel = function (enhanced) {
    if (enhanced.getAttribute('data-compact') === 'v2') return;
    enhanced.setAttribute('data-compact', 'v2');

    var actions = enhanced.querySelector('.ikimon-record-value-loop__actions');
    var message = enhanced.querySelector('.ikimon-record-value-loop__message');
    var place = enhanced.querySelector('.ikimon-record-value-loop__place');
    var result = enhanced.querySelector('.ikimon-record-value-loop__result');
    var secondaryActions = [];

    if (actions) {
      actions.querySelectorAll('.ikimon-record-value-loop__action.is-secondary').forEach(function (action) {
        secondaryActions.push(action);
      });
      var primaryCount = actions.querySelectorAll('.ikimon-record-value-loop__action:not(.is-secondary)').length;
      if (primaryCount > 0) actions.classList.add('has-primary');
    }

    var details = document.createElement('details');
    details.className = 'ikimon-record-value-loop__details';
    var summary = document.createElement('summary');
    summary.textContent = copy.details;
    var body = document.createElement('div');
    body.className = 'ikimon-record-value-loop__details-body';
    details.appendChild(summary);
    details.appendChild(body);

    if (message) body.appendChild(message);
    if (place) body.appendChild(place);
    if (secondaryActions.length > 0) {
      var detailActions = document.createElement('div');
      detailActions.className = 'ikimon-record-value-loop__actions';
      secondaryActions.forEach(function (action) { detailActions.appendChild(action); });
      body.appendChild(detailActions);
    }
    if (result) body.appendChild(result);
    if (body.childNodes.length > 0) enhanced.appendChild(details);

    if (actions && actions.children.length === 0) actions.remove();
  };

  var reconcile = function () {
    var enhanced = document.querySelector('[data-ikimon-record-value-loop-panel]');
    if (!enhanced) return;
    removeDuplicateStatus();
    removeOriginalStatus(enhanced);
    compactPanel(enhanced);
    prioritizeContent(enhanced);
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

function nonceAttribute(html: string, cspNonce = ""): string {
  const match = html.match(/<script\b[^>]*\bnonce=(["'])([^"']+)\1/iu);
  const nonce = match?.[2] || cspNonce;
  return nonce ? ` nonce="${escapeAttribute(nonce)}"` : "";
}

function nonceFromContentSecurityPolicy(value: string | null): string {
  const match = String(value ?? "").match(/(?:^|;)\s*script-src\s+[^;]*?'nonce-([^'\s;]+)'/iu);
  return match?.[1] ?? "";
}

export function applyPostCaptureValueLoopCompatibilityPatch(html: string, cspNonce = ""): string {
  if (html.includes(PATCH_MARKER) || !html.includes("data-observation-first-record-detail")) return html;
  const nonce = nonceAttribute(html, cspNonce);
  const payload = `<style id="${STYLE_ID}"${nonce}>${INJECTED_STYLE}</style><script ${PATCH_MARKER}${nonce}>${INJECTED_SCRIPT}</script>`;
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
  const patched = applyPostCaptureValueLoopCompatibilityPatch(html, nonceFromContentSecurityPolicy(response.headers.get("content-security-policy")) || String(response.headers.get("x-ikimon-csp-nonce") ?? ""));
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
