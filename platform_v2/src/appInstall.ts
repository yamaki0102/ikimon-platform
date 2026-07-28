import { langFromBrowserLocale, langToUrlSegment, type SiteLang } from "./i18n.js";
import { BRAND_ASSETS } from "./brandAssets.js";

type AppInstallCopy = {
  name: string;
  shortName: string;
  description: string;
  installTitle: string;
  installBody: string;
  installAction: string;
  dismissAction: string;
  offlineTitle: string;
  offlineBody: string;
  offlineGuide: string;
  offlineRecord: string;
  offlineMap: string;
  retry: string;
};

export const APP_LAUNCH_BACKGROUND_COLOR = "#f7f7f3";
export const APP_THEME_COLOR = "#143f2e";

export const appInstallCopy: Record<SiteLang, AppInstallCopy> = {
  ja: {
    name: "ZUKAN",
    shortName: "ZUKAN",
    description: "写真や記録を場所と時間につなぎ、地域の記憶をみんなで育てるアプリ。",
    installTitle: "ZUKAN を端末に追加",
    installBody: "撮る、場所、記録、自分をすぐ開けます。",
    installAction: "追加",
    dismissAction: "あとで",
    offlineTitle: "オフラインです",
    offlineBody: "接続が戻るまで、最後に開いた記録・場所・ガイドを端末から再表示します。",
    offlineGuide: "ガイドを開く",
    offlineRecord: "記録を開く",
    offlineMap: "場所を開く",
    retry: "再接続を試す",
  },
  en: {
    name: "ZUKAN",
    shortName: "ZUKAN",
    description: "A place- and time-aware photo record for growing local knowledge together.",
    installTitle: "Add ZUKAN to this device",
    installBody: "Open Capture, Places, Records, and My page faster.",
    installAction: "Add",
    dismissAction: "Later",
    offlineTitle: "You are offline",
    offlineBody: "Until the connection returns, ZUKAN can reopen cached Records, Places, and Guides.",
    offlineGuide: "Open Guide",
    offlineRecord: "Open Records",
    offlineMap: "Open Places",
    retry: "Try again",
  },
  es: {
    name: "ZUKAN",
    shortName: "ZUKAN",
    description: "Un registro de fotos conectado con lugares y tiempo para cultivar conocimiento local.",
    installTitle: "Añadir ZUKAN al dispositivo",
    installBody: "Abre Capturar, Lugares, Registros y Mi página más rápido.",
    installAction: "Añadir",
    dismissAction: "Luego",
    offlineTitle: "Sin conexión",
    offlineBody: "Hasta que vuelva la conexión, ZUKAN puede reabrir Registros, Lugares y Guías guardados.",
    offlineGuide: "Abrir Guía",
    offlineRecord: "Abrir Registros",
    offlineMap: "Abrir Lugares",
    retry: "Intentar de nuevo",
  },
  "pt-BR": {
    name: "ZUKAN",
    shortName: "ZUKAN",
    description: "Um registro de fotos ligado a lugares e tempo para cultivar conhecimento local.",
    installTitle: "Adicionar ZUKAN ao dispositivo",
    installBody: "Abra Capturar, Lugares, Registros e Minha página mais rápido.",
    installAction: "Adicionar",
    dismissAction: "Depois",
    offlineTitle: "Você está offline",
    offlineBody: "Até a conexão voltar, o ZUKAN pode reabrir Registros, Lugares e Guias salvos.",
    offlineGuide: "Abrir Guia",
    offlineRecord: "Abrir Registros",
    offlineMap: "Abrir Lugares",
    retry: "Tentar novamente",
  },
};

export function appLangFromLocale(locale: string | null | undefined): SiteLang {
  return langFromBrowserLocale(locale);
}

