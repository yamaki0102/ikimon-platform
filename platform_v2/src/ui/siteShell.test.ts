import assert from "node:assert/strict";
import test from "node:test";
import { runWithCspNonce } from "../services/cspNonce.js";
import { getSiteShellLayoutForPath } from "../siteMap.js";
import { renderSiteDocument } from "./siteShell.js";

test("site shell keeps the keyboard skip link at the 44px target contract", () => {
  const html = renderSiteDocument({ basePath: "", title: "Test", body: "<p>body</p>", lang: "ja" });
  assert.match(html, /\.skip-link \{[\s\S]*?min-height: 44px;[\s\S]*?display: inline-flex;[\s\S]*?align-items: center;/);
});

test("desktop shell controls keep a real 44px target contract", () => {
  const html = renderSiteDocument({ basePath: "", title: "Test", body: "<p>body</p>", lang: "ja" });
  assert.match(html, /\.desktop-side-nav-toggle \{[\s\S]*?width: 44px;[\s\S]*?height: 44px;[\s\S]*?flex: 0 0 44px;/);
  assert.match(html, /\.site-search \{[\s\S]*?min-height: 44px;[\s\S]*?padding: 0 14px;/);
  assert.match(html, /\.site-search-input \{[\s\S]*?min-height: 44px;/);
  assert.match(html, /\.desktop-side-nav-link \{[\s\S]*?min-height: 44px;/);
  assert.match(html, /\.desktop-side-nav-text-link \{[\s\S]*?min-height: 44px;/);
  assert.match(html, /\.side-nav-collapsible-summary \{[\s\S]*?min-height: 44px;/);
  assert.match(html, /\.desktop-side-nav-mini-summary \{[\s\S]*?min-height: 44px;/);
  assert.match(html, /\.desktop-side-nav-legal \{[^}]*color: #64748b;/);
  assert.doesNotMatch(html, /\.desktop-side-nav-legal \{[^}]*color: #94a3b8;/);
  assert.match(html, /@media \(min-width: 1161px\) \{[\s\S]*?\.brand-logo-lockup \{[\s\S]*?min-height: 44px;/);
});

test("site shell hydrates the login link from the v2 session endpoint", () => {
  const html = renderSiteDocument({
    basePath: "",
    title: "Test",
    body: "<p>body</p>",
    lang: "ja",
  });

  assert.doesNotMatch(html, /class="btn btn-ghost site-login-link"/);
  assert.doesNotMatch(html, /class="desktop-side-nav-link site-login-link/);
  assert.match(html, /class="site-mobile-menu-account site-login-link"/);
  assert.match(html, /class="site-mobile-account-row"/);
  assert.match(html, /class="site-mobile-account-actions"/);
  assert.match(html, /class="site-mobile-return-links"/);
  assert.match(html, /<a class="site-mobile-return-link" href="\/ja\/profile">[\s\S]*<span>マイページ<\/span><\/a>/);
  assert.match(html, /<a class="site-mobile-return-link" href="\/ja\/records\?view=mine">[\s\S]*<span>自分の記録<\/span><\/a>/);
  assert.match(html, /class="site-account-icons"/);
  assert.match(html, /data-account-profile/);
  assert.match(html, /data-account-alerts/);
  assert.match(html, /data-account-settings/);
  assert.match(html, /\/login\?redirect=%2Fprofile/);
  assert.match(html, /\/api\/v1\/auth\/session\?optional=1/);
  assert.match(html, /\/api\/v1\/me\/personalized-menu\?limit=8/);
  assert.match(html, /\/api\/v1\/me\/alerts/);
  assert.match(html, /\/api\/v1\/me\/alerts\/read/);
  assert.match(html, /data-notification-panel/);
  assert.match(html, /data-notification-toggle/);
  assert.match(html, /data-notification-read-all/);
  assert.match(html, /\.site-notification-badge\[hidden\] \{ display: none; \}/);
  assert.match(html, /credentials: 'same-origin'/);
  assert.match(html, /マイページ/);
  assert.match(html, /rel="manifest" href="\/manifest\.webmanifest\?lang=ja"/);
  assert.match(html, /rel="apple-touch-icon" sizes="180x180" href="\/assets\/brand\/zukan-apple-touch-icon\.png"/);
  assert.match(html, /rel="icon" type="image\/png" sizes="32x32" href="\/assets\/brand\/zukan-favicon-32\.png"/);
  assert.match(html, /rel="icon" type="image\/x-icon" sizes="32x32" href="\/favicon\.ico"/);
  assert.match(html, /rel="icon" type="image\/png" sizes="192x192" href="\/assets\/brand\/zukan-app-icon-192\.png"/);
  assert.match(html, /navigator\.languages/);
  assert.match(html, /beforeinstallprompt/);
  assert.match(html, /navigator\.serviceWorker\.register\('\/app-sw\.js'/);
  assert.match(html, /updateViaCache: 'none'/);
  assert.match(html, /registration\.update\(\)/);
  assert.match(html, /data-app-install-prompt/);
  assert.match(html, /<meta name="theme-color" content="#143f2e" \/>/);
  assert.match(html, /data-app-launch-screen/);
  assert.match(html, /ikimon:app-launch-screen-shown-v1/);
  assert.match(html, /is-app-launch-screen-eligible/);
  assert.match(html, /appLaunchMarkBreath/);
  assert.match(html, /prefers-reduced-motion: reduce/);
  const launchHtml = html.slice(html.indexOf("data-app-launch-screen"), html.indexOf("data-language-suggestion"));
  assert.match(launchHtml, /alt=""/);
  assert.doesNotMatch(launchHtml, />\s*[^<\s][^<]*</);
  assert.doesNotMatch(launchHtml, /読み込み中|はじめよう/);
  assert.doesNotMatch(html, /<footer class="site-footer">/);
  assert.match(html, /desktop-side-nav-section--guest/);
  assert.match(html, /desktop-side-nav-section--signed-in/);
  assert.match(html, /desktop-side-nav-section--personalized/);
  assert.match(html, /data-side-nav-personalized-list/);
  assert.match(html, /parts\.push\('確認中' \+ needsIdCount \+ '件'\)/);
  assert.doesNotMatch(html, /parts\.push\('名前待ち' \+ needsIdCount\)/);
  assert.doesNotMatch(html, /ログインすると、フォロー中の分類群や観察エリアをここに固定します。/);
  assert.match(html, /desktop-side-nav-mini-card/);
  assert.match(html, /class="shell shell-layout-home"/);
  assert.match(html, /class="site-nav site-nav-desktop site-core-nav"/);
  assert.match(html, /data-global-record-trigger="photo"/);
  assert.match(html, />場所<\/a>/);
  assert.match(html, />記録<\/a>/);
  assert.match(html, />自分<\/a>/);
  assert.match(html, /data-auth-member-href="\/ja\/records\?view=mine"/);
  assert.match(html, /href="\/ja\/profile" title="マイページ"/);
  assert.match(html, /href="\/ja\/records\?view=mine" title="記録を見る"/);
  assert.match(html, /href="\/ja\/records" title="記録を見る"/);
  assert.match(html, /href="\/ja\/records\?view=needs_id">名前を待つ記録/);
  assert.doesNotMatch(html, /名前を待つ観察レコード/);
  assert.doesNotMatch(html, /href="\/ja\/observations\?filter=needs_id" title="同定"/);
  assert.match(html, /href="\/ja\/learn\/updates"/);
  assert.doesNotMatch(html, /desktop-side-nav-section-title">今日使う/);
  assert.match(html, /desktop-side-nav-section-title">今日の続き/);
  assert.match(html, /desktop-side-nav-section-title">フォロー中/);
  assert.match(html, /desktop-side-nav-section-title">探す・見る/);
  assert.match(html, /desktop-side-nav-section-title">地域・みんな/);
  assert.match(html, /side-nav-collapsible-summary">更新・連絡/);
  assert.match(html, /href="\/ja\/learn\/field-loop">観察の流れ/);
  assert.match(html, /href="\/ja\/learn\/glossary">用語集/);
  assert.doesNotMatch(html, /政策・企業活動と自然/);
  assert.doesNotMatch(html, /href="\/ja\/for-business/);
  assert.doesNotMatch(html, /href="\/ja\/specialist/);
  assert.match(html, /html\[data-auth="signed-in"\] \.desktop-side-nav-section--guest/);
  assert.match(html, /\.site-mobile-menu-section\.desktop-side-nav-section--signed-in \{[^}]*display: none;/);
  assert.match(html, /window\.ikimonAppOutbox/);
  assert.match(html, /class="site-core-nav-link is-capture" data-global-record-trigger="photo"/);
  assert.doesNotMatch(html, /class="desktop-side-nav-link[^"]*" href="\/ja\/record(?:\?|")/);
  assert.match(html, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(html, /location: latestCaptureLocation,/);
  assert.match(html, /const resolvedLocation = await requestCaptureLocation\(true\) \|\| metadata\.location;/);
  assert.match(html, /let latestCaptureLocationAt = 0;/);
  assert.match(html, /maximumAge: forceFresh \? 0 : 15000/);
  assert.match(html, /latestCaptureLocation = null;\s+latestCaptureLocationAt = 0;\s+void requestCaptureLocation\(true\);/);
  assert.match(html, /button\.addEventListener\('click', \(event\) => \{\s+event\.preventDefault\(\);/);
  assert.match(html, /ikimon-app-outbox-v1/);
  assert.match(html, /window\.ikimonRequestAppOutboxSync/);
  assert.match(html, /registration\.sync\.register\('ikimon-app-outbox-sync'\)/);
  assert.match(html, /ikimon-app-outbox-change/);
  assert.match(html, /ikimon:app-outbox-sync/);
  assert.match(html, /G-NCL0M1VJZ2/);
  assert.match(html, /googletagmanager\.com\/gtag\/js/);
  assert.match(html, /window\.gtag\('config', googleTagId\)/);
  assert.match(html, /window\.ikimonExternalAnalytics = \{ track: trackExternalAnalytics \}/);
  assert.match(html, /window\.gtag\('event', name, params\)/);
  assert.match(html, /window\.clarity\('event', name\)/);
  assert.match(html, /window\.clarity\('set', 'ikimon_action', params\.action_key\)/);
  assert.match(html, /www\.clarity\.ms\/tag/);
  assert.match(html, /wl2ezvfqbh/);
  assert.match(html, /host !== 'ikimon\.life' && host !== 'www\.ikimon\.life'/);
  assert.match(html, /<span class="brand-wordmark" aria-label="ZUKAN">/);
  assert.match(html, /<img class="brand-wordmark-img" src="\/assets\/brand\/zukan-wordmark\.svg" alt="" \/>/);
  assert.match(html, /<span class="brand-mark"><img src="\/assets\/brand\/zukan-app-icon-192\.png" alt="" \/><\/span>/);
  assert.match(html, /\.brand-logo-lockup \{[\s\S]*align-items: center;[\s\S]*gap: 7px;/);
  assert.match(html, /\.brand-wordmark \{[\s\S]*flex: 0 0 auto;[\s\S]*width: auto;[\s\S]*height: 16px;[\s\S]*aspect-ratio: 711 \/ 222;/);
  assert.match(html, /\.brand-wordmark-img \{[\s\S]*width: auto;[\s\S]*height: 100%;[\s\S]*max-width: none;/);
  assert.match(html, /--ikimon-header-brand-w: max\(var\(--ikimon-desktop-sidebar-w\), 154px\);/);
  assert.match(html, /body\.is-desktop-side-nav-collapsed \{[\s\S]*--ikimon-header-brand-w: 154px;/);
  assert.match(html, /grid-template-columns: var\(--ikimon-header-brand-w\) minmax\(280px, 640px\) minmax\(0, 1fr\);/);
  assert.match(html, /\.site-search-desktop \{[\s\S]*grid-column: 2;/);
  assert.match(html, /\.site-header-actions-desktop \{[\s\S]*grid-column: 3;[\s\S]*justify-self: end;/);
  assert.match(html, /@media \(min-width: 1161px\) \{[\s\S]*\.site-header-actions-mobile \{[\s\S]*display: none !important;/);
  assert.match(html, /@media \(max-width: 1160px\) \{[\s\S]*\.desktop-side-nav-toggle \{[\s\S]*display: none !important;/);
  assert.match(html, /@media \(max-width: 430px\) \{[\s\S]*\.brand-logo-lockup \{[\s\S]*gap: 6px;[\s\S]*\.brand-wordmark \{[\s\S]*width: auto;[\s\S]*height: 15px;[\s\S]*aspect-ratio: 711 \/ 222;/);
  assert.doesNotMatch(html, /<span class="brand-name">ikimon<\/span>/);
  assert.doesNotMatch(html, /class="brand-domain">\.life/);
  assert.match(html, /<meta name="application-name" content="ZUKAN" \/>/);
  assert.match(html, /<meta name="apple-mobile-web-app-title" content="ZUKAN" \/>/);
  assert.match(html, /<meta property="og:site_name" content="ZUKAN" \/>/);
  assert.match(html, /<meta property="og:image" content="https:\/\/zukan\.earth\/assets\/brand\/zukan-ogp-default\.png" \/>/);
  assert.match(html, /<meta property="og:image:type" content="image\/png" \/>/);
  assert.match(html, /<meta property="og:image:width" content="1200" \/>/);
  assert.match(html, /<meta property="og:image:height" content="630" \/>/);
  assert.match(html, /<meta property="og:image:alt" content="ZUKAN" \/>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/zukan\.earth\/ja\/" \/>/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image" \/>/);
  assert.match(html, /<meta name="twitter:image" content="https:\/\/zukan\.earth\/assets\/brand\/zukan-ogp-default\.png" \/>/);
  assert.match(html, /<span>ZUKAN<\/span>\s*<span>皆で作る地域図鑑<\/span>/);
  assert.doesNotMatch(html, /aria-label="ikimon"|application-name" content="ikimon|apple-mobile-web-app-title" content="ikimon|og:site_name" content="ikimon|og:image:alt" content="ikimon"/i);
});

test("site shell replaces existing and empty script nonce attributes with the active CSP nonce", () => {
  const html = runWithCspNonce("shell-test-nonce", () => renderSiteDocument({
    basePath: "",
    title: "Test",
    body: "<script nonce=\"stale-shell-nonce\">window.staleNonceScript = true;</script><script nonce=\"\">window.emptyNonceScript = true;</script><script>window.missingNonceScript = true;</script>",
    lang: "ja",
  }));

  assert.match(html, /<script nonce="shell-test-nonce">window\.staleNonceScript = true;<\/script>/);
  assert.match(html, /<script nonce="shell-test-nonce">window\.emptyNonceScript = true;<\/script>/);
  assert.match(html, /<script nonce="shell-test-nonce">window\.missingNonceScript = true;<\/script>/);
  assert.doesNotMatch(html, /stale-shell-nonce/);
  assert.doesNotMatch(html, /<script\b[^>]*\bnonce=""/);
});

test("site shell keeps records search query and view in header search", () => {
  const html = renderSiteDocument({
    basePath: "",
    title: "Test",
    body: "<p>body</p>",
    lang: "ja",
    currentPath: "/ja/records?view=needs_id&q=%E3%82%AB%E3%83%A9%E3%82%B9",
  });

  assert.match(html, /<input type="hidden" name="view" value="needs_id" \/>/);
  assert.match(html, /name="q" placeholder="[^"]*" value="カラス"/);
});

test("mobile menu panel can render outside the sticky header", () => {
  const html = renderSiteDocument({
    basePath: "",
    title: "Test",
    body: "<p>body</p>",
    lang: "ja",
  });

  assert.match(html, /\.site-header \{[^}]*z-index: 90;[^}]*overflow: visible;/);
  assert.match(html, /class="site-mobile-menu-toggle" aria-label="メニュー" title="メニュー"/);
  assert.match(html, /\.site-mobile-menu-panel \{[^}]*position: absolute;[^}]*z-index: 2;[^}]*top: calc\(100% \+ 9px\);/);
  assert.match(html, /\.site-mobile-menu-panel \{[^}]*background: #ffffff;/);
  assert.match(html, /\.site-mobile-menu-panel \{[^}]*max-height: calc\(100dvh - 76px\);[^}]*overflow-y: auto;/);
  assert.match(html, /\.site-mobile-menu-panel \{[^}]*overscroll-behavior: contain;/);
  assert.match(html, /\.site-mobile-return-link \{[^}]*min-height: 54px;[^}]*border-radius: 12px;/);
  assert.match(html, /\.site-mobile-return-link \.desktop-side-nav-icon \{[^}]*width: 18px;[^}]*height: 18px;/);
});

test("language switch is user-facing while SEO stays Japanese canonical", () => {
  const html = renderSiteDocument({
    basePath: "",
    title: "Test",
    body: "<p>body</p>",
    lang: "en",
    currentPath: "/?lang=en",
  });
  const head = html.slice(0, html.indexOf("</head>"));

  assert.match(html, /class="lang-switch-label"/);
  assert.match(html, /class="lang-switch-current">EN<\/span>/);
  assert.match(html, /<span class="lang-switch-name">English<\/span>/);
  assert.match(html, /\.lang-switch::after/);
  assert.match(html, /\.lang-switch:hover::after,\s*\.lang-switch:focus-within::after/);
  assert.match(html, /aria-current="true"/);
  assert.match(head, /<link rel="canonical" href="https:\/\/zukan\.earth\/ja\/" \/>/);
  assert.match(head, /<meta name="robots" content="noindex,follow" \/>/);
  assert.match(head, /hreflang="ja"/);
  assert.match(head, /hreflang="x-default"/);
  assert.doesNotMatch(head, /hreflang="en"/);
});

test("site shell normalizes service name in visible page titles", () => {
  const html = renderSiteDocument({
    basePath: "",
    title: "地域カード管理 — ikimon.life",
    body: "<p>body</p>",
    lang: "ja",
  });

  assert.match(html, /<title>地域カード管理 — ZUKAN<\/title>/);
  assert.match(html, /<meta property="og:title" content="地域カード管理 — ZUKAN" \/>/);
  assert.match(html, /<meta name="twitter:title" content="地域カード管理 — ZUKAN" \/>/);
  assert.doesNotMatch(html, /<title>[^<]*ikimon\.life/);
});

test("browser language handling asks before switching away from Japanese SEO entry", () => {
  const html = renderSiteDocument({
    basePath: "",
    title: "Test",
    body: "<p>body</p>",
    lang: "ja",
    currentPath: "/?lang=ja",
  });

  assert.match(html, /data-language-suggestion/);
  assert.match(html, /data-language-suggestion-dismiss aria-label="閉じる"/);
  assert.match(html, /Use ZUKAN in English\?/);
  assert.match(html, /Cambiar a español/);
  assert.match(html, /Mudar para português/);
  assert.match(html, /ikimon:locale-suggestion-dismissed-v1/);
  assert.match(html, /source', 'device_locale'/);
  assert.match(html, /showLanguageSuggestion\(deviceLang\)/);
  assert.doesNotMatch(html, /location\.replace\('/);
  assert.doesNotMatch(html, /ikimon:locale-redirect-v1/);
});

test("app install prompt stores beforeinstallprompt without immediate display", () => {
  const html = renderSiteDocument({
    basePath: "",
    title: "Record",
    body: "<p>record</p>",
    lang: "ja",
    currentPath: "/record?lang=ja",
  });
  const listenerStart = html.indexOf("window.addEventListener('beforeinstallprompt'");
  const listenerEnd = html.indexOf("if (dismissEl)", listenerStart);
  const listener = html.slice(listenerStart, listenerEnd);

  assert.match(listener, /event\.preventDefault\(\);/);
  assert.match(listener, /deferredPrompt = event;/);
  assert.match(listener, /window\.setTimeout\(showInstallPrompt, 0\);/);
  assert.doesNotMatch(listener, /promptEl\.hidden = false;/);
});

test("app install prompt only allows mobile return-value surfaces", () => {
  const html = renderSiteDocument({
    basePath: "",
    title: "Records",
    body: "<p>records</p>",
    lang: "ja",
    currentPath: "/records?lang=ja",
  });
  const routeStart = html.indexOf("function isReturnValueInstallSurface()");
  const routeEnd = html.indexOf("function showInstallPrompt()", routeStart);
  const routeLogic = html.slice(routeStart, routeEnd);

  assert.ok(routeLogic.includes("replace(/"));
  assert.ok(routeLogic.includes("+$/, '')"));
  assert.match(routeLogic, /pathname === '\/'/);
  assert.match(routeLogic, /pathname === '\/home'/);
  assert.match(routeLogic, /pathname === '\/records'/);
  assert.match(routeLogic, /pathname === '\/map'/);
  assert.match(routeLogic, /pathname === '\/profile'/);
  assert.doesNotMatch(routeLogic, /pathname === '\/record'/);
  assert.match(html, /function isMobileInstallSurface\(\) \{\s+return window\.matchMedia\('\(max-width: 900px\) and \(pointer: coarse\)'\)\.matches;\s+\}/);
  assert.match(html, /if \(!promptEl \|\| !deferredPrompt \|\| isStandalone\(\) \|\| !isMobileInstallSurface\(\) \|\| !isReturnValueInstallSurface\(\)\) return;/);
});

test("site shell renders a global record footer nav outside the record flow", () => {
  const html = renderSiteDocument({
    basePath: "",
    title: "Test",
    body: "<p>body</p>",
    lang: "ja",
    currentPath: "/?lang=ja",
  });

  assert.match(html, /class="global-record-launcher"/);
  assert.equal(html.match(/<(?:button|a)[^>]+class="global-record-choice/g)?.length, 4);
  assert.equal(html.match(/data-global-record-input="gallery"/g)?.length, 1);
  assert.match(html, /data-global-record-input="gallery" type="file" accept="image\/\*" multiple/);
  assert.doesNotMatch(html, /capture="environment"/);
  assert.match(html, /files: draftFiles/);
  assert.match(html, /Array\.from\(input\.files\)/);
  assert.doesNotMatch(html, /class="global-record-entry"/);
  assert.doesNotMatch(html, /class="global-record-entry"[^>]*aria-expanded="false"/);
  assert.match(html, /data-kpi-action="capture_nav"/);
  assert.doesNotMatch(html, /data-global-record-trigger="gallery"/);
  assert.doesNotMatch(html, /data-record-target="\/ja\/record\?start=photo"/);
  assert.match(html, /data-global-record-gallery-select/);
  assert.match(html, /indexedDB\.open\(DB_NAME, 1\)/);
  assert.match(html, /source: 'record'/);
  assert.match(html, /const draftOwnerContext = async \(\) =>/);
  assert.match(html, /'latest:user:' \+ userId/);
  assert.match(html, /'latest:guest:' \+ token/);
  assert.match(html, /continuationToken/);
  assert.match(html, /id: 'record:' \+ draftKey/);
  assert.doesNotMatch(html, /const DRAFT_KEY = 'latest';/);
  assert.match(html, /data-global-record-camera-sheet/);
  assert.match(html, /data-global-record-mode="photo"[^>]+aria-pressed="true"[^>]*>写真<\/button>/);
  assert.match(html, /data-global-record-mode="video"[^>]+aria-pressed="false"[^>]*>動画<\/button>/);
  assert.match(html, /data-global-record-camera-video/);
  assert.match(html, /data-global-record-camera-image/);
  assert.match(html, /data-global-record-camera-zoom/);
  assert.match(html, /data-global-record-camera-zoom-range/);
  assert.match(html, /data-global-record-camera-zoom-max/);
  assert.match(html, /data-global-record-camera-focus/);
  assert.match(html, /data-global-record-camera-focus-range/);
  assert.match(html, /data-global-record-camera-focus-auto/);
  assert.match(html, /data-global-record-photo-tray/);
  assert.match(html, /data-global-record-photo-grid/);
  assert.match(html, /const savedRecordActionsHtml = \(message\) =>/);
  assert.match(html, /data-global-record-saved-action="records"/);
  assert.match(html, /data-global-record-saved-action="profile"/);
  assert.match(html, /data-global-record-saved-action="map"/);
  assert.match(html, /\/records\?view=mine&source=record_saved/);
  assert.match(html, /\/profile\?source=record_saved/);
  assert.match(html, /\/map\?tab=places&source=record_saved/);
  assert.match(html, /setStatusHtml\(savedRecordActionsHtml\(message\)\)/);
  assert.doesNotMatch(html, /escapeHtml\(message/);
  assert.match(html, /\.global-record-saved-actions \{/);
  assert.match(html, /\.global-record-saved-actions a \{/);
  assert.match(html, /data-photo-draft="true"/);
  assert.match(html, /data-active-kind/);
  assert.doesNotMatch(html, /ここで少し整える/);
  assert.doesNotMatch(html, /data-global-record-inline-edit/);
  assert.doesNotMatch(html, /data-global-record-data-estimate/);
  assert.match(html, /data-global-record-video-trim/);
  assert.match(html, /activeKind && activeKind !== kind[\s\S]+stopActiveStream\(\)/);
  assert.match(html, /object-fit: contain/);
  assert.match(html, /global-record-camera-preview video\[hidden\]/);
  assert.match(html, /\.global-record-camera-backdrop \{[\s\S]+z-index: 130;/);
  assert.match(html, /\.global-record-camera-sheet \{[\s\S]+z-index: 131;/);
  assert.match(html, /\.global-record-camera-close \{[\s\S]+position: fixed;[\s\S]+z-index: 133;/);
  assert.match(html, /\.global-record-camera-actions \{[\s\S]+z-index: 132;/);
  assert.match(html, /--global-record-visual-top/);
  assert.match(html, /--global-record-visual-height/);
  assert.match(html, /\.global-record-camera-actions \{/);
  assert.match(html, /global-record-camera-sheet\[data-active-kind="photo"\] \.global-record-photo-tray/);
  assert.match(html, /global-record-camera-sheet\[data-camera-active="true"\] \.global-record-photo-tray/);
  assert.match(html, /\.global-record-camera-sheet \{[\s\S]+top: calc\(max\(12px, env\(safe-area-inset-top\)\) \+ var\(--global-record-visual-top, 0px\)\);/);
  assert.match(html, /\.global-record-camera-sheet \{[\s\S]+padding: 10px 10px calc\(10px \+ var\(--global-record-camera-actions-space\)\);/);
  assert.match(html, /global-record-camera-sheet\[data-photo-draft="true"\] \.global-record-camera-preview/);
  assert.match(html, /global-record-camera-sheet\[data-photo-draft="true"\] \{\s+grid-template-rows: auto auto auto auto auto;/);
  assert.match(html, /\.global-record-camera-preview \{[\s\S]+touch-action: none;/);
  assert.match(html, /\.global-record-camera-zoom \{/);
  assert.match(html, /\.global-record-camera-zoom button \{/);
  assert.match(html, /--global-record-visual-bottom/);
  assert.match(html, /\.global-record-photo-cell img \{\s+position: absolute;\s+inset: 0;/);
  assert.doesNotMatch(html, /photoDraftSubmitConfirmUntil = nowMs\(\) \+ 4500/);
  assert.doesNotMatch(html, /もう一度押すと記録/);
  assert.match(html, /if \(files\.length > 0\) \{\s+setFooterActionMode\('submit'\);/);
  assert.match(html, /右で記録、左でもう1枚撮れます。/);
  assert.match(html, /必要なら使う区間だけ選べます/);
  assert.match(html, /top: calc\(max\(12px, env\(safe-area-inset-top\)\) \+ var\(--global-record-visual-top, 0px\)\)/);
  assert.match(html, /height: clamp\(260px, min\(72dvh, calc\(var\(--global-record-visual-height, 100dvh\) - 212px\)\), 760px\)/);
  assert.match(html, /height: clamp\(240px, min\(70dvh, calc\(var\(--global-record-visual-height, 100dvh\) - 214px\)\), 640px\)/);
  assert.match(html, /global-record-camera-sheet\[data-active-kind="photo"\]:not\(\[data-camera-active="true"\]\):not\(\[data-photo-draft="true"\]\):not\(\[data-camera-error="true"\]\)/);
  assert.match(html, /global-record-camera-sheet\[data-active-kind="photo"\][\s\S]+\.global-record-camera-preview \{\s+display: none;/);
  assert.match(html, /global-record-camera-sheet\[data-active-kind="photo"\][\s\S]+\.global-record-camera-actions \{\s+position: static;/);
  assert.match(html, /grid-template-columns: 1fr;\s+gap: 8px;\s+padding: 0;/);
  assert.match(html, /\.global-record-camera-action \{\s+min-height: 56px;\s+white-space: normal;/);
  assert.match(html, /navigator\.mediaDevices\.getUserMedia/);
  assert.match(html, /track\.getCapabilities/);
  assert.match(html, /capabilities && capabilities\.zoom/);
  assert.match(html, /applyConstraints\(\{ advanced: \[\{ zoom: next \}\] \}\)/);
  assert.match(html, /capabilities && capabilities\.focusDistance/);
  assert.match(html, /manualConstraint\.focusMode = 'manual'/);
  assert.match(html, /applyCameraFocusDistance/);
  assert.match(html, /restoreCameraAutoFocus/);
  assert.match(html, /const applyCameraFocusAt = async \(clientX, clientY\)/);
  assert.match(html, /pointsOfInterest: \[point\]/);
  assert.match(html, /focusMode: 'single-shot'/);
  assert.match(html, /zoomMaxButton\.addEventListener\('click'/);
  assert.match(html, /applyCameraZoom\(cameraZoomMax\)/);
  assert.match(html, /cameraPinchDistance/);
  assert.match(html, /window\.visualViewport\.addEventListener\('resize', syncVisualViewportVars\)/);
  assert.match(html, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(html, /const metadata = buildCaptureMetadata\(\);\s+showCapturedReview\(file, 'photo', metadata\);/);
  assert.doesNotMatch(html, /fillCaptureLocationLater/);
  assert.doesNotMatch(html, /const metadata = await buildCaptureMetadata\(\);\s+showCapturedReview\(file, 'photo', metadata\);/);
  assert.match(html, /撮影地点を確認しています/);
  assert.match(html, /位置情報を取得できなかったため、写真を保持して記録画面へ移動します。/);
  assert.match(html, /global_record_capture_latency/);
  assert.match(html, /capture_to_review_ms/);
  assert.doesNotMatch(html, /gps_wait_ms/);
  assert.match(html, /camera_start_ms/);
  assert.match(html, /photo_prepare_ms/);
  assert.match(html, /observation_upsert_ms/);
  assert.match(html, /photo_upload_ms/);
  assert.match(html, /void startCamera\(\)/);
  assert.match(html, /MediaRecorder/);
  assert.match(html, /MAX_PHOTO_DRAFT_FILES = 6/);
  assert.match(html, /PHOTO_UPLOAD_MAX_EDGE = 2560/);
  assert.match(html, /PHOTO_UPLOAD_JPEG_QUALITY = 0\.88/);
  assert.match(html, /PHOTO_UPLOAD_CONCURRENCY = 2/);
  assert.match(html, /CAMERA_PHOTO_IDEAL_WIDTH = 2560/);
  assert.match(html, /CAMERA_PHOTO_IDEAL_HEIGHT = 1920/);
  assert.match(html, /CAMERA_VIDEO_IDEAL_WIDTH = 1280/);
  assert.match(html, /CAMERA_VIDEO_IDEAL_HEIGHT = 720/);
  assert.match(html, /video: cameraVideoConstraints\(\)/);
  assert.doesNotMatch(html, /redactCanvasFaces\(canvas\)/);
  assert.match(html, /server_async_face_privacy/);
  assert.match(html, /facePrivacy: upload\.facePrivacy \|\| null/);
  assert.match(html, /preparePhotoUpload/);
  assert.match(html, /canvasToJpegDataUrl\(canvas, PHOTO_UPLOAD_JPEG_QUALITY\)/);
  assert.match(html, /mapWithConcurrency\(files, PHOTO_UPLOAD_CONCURRENCY/);
  assert.match(html, /selectedPhotoDraftFiles/);
  assert.match(html, /data-global-record-photo-remove/);
  assert.match(html, /data-global-record-photo-move/);
  assert.doesNotMatch(html, /AIは全体を見て主役と周囲を判断します/);
  assert.doesNotMatch(html, /一緒に残せます/);
  assert.match(html, /photoDraftSubmitLabel/);
  assert.match(html, /global_photo_tray/);
  assert.match(html, /directPostInFlight/);
  assert.match(html, /photoDraftRetryDetailId/);
  assert.match(html, /photoDraftRetryVisitId/);
  assert.match(html, /photoDraftRetryHasUploadedPhoto/);
  assert.match(html, /const normalizeSavedObservationVisitId = \(json, fallbackId\) =>/);
  assert.match(html, /const normalizeSavedObservationTargetId = \(json, fallbackId\) =>/);
  assert.match(html, /photoUploadTargetId = normalizeSavedObservationVisitId\(observationJson, observationId\)/);
  assert.match(html, /detailId = normalizeSavedObservationTargetId\(observationJson, photoUploadTargetId \|\| observationId\)/);
  assert.match(html, /photoDraftRetryDetailId = detailId/);
  assert.match(html, /photoDraftRetryVisitId = photoUploadTargetId \|\| visitIdFromObservationTargetId\(detailId\)/);
  assert.match(html, /formatPhotoUploadFailureReason/);
  assert.doesNotMatch(html, /observation not found: ' \+ detailId/);
  assert.match(html, /clientSubmissionId/);
  assert.match(html, /client_photo_sha256s/);
  assert.match(html, /\/api\/v1\/observations\/upsert/);
  assert.match(html, /\/api\/v1\/observations\/' \+ encodeURIComponent\(photoUploadTargetId\) \+ '\/photos\/upload/);
  assert.match(html, /photoJson\.error/);
  assert.match(html, /uploadResults\.filter/);
  assert.match(html, /photo_upload_network_failed/);
  assert.match(html, /記録本体は保存済みです。写真は/);
  assert.match(html, /写真の通信確認だけ失敗しました。ホームに戻ると記録が見える場合があります/);
  assert.match(html, /同じ記録に再送/);
  assert.match(html, /失敗した' \+ String\(failed\) \+ '枚を再送/);
  assert.doesNotMatch(html, /\/api\/v1\/observations\/' \+ encodeURIComponent\(detailId\) \+ '\/reassess/);
  assert.match(html, /subject_inference: 'ai'/);
  assert.match(html, /data-global-record-camera-error/);
  assert.match(html, /data-global-record-camera-retry/);
  assert.match(html, /data-global-record-camera-cancel/);
  assert.match(html, /端末の写真から選ぶ/);
  assert.match(html, /global-record-camera-sheet\[data-camera-error="true"\] \.global-record-camera-preview/);
  assert.match(html, /@media \(min-width: 721px\) and \(max-width: 960px\)/);
  assert.match(html, /@media \(min-width: 961px\) \{\s+\.site-core-nav \{\s+display: flex;/);
  assert.match(html, /もう1枚撮る/);
  assert.match(html, /VIDEO_MAX_SECONDS = 60/);
  assert.match(html, /動画記録は最大60秒/);
  assert.match(html, /createSheetTrimmedVideoFile/);
  assert.doesNotMatch(html, /YouTube標準画質/);
  assert.doesNotMatch(html, /名前、メモを整えられます/);
  assert.match(html, /この内容で記録画面へ/);
  assert.match(html, /撮り直す/);
});

test("primary mobile navigation is capture-first and keeps camera separate from the gallery", () => {
  const html = renderSiteDocument({
    basePath: "",
    title: "Home",
    body: "<p>home</p>",
    lang: "ja",
    currentPath: "/ja/",
    homeChrome: "guest",
  });
  const launcher = html.match(/<nav class="global-record-launcher"[\s\S]*?<\/nav>/)?.[0] ?? "";

  assert.match(launcher, />撮る<\/span>/);
  assert.match(launcher, />場所<\/span>/);
  assert.match(launcher, />記録<\/span>/);
  assert.match(launcher, />自分<\/span>/);
  assert.ok(launcher.indexOf(">撮る</span>") < launcher.indexOf(">場所</span>"));
  assert.ok(launcher.indexOf(">場所</span>") < launcher.indexOf(">記録</span>"));
  assert.ok(launcher.indexOf(">記録</span>") < launcher.indexOf(">自分</span>"));
  assert.match(launcher, /<button[^>]+data-global-record-trigger="photo"[^>]+aria-haspopup="dialog"/);
  assert.doesNotMatch(launcher, /data-global-record-trigger="gallery"/);
  assert.doesNotMatch(launcher, /href="[^"]*\/record(?:\?|")/);
  assert.doesNotMatch(launcher, /aria-current="page"/);
  assert.match(html, /\.site-core-nav-link\.is-capture \{[^}]*min-height: 48px;[^}]*background: #087a4d;/);
  assert.match(html, /\.global-record-choice\.is-primary \{[^}]*min-height: 66px;[^}]*margin-top: -10px;[^}]*border-radius: 21px;/);
  assert.match(html, /\.global-record-choice\.is-primary \.global-record-choice-icon \{[^}]*width: 36px;[^}]*background: #087a4d;[^}]*color: #fff;/);
  assert.match(html, /data-global-record-gallery-select[^>]*>端末の写真から選ぶ<\/button>/);
  assert.match(html, /カメラを開けませんでした/);
  assert.match(html, /data-global-record-camera-retry[^>]*>カメラの利用を許可する<\/button>/);
  assert.match(html, /data-global-record-camera-cancel[^>]*>キャンセル<\/button>/);
  assert.match(html, /document\.addEventListener\('visibilitychange'/);
  assert.match(html, /capture_nav_tap/);
  assert.match(html, /camera_open_success/);
  assert.match(html, /camera_permission_denied/);
  assert.match(html, /camera_unavailable/);
  assert.match(html, /gallery_select_tap/);
  assert.match(html, /capture_completed/);
  assert.match(html, /capture_saved/);

  const profileHtml = renderSiteDocument({
    basePath: "",
    title: "Profile",
    body: "<p>profile</p>",
    lang: "ja",
    currentPath: "/ja/profile",
  });
  const profileLauncher = profileHtml.match(/<nav class="global-record-launcher"[\s\S]*?<\/nav>/)?.[0] ?? "";
  assert.match(profileLauncher, /global-record-choice is-active[^>]+href="\/ja\/login\?redirect=%2Fprofile"[^>]+aria-current="page"/);
});

test("browse navigation gives active state only to places, records, or self", () => {
  const surfaces = [
    { path: "/ja/map?tab=places", label: "場所" },
    { path: "/ja/records?view=mine", label: "記録" },
    { path: "/ja/profile", label: "自分" },
  ];

  for (const surface of surfaces) {
    const html = renderSiteDocument({
      basePath: "",
      title: surface.label,
      body: "<p>surface</p>",
      lang: "ja",
      currentPath: surface.path,
      homeChrome: "member",
    });
    const desktopNav = html.match(/<nav class="site-nav site-nav-desktop site-core-nav"[\s\S]*?<\/nav>/)?.[0] ?? "";
    const mobileNav = html.match(/<nav class="global-record-launcher"[\s\S]*?<\/nav>/)?.[0] ?? "";

    assert.equal((desktopNav.match(/aria-current="page"/g) || []).length, 1);
    assert.equal((mobileNav.match(/aria-current="page"/g) || []).length, 1);
    assert.match(desktopNav, new RegExp(`aria-current="page">${surface.label}</a>`));
    assert.match(mobileNav, new RegExp(`aria-current="page">[\\s\\S]*?<span>${surface.label}</span>`));
    const desktopCapture = desktopNav.match(/<button[^>]+data-global-record-trigger="photo"[^>]*>/)?.[0] ?? "";
    const mobileCapture = mobileNav.match(/<button[^>]+data-global-record-trigger="photo"[^>]*>/)?.[0] ?? "";
    assert.doesNotMatch(desktopCapture, /aria-current|is-active/);
    assert.doesNotMatch(mobileCapture, /aria-current|is-active/);
  }
});

test("logo is the auth-aware home entry and exposes its privacy-safe KPI", () => {
  const html = renderSiteDocument({
    basePath: "",
    title: "Records",
    body: "<p>records</p>",
    lang: "ja",
    currentPath: "/ja/records",
  });
  assert.match(html, /<a class="brand" href="\/ja\/" data-kpi-event="logo_home_tap"/);
  assert.doesNotMatch(html, /<footer[^>]*>[\s\S]*>ホーム</);
});

test("site shell minimal chrome keeps guest top visually quiet", () => {
  const html = renderSiteDocument({
    basePath: "",
    title: "Home",
    body: "<h1>記録を見る</h1>",
    lang: "ja",
    currentPath: "/?lang=ja",
    minimalChrome: true,
  });

  assert.match(html, /site-shell[^"]*is-minimal-chrome/);
  assert.match(html, /class="site-header site-header-minimal"/);
  assert.match(html, /class="btn btn-solid site-login-link" href="\/ja\/login\?redirect=%2Fprofile">ログイン<\/a>/);
  assert.match(html, /class="site-nav site-nav-desktop site-core-nav"/);
  assert.match(html, /class="site-core-nav-link is-capture" data-global-record-trigger="photo"/);
  assert.doesNotMatch(html, /href="[^"]*\/record\?start=photo"[^>]*data-global-record-trigger="photo"/);
  assert.doesNotMatch(html, /<nav class="desktop-side-nav-inner"/);
  assert.doesNotMatch(html, /<form class="site-search site-search-desktop"/);
  assert.doesNotMatch(html, /<div class="site-mobile-menu-panel"/);
  assert.match(html, /\.site-shell\.is-minimal-chrome \.shell\.shell-layout-home/);
  assert.match(html, /width: min\(680px, calc\(100% - 48px\)\)/);
});

test("site shell home chrome emits state-aware guest and member controls without the global launcher", () => {
  const html = renderSiteDocument({
    basePath: "",
    title: "Home",
    body: '<h1>Home</h1>',
    lang: "ja",
    currentPath: "/ja/",
    homeChrome: "member",
    hideGlobalRecordLauncher: true,
  });
  assert.match(html, /class="site-header site-header-home"/);
  assert.match(html, /data-home-auth-state="member"/);
  assert.match(html, /home-header-actions is-guest/);
  assert.match(html, /home-header-actions is-member/);
  assert.doesNotMatch(html, /class="global-record-launcher"/);
  assert.doesNotMatch(html, /class="desktop-side-nav"/);
});

test("site shell localizes the mobile global record launcher", () => {
  const html = renderSiteDocument({
    basePath: "",
    title: "Test",
    body: "<p>body</p>",
    lang: "en",
    currentPath: "/?lang=en",
  });

  assert.match(html, /aria-label="Main actions"/);
  assert.match(html, />Capture<\/span>/);
  assert.match(html, />Places<\/span>/);
  assert.match(html, />Records<\/span>/);
  assert.match(html, />Me<\/span>/);
  assert.match(html, /class="site-mobile-menu-account site-login-link" href="\/en\/login\?redirect=%2Fprofile">Sign in</);
  assert.match(html, /Capture a record/);
  assert.match(html, /Choose from device/);
  assert.doesNotMatch(html, /aria-label="主要ナビゲーション"/);
  assert.doesNotMatch(html, />撮る<\/span>/);
});

test("site shell excludes the global record launcher from record surfaces", () => {
  const html = renderSiteDocument({
    basePath: "",
    title: "Record",
    body: "<p>record</p>",
    lang: "ja",
    currentPath: "/record?lang=ja",
  });
  const localizedHtml = renderSiteDocument({
    basePath: "",
    title: "Record",
    body: "<p>record</p>",
    lang: "ja",
    currentPath: "/ja/record?start=photo",
  });
  const subpathHtml = renderSiteDocument({
    basePath: "",
    title: "Record draft",
    body: "<p>record draft</p>",
    lang: "ja",
    currentPath: "/record/drafts?lang=ja",
  });

  for (const rendered of [html, localizedHtml, subpathHtml]) {
    assert.doesNotMatch(rendered, /class="global-record-launcher"/);
    assert.doesNotMatch(rendered, /class="site-nav site-nav-desktop site-core-nav"/);
    assert.doesNotMatch(rendered, /site-shell has-global-record-launcher/);
    assert.doesNotMatch(rendered, /class="global-record-entry"/);
    assert.doesNotMatch(rendered, /data-global-record-trigger="photo"/);
    assert.doesNotMatch(rendered, /aria-current="page"[^>]*>撮る/);
  }
});

test("site shell treats guide outcomes as a reading surface with quick record actions", () => {
  const html = renderSiteDocument({
    basePath: "",
    title: "Guide outcomes",
    body: "<p>outcomes</p>",
    lang: "ja",
    currentPath: "/guide/outcomes?lang=ja",
  });

  assert.match(html, /class="global-record-launcher"/);
  assert.match(html, /site-shell has-global-record-launcher/);
});

test("desktop side nav is opaque and footerless on immersive surfaces", () => {
  const html = renderSiteDocument({
    basePath: "",
    title: "Map",
    body: "<p>map</p>",
    lang: "ja",
    currentPath: "/map?lang=ja",
    shellClassName: "shell-bleed shell-map",
  });

  assert.match(html, /\.desktop-side-nav \{[^}]*background: #ffffff;[^}]*backdrop-filter: none;/);
  assert.match(html, /\.site-shell\.is-immersive-surface \.desktop-side-nav \{[^}]*background: #ffffff;[^}]*backdrop-filter: none;/);
  assert.match(html, /\.site-shell\.is-immersive-surface \.desktop-side-nav \{[^}]*transition: transform \.22s ease, box-shadow \.18s ease;/);
  assert.match(html, /body\.is-desktop-side-nav-collapsed \.desktop-side-nav-section--secondary/);
  assert.match(html, /class="site-shell[^"]*is-immersive-surface/);
  assert.match(html, /class="shell shell-layout-immersive shell-bleed shell-map"/);
  assert.doesNotMatch(html, /<footer class="site-footer">/);
});

test("subpages use centered width contracts instead of homepage width", () => {
  const readingHtml = renderSiteDocument({
    basePath: "",
    title: "Learn",
    body: "<p>learn</p>",
    lang: "ja",
    currentPath: "/learn/field-loop?lang=ja",
  });
  const wideHtml = renderSiteDocument({
    basePath: "",
    title: "Observations",
    body: "<p>observations</p>",
    lang: "ja",
    currentPath: "/observations?lang=ja",
  });

  assert.match(readingHtml, /class="shell shell-layout-reading"/);
  assert.match(wideHtml, /class="shell shell-layout-wide"/);
  assert.match(readingHtml, /\.shell\.shell-layout-reading \{[^}]*--ikimon-shell-target-max: var\(--ikimon-reading-max\);/);
  assert.match(wideHtml, /--ikimon-shell-available-w: calc\(100% - var\(--ikimon-desktop-sidebar-w\)\);/);
  assert.doesNotMatch(wideHtml, /--ikimon-shell-available-w: calc\(100vw - var\(--ikimon-desktop-sidebar-w\)\);/);
  assert.match(wideHtml, /--ikimon-shell-effective-w: min\(var\(--ikimon-shell-target-max\), calc\(var\(--ikimon-shell-available-w\) - 96px\), calc\(var\(--ikimon-shell-available-w\) - var\(--ikimon-page-inline\)\)\);/);
  assert.match(wideHtml, /--ikimon-shell-side-space: max\(48px, calc\(\(var\(--ikimon-shell-available-w\) - var\(--ikimon-shell-effective-w\)\) \/ 2\)\);/);
  assert.match(wideHtml, /margin-left: calc\(var\(--ikimon-desktop-sidebar-w\) \+ var\(--ikimon-shell-side-space\)\);/);
});

test("desktop shell keeps the side nav expandable at tight desktop widths", () => {
  const html = renderSiteDocument({
    basePath: "",
    title: "Home",
    body: "<p>home</p>",
    lang: "ja",
    currentPath: "/?lang=ja",
  });

  assert.match(html, /@media \(min-width: 1161px\) and \(max-width: 1380px\) \{[\s\S]*body\.is-desktop-side-nav-collapsed \{[\s\S]*--ikimon-desktop-sidebar-w: 72px;/);
  assert.doesNotMatch(html, /@media \(min-width: 1161px\) and \(max-width: 1380px\) \{[\s\S]*\.brand-wordmark,\s*\.desktop-side-nav-label,[\s\S]*display: none;/);
  assert.match(html, /@media \(min-width: 1161px\) and \(max-width: 1380px\) \{[\s\S]*--ikimon-shell-margin-left: calc\(var\(--ikimon-desktop-sidebar-w\) \+ 48px\);/);
  assert.match(html, /@media \(min-width: 1161px\) and \(max-width: 1380px\) \{[\s\S]*width: min\(var\(--ikimon-page-max\), calc\(100% - var\(--ikimon-shell-margin-left\) - var\(--ikimon-shell-margin-right\)\)\);/);
});

test("major routes keep route-metadata layout contracts", () => {
  const cases = [
    { path: "/", layout: "home", className: "shell-layout-home" },
    { path: "/record", layout: "narrow", className: "shell-layout-narrow" },
    { path: "/guide", layout: "immersive", className: "shell-layout-immersive" },
    { path: "/map", layout: "immersive", className: "shell-layout-immersive" },
    { path: "/records", layout: "wide", className: "shell-layout-wide" },
    { path: "/observations/demo-id", layout: "wide", className: "shell-layout-wide" },
    { path: "/profile/demo-user", layout: "reading", className: "shell-layout-reading" },
    { path: "/learn/field-loop", layout: "reading", className: "shell-layout-reading" },
    { path: "/community", layout: "wide", className: "shell-layout-wide" },
    { path: "/community/events", layout: "wide", className: "shell-layout-wide" },
    { path: "/community/fields", layout: "wide", className: "shell-layout-wide" },
    { path: "/community/fields/demo-field", layout: "wide", className: "shell-layout-wide" },
    { path: "/for-business", layout: "wide", className: "shell-layout-wide" },
    { path: "/for-business/demo", layout: "wide", className: "shell-layout-wide" },
  ] as const;
  const snapshot = Object.fromEntries(cases.map((entry) => [entry.path, getSiteShellLayoutForPath(entry.path)]));

  assert.deepEqual(snapshot, Object.fromEntries(cases.map((entry) => [entry.path, entry.layout])));
  for (const entry of cases) {
    const html = renderSiteDocument({
      basePath: "",
      title: entry.path,
      body: "<p>body</p>",
      lang: "ja",
      currentPath: `/ja${entry.path === "/" ? "/" : entry.path}`,
    });
    assert.match(html, new RegExp(`class="shell ${entry.className}`), entry.path);
  }
});


test("global record draft handoff includes a recovery source", () => {
  const html = renderSiteDocument({
    basePath: "",
    title: "test",
    body: "<p>test</p>",
    lang: "ja",
    currentPath: "/",
  });
  assert.match(html, /const withDraftParams = \(href, kind, source, continuationToken\) =>/);
  assert.match(html, /url\.searchParams\.set\('source', recoverySource\)/);
  assert.match(html, /url\.searchParams\.set\('draft_token', String\(continuationToken\)\)/);
  assert.match(html, /navigateWithDraft\(files, 'photo', metadata, 'location_denied'\)/);
  assert.match(html, /navigateWithDraft\(selectedPhotoDraftFiles\(\), 'photo', capturedReviewMeta \|\| \{\}, 'login_required'\)/);
});
