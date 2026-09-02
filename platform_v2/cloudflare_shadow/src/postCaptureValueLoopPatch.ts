export const POST_CAPTURE_VALUE_LOOP_PRESENTATION = "post-capture-value-loop-v1";

const PATCH_MARKER = 'data-ikimon-post-capture-value-loop="v1"';
const STYLE_ID = "ikimon-post-capture-value-loop-style";
const ELIGIBLE_HTML_MARKERS = [
  "data-global-record-camera-sheet",
  "data-observation-first-record-detail",
  'class="of-record-info"',
];

const INJECTED_STYLE = `
  .ikimon-record-value-loop {
    display: grid;
    gap: 13px;
    margin: 0 0 14px;
    padding: 17px;
    border: 1px solid #cfe2d7;
    border-radius: 17px;
    background: linear-gradient(145deg, #edf8f2, #fff 64%);
    color: #16231c;
  }
  .ikimon-record-value-loop[hidden] { display: none !important; }
  .ikimon-record-value-loop__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }
  .ikimon-record-value-loop__head h2 {
    margin: 0;
    font-size: 19px;
    line-height: 1.35;
  }
  .ikimon-record-value-loop__updated {
    color: #607067;
    font-size: 11px;
    font-weight: 750;
    text-align: right;
  }
  .ikimon-record-value-loop__states {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin: 0;
  }
  .ikimon-record-value-loop__state {
    display: grid;
    gap: 2px;
    min-height: 66px;
    padding: 10px 12px;
    border-radius: 13px;
    background: #fff;
  }
  .ikimon-record-value-loop__state span {
    color: #607067;
    font-size: 11px;
    font-weight: 800;
  }
  .ikimon-record-value-loop__state strong {
    font-size: 14px;
    line-height: 1.35;
  }
  .ikimon-record-value-loop__message,
  .ikimon-record-value-loop__place {
    margin: 0;
    color: #33473c;
    font-size: 14px;
    line-height: 1.7;
  }
  .ikimon-record-value-loop__place {
    padding-top: 11px;
    border-top: 1px solid #dce7e0;
  }
  .ikimon-record-value-loop__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .ikimon-record-value-loop__action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 8px 14px;
    border: 1px solid #0a7b57;
    border-radius: 999px;
    background: #0a7b57;
    color: #fff;
    font: inherit;
    font-weight: 850;
    text-decoration: none;
    cursor: pointer;
  }
  .ikimon-record-value-loop__action.is-secondary {
    border-color: #cfe2d7;
    background: #fff;
    color: #0b6f61;
  }
  .ikimon-record-value-loop__action:disabled {
    cursor: wait;
    opacity: .7;
  }
  .ikimon-record-value-loop__result {
    min-height: 1.5em;
    color: #607067;
    font-size: 12px;
    font-weight: 700;
  }
  @media (max-width: 560px) {
    .ikimon-record-value-loop { padding: 14px; }
    .ikimon-record-value-loop__head { display: grid; }
    .ikimon-record-value-loop__updated { text-align: left; }
    .ikimon-record-value-loop__states { grid-template-columns: 1fr; }
    .ikimon-record-value-loop__state {
      grid-template-columns: 76px minmax(0, 1fr);
      align-items: center;
      min-height: 52px;
    }
    .ikimon-record-value-loop__actions { display: grid; }
    .ikimon-record-value-loop__action { width: 100%; }
  }
`;

