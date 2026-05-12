import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";

async function withEnv(
  overrides: Record<string, string | undefined>,
  run: () => Promise<void>,
): Promise<void> {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    await run();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("record route exposes quick revisit fields in staging mode", async () => {
  await withEnv(
    {
      ALLOW_QUERY_USER_ID: "1",
    },
    async () => {
      const app = buildApp();
      try {
        const response = await app.inject({
          method: "GET",
          url: "/record?userId=staging-user",
        });

        assert.equal(response.statusCode, 200);
        assert.match(response.body, /あとで見返すためのメモ/);
        assert.match(response.body, /まだ分からないまま残す/);
        assert.match(response.body, /今日は見なかったメモを記録として残す/);
        assert.match(response.body, /次に見返す手がかり/);
        assert.match(response.body, /この記録の役割/);
        assert.match(response.body, /name="activityIntent"/);
        assert.match(response.body, /name="participantRole"/);
        assert.match(response.body, /name="revisitOfVisitId"/);
        assert.match(response.body, /civicContext:/);
        assert.match(response.body, /activityIntent/);
        assert.match(response.body, /participantRole/);
        assert.match(response.body, /revisitObservationId/);
        assert.match(response.body, /写真で記録する/);
        assert.match(response.body, /メモだけ残す/);
        assert.match(response.body, /動画で残す/);
        assert.match(response.body, /ファイルから選ぶ/);
        assert.match(response.body, /record-confidence-strip/);
        assert.match(response.body, /場所と時間が残る/);
        assert.match(response.body, /周囲も手がかり/);
        assert.match(response.body, /対象はあとで分ける/);
        assert.match(response.body, /自動下書き/);
        assert.match(response.body, /あとで補完する項目/);
        assert.match(response.body, /記録を保存/);
        assert.match(response.body, /記録のコツを読む/);
        assert.ok(
          response.body.indexOf('id="record-status"') > response.body.indexOf("</form>"),
          "record success status must remain visible after the draft form is collapsed",
        );
        assert.doesNotMatch(response.body, /この 1 件が効く理由/);
        assert.doesNotMatch(response.body, /信頼のレーン/);
        assert.doesNotMatch(response.body, /送信ステータス/);
        assert.doesNotMatch(response.body, /主役は1つ選べばOK/);
        assert.match(response.body, /data-capture-action="note"/);
        assert.match(response.body, /data-capture-action="photo"/);
        assert.match(response.body, /data-capture-action="video"/);
        assert.match(response.body, /data-capture-action="gallery"/);
        assert.match(response.body, /id="record-media-photo"[^>]+multiple/);
        assert.match(response.body, /id="record-media"[^>]+multiple/);
        assert.match(response.body, /MAX_PHOTO_FILES = 6/);
        assert.match(response.body, /PHOTO_UPLOAD_MAX_EDGE = 2560/);
        assert.match(response.body, /PHOTO_UPLOAD_JPEG_QUALITY = 0\.88/);
        assert.match(response.body, /PHOTO_UPLOAD_CONCURRENCY = 2/);
        assert.doesNotMatch(response.body, /redactCanvasFaces\(canvas\)/);
        assert.match(response.body, /server_async_face_privacy/);
        assert.match(response.body, /facePrivacy: upload\.facePrivacy \|\| null/);
        assert.match(response.body, /MAX_VIDEO_BASIC_POST_BYTES = 200000000/);
        assert.match(response.body, /MAX_VIDEO_TUS_BYTES = 1024 \* 1024 \* 1024/);
        assert.match(response.body, /uploadProtocol = videoFile\.size >= MAX_VIDEO_BASIC_POST_BYTES \? 'tus' : 'post'/);
        assert.match(response.body, /uploadVideoWithTus/);
        assert.match(response.body, /Tus-Resumable', '1\.0\.0'/);
        assert.match(response.body, /公開準備中|再生準備をしています/);
        assert.match(response.body, /公開までの状態/);
        assert.match(response.body, /data-video-publication-step="upload"/);
        assert.match(response.body, /data-video-publication-step="processing"/);
        assert.match(response.body, /data-video-publication-step="public"/);
        assert.match(response.body, /setVideoPublicationStatus\('uploading'/);
        assert.match(response.body, /setVideoPublicationStatus\('processing'/);
        assert.match(response.body, /waitForVideoPublication/);
        assert.match(response.body, /動画は保存済みです。公開までの状態を下に表示しています。/);
        assert.match(response.body, /動画は保存済みです。公開準備が続いています。画面を閉じても大丈夫です。/);
        assert.match(response.body, /preparePhotoUpload/);
        assert.match(response.body, /canvasToJpegDataUrl\(canvas, PHOTO_UPLOAD_JPEG_QUALITY\)/);
        assert.match(response.body, /mapWithConcurrency\(preparedPhotoUploads, PHOTO_UPLOAD_CONCURRENCY/);
        assert.match(response.body, /let selectedMediaFiles = \[\]/);
        assert.match(response.body, /let selectedVideoFile = null/);
        assert.match(response.body, /写真' \+ String\(photoCount\) \+ '枚/);
        assert.match(response.body, /id="record-submit-panel"/);
        assert.match(response.body, /id="record-submit-dock-meta"/);
        assert.match(response.body, /class="record-submit-primary">保存/);
        assert.match(response.body, /\/api\/v1\/ui-kpi\/events/);
        assert.match(response.body, /recordSessionId/);
        assert.match(response.body, /record_open/);
        assert.match(response.body, /capture_method_selected/);
        assert.match(response.body, /media_selected/);
        assert.match(response.body, /location_set/);
        assert.match(response.body, /submit_attempt/);
        assert.match(response.body, /observation_upsert_success/);
        assert.match(response.body, /record_success_rendered/);
        assert.match(response.body, /record_saved/);
        assert.match(response.body, /record_submit_error/);
        assert.match(response.body, /photo_upload_error/);
        assert.match(response.body, /video_upload_error/);
        assert.match(response.body, /const statusHeading = savedDetailId \? '記録本体は保存済みです。' : '送信に失敗しました。'/);
        assert.match(response.body, /data-record-success-cta="revisit_same_place"/);
        assert.match(response.body, /同じ場所でもう1件記録する/);
        assert.match(response.body, /revisitObservationId=/);
        assert.match(response.body, /写真を保存しています\.\.\. ' \+ String\(index\) \+ '\/' \+ String\(total\)/);
        assert.match(response.body, /photo_upload_failed_at_/);
        assert.match(response.body, /動画アップロードの準備ができませんでした/);
        assert.match(response.body, /uploadVideoWithDirectPost/);
        assert.match(response.body, /request\.open\('POST', directUploadUrl, true\)/);
        assert.match(response.body, /formData\.append\('file', file, file\.name \|\| 'upload\.mp4'\)/);
        assert.doesNotMatch(response.body, /tus-js-client/);
        assert.doesNotMatch(response.body, /window\.tus/);
        assert.doesNotMatch(response.body, /Cloudflare側/);
        assert.match(response.body, /isGenericVideoUploadError/);
        assert.doesNotMatch(response.body, /data-record-media-input[\s\S]*?files\[0\]/);
        assert.match(response.body, /id="record-video-trim"/);
        assert.match(response.body, /id="record-video-guide"/);
        assert.match(response.body, /id="record-video-primary-photo"/);
        assert.match(response.body, /主役写真を追加/);
        assert.match(response.body, /動画記録ナビ/);
        assert.match(response.body, /動画の長さを確認/);
        assert.match(response.body, /id="record-video-length-fill"/);
        assert.match(response.body, /はじめの60秒/);
        assert.match(response.body, /おわりの60秒/);
        assert.match(response.body, /setVideoGuideState/);
        assert.match(response.body, /このまま保存を押しても自動で切り出します/);
        assert.match(response.body, /選んだ60秒を作ってから保存します/);
        assert.match(response.body, /selectedPrimaryPhotoFile/);
        assert.match(response.body, /name="mediaRole" value="primary_subject" checked/);
        assert.match(response.body, /name="mediaRole" value="sound_motion"/);
        assert.match(response.body, /この長さでOK/);
        assert.match(response.body, /撮影時の現在地/);
        assert.match(response.body, /name="prefecture" value=""/);
        assert.match(response.body, /if \(!latRaw \|\| !lngRaw\) return null;/);
        assert.match(response.body, /nominatim\.openstreetmap\.org\/reverse/);
        assert.match(response.body, /inferLocalityFromCoords/);
        assert.match(response.body, /recordLocationProvenance/);
        assert.match(response.body, /location_provenance: recordLocationProvenance/);
        assert.match(response.body, /photo_exif_gps/);
        assert.match(response.body, /browser_geolocation/);
        assert.match(response.body, /PHOTO_EXIF_READ_MAX_BYTES = 8 \* 1024 \* 1024/);
        assert.match(response.body, /parseImageExif/);
        assert.match(response.body, /parseHeifExif/);
        assert.match(response.body, /geolocation_denied/);
        assert.match(response.body, /geolocation_timeout/);
        assert.match(response.body, /currentLocationAttempts/);
        assert.doesNotMatch(response.body, /prefecture: 'Shizuoka'/);
        assert.match(response.body, /normalizeDraftMetadata/);
        assert.match(response.body, /createTrimmedVideoFile/);
        assert.match(response.body, /video_trim_required/);
        assert.match(response.body, /const scheduleMediaAutofill = \(file, metadata, opts\) =>/);
        assert.match(response.body, /requestAnimationFrame\(\(\) =>/);
        assert.match(response.body, /timeout: 2500/);
        assert.match(response.body, /scheduleMediaAutofill\(normalized\.photos\[0\] \|\| null, \{\}, \{ autoLocateFreshCapture: kind === 'photo' \|\| kind === 'gallery' \}\)/);
        assert.doesNotMatch(response.body, /await applyMediaAutofill\(normalized\.photos\[0\] \|\| null/);
      } finally {
        await app.close();
      }
    },
  );
});

test("record route honors English language prefix for logged-in recording", async () => {
  await withEnv(
    {
      ALLOW_QUERY_USER_ID: "1",
    },
    async () => {
      const app = buildApp();
      try {
        const response = await app.inject({
          method: "GET",
          url: "/en/record?userId=staging-user",
        });

        assert.equal(response.statusCode, 200);
        assert.match(response.body, /<html lang="en">/);
        assert.match(response.body, /Record with photo/);
        assert.match(response.body, /Name can come later/);
        assert.match(response.body, /One photo is enough/);
        assert.match(response.body, /Community can help/);
        assert.match(response.body, /Observed time/);
        assert.match(response.body, /Observation place/);
        assert.match(response.body, /Fields you can complete later/);
        assert.match(response.body, /No media selected/);
        assert.match(response.body, /Save and complete later/);
        assert.match(response.body, /Role of this record/);
        assert.match(response.body, /Today&#39;s purpose/);
        assert.match(response.body, /Save while unsure/);
        assert.match(response.body, /Record for comparison/);
        assert.match(response.body, /Field scan/);
        assert.match(response.body, /Waterside \/ catch/);
        assert.match(response.body, /href="\/en\/guide"/);
        assert.match(response.body, /href="\/en\/learn"/);
        assert.match(response.body, /<meta name="robots" content="noindex,follow" \/>/);
        assert.doesNotMatch(response.body, /<h2>写真で記録する<\/h2>/);
        assert.doesNotMatch(response.body, /写真を撮るか選ぶだけで始められます/);
        assert.doesNotMatch(response.body, />観察した日時</);
        assert.doesNotMatch(response.body, />見つける</);
        assert.doesNotMatch(response.body, /フィールドスキャン/);
      } finally {
        await app.close();
      }
    },
  );
});

test("record route gives unauthenticated visitors a start guide instead of a raw 401", async () => {
  await withEnv(
    {
      ALLOW_QUERY_USER_ID: undefined,
    },
    async () => {
      const app = buildApp();
      try {
        const response = await app.inject({
          method: "GET",
          url: "/record?lang=ja",
          headers: { accept: "text/html" },
        });

        assert.equal(response.statusCode, 200);
        assert.match(response.body, /写真で記録する/);
        assert.match(response.body, /ログインして写真で記録する/);
        assert.match(response.body, /場所と時間が残る/);
        assert.match(response.body, /周囲も手がかり/);
        assert.match(response.body, /対象はあとで分ける/);
        assert.match(response.body, /メモで始める/);
        assert.match(response.body, /使い方を読む/);
        assert.match(response.body, /新しく登録して記録する/);
        assert.match(response.body, /redirect=%2Frecord%3Fstart%3Dnote/);
        assert.match(response.body, /redirect=%2Frecord%3Fstart%3Dphoto/);
        assert.doesNotMatch(response.body, /まず写真を残す/);
        assert.doesNotMatch(response.body, /主役と周囲を分ける/);
        assert.doesNotMatch(response.body, /Session required/);
      } finally {
        await app.close();
      }
    },
  );
});

test("record start guide preserves a direct-capture draft through login", async () => {
  await withEnv(
    {
      ALLOW_QUERY_USER_ID: undefined,
    },
    async () => {
      const app = buildApp();
      try {
        const response = await app.inject({
          method: "GET",
          url: "/record?start=photo&draft=1&lang=ja",
          headers: { accept: "text/html" },
        });

        assert.equal(response.statusCode, 200);
        assert.match(response.body, /redirect=%2Frecord%3Fstart%3Dphoto%26draft%3D1%26lang%3Dja/);
      } finally {
        await app.close();
      }
    },
  );
});

test("guide route redacts face regions before scene analysis", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/guide?lang=ja",
      headers: { accept: "text/html" },
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.body, /ikimonFacePrivacy/);
    assert.match(response.body, /ikimonFacePrivacyAssetBase/);
    assert.match(response.body, /assets\/face-privacy/);
    assert.match(response.body, /captureFramePayload/);
    assert.match(response.body, /redactCanvasFaces\(canvas, \{ blocksPerFace: 10 \}\)/);
    assert.match(response.body, /facePrivacy: framePayload\.facePrivacy/);
    assert.match(response.body, /\/api\/v1\/guide\/scene/);
  } finally {
    await app.close();
  }
});

test("login and register pages render v2 auth forms", async () => {
  const app = buildApp();
  try {
    const login = await app.inject({
      method: "GET",
      url: "/login?redirect=/record",
      headers: { accept: "text/html" },
    });
    assert.equal(login.statusCode, 200);
    assert.match(login.body, /ログインして記録する/);
    assert.match(login.body, /data-endpoint="\/api\/v1\/auth\/login"/);

    const register = await app.inject({
      method: "GET",
      url: "/register?redirect=/record",
      headers: { accept: "text/html" },
    });
    assert.equal(register.statusCode, 200);
    assert.match(register.body, /新しく登録して記録する/);
    assert.match(register.body, /data-endpoint="\/api\/v1\/auth\/register"/);
  } finally {
    await app.close();
  }
});

test("profile route gives unauthenticated visitors a mypage start guide", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/profile?lang=ja",
      headers: { accept: "text/html" },
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.body, /ログインすると、自分の記録史を読み返せます/);
    assert.match(response.body, /記録一覧を起点に/);
    assert.match(response.body, /ログインしてマイページへ/);
    assert.match(response.body, /\/login\?redirect=\/profile/);
  } finally {
    await app.close();
  }
});

test("profile settings route gives unauthenticated visitors a login guide", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/profile/settings?lang=ja",
      headers: { accept: "text/html" },
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.body, /プロフィール編集にはログインが必要です/);
    assert.match(response.body, /\/login\?redirect=\/profile\/settings/);
  } finally {
    await app.close();
  }
});

