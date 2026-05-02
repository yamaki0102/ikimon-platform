import type { FastifyInstance } from "fastify";
import { appLangFromLocale, buildAppServiceWorker, buildOfflineHtml, buildWebManifest } from "../appInstall.js";
import { detectLangFromUrl, normalizeLang } from "../i18n.js";
import { getForwardedBasePath } from "../httpBasePath.js";
import { renderSiteDocument } from "../ui/siteShell.js";

function requestLang(request: { query?: { lang?: string }; headers: Record<string, unknown> }) {
  const queryLang = normalizeLang(request.query?.lang);
  if (request.query?.lang) {
    return queryLang;
  }
  const acceptLanguage = String(request.headers["accept-language"] ?? "").split(",")[0] ?? "";
  return appLangFromLocale(acceptLanguage);
}

export async function registerPwaRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { lang?: string } }>("/manifest.webmanifest", async (request, reply) => {
    reply
      .type("application/manifest+json; charset=utf-8")
      .header("Cache-Control", "public, max-age=3600");
    return buildWebManifest(requestLang(request as unknown as { query?: { lang?: string }; headers: Record<string, unknown> }));
  });

  app.get<{ Querystring: { lang?: string } }>("/offline.html", async (request, reply) => {
    reply
      .type("text/html; charset=utf-8")
      .header("Cache-Control", "no-cache, no-store, must-revalidate");
    return buildOfflineHtml(requestLang(request as unknown as { query?: { lang?: string }; headers: Record<string, unknown> }));
  });

  app.get("/app-sw.js", async (_request, reply) => {
    reply
      .type("application/javascript; charset=utf-8")
      .header("Cache-Control", "no-cache, no-store, must-revalidate")
      .header("Service-Worker-Allowed", "/");
    return buildAppServiceWorker();
  });

  app.get<{ Querystring: { lang?: string } }>("/debug/app-outbox", async (request, reply) => {
    const lang = detectLangFromUrl(request.url);
    const basePath = getForwardedBasePath(request.headers as Record<string, unknown>);
    const body = renderAppOutboxDebugBody();
    reply
      .type("text/html; charset=utf-8")
      .header("Cache-Control", "no-cache, no-store, must-revalidate")
      .header("X-Robots-Tag", "noindex, nofollow");
    return renderSiteDocument({
      basePath,
      lang,
      currentPath: "/debug/app-outbox",
      canonicalPath: "/debug/app-outbox",
      noindex: true,
      title: "App outbox debug | ikimon.life",
      description: "端末内に保存された ikimon app outbox の状態確認ページ。",
      activeNav: "",
      body,
      shellClassName: "app-outbox-debug-shell",
      extraStyles: appOutboxDebugStyles(),
    });
  });
}

function renderAppOutboxDebugBody(): string {
  const bootScript = `<script>
(function () {
  const listEl = document.querySelector('[data-outbox-list]');
  const emptyEl = document.querySelector('[data-outbox-empty]');
  const summaryEl = document.querySelector('[data-outbox-summary]');
  const updatedEl = document.querySelector('[data-outbox-updated]');
  const refreshBtn = document.querySelector('[data-outbox-refresh]');
  const syncBtn = document.querySelector('[data-outbox-sync]');
  const statusLabel = {
    queued: '未同期',
    error: 'エラー',
    saved: '保存中',
    syncing: '同期中'
  };
  function escapeText(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char;
    });
  }
  function groupCount(items, key) {
    return items.reduce(function (acc, item) {
      const value = String(item && item[key] || 'unknown');
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
  }
  function compactGroups(groups) {
    return Object.keys(groups).sort().map(function (key) {
      return '<span><b>' + escapeText(key) + '</b> ' + groups[key] + '</span>';
    }).join('');
  }
  function routeLabel(route) {
    const value = String(route || '');
    return value.length > 56 ? value.slice(0, 53) + '...' : value;
  }
  async function loadItems() {
    if (!(window.ikimonAppOutbox && typeof window.ikimonAppOutbox.all === 'function')) {
      if (summaryEl) summaryEl.innerHTML = '<span><b>IndexedDB</b> unavailable</span>';
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    const items = await window.ikimonAppOutbox.all();
    items.sort(function (a, b) { return Number(b.updatedAt || 0) - Number(a.updatedAt || 0); });
    if (emptyEl) emptyEl.hidden = items.length > 0;
    if (summaryEl) {
      summaryEl.innerHTML = '<span><b>Total</b> ' + items.length + '</span>' + compactGroups(groupCount(items, 'source')) + compactGroups(groupCount(items, 'status'));
    }
    if (listEl) {
      listEl.innerHTML = items.map(function (item) {
        const meta = item && item.payloadMeta ? JSON.stringify(item.payloadMeta) : '';
        const updated = item && item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '';
        const status = String(item && item.status || 'queued');
        return '<article class="outbox-item" data-outbox-source="' + escapeText(item && item.source) + '">'
          + '<div><strong>' + escapeText(item && item.source) + '</strong><span>' + escapeText(item && item.kind) + '</span></div>'
          + '<div><mark>' + escapeText(statusLabel[status] || status) + '</mark><span>' + escapeText(updated) + '</span></div>'
          + '<code>' + escapeText(item && item.id) + '</code>'
          + '<p>' + escapeText(routeLabel(item && item.route)) + '</p>'
          + (meta ? '<details><summary>payloadMeta</summary><pre>' + escapeText(meta) + '</pre></details>' : '')
          + '</article>';
      }).join('');
    }
    if (updatedEl) updatedEl.textContent = new Date().toLocaleTimeString();
  }
  if (refreshBtn) refreshBtn.addEventListener('click', function () { void loadItems(); });
  if (syncBtn) syncBtn.addEventListener('click', function () {
    if (window.ikimonRequestAppOutboxSync) void window.ikimonRequestAppOutboxSync('debug-ui');
    else window.dispatchEvent(new Event('ikimon-app-outbox-sync'));
    void loadItems();
  });
  window.addEventListener('ikimon-app-outbox-change', function () { void loadItems(); });
  window.addEventListener('online', function () { void loadItems(); });
  void loadItems();
})();
</script>`;
  return `<section class="outbox-debug" data-outbox-debug>
    <div class="outbox-debug-head">
      <div>
        <p class="outbox-kicker">App diagnostics</p>
        <h1>App outbox</h1>
        <p>この端末に残っている Guide / Record / Map の保存・未同期状態を確認します。サーバー側データは表示しません。</p>
      </div>
      <div class="outbox-actions">
        <button type="button" data-outbox-refresh>更新</button>
        <button type="button" data-outbox-sync>再送を試す</button>
      </div>
    </div>
    <div class="outbox-summary" data-outbox-summary aria-live="polite"></div>
    <p class="outbox-updated">Last read: <span data-outbox-updated>-</span></p>
    <p class="outbox-empty" data-outbox-empty hidden>この端末の app outbox は空です。</p>
    <div class="outbox-list" data-outbox-list></div>
  </section>${bootScript}`;
}