export function buildWebManifest(lang: SiteLang): Record<string, unknown> {
  const copy = appInstallCopy[lang];
  const prefix = `/${langToUrlSegment(lang)}`;
  return {
    name: copy.name,
    short_name: copy.shortName,
    id: `${prefix}/?source=pwa`,
    start_url: `${prefix}/?source=pwa`,
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui", "browser"],
    background_color: APP_LAUNCH_BACKGROUND_COLOR,
    theme_color: APP_THEME_COLOR,
    description: copy.description,
    lang,
    dir: "ltr",
    categories: ["education", "lifestyle", "utilities"],
    prefer_related_applications: false,
    icons: [
      { src: BRAND_ASSETS.mark192, sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: BRAND_ASSETS.mark512, sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: BRAND_ASSETS.mark192Maskable, sizes: "any", type: "image/svg+xml", purpose: "maskable" },
      { src: BRAND_ASSETS.mark512Maskable, sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Guide", short_name: "Guide", url: `${prefix}/guide`, icons: [{ src: BRAND_ASSETS.mark192, sizes: "any", type: "image/svg+xml" }] },
      { name: "Record", short_name: "Record", url: `${prefix}/record`, icons: [{ src: BRAND_ASSETS.mark192, sizes: "any", type: "image/svg+xml" }] },
      { name: "Map", short_name: "Map", url: `${prefix}/map`, icons: [{ src: BRAND_ASSETS.mark192, sizes: "any", type: "image/svg+xml" }] },
    ],
    orientation: "portrait-primary",
  };
}

export function buildOfflineHtml(lang: SiteLang): string {
  const copy = appInstallCopy[lang];
  const prefix = `/${langToUrlSegment(lang)}`;
  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="${APP_THEME_COLOR}" />
  <title>${copy.offlineTitle} | ZUKAN</title>
  <style>
    *{box-sizing:border-box}body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:24px;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:${APP_LAUNCH_BACKGROUND_COLOR};color:#17211b}.offline{width:min(420px,100%);display:grid;gap:16px}.mark{width:64px;height:64px;border-radius:18px;display:grid;place-items:center;overflow:hidden}.mark img{width:100%;height:100%;display:block}.offline h1{margin:0;font-size:26px;line-height:1.2}.offline p{margin:0;color:#69716c;line-height:1.7}.links{display:grid;gap:10px;margin-top:6px}.links a,.retry{min-height:48px;border-radius:999px;border:1px solid rgba(20,63,46,.16);display:flex;align-items:center;justify-content:center;padding:0 14px;text-decoration:none;font-weight:850;color:#143f2e;background:#fff}.retry{background:#143f2e;color:#fff;border:0;font:inherit;cursor:pointer}
  </style>
</head>
<body>
  <main class="offline">
    <div class="mark"><img src="${BRAND_ASSETS.mark192}" alt="ZUKAN" /></div>
    <h1>${copy.offlineTitle}</h1>
    <p>${copy.offlineBody}</p>
    <div class="links">
      <a href="${prefix}/guide">${copy.offlineGuide}</a>
      <a href="${prefix}/record">${copy.offlineRecord}</a>
      <a href="${prefix}/map">${copy.offlineMap}</a>
      <button class="retry" type="button" onclick="location.reload()">${copy.retry}</button>
    </div>
  </main>
  <script>window.addEventListener('online',()=>location.reload(),{once:true});</script>
</body>
</html>`;
}

export function buildAppServiceWorker(): string {
  return `const VERSION = 'ikimon-app-v9';
const STATIC_CACHE = VERSION + ':static';
const OFFLINE_URL = '/offline.html';
const OFFLINE_URLS = {
  ja: '/offline.html?lang=ja',
  en: '/offline.html?lang=en',
  es: '/offline.html?lang=es',
  'pt-br': '/offline.html?lang=pt-BR'
};
const STATIC_ASSETS = [
  OFFLINE_URL,
  OFFLINE_URLS.ja,
  OFFLINE_URLS.en,
  OFFLINE_URLS.es,
  OFFLINE_URLS['pt-br'],
  '${BRAND_ASSETS.mark192}',
  '${BRAND_ASSETS.mark192Maskable}',
  '${BRAND_ASSETS.mark512}',
  '${BRAND_ASSETS.favicon32}'
];
const MAP_NAV_RE = /^\\/(?:ja|en|es|pt-br)?\\/?map\\/?$/;
const PERSONAL_NAV_RE = /^\\/(?:ja|en|es|pt-br)?\\/?(?:$|home\\/?$|profile(?:\\/settings)?\\/?$|settings\\/?$|records\\/?$|record\\/?$)/;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('ikimon-app-') && !key.startsWith(VERSION)).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function networkFirstNavigation(request) {
  const path = new URL(request.url).pathname;
  const isMapShell = MAP_NAV_RE.test(path);
  const isPersonalShell = PERSONAL_NAV_RE.test(path);
  try {
    const response = await fetch(request, (isMapShell || isPersonalShell) ? { cache: 'no-store' } : undefined);
    return response;
  } catch (_) {
    if (isMapShell || isPersonalShell) {
      const match = path.match(/^\\/(ja|en|es|pt-br)(?:\\/|$)/);
      const offlineUrl = match && OFFLINE_URLS[match[1]] ? OFFLINE_URLS[match[1]] : OFFLINE_URLS.ja;
      return (await caches.match(offlineUrl))
        || (await caches.match(OFFLINE_URL))
        || new Response('offline', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }
    const match = path.match(/^\\/(ja|en|es|pt-br)(?:\\/|$)/);
    const offlineUrl = match && OFFLINE_URLS[match[1]] ? OFFLINE_URLS[match[1]] : OFFLINE_URLS.ja;
    return (await caches.match(offlineUrl))
      || (await caches.match(OFFLINE_URL))
      || new Response('offline', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }
  if (url.pathname.startsWith('/assets/img/')) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response && response.ok) caches.open(STATIC_CACHE).then((cache) => cache.put(request, response.clone())).catch(() => undefined);
      return response;
    })));
  }
});

async function notifyOutboxSyncClients(reason) {
  const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  await Promise.all(clientsList.map((client) => client.postMessage({
    type: 'ikimon:app-outbox-sync',
    reason: reason || 'background-sync'
  })));
}

self.addEventListener('sync', (event) => {
  if (event.tag !== 'ikimon-app-outbox-sync') return;
  event.waitUntil(notifyOutboxSyncClients('background-sync'));
});
`;
}