test("guest profile urls still redirect to guest notebooks", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/profile/guest_route_test?lang=ja",
      headers: { accept: "text/html" },
    });

    assert.equal(response.statusCode, 302);
    assert.equal(response.headers.location, "/ja/guest/guest_route_test");
  } finally {
    await app.close();
  }
});

test("profile self update API requires a signed-in session", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/profile/me",
      headers: {
        "content-type": "application/json",
      },
      payload: {
        displayName: "No Session",
        profileBio: "",
        expertise: "",
      },
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(JSON.parse(response.body), {
      ok: false,
      error: "session_required",
    });
  } finally {
    await app.close();
  }
});

test("www host redirects to apex before OAuth cookies are issued", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/auth/oauth/google/start?redirect=/record",
      headers: {
        host: "www.ikimon.life",
        accept: "text/html",
      },
    });

    assert.equal(response.statusCode, 308);
    assert.equal(response.headers.location, "https://ikimon.life/auth/oauth/google/start?redirect=/record");
    assert.equal(response.headers["set-cookie"], undefined);
  } finally {
    await app.close();
  }
});

test("app OAuth start redirects to Google with an Android callback state", async () => {
  await withEnv(
    {
      GOOGLE_CLIENT_ID: "google-client",
      GOOGLE_CLIENT_SECRET: "google-secret",
      V2_OAUTH_STATE_SECRET: "state-secret",
    },
    async () => {
      const app = buildApp();
      try {
        const response = await app.inject({
          method: "GET",
          url: "/app_oauth_start.php?provider=google&return_uri=ikimonfieldscan%3A%2F%2Fauth%2Fcallback&install_id=install-1&platform=android&app_version=0.8.1",
          headers: {
            host: "staging.ikimon.life",
            "x-forwarded-proto": "https",
            accept: "text/html",
          },
        });

        assert.equal(response.statusCode, 303);
        assert.match(String(response.headers.location), /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/);
        const location = new URL(String(response.headers.location));
        assert.equal(location.searchParams.get("redirect_uri"), "https://staging.ikimon.life/oauth_callback.php?provider=google");
        assert.match(String(response.headers["set-cookie"]), /^ikimon_oauth_state=/);
      } finally {
        await app.close();
      }
    },
  );
});

test("failed OAuth callback clears OAuth state without logging out an existing session", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/oauth_callback.php?provider=google&state=bad&code=bad",
      headers: {
        cookie: "ikimon_v2_session=keep-me",
      },
    });

    const setCookies = Array.isArray(response.headers["set-cookie"])
      ? response.headers["set-cookie"]
      : [String(response.headers["set-cookie"] ?? "")];
    assert.equal(response.statusCode, 303);
    assert.equal(response.headers.location, "/login?error=oauth");
    assert.ok(setCookies.some((cookie) => cookie.startsWith("ikimon_oauth_state=;")));
    assert.ok(!setCookies.some((cookie) => cookie.startsWith("ikimon_v2_session=;")));
  } finally {
    await app.close();
  }
});

test("cross-site auth mutation returns a controlled 403", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: {
        origin: "https://evil.example",
        "sec-fetch-site": "cross-site",
        "content-type": "application/json",
      },
      payload: {
        email: "nobody@example.invalid",
        password: "wrongwrong",
      },
    });

    assert.equal(response.statusCode, 403);
    assert.deepEqual(JSON.parse(response.body), {
      ok: false,
      error: "same_origin_required",
    });
  } finally {
    await app.close();
  }
});
