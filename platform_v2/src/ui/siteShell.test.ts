import assert from "node:assert/strict";
import test from "node:test";
import { getSiteShellLayoutForPath } from "../siteMap.js";
import { renderSiteDocument } from "./siteShell.js";

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
  assert.match(html, /class="site-account-icons"/);
  assert.match(html, /data-account-profile/);
  assert.match(html, /data-account-alerts/);
  assert.match(html, /data-account-settings/);
  assert.match(html, /\/login\?redirect=%2Fprofile/);
  assert.match(html, /\/api\/v1\/auth\/session/);
  assert.match(html, /\/api\/v1\/me\/personalized-menu\?limit=8/);
  assert.match(html, /\/api\/v1\/me\/alerts/);
  assert.match(html, /\/api\/v1\/me\/alerts\/read/);
  assert.match(html, /data-notification-panel/);
  assert.match(html, /data-notification-toggle/);
  assert.match(html, /data-notification-read-all/);
  assert.match(html, /credentials: 'same-origin'/);
  assert.match(html, /マイページ/);
  assert.match(html, /rel="manifest" href="\/manifest\.webmanifest\?lang=ja"/);
  assert.match(html, /navigator\.languages/);
  assert.match(html, /beforeinstallprompt/);
  assert.match(html, /navigator\.serviceWorker\.register\('\/app-sw\.js'/);
  assert.match(html, /data-app-install-prompt/);
  assert.doesNotMatch(html, /<footer class="site-footer">/);
  assert.match(html, /desktop-side-nav-section--guest/);
  assert.match(html, /desktop-side-nav-section--signed-in/);
  assert.match(html, /desktop-side-nav-section--personalized/);
  assert.match(html, /data-side-nav-personalized-list/);
  assert.match(html, /desktop-side-nav-mini-card/);
  assert.match(html, /class="shell shell-layout-home"/);
  assert.match(html, /href="\/ja\/observations">観察投稿一覧/);
  assert.match(html, /href="\/ja\/observations" title="観察"/);
  assert.doesNotMatch(html, /href="\/ja\/observations\?filter=needs_id" title="同定"/);
  assert.match(html, /href="\/ja\/learn\/updates"/);
  assert.match(html, /desktop-side-nav-section-title">今日使う/);
  assert.match(html, /desktop-side-nav-section-title">今日の続き/);
  assert.match(html, /desktop-side-nav-section-title">フォロー中/);
  assert.match(html, /desktop-side-nav-section-title">探す・見る/);
  assert.match(html, /desktop-side-nav-section-title">地域・みんな/);
  assert.match(html, /desktop-side-nav-section-title">更新・連絡/);
  assert.match(html, /href="\/ja\/learn\/field-loop">観察の流れ/);
  assert.match(html, /href="\/ja\/learn\/glossary">用語集/);
  assert.doesNotMatch(html, /政策・企業活動と自然/);
  assert.doesNotMatch(html, /href="\/ja\/for-business/);
  assert.doesNotMatch(html, /href="\/ja\/specialist/);
  assert.match(html, /html\[data-auth="signed-in"\] \.desktop-side-nav-section--guest/);
  assert.match(html, /\.site-mobile-menu-section\.desktop-side-nav-section--signed-in \{[^}]*display: none;/);
  assert.match(html, /window\.ikimonAppOutbox/);
  assert.match(html, /ikimon-app-outbox-v1/);
  assert.match(html, /window\.ikimonRequestAppOutboxSync/);
  assert.match(html, /registration\.sync\.register\('ikimon-app-outbox-sync'\)/);
  assert.match(html, /ikimon-app-outbox-change/);
  assert.match(html, /ikimon:app-outbox-sync/);
  assert.match(html, /G-NCL0M1VJZ2/);
  assert.match(html, /googletagmanager\.com\/gtag\/js/);
  assert.match(html, /window\.gtag\('config', googleTagId\)/);
  assert.match(html, /www\.clarity\.ms\/tag/);
  assert.match(html, /wl2ezvfqbh/);
  assert.match(html, /host !== 'ikimon\.life' && host !== 'www\.ikimon\.life'/);
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
  assert.match(html, /<span>Language<\/span>/);
  assert.match(html, /<span class="lang-switch-name">English<\/span>/);
  assert.match(html, /aria-current="true"/);
  assert.match(head, /<link rel="canonical" href="https:\/\/ikimon\.life\/ja\/" \/>/);
  assert.match(head, /<meta name="robots" content="noindex,follow" \/>/);
  assert.match(head, /hreflang="ja"/);
  assert.match(head, /hreflang="x-default"/);
  assert.doesNotMatch(head, /hreflang="en"/);
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
  assert.match(html, /Use ikimon\.life in English\?/);
  assert.match(html, /Cambiar a español/);
  assert.match(html, /Mudar para português/);
  assert.match(html, /ikimon:locale-suggestion-dismissed-v1/);
  assert.match(html, /source', 'device_locale'/);
  assert.match(html, /showLanguageSuggestion\(deviceLang\)/);
  assert.doesNotMatch(html, /location\.replace\('/);
  assert.doesNotMatch(html, /ikimon:locale-redirect-v1/);
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
  assert.equal(html.match(/data-global-record-input="(?:photo|video|gallery)"/g)?.length, 3);
  assert.equal(html.match(/data-global-record-trigger="(?:photo|video|gallery)"/g)?.length, 3);
  assert.match(html, /accept="image\/\*" capture="environment" multiple/);
  assert.match(html, /accept="video\/\*" capture="environment"/);
  assert.match(html, /accept="image\/\*,video\/\*" multiple/);
  assert.match(html, /files: draftFiles/);
  assert.match(html, /Array\.from\(input\.files\)/);
  assert.doesNotMatch(html, /class="global-record-entry"/);
  assert.doesNotMatch(html, /class="global-record-entry"[^>]*aria-expanded="false"/);
  assert.match(html, /data-kpi-action="global_record_photo"/);
  assert.match(html, /data-kpi-action="global_record_video"/);
  assert.match(html, /data-kpi-action="global_record_gallery"/);
  assert.match(html, /data-kpi-action="global_record_guide"/);
  assert.match(html, /data-record-target="\/ja\/record\?start=photo"/);
  assert.match(html, /data-record-target="\/ja\/record\?start=video"/);
  assert.match(html, /data-record-target="\/ja\/record\?start=gallery"/);
  assert.match(html, /href="\/ja\/guide"/);
  assert.match(html, /indexedDB\.open\(DB_NAME, 1\)/);
  assert.match(html, /source: 'record'/);
  assert.match(html, /id: 'record:' \+ DRAFT_KEY/);
  assert.match(html, /data-global-record-camera-sheet/);
  assert.match(html, /data-global-record-camera-video/);
  assert.match(html, /data-global-record-camera-image/);
  assert.match(html, /data-global-record-photo-tray/);
  assert.match(html, /data-global-record-photo-grid/);
  assert.match(html, /data-photo-draft="true"/);
  assert.match(html, /data-active-kind/);
  assert.match(html, /data-global-record-inline-edit/);
  assert.match(html, /data-global-record-data-estimate/);
  assert.match(html, /data-global-record-video-trim/);
  assert.match(html, /object-fit: contain/);
  assert.match(html, /global-record-camera-preview video\[hidden\]/);
  assert.match(html, /\.global-record-camera-actions \{/);
  assert.match(html, /global-record-camera-sheet\[data-active-kind="photo"\] \.global-record-photo-tray/);
  assert.match(html, /global-record-camera-sheet\[data-photo-draft="true"\] \.global-record-camera-preview/);
  assert.match(html, /top: max\(12px, env\(safe-area-inset-top\)\)/);
  assert.match(html, /height: min\(72dvh, calc\(100dvh - 178px\)\)/);
  assert.match(html, /height: min\(70dvh, calc\(100dvh - 176px\)\)/);
  assert.match(html, /navigator\.mediaDevices\.getUserMedia/);
  assert.match(html, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(html, /void startCamera\(\)/);
  assert.match(html, /MediaRecorder/);
  assert.match(html, /MAX_PHOTO_DRAFT_FILES = 6/);
  assert.match(html, /PHOTO_UPLOAD_MAX_EDGE = 2560/);
  assert.match(html, /PHOTO_UPLOAD_JPEG_QUALITY = 0\.88/);
  assert.match(html, /CAMERA_PHOTO_IDEAL_WIDTH = 2560/);
  assert.match(html, /CAMERA_PHOTO_IDEAL_HEIGHT = 1920/);
  assert.match(html, /CAMERA_VIDEO_IDEAL_WIDTH = 1280/);
  assert.match(html, /CAMERA_VIDEO_IDEAL_HEIGHT = 720/);
  assert.match(html, /video: cameraVideoConstraints\(\)/);
  assert.match(html, /ikimonFacePrivacy/);
  assert.match(html, /ikimonFacePrivacyAssetBase/);
  assert.match(html, /assets\/face-privacy/);
  assert.match(html, /redactCanvasFaces\(canvas\)/);
  assert.match(html, /facePrivacy: upload\.facePrivacy \|\| null/);
  assert.match(html, /preparePhotoUpload/);
  assert.match(html, /canvas\.toDataURL\('image\/jpeg', PHOTO_UPLOAD_JPEG_QUALITY\)/);
  assert.match(html, /selectedPhotoDraftFiles/);
  assert.match(html, /data-global-record-photo-remove/);
  assert.match(html, /data-global-record-photo-move/);
  assert.match(html, /AIは全体を見て主役と周囲を判断します/);
  assert.match(html, /この' \+ String\(files\.length\) \+ '枚を投稿/);
  assert.match(html, /global_photo_tray/);
  assert.match(html, /directPostInFlight/);
  assert.match(html, /photoDraftRetryDetailId/);
  assert.match(html, /photoDraftRetryHasUploadedPhoto/);
  assert.match(html, /clientSubmissionId/);
  assert.match(html, /client_photo_sha256s/);
  assert.match(html, /\/api\/v1\/observations\/upsert/);
  assert.match(html, /\/api\/v1\/observations\/' \+ encodeURIComponent\(detailId\) \+ '\/photos\/upload/);
  assert.match(html, /photoJson\.error/);
  assert.match(html, /continue;/);
  assert.match(html, /photo_upload_network_failed/);
  assert.match(html, /観察本体は保存済みです。写真は/);
  assert.match(html, /写真の通信確認だけ失敗しました。ホームに戻ると記録が見える場合があります/);
  assert.match(html, /同じ観察に再送/);
  assert.match(html, /失敗した' \+ String\(failed\) \+ '枚を再送/);
  assert.doesNotMatch(html, /\/api\/v1\/observations\/' \+ encodeURIComponent\(detailId\) \+ '\/reassess/);
  assert.match(html, /subject_inference: 'ai'/);
  assert.doesNotMatch(html, /data-global-record-camera-fallback/);
  assert.doesNotMatch(html, /端末のカメラを開く/);
  assert.match(html, /もう1枚撮る/);
  assert.match(html, /VIDEO_MAX_SECONDS = 60/);
  assert.match(html, /動画投稿は最大60秒/);
  assert.match(html, /createSheetTrimmedVideoFile/);
  assert.match(html, /YouTube標準画質/);
  assert.match(html, /この内容で投稿画面へ/);
  assert.match(html, /撮り直す/);
});

test("site shell localizes the mobile global record launcher", () => {
  const html = renderSiteDocument({
    basePath: "",
    title: "Test",
    body: "<p>body</p>",
    lang: "en",
    currentPath: "/?lang=en",
  });

  assert.match(html, /aria-label="Record quickly"/);
  assert.match(html, />Photo</);
  assert.match(html, />Video</);
  assert.match(html, />Choose</);
  assert.match(html, />Guide</);
  assert.match(html, /class="site-mobile-menu-account site-login-link" href="\/en\/login\?redirect=%2Fprofile">Sign in</);
  assert.match(html, /Capture a record/);
  assert.doesNotMatch(html, /aria-label="すぐ記録する"/);
  assert.doesNotMatch(html, />写真</);
});

test("site shell does not duplicate the record entry on the record page", () => {
  const html = renderSiteDocument({
    basePath: "",
    title: "Record",
    body: "<p>record</p>",
    lang: "ja",
    currentPath: "/record?lang=ja",
  });

  assert.doesNotMatch(html, /class="global-record-launcher"/);
  assert.doesNotMatch(html, /class="global-record-entry"/);
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
    { path: "/observations", layout: "wide", className: "shell-layout-wide" },
    { path: "/observations/demo-id", layout: "wide", className: "shell-layout-wide" },
    { path: "/notes", layout: "reading", className: "shell-layout-reading" },
    { path: "/profile/demo-user", layout: "reading", className: "shell-layout-reading" },
    { path: "/learn/field-loop", layout: "reading", className: "shell-layout-reading" },
    { path: "/community", layout: "wide", className: "shell-layout-wide" },
    { path: "/community/events", layout: "wide", className: "shell-layout-wide" },
    { path: "/community/fields", layout: "wide", className: "shell-layout-wide" },
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
