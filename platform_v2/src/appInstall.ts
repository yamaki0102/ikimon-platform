import { langFromBrowserLocale, langToUrlSegment, type SiteLang } from "./i18n.js";

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

export const appInstallCopy: Record<SiteLang, AppInstallCopy> = {
  ja: {
    name: "ikimon.life",
    shortName: "ikimon",
    description: "身近な生きものを楽しみ、地域の自然を記録し、地図とガイドで見返す生物多様性アプリ。",
    installTitle: "ikimon を端末に追加",
    installBody: "Guide、記録、地図をすぐ開けます。",
    installAction: "追加",
    dismissAction: "あとで",
    offlineTitle: "オフラインです",
    offlineBody: "接続が戻るまで、最後に開いた Guide・記録・地図を端末から再表示します。",
    offlineGuide: "Guide を開く",
    offlineRecord: "記録を開く",
    offlineMap: "地図を開く",
    retry: "再接続を試す",
  },
  en: {
    name: "ikimon.life",
    shortName: "ikimon",
    description: "A field app for recording nearby nature with Guide, Record, and Map.",
    installTitle: "Add ikimon to this device",
    installBody: "Open Guide, Record, and Map faster in the field.",
    installAction: "Add",
    dismissAction: "Later",
    offlineTitle: "You are offline",
    offlineBody: "Until the connection returns, ikimon can reopen the last cached Guide, Record, and Map screens.",
    offlineGuide: "Open Guide",
    offlineRecord: "Open Record",
    offlineMap: "Open Map",
    retry: "Try again",
  },
  es: {
    name: "ikimon.life",
    shortName: "ikimon",
    description: "Una app de campo para registrar naturaleza cercana con Guía, Registro y Mapa.",
    installTitle: "Añadir ikimon al dispositivo",
    installBody: "Abre Guía, Registro y Mapa más rápido en campo.",
    installAction: "Añadir",
    dismissAction: "Luego",
    offlineTitle: "Sin conexión",
    offlineBody: "Hasta que vuelva la conexión, ikimon puede reabrir las pantallas guardadas de Guía, Registro y Mapa.",
    offlineGuide: "Abrir Guía",
    offlineRecord: "Abrir Registro",
    offlineMap: "Abrir Mapa",
    retry: "Intentar de nuevo",
  },
  "pt-BR": {
    name: "ikimon.life",
    shortName: "ikimon",
    description: "Um app de campo para registrar a natureza próxima com Guia, Registro e Mapa.",
    installTitle: "Adicionar ikimon ao dispositivo",
    installBody: "Abra Guia, Registro e Mapa mais rápido em campo.",
    installAction: "Adicionar",
    dismissAction: "Depois",
    offlineTitle: "Você está offline",
    offlineBody: "Até a conexão voltar, o ikimon pode reabrir as telas salvas de Guia, Registro e Mapa.",
    offlineGuide: "Abrir Guia",
    offlineRecord: "Abrir Registro",
    offlineMap: "Abrir Mapa",
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
    background_color: "#f9fffe",
    theme_color: "#10b981",
    description: copy.description,
    lang,
    dir: "ltr",
    categories: ["education", "lifestyle", "utilities"],
    prefer_related_applications: false,
    icons: [
      { src: "/assets/img/icon-192-v2.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/assets/img/icon-512-v2.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/assets/img/icon-192-maskable-v2.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/assets/img/icon-512-maskable-v2.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Guide", short_name: "Guide", url: `${prefix}/guide`, icons: [{ src: "/assets/img/icon-192-v2.png", sizes: "192x192" }] },
      { name: "Record", short_name: "Record", url: `${prefix}/record`, icons: [{ src: "/assets/img/icon-192-v2.png", sizes: "192x192" }] },
      { name: "Map", short_name: "Map", url: `${prefix}/map`, icons: [{ src: "/assets/img/icon-192-v2.png", sizes: "192x192" }] },
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
  <meta name="theme-color" content="#10b981" />
  <title>${copy.offlineTitle} | ikimon.life</title>
  <style>
    *{box-sizing:border-box}body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:24px;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f9fffe;color:#0f172a}.offline{width:min(420px,100%);display:grid;gap:16px}.mark{width:56px;height:56px;border-radius:16px;background:#ecfdf5;display:grid;place-items:center;color:#047857;font-weight:950;font-size:24px}.offline h1{margin:0;font-size:26px;line-height:1.2}.offline p{margin:0;color:#475569;line-height:1.7}.links{display:grid;gap:10px;margin-top:6px}.links a,.retry{min-height:48px;border-radius:8px;border:1px solid rgba(15,23,42,.1);display:flex;align-items:center;justify-content:center;padding:0 14px;text-decoration:none;font-weight:850;color:#064e3b;background:#fff}.retry{background:#10b981;color:#fff;border:0;font:inherit;cursor:pointer}
  </style>
</head>
<body>
  <main class="offline">
    <div class="mark">i</div>
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
  return `const VERSION = 'ikimon-app-v1';
const SHELL_CACHE = VERSION + ':shell';
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
  '/assets/img/icon-192-v2.png',
  '/assets/img/icon-512-v2.png',
  '/assets/img/favicon-32.png'
];
const APP_NAV_RE = /^\\/(?:ja|en|es|pt-br)?\\/?(?:$|guide\\/?$|record\\/?$|map\\/?$)/;

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
  const cache = await caches.open(SHELL_CACHE);
  const path = new URL(request.url).pathname;
  try {
    const response = await fetch(request);
    if (response && response.ok && APP_NAV_RE.test(path)) {
      cache.put(request, response.clone()).catch(() => undefined);
    }
    return response;
  } catch (_) {
    const cached = await cache.match(request);
    if (cached) return cached;
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