function appOutboxDebugStyles(): string {
  return `
    .app-outbox-debug-shell { max-width: 980px; }
    .outbox-debug { display: grid; gap: 18px; padding: 28px 0 48px; }
    .outbox-debug-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
    .outbox-kicker { margin: 0 0 8px; color: #047857; font-size: 12px; font-weight: 950; text-transform: uppercase; letter-spacing: .08em; }
    .outbox-debug h1 { margin: 0; font-size: clamp(30px, 5vw, 48px); line-height: 1.08; }
    .outbox-debug p { margin: 8px 0 0; color: #475569; line-height: 1.75; }
    .outbox-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .outbox-actions button { min-height: 42px; border: 0; border-radius: 8px; padding: 0 14px; background: #0f172a; color: #fff; font-weight: 900; cursor: pointer; }
    .outbox-actions button:first-child { background: #e2e8f0; color: #0f172a; }
    .outbox-summary { display: flex; flex-wrap: wrap; gap: 8px; }
    .outbox-summary span { min-height: 34px; display: inline-flex; align-items: center; gap: 6px; border: 1px solid rgba(15,23,42,.08); border-radius: 8px; padding: 0 10px; background: #fff; color: #334155; font-weight: 850; }
    .outbox-updated { margin: 0; font-size: 12px; font-weight: 850; }
    .outbox-empty { border: 1px dashed rgba(15,23,42,.18); border-radius: 8px; padding: 18px; background: #fff; }
    .outbox-empty[hidden] { display: none; }
    .outbox-list { display: grid; gap: 10px; }
    .outbox-item { display: grid; gap: 8px; border: 1px solid rgba(15,23,42,.08); border-radius: 8px; padding: 14px; background: #fff; box-shadow: 0 12px 30px rgba(15,23,42,.04); }
    .outbox-item > div { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
    .outbox-item strong { font-size: 16px; }
    .outbox-item span { color: #64748b; font-size: 12px; font-weight: 850; }
    .outbox-item mark { border-radius: 999px; padding: 4px 9px; background: #ecfdf5; color: #047857; font-size: 12px; font-weight: 950; }
    .outbox-item code { overflow-wrap: anywhere; white-space: normal; color: #334155; }
    .outbox-item p { margin: 0; font-size: 13px; }
    .outbox-item details { border-top: 1px solid rgba(15,23,42,.06); padding-top: 8px; }
    .outbox-item summary { cursor: pointer; font-weight: 900; color: #334155; }
    .outbox-item pre { white-space: pre-wrap; overflow-wrap: anywhere; margin: 8px 0 0; font-size: 12px; line-height: 1.5; color: #334155; }
    @media (max-width: 720px) {
      .outbox-debug-head { display: grid; }
      .outbox-actions { justify-content: stretch; }
      .outbox-actions button { flex: 1 1 140px; }
    }
  `;
}