const INJECTED_SCRIPT = String.raw`
(function () {
  if (window.__ikimonPostCaptureValueLoopV1) return;
  window.__ikimonPostCaptureValueLoopV1 = true;

  var STORAGE_KEY = 'ikimon:post-capture-detail-id:v1';
  var CAPTURE_SOURCE = 'capture_saved';
  var pendingDetailId = '';
  var redirectScheduled = false;

  var safeRecordId = function (value) {
    var normalized = String(value || '').trim();
    return /^[A-Za-z0-9:_-]{1,180}$/.test(normalized) ? normalized : '';
  };
  var safeDecode = function (value) {
    try { return decodeURIComponent(String(value || '')); } catch (_) { return ''; }
  };
  var visitIdFromTarget = function (value) {
    var normalized = safeRecordId(value);
    var match = normalized.match(/^occ:([^:]+):[0-9]+$/);
    return match && match[1] ? match[1] : normalized;
  };
  var recordIdFromPayload = function (json) {
    if (!json || typeof json !== 'object') return '';
    var direct = safeRecordId(json.occurrenceId);
    if (direct) return direct;
    var occurrenceIds = Array.isArray(json.occurrenceIds) ? json.occurrenceIds : [];
    for (var index = 0; index < occurrenceIds.length; index += 1) {
      var item = safeRecordId(occurrenceIds[index]);
      if (item) return item;
    }
    return safeRecordId(json.visitId || json.observationId);
  };
  var rememberDetailId = function (value) {
    var normalized = safeRecordId(value);
    if (!normalized) return;
    pendingDetailId = normalized;
    try { sessionStorage.setItem(STORAGE_KEY, normalized); } catch (_) {}
  };
  var recalledDetailId = function () {
    if (pendingDetailId) return pendingDetailId;
    try { return safeRecordId(sessionStorage.getItem(STORAGE_KEY)); } catch (_) { return ''; }
  };
  var clearRecalledDetailId = function () {
    pendingDetailId = '';
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (_) {}
  };
  var langPrefix = function () {
    var pathMatch = location.pathname.match(/^\/(ja|en|es|pt-br)(?:\/|$)/i);
    if (pathMatch && pathMatch[1]) return '/' + pathMatch[1].toLowerCase();
    var lang = String(document.documentElement.lang || '').toLowerCase();
    if (lang === 'pt-br') return '/pt-br';
    if (lang === 'en' || lang === 'es') return '/' + lang;
    return '';
  };
  var detailHref = function (recordId) {
    return langPrefix() + '/observations/' + encodeURIComponent(recordId) + '?source=' + CAPTURE_SOURCE;
  };
  var scheduleCaptureRedirect = function () {
    if (redirectScheduled) return;
    var recordId = recalledDetailId();
    if (!recordId) return;
    redirectScheduled = true;
    window.setTimeout(function () {
      clearRecalledDetailId();
      window.location.assign(detailHref(recordId));
    }, 320);
  };
  var detectSavedMarker = function () {
    if (document.querySelector('[data-global-record-saved-action="records"]')) scheduleCaptureRedirect();
  };

  if (typeof window.fetch === 'function') {
    var originalFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var responsePromise = originalFetch(input, init);
      try {
        var requestUrl = typeof input === 'string' ? input : (input && input.url ? input.url : '');
        var resolvedUrl = new URL(requestUrl, window.location.href);
        var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
        if (method === 'POST' && /\/api\/v1\/observations\/upsert\/?$/.test(resolvedUrl.pathname)) {
          responsePromise.then(function (response) {
            if (!response || !response.ok) return;
            response.clone().json().then(function (json) {
              rememberDetailId(recordIdFromPayload(json));
              detectSavedMarker();
            }).catch(function () {});
          }).catch(function () {});
        }
      } catch (_) {}
      return responsePromise;
    };
  }

  var observer = new MutationObserver(function () { detectSavedMarker(); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  detectSavedMarker();

  var COPY = {
    ja: {
      savedTitle: '記録できました',
      statusTitle: 'この記録の状態',
      record: '記録',
      photo: '写真',
      ai: 'AI',
      saved: '保存済み',
      photoNone: '写真なし',
      photoProcessing: '表示準備中',
      photoReady: '保存済み',
      photoRetry: '再送が必要',
      aiNotRequested: '未受付',
      aiQueued: '受付済み',
      aiProcessing: '確認中',
      aiCandidate: '候補あり',
      aiCompleted: '確認済み',
      aiFailed: '再確認できます',
      aiUnavailable: '現在利用不可',
      genericMessage: '記録は保存されています。',
      placePrefix: 'この記録は',
      placeSuffix: 'の記録として保存されています。',
      placeGeneric: 'この場所の記録として保存されています。',
      map: '場所を見る',
      candidate: 'AIの候補を見る',
      retry: 'AIで再確認',
      retrying: '受付中…',
      retried: 'AIで再確認を受け付けました。',
      retryFailed: '受付できませんでした。少し待ってからもう一度お試しください。',
      updated: '最終更新',
    },
    en: {
      savedTitle: 'Record saved',
      statusTitle: 'Record status',
      record: 'Record',
      photo: 'Photos',
      ai: 'AI',
      saved: 'Saved',
      photoNone: 'No photos',
      photoProcessing: 'Preparing',
      photoReady: 'Saved',
      photoRetry: 'Retry needed',
      aiNotRequested: 'Not requested',
      aiQueued: 'Queued',
      aiProcessing: 'Checking',
      aiCandidate: 'Candidate ready',
      aiCompleted: 'Checked',
      aiFailed: 'Can retry',
      aiUnavailable: 'Unavailable',
      genericMessage: 'Your record is saved.',
      placePrefix: 'This record is saved for ',
      placeSuffix: '.',
      placeGeneric: 'This record is saved for this place.',
      map: 'View place',
      candidate: 'Review AI candidate',
      retry: 'Check with AI again',
      retrying: 'Requesting…',
      retried: 'AI recheck requested.',
      retryFailed: 'Could not request a recheck. Please try again shortly.',
      updated: 'Updated',
    },
    es: {
      savedTitle: 'Registro guardado',
      statusTitle: 'Estado del registro',
      record: 'Registro',
      photo: 'Fotos',
      ai: 'IA',
      saved: 'Guardado',
      photoNone: 'Sin fotos',
      photoProcessing: 'Preparando',
      photoReady: 'Guardadas',
      photoRetry: 'Reintento necesario',
      aiNotRequested: 'No solicitado',
      aiQueued: 'En cola',
      aiProcessing: 'Revisando',
      aiCandidate: 'Hay candidato',
      aiCompleted: 'Revisado',
      aiFailed: 'Se puede reintentar',
      aiUnavailable: 'No disponible',
      genericMessage: 'El registro esta guardado.',
      placePrefix: 'Este registro se guardo para ',
      placeSuffix: '.',
      placeGeneric: 'Este registro se guardo para este lugar.',
      map: 'Ver lugar',
      candidate: 'Revisar candidato de IA',
      retry: 'Revisar otra vez con IA',
      retrying: 'Solicitando…',
      retried: 'Se solicito otra revision de IA.',
      retryFailed: 'No se pudo solicitar. Intentalo de nuevo en breve.',
      updated: 'Actualizado',
    },
    'pt-br': {
      savedTitle: 'Registro salvo',
      statusTitle: 'Status do registro',
      record: 'Registro',
      photo: 'Fotos',
      ai: 'IA',
      saved: 'Salvo',
      photoNone: 'Sem fotos',
      photoProcessing: 'Preparando',
      photoReady: 'Salvas',
      photoRetry: 'Precisa reenviar',
      aiNotRequested: 'Nao solicitado',
      aiQueued: 'Na fila',
      aiProcessing: 'Verificando',
      aiCandidate: 'Candidato pronto',
      aiCompleted: 'Verificado',
      aiFailed: 'Pode tentar novamente',
      aiUnavailable: 'Indisponivel',
      genericMessage: 'O registro esta salvo.',
      placePrefix: 'Este registro foi salvo para ',
      placeSuffix: '.',
      placeGeneric: 'Este registro foi salvo para este local.',
      map: 'Ver local',
      candidate: 'Revisar candidato da IA',
      retry: 'Verificar novamente com IA',
      retrying: 'Solicitando…',
      retried: 'Nova verificacao solicitada.',
      retryFailed: 'Nao foi possivel solicitar. Tente novamente em instantes.',
      updated: 'Atualizado',
    },
  };
  var currentLang = String(document.documentElement.lang || 'ja').toLowerCase();
  var copy = COPY[currentLang] || COPY.ja;

  var textNode = function (tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = String(text || '');
    return element;
  };
  var mediaLabel = function (state) {
    if (state === 'ready') return copy.photoReady;
    if (state === 'processing') return copy.photoProcessing;
    if (state === 'retry_required') return copy.photoRetry;
    return copy.photoNone;
  };
  var aiLabel = function (state) {
    if (state === 'queued') return copy.aiQueued;
    if (state === 'processing') return copy.aiProcessing;
    if (state === 'candidate_ready') return copy.aiCandidate;
    if (state === 'completed') return copy.aiCompleted;
    if (state === 'failed_retryable') return copy.aiFailed;
    if (state === 'unavailable') return copy.aiUnavailable;
    return copy.aiNotRequested;
  };
  var formattedUpdatedAt = function (value) {
    if (!value) return '';
    var date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    try {
      return new Intl.DateTimeFormat(currentLang === 'pt-br' ? 'pt-BR' : currentLang, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
    } catch (_) {
      return date.toISOString();
    }
  };
  var locationLabel = function () {
    var nodes = document.querySelectorAll('.of-meta p');
    if (nodes.length < 2) return '';
    var value = String(nodes[1].textContent || '').replace(/^[⌖\s]+/, '').trim();
    return value;
  };
  var placeMessage = function () {
    var label = locationLabel();
    if (!label) return copy.placeGeneric;
    if (currentLang === 'ja') return copy.placePrefix + '「' + label + '」' + copy.placeSuffix;
    return copy.placePrefix + label + copy.placeSuffix;
  };
  var mapHref = function () {
    return langPrefix() + '/map?tab=places&source=record_detail';
  };
  var isCaptureReturn = function () {
    try { return new URLSearchParams(location.search).get('source') === CAPTURE_SOURCE; } catch (_) { return false; }
  };
  var createState = function (label, value) {
    var item = document.createElement('div');
    item.className = 'ikimon-record-value-loop__state';
    item.appendChild(textNode('span', '', label));
    item.appendChild(textNode('strong', '', value));
    return item;
  };
  var ensurePanel = function () {
    var existing = document.querySelector('[data-ikimon-record-value-loop-panel]');
    if (existing) return existing;
    var anchor = document.querySelector('.of-record-info');
    if (!anchor || !anchor.parentNode) return null;
    var panel = document.createElement('section');
    panel.className = 'ikimon-record-value-loop';
    panel.setAttribute('data-ikimon-record-value-loop-panel', 'v1');
    panel.setAttribute('aria-live', 'polite');
    panel.hidden = true;
    anchor.insertAdjacentElement('afterend', panel);
    return panel;
  };
  var safeActionHref = function (value) {
    var href = String(value || '');
    return href.charAt(0) === '/' && href.indexOf('//') !== 0 ? href : '';
  };
  var renderPanel = function (status) {
    var panel = ensurePanel();
    if (!panel || !status) return;
    panel.replaceChildren();

    var head = document.createElement('div');
    head.className = 'ikimon-record-value-loop__head';
    head.appendChild(textNode('h2', '', isCaptureReturn() ? copy.savedTitle : copy.statusTitle));
    var updated = formattedUpdatedAt(status.updatedAt);
    if (updated) head.appendChild(textNode('span', 'ikimon-record-value-loop__updated', copy.updated + ' ' + updated));
    panel.appendChild(head);

    var states = document.createElement('div');
    states.className = 'ikimon-record-value-loop__states';
    states.appendChild(createState(copy.record, copy.saved));
    states.appendChild(createState(copy.photo, mediaLabel(status.mediaState)));
    states.appendChild(createState(copy.ai, aiLabel(status.aiState)));
    panel.appendChild(states);

    var statusMessage = currentLang === 'ja' && status.message ? status.message : copy.genericMessage;
    panel.appendChild(textNode('p', 'ikimon-record-value-loop__message', statusMessage));
    panel.appendChild(textNode('p', 'ikimon-record-value-loop__place', placeMessage()));

    var actions = document.createElement('div');
    actions.className = 'ikimon-record-value-loop__actions';
    var mapLink = textNode('a', 'ikimon-record-value-loop__action is-secondary', copy.map);
    mapLink.setAttribute('href', mapHref());
    actions.appendChild(mapLink);

    if (status.aiState === 'candidate_ready') {
      var candidateLink = textNode('a', 'ikimon-record-value-loop__action', copy.candidate);
      candidateLink.setAttribute('href', '#of-summary-title');
      actions.prepend(candidateLink);
    } else if (status.aiState === 'failed_retryable' && status.action && status.action.method === 'post') {
      var retryHref = safeActionHref(status.action.href);
      if (retryHref) {
        var retryButton = textNode('button', 'ikimon-record-value-loop__action', copy.retry);
        retryButton.type = 'button';
        retryButton.addEventListener('click', function () {
          if (retryButton.disabled) return;
          retryButton.disabled = true;
          retryButton.textContent = copy.retrying;
          fetch(retryHref, { method: 'POST', credentials: 'same-origin', headers: { accept: 'application/json' } })
            .then(function (response) {
              if (!response.ok) throw new Error('request_failed');
              retryButton.textContent = copy.retried;
              var result = panel.querySelector('.ikimon-record-value-loop__result');
              if (result) result.textContent = copy.retried;
              window.setTimeout(function () { void loadOwnerStatus(true); }, 700);
            })
            .catch(function () {
              retryButton.disabled = false;
              retryButton.textContent = copy.retry;
              var result = panel.querySelector('.ikimon-record-value-loop__result');
              if (result) result.textContent = copy.retryFailed;
            });
        });
        actions.prepend(retryButton);
      }
    } else if (status.action && status.action.method !== 'post') {
      var nextHref = safeActionHref(status.action.href);
      if (nextHref) {
        var nextLabel = currentLang === 'ja' && status.action.label ? status.action.label : copy.statusTitle;
        var nextLink = textNode('a', 'ikimon-record-value-loop__action', nextLabel);
        nextLink.setAttribute('href', nextHref);
        actions.prepend(nextLink);
      }
    }
    panel.appendChild(actions);
    panel.appendChild(textNode('div', 'ikimon-record-value-loop__result', ''));
    panel.hidden = false;
  };

  var detailMatch = location.pathname.match(/^(?:\/(?:ja|en|es|pt-br))?\/observations\/([^/]+)\/?$/i);
  var detailId = detailMatch && detailMatch[1] ? safeRecordId(safeDecode(detailMatch[1])) : '';
  var pollCount = 0;
  var pollTimer = 0;
  var shouldPoll = function (status) {
    return status && (status.mediaState === 'processing' || status.aiState === 'queued' || status.aiState === 'processing');
  };
  var schedulePoll = function (status) {
    if (!shouldPoll(status) || pollCount >= 12) return;
    window.clearTimeout(pollTimer);
    pollTimer = window.setTimeout(function () {
      pollCount += 1;
      void loadOwnerStatus(false);
    }, isCaptureReturn() ? 2000 : 5000);
  };
  var loadOwnerStatus = function (resetPoll) {
    if (!detailId) return Promise.resolve();
    if (resetPoll) pollCount = 0;
    var visitId = visitIdFromTarget(detailId);
    return fetch('/api/v1/observations/' + encodeURIComponent(visitId) + '/processing-status', {
      method: 'GET',
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
    }).then(function (response) {
      if (!response.ok) return null;
      return response.json();
    }).then(function (json) {
      if (!json || !json.ok || !json.status) return;
      renderPanel(json.status);
      schedulePoll(json.status);
    }).catch(function () {});
  };

  var startDetailEnhancement = function () {
    if (!detailId) return;
    void loadOwnerStatus(true);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startDetailEnhancement, { once: true });
  } else {
    startDetailEnhancement();
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

function nonceAttribute(cspNonce: string): string {
  const nonce = cspNonce.trim();
  return nonce ? ` nonce="${escapeAttribute(nonce)}"` : "";
}

function nonceFromContentSecurityPolicy(value: string | null): string {
  const match = String(value ?? "").match(/(?:^|;)\s*script-src\s+[^;]*?'nonce-([^'\s;]+)'/iu);
  return match?.[1] ?? "";
}

function shouldPatchHtml(html: string): boolean {
  return ELIGIBLE_HTML_MARKERS.some((marker) => html.includes(marker));
}

function repairMarkedNonce(html: string, nonce: string): string {
  if (!nonce) return html;
  return html.replace(/<(script|style)\b([^>]*?)>/giu, (full, tagName: string, attributes: string) => {
    if (!attributes.includes(PATCH_MARKER) && !attributes.includes(`id="${STYLE_ID}"`)) return full;
    const withoutNonce = attributes.replace(/\snonce=(?:"[^"]*"|'[^']*'|[^\s>]+)/iu, "");
    return `<${tagName}${withoutNonce}${nonce}>`;
  });
}

export function applyPostCaptureValueLoopPatch(html: string, cspNonce = ""): string {
  const nonce = nonceAttribute(cspNonce);
  if (html.includes(PATCH_MARKER)) return repairMarkedNonce(html, nonce);
  if (!shouldPatchHtml(html)) return html;
  if (!nonce) return html;
  const payload = `<style id="${STYLE_ID}"${nonce}>${INJECTED_STYLE}</style><script ${PATCH_MARKER}${nonce}>${INJECTED_SCRIPT}</script>`;
  if (html.includes("</head>")) return html.replace("</head>", `${payload}\n</head>`);
  return `${payload}${html}`;
}

export async function enhancePostCaptureValueLoop(request: Request, response: Response): Promise<Response> {
  if (request.method.toUpperCase() !== "GET" || response.status < 200 || response.status >= 300) return response;
  const contentType = String(response.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.includes("text/html")) return response;

  const html = await response.text();
  const patched = applyPostCaptureValueLoopPatch(html, nonceFromContentSecurityPolicy(response.headers.get("content-security-policy")));
  if (patched === html) {
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("etag");
  headers.delete("last-modified");
  headers.set("x-ikimon-post-capture-value-loop", POST_CAPTURE_VALUE_LOOP_PRESENTATION);
  return new Response(patched, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
