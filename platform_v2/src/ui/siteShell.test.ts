import assert from "node:assert/strict";
import test from "node:test";
import { renderSiteDocument } from "./siteShell.js";

test("site shell hydrates the login link from the v2 session endpoint", () => {
  const html = renderSiteDocument({
    basePath: "",
    title: "Test",
    body: "<p>body</p>",
    lang: "ja",
  });

  assert.match(html, /class="btn btn-ghost site-login-link"/);
  assert.match(html, /\/login\?redirect=%2Fprofile/);
  assert.match(html, /\/api\/v1\/auth\/session/);
  assert.match(html, /credentials: 'same-origin'/);
  assert.match(html, /マイページ/);
  assert.match(html, /rel="manifest" href="\/manifest\.webmanifest\?lang=ja"/);
  assert.match(html, /navigator\.languages/);
  assert.match(html, /beforeinstallprompt/);
  assert.match(html, /navigator\.serviceWorker\.register\('\/app-sw\.js'/);
  assert.match(html, /data-app-install-prompt/);
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
  assert.match(html, /\.site-mobile-menu-panel \{[^}]*position: absolute;[^}]*z-index: 2;[^}]*top: calc\(100% \+ 9px\);/);
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
  assert.doesNotMatch(html, /aria-expanded="false"/);
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
