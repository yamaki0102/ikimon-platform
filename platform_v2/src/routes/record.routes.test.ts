import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
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
        assert.match(response.body, /今見えた変化/);
        assert.match(response.body, /当てはまるものを押すと、手がかりに入ります。自宅・学校名は入れないでください。/);
        assert.match(response.body, /data-season-clue="花・実"/);
        assert.match(response.body, /data-season-clue="葉の色"/);
        assert.match(response.body, /data-season-clue="水の量"/);
        assert.match(response.body, /data-season-clue="土の湿り"/);
        assert.match(response.body, /data-season-clue="音・におい"/);
        assert.match(response.body, /data-season-clue="虫・鳥"/);
        assert.match(response.body, /seasonClueManagedValue/);
        assert.match(response.body, /selectedSeasonClues/);
        assert.match(response.body, /season_clue_selected/);
        assert.match(response.body, /aria-pressed/);
        assert.match(response.body, /この記録の役割/);
        assert.match(response.body, /name="activityIntent"/);
        assert.match(response.body, /name="participantRole"/);
        assert.match(response.body, /name="revisitOfVisitId"/);
        assert.match(response.body, /civicContext:/);
        assert.match(response.body, /activityIntent/);
        assert.match(response.body, /participantRole/);
        assert.match(response.body, /revisitObservationId/);
        assert.match(response.body, /記録を始める/);
        assert.match(response.body, /写真で記録/);
        assert.match(response.body, /音や様子をメモ/);
        assert.match(response.body, /聞こえた音・周囲の様子・場所を残せます。/);
        assert.match(response.body, /水辺の柵のそば \/ 鳥の声 \/ 草刈り直後/);
        assert.doesNotMatch(response.body, /録音して保存/);
        assert.doesNotMatch(response.body, /音声を録/);
        assert.match(response.body, /動画で残す/);
        assert.match(response.body, /ファイルから選ぶ/);
        assert.match(response.body, /record-confidence-strip/);
        assert.match(response.body, /あとで戻れる/);
        assert.match(response.body, /写真なしでも残せる/);
        assert.match(response.body, /公開前に確認できる/);
        assert.match(response.body, /record-first-success/);
        assert.match(response.body, /最短で残す/);
        assert.match(response.body, /写真かメモを選ぶ/);
        assert.match(response.body, /気づきを1つ入れる/);
        assert.match(response.body, /保存して見返す/);
        assert.match(response.body, /\.record-has-media \.record-first-success/);
        assert.match(response.body, /buildRecordFeedbackSentence/);
        assert.match(response.body, /requestVisualRecordFeedback/);
        assert.match(response.body, /\/api\/v1\/record\/photo-feedback/);
        assert.match(response.body, /写真を見て、次の撮り方のヒントを作っています/);
        assert.match(response.body, /次の撮り方/);
        assert.doesNotMatch(response.body, /対象が大きく写る1枚と周囲が分かる1枚/);
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
        assert.match(response.body, /写真なしでも、このまま保存できます。あとで写真や名前を足せます。/);
        assert.match(response.body, /名前が分からなくても保存できます。写真はあとで足せます。/);
        assert.match(response.body, /見つからなかったことを保存できます。次に同じ場所で比べやすくなります。/);
        assert.match(response.body, /音や様子のメモを保存/);
        assert.match(response.body, /名前はあとで保存/);
        assert.match(response.body, /見つからなかった記録/);
        assert.match(response.body, /noteOnlySummaryText/);
        assert.match(response.body, /noteOnlySubmitHelp/);
        assert.match(response.body, /renderPreviewFile\(first, hasNoteDraft\(\) && !files\.length \? noteOnlySummaryText\(\) : ''\)/);
        assert.match(response.body, /id="record-unknown-name-strip"/);
        assert.match(response.body, /data-quick-capture-state="present"/);
        assert.match(response.body, /data-quick-capture-state="unknown"/);
        assert.match(response.body, /名前はあとで/);
        assert.doesNotMatch(response.body, /data-quick-capture-state="no_detection_note"/);
        assert.match(response.body, /syncQuickCaptureStateChips/);
        assert.match(response.body, /setQuickCaptureState/);
        assert.match(response.body, /写真があると名前を確かめやすくなります。今はメモだけでも保存できます。/);
        assert.match(response.body, /名前はあとで確かめられます。写真と場所を保存できます。/);
        assert.match(response.body, /id="record-submit-dock-meta"/);
        assert.match(response.body, /class="record-submit-primary">保存/);
        assert.match(response.body, /data-first-record-candidate="1"/);
        assert.match(response.body, /\/api\/v1\/ui-kpi\/events/);
        assert.match(response.body, /recordSessionId/);
        assert.match(response.body, /recordFirstRecordCandidate/);
        assert.match(response.body, /firstRecordCandidate/);
        assert.match(response.body, /record_open/);
        assert.match(response.body, /capture_method_selected/);
        assert.match(response.body, /media_selected/);
        assert.match(response.body, /location_set/);
        assert.match(response.body, /submit_attempt/);
        assert.match(response.body, /observation_upsert_success/);
        assert.match(response.body, /const normalizeSavedObservationVisitId = \(json, fallbackId\) =>/);
        assert.match(response.body, /const normalizeSavedObservationTargetId = \(json, fallbackId\) =>/);
        assert.match(response.body, /visitId = normalizeSavedObservationVisitId\(observationJson, observationId\)/);
        assert.match(response.body, /detailId = normalizeSavedObservationTargetId\(observationJson, visitId \|\| observationId\)/);
        assert.match(response.body, /record_success_rendered/);
        assert.match(response.body, /const scrollStatusIntoView = \(\) =>/);
        assert.match(response.body, /scrollStatusIntoView\(\);/);
        assert.match(response.body, /buildRecordSuccessReturnHtml/);
        assert.match(response.body, /buildRecordSuccessSavedCardHtml/);
        assert.match(response.body, /publicStateSuccessKind/);
        assert.match(response.body, /record-success-return/);
        assert.match(response.body, /record-success-saved-card/);
        assert.match(response.body, /record-success-shortcuts/);
        assert.match(response.body, /record-success-actions/);
        assert.match(response.body, /data-record-success-cta/);
        assert.match(response.body, /data-record-success-cta="saved_record_card"/);
        assert.match(response.body, /const returnLinks = \[/);
        assert.match(response.body, /key: 'notes', label: recordUiCopy\.successRecordsCta, primary: true/);
        assert.match(response.body, /key: 'profile', label: recordUiCopy\.successProfileCta, primary: false/);
        assert.match(response.body, /key: 'map_nearby', label: recordUiCopy\.successMapCta, primary: false/);
        assert.match(response.body, /const nextLinks = \[/);
        assert.match(response.body, /key: 'observation_detail', label: recordUiCopy\.successObservationCta, primary: hasObservationHref/);
        assert.match(response.body, /recordSuccessMapHref/);
        assert.match(response.body, /周辺の地図を見る/);
        assert.match(response.body, /自分の記録を見る/);
        assert.match(response.body, /record_saved/);
        assert.match(response.body, /buildContributionReceiptsHtml/);
        assert.match(response.body, /buildRecordFeedbackLoopHtml/);
        assert.match(response.body, /observationJson\.contributionReceipts/);
        assert.match(response.body, /observationJson\.feedbackLoop/);
        assert.match(response.body, /観察インパクト・レシート/);
        assert.match(response.body, /data-contribution-receipts/);
        assert.match(response.body, /data-record-feedback-loop/);
        assert.match(response.body, /data-feedback-loop-status/);
        assert.match(response.body, /data-contribution-receipt-kind/);
        assert.match(response.body, /contributionReceiptKinds/);
        assert.match(response.body, /contributionReceiptCount/);
        assert.match(response.body, /feedbackLoopStatus/);
        assert.match(response.body, /feedback_loop/);
        assert.match(response.body, /contribution_receipt_/);
        assert.match(response.body, /successCtas: \['observation_detail', 'saved_record_card', 'notes', 'profile'\]/);
        assert.match(response.body, /record_submit_error/);
        assert.match(response.body, /photo_upload_error/);
        assert.match(response.body, /video_upload_error/);
        assert.match(response.body, /isDatabaseTemporarilyUnavailable/);
        assert.match(response.body, /57P03/);
        assert.match(response.body, /formatRecordSaveFailureReason/);
        assert.match(response.body, /escapeHtmlText\(userMessage\)/);
        assert.match(response.body, /const statusHeading = savedDetailId \? '記録本体は保存済みです。' : '送信に失敗しました。'/);
        assert.match(response.body, /const saveRecordDraft = async \(draft\) =>/);
        assert.match(response.body, /const deleteRecordDraft = async \(\) =>/);
        assert.match(response.body, /const markMediaRetryUrl = \(\) =>/);
        assert.match(response.body, /const persistMediaRetryDraft = async \(visitId, detailId, reason\) =>/);
        assert.match(response.body, /pendingMediaRetryObservationId: retryId/);
        assert.match(response.body, /pendingMediaRetryVisitId: String\(visitId \|\| ''\)\.trim\(\)/);
        assert.match(response.body, /pendingMediaRetryDetailId: String\(detailId \|\| ''\)\.trim\(\)/);
        assert.match(response.body, /kind: isMediaRetryDraft \? 'media_retry' : 'record_draft'/);
        assert.match(response.body, /url\.searchParams\.set\('retry', 'media'\)/);
        assert.match(response.body, /const setMediaRetryFormLock = \(locked\) =>/);
        assert.match(response.body, /document\.documentElement\.classList\.toggle\('record-media-retry-mode'/);
        assert.match(response.body, /preserveMediaRetry: Boolean\(pendingMediaRetryObservationId \|\| pendingMediaRetryVisitId \|\| pendingMediaRetryDetailId\)/);
        assert.match(response.body, /未送信メディアはこの端末に残っています。別の写真や動画を選ぶと、同じ保存済み記録へ再送できます。/);
        assert.match(response.body, /const isMediaRetrySubmit = Boolean\(mediaRetryVisitTargetId \|\| mediaRetryDetailTargetId\)/);
        assert.match(response.body, /sendRecordFunnelStep\('media_retry_target_ready'/);
        assert.match(response.body, /saveRecordDraft\(draft\)\.catch\(\(\) => undefined\)/);
        assert.match(response.body, /deleteRecordDraft\(\)\.catch\(\(\) => undefined\)/);
        assert.match(response.body, /記録本体は保存済みです。この画面ではメディアだけ再送できます。/);
        assert.match(response.body, /残っていたメディアを同じ記録に再送できます。/);
        assert.match(response.body, /この画面ではメディアだけ送ります。/);
        assert.match(response.body, /画面を閉じたり読み込み直しても、残っているメディアを次に開いた記録画面で再送できます。/);
        assert.match(response.body, /pendingMediaRetryVisitId = savedVisitId \|\| visitIdFromObservationTargetId\(savedDetailId\)/);
        assert.match(response.body, /pendingMediaRetryObservationId = pendingMediaRetryVisitId \|\| pendingMediaRetryDetailId/);
        assert.doesNotMatch(response.body, /pendingMediaRetryObservationId = observationId/);
        assert.doesNotMatch(response.body, /const observationId = pendingMediaRetryObservationId \|\| 'record-'/);
        assert.match(response.body, /key: 'revisit_same_place', label: recordUiCopy\.successRevisitCta, primary: false/);
        assert.match(response.body, /続けて記録する/);
        assert.match(response.body, /あとからAIのヒント/);
        assert.match(response.body, /revisitObservationId=/);
        assert.match(response.body, /RECORD_REVISIT_CONTEXT_STORAGE_PREFIX = 'ikimon:record-revisit-context:'/);
        assert.match(response.body, /rememberRevisitContext\(visitId, \{/);
        assert.match(response.body, /storedRevisitContextParams\(revisitId\)/);
        assert.match(response.body, /if \(!params\.has\(key\)\) params\.set\(key, value\)/);
        assert.match(response.body, /recordSuccessRevisitHrefPrefix = "\/ja\/record\?start=gallery&revisitObservationId="/);
        assert.doesNotMatch(response.body, /recordSuccessRevisitHrefPrefix = "[^"]*(?:latitude|longitude)=/);
        assert.doesNotMatch(response.body, /const revisitHref = recordSuccessRevisitHrefPrefix \+ encodeURIComponent\(visitId\) \+ [^;]*(?:latitude|longitude)/);
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
        assert.match(response.body, /record-video-simple #record-video-guide/);
        assert.match(response.body, /record-video-simple #record-video-primary-photo/);
        assert.match(response.body, /record-video-simple \.record-later-details/);
        assert.match(response.body, /record-has-media \.global-record-launcher \{ display: none; \}/);
        assert.match(response.body, /const isVideoSimpleMode = \(\) => selectedVideoFile instanceof File && isVideoFile\(selectedVideoFile\) && selectedPhotoFiles\(\)\.length === 0/);
        assert.match(response.body, /videoPrimaryPhotoWrap\) videoPrimaryPhotoWrap\.hidden = !hasVideo \|\| simpleVideo/);
        assert.match(response.body, /classList\.toggle\('record-video-simple', isVideoSimpleMode\(\)\)/);
        assert.match(response.body, /classList\.remove\('record-video-simple'\)/);
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
        assert.match(response.body, /現在地をこの記録に使う/);
        assert.match(response.body, /許可すると、この記録の地点入力に使います。/);
        assert.match(response.body, /現在地は許可した時に、この記録の地点入力に使います。/);
        assert.doesNotMatch(response.body, /写真に場所も入れる/);
        assert.doesNotMatch(response.body, /現在地を入れると、あとで同じ場所を見返しやすくなります。/);
        assert.match(response.body, /id="record-location-privacy"/);
        assert.match(response.body, /id="record-public-state"/);
        assert.match(response.body, /id="record-prepublish-checklist"/);
        assert.match(response.body, /保存前チェック/);
        assert.match(response.body, /自分用/);
        assert.match(response.body, /公開側/);
        assert.match(response.body, /id="record-prepublish-location"/);
        assert.match(response.body, /id="record-prepublish-media"/);
        assert.match(response.body, /recordUiCopy\.prepublishMediaPhoto/);
        assert.match(response.body, /prepublishLocationSet/);
        assert.match(response.body, /公開状態/);
        assert.match(response.body, /公開候補として保存しました/);
        assert.match(response.body, /recordSuccessProfileHref = "\/ja\/profile\?source=record_saved"/);
        assert.match(response.body, /recordSuccessRecordsHref = "\/ja\/records\?view=mine&source=record_saved"/);
        assert.match(response.body, /recordSuccessMapHref = "\/ja\/map\?tab=places&source=record_saved"/);
        assert.match(response.body, /recordSuccessObservationHrefPrefix = "\/ja\/observations\/"/);
        assert.match(response.body, /successProfileCta: "マイページへ"/);
        assert.match(response.body, /successRecordsCta: "自分の記録を見る"/);
        assert.match(response.body, /保存した1件をすぐ開けます。あとから自分の記録一覧やマイページでも見返せます/);
        assert.match(response.body, /successSavedCardEyebrow: "保存済みの1件"/);
        assert.match(response.body, /successSavedCardFallbackTitle: "対象を整理中の記録"/);
        assert.match(response.body, /buildPublicStateSuccessHtml/);
        assert.match(response.body, /qualityReviewStatus/);
        assert.match(response.body, /recordUiCopy\.publicStatePhotoCandidate/);
        assert.match(response.body, /公開される位置/);
        assert.match(response.body, /正確な地点/);
        assert.match(response.body, /写真のGPS情報は別に注意が必要です/);
        assert.match(response.body, /学校・自宅・希少種/);
        assert.match(response.body, /record-location-privacy-preview/);
        assert.match(response.body, /record-location-public-preview/);
        assert.match(response.body, /公開の目安/);
        assert.match(response.body, /水色の範囲だけでは、写真のGPS情報や写り込みまでは隠せません。/);
        assert.match(response.body, /PUBLIC_LOCATION_PREVIEW_SOURCE/);
        assert.match(response.body, /record-public-location-preview-fill/);
        assert.match(response.body, /buildPublicLocationPreviewFeature/);
        assert.match(response.body, /syncLocationPublicPreviewMap/);
        assert.match(response.body, /syncRecordMapMarker/);
        assert.match(response.body, /syncLocationPrivacyNotice/);
        assert.match(response.body, /locationPrivacyAfterSave/);
        assert.match(response.body, /写真ファイルのGPS情報や写り込みから場所が分かる場合があります/);
        assert.doesNotMatch(response.body, /正確な座標を出しません/);
        assert.match(response.body, /name="prefecture" value=""/);
        assert.match(response.body, /if \(!latRaw \|\| !lngRaw\) return null;/);
        assert.doesNotMatch(response.body, /name="latitude"[^>]+required/);
        assert.doesNotMatch(response.body, /name="longitude"[^>]+required/);
        assert.match(response.body, /nominatim\.openstreetmap\.org\/reverse/);
        assert.match(response.body, /inferLocalityFromCoords/);
        assert.match(response.body, /combineMunicipalityAndSubArea/);
        assert.match(response.body, /source\.city_district \|\| source\.borough \|\| source\.district \|\| source\.ward/);
        assert.match(response.body, /municipality \+ subArea/);
        assert.match(response.body, /recordLocationProvenance/);
        assert.match(response.body, /location_provenance: hasRecordCoordinates \? recordLocationProvenance : null/);
        assert.match(response.body, /record_location_pair_required/);
        assert.match(response.body, /photo_exif_gps/);
        assert.match(response.body, /browser_geolocation/);
        assert.match(response.body, /hasCoordinates: true/);
        assert.doesNotMatch(response.body, /sendRecordFunnelStep\('location_set', \{[\s\S]{0,240}latitude:/);
        assert.doesNotMatch(response.body, /sendRecordFunnelStep\('location_set', \{[\s\S]{0,240}longitude:/);
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
        assert.doesNotMatch(response.body, /autoLocateFreshCapture/);
        assert.match(response.body, /scheduleMediaAutofill\(normalized\.photos\[0\] \|\| null, \{\}, \{\}\)/);
        assert.match(response.body, /document\.querySelectorAll\('\[data-record-locate\]'\)/);
        assert.match(response.body, /locateButtons\.forEach\(\(button\) => \{[\s\S]*button\.addEventListener\('click'/);
        assert.doesNotMatch(response.body, /await applyMediaAutofill\(normalized\.photos\[0\] \|\| null/);
      } finally {
        await app.close();
      }
    },
  );
});

test("record note start renders seasonal clue chips in the visible quick form", async () => {
  await withEnv(
    {
      ALLOW_QUERY_USER_ID: "1",
    },
    async () => {
      const app = buildApp();
      try {
        const response = await app.inject({
          method: "GET",
          url: "/ja/record?start=note&userId=staging-user",
        });

        assert.equal(response.statusCode, 200);
        assert.match(response.body, /<html lang="ja">/);
        assert.match(response.body, /今見えた変化/);
        assert.match(response.body, /data-season-clue="花・実"/);
        assert.match(response.body, /data-season-clue="葉の色"/);
        assert.match(response.body, /data-season-clue="水の量"/);
        assert.match(response.body, /data-season-clue="土の湿り"/);
        assert.match(response.body, /data-season-clue="音・におい"/);
        assert.match(response.body, /data-season-clue="虫・鳥"/);
        assert.ok(
          response.body.indexOf('class="record-field record-field-wide record-quick-fields" data-quick-only') <
            response.body.indexOf('class="record-field record-field-wide record-later-details"'),
          "seasonal clue chips should not be hidden inside the collapsed later-details section",
        );
        assert.doesNotMatch(response.body, /育つ余白/);
        assert.doesNotMatch(response.body, /少ない事実 \+ 次に探す方向/);
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
        assert.match(response.body, /Record/);
        assert.match(response.body, /Use current location for this record/);
        assert.match(response.body, /If you allow it, we use it to fill in this record&#39;s location\./);
        assert.match(response.body, /Current location is used after you allow it to fill in this record&#39;s location\./);
        assert.match(response.body, /Return later/);
        assert.match(response.body, /No photo required/);
        assert.match(response.body, /Check before public/);
        assert.match(response.body, /Observed time/);
        assert.match(response.body, /Observation place/);
        assert.match(response.body, /What becomes public/);
        assert.match(response.body, /Exact place/);
        assert.match(response.body, /Photo files may still contain GPS metadata/);
        assert.match(response.body, /Public guide/);
        assert.match(response.body, /The blue guide does not hide photo GPS metadata or visible clues/);
        assert.match(response.body, /Schools, homes, rare species/);
        assert.doesNotMatch(response.body, /Exact coordinates stay off public pages/);
        assert.match(response.body, /Fields you can complete later/);
        assert.match(response.body, /No media selected/);
        assert.match(response.body, /Save sound\/scene note/);
        assert.match(response.body, /You can save this without a photo\. Add photos or names later\./);
        assert.match(response.body, /Sound or scene note/);
        assert.match(response.body, /Write what you heard, the surrounding scene, and the place even without a photo\./);
        assert.match(response.body, /Save and complete later/);
        assert.match(response.body, /Role of this record/);
        assert.match(response.body, /Today&#39;s purpose/);
        assert.match(response.body, /Save while unsure/);
        assert.match(response.body, /Name later/);
        assert.doesNotMatch(response.body, /data-quick-capture-state="no_detection_note"/);
        assert.doesNotMatch(response.body, /Not seen/);
        assert.match(response.body, /Record for comparison/);
        assert.match(response.body, /Field scan/);
        assert.match(response.body, /Waterside \/ catch/);
        assert.match(response.body, /href="\/en\/guide"/);
        assert.match(response.body, /href="\/en\/learn"/);
        assert.match(response.body, /recordSuccessProfileHref = "\/en\/profile\?source=record_saved"/);
        assert.match(response.body, /recordSuccessRecordsHref = "\/en\/records\?view=mine&source=record_saved"/);
        assert.match(response.body, /recordSuccessMapHref = "\/en\/map\?tab=places&source=record_saved"/);
        assert.match(response.body, /recordSuccessObservationHrefPrefix = "\/en\/observations\/"/);
        assert.match(response.body, /successProfileCta: "My page"/);
        assert.match(response.body, /successRecordsCta: "View my records"/);
        assert.match(response.body, /successMapCta: "View nearby map"/);
        assert.match(response.body, /Open the saved record right away. You can also return from your records list or My page later/);
        assert.match(response.body, /successSavedCardEyebrow: "Saved record"/);
        assert.match(response.body, /successSavedCardFallbackTitle: "Record still being organized"/);
        assert.match(response.body, /<meta name="robots" content="noindex, nofollow" \/>/);
        assert.doesNotMatch(response.body, /<h2>写真で記録する<\/h2>/);
        assert.doesNotMatch(response.body, /写真を撮るか選ぶだけで始められます/);
        assert.doesNotMatch(response.body, />観察した日時</);
        assert.doesNotMatch(response.body, />見つける</);
        assert.doesNotMatch(response.body, /自分の記録を見る/);
        assert.doesNotMatch(response.body, /マイページへ/);
        assert.doesNotMatch(response.body, new RegExp("フィールド" + "スキャン"));
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
        assert.match(response.body, /記録を始める/);
        assert.match(response.body, /shell-record-start/);
        assert.match(response.body, /ログインして記録を始める/);
        assert.match(response.body, /写真、動画、メモから始められます。名前はあとで大丈夫です。/);
        assert.match(response.body, /自分の記録に残ります。/);
        assert.match(response.body, /場所と時刻も一緒に残り、あとでヒントを見返せます。/);
        assert.match(response.body, /保存後の状態/);
        assert.match(response.body, /地図を見る/);
        assert.match(response.body, /みんなの発見/);
        assert.match(response.body, /場所/);
        assert.match(response.body, /時刻/);
        assert.match(response.body, /あとでヒント/);
        assert.match(response.body, /メモで始める/);
        assert.match(response.body, /使い方を読む/);
        assert.match(response.body, /アカウント作成/);
        assert.match(response.body, /redirect=%2Frecord%3Fstart%3Dnote/);
        assert.match(response.body, /redirect=%2Frecord%3Fstart%3Dphoto/);
        assert.doesNotMatch(response.body, /class="global-record-launcher"/);
        assert.doesNotMatch(response.body, /site-shell has-global-record-launcher/);
        assert.doesNotMatch(response.body, /class="record-capture-dock"/);
        assert.doesNotMatch(response.body, /分類や長い説明は最初にいりません/);
        assert.doesNotMatch(response.body, /あとで見返す、同じ場所を比べる/);
        assert.doesNotMatch(response.body, /あとで戻れる/);
        assert.doesNotMatch(response.body, /写真なしでも残せる/);
        assert.doesNotMatch(response.body, /公開前に確認できる/);
        assert.doesNotMatch(response.body, /\u30dd\u30c1|\u307d\u3061/);
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
        assert.match(response.body, /redirect=%2Frecord%3Fstart%3Dphoto%26draft%3D1%26source%3Ddraft_restore%26lang%3Dja/);
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

test("record photo feedback API requires a signed-in session", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/record/photo-feedback",
      headers: {
        "content-type": "application/json",
      },
      payload: {
        images: [{ mimeType: "image/jpeg", base64Data: "a".repeat(120) }],
      },
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.json(), {
      ok: false,
      error: "session_required",
    });
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

test("registration safety copy matches the explicit duplicate-email API contract", async () => {
  const app = buildApp();
  try {
    for (const lang of ["ja", "en", "es", "pt-BR"] as const) {
      const response = await app.inject({ method: "GET", url: `/${lang}/register?redirect=/profile` });
      assert.equal(response.statusCode, 200);
      assert.doesNotMatch(response.body, /メール有無が分からない|do not reveal whether an email exists|no revelan si existe un correo|nao revelam se um e-mail existe/i);
    }
    const ja = await app.inject({ method: "GET", url: "/ja/register?redirect=/profile" });
    assert.match(ja.body, /登録済みのメールアドレスはログインへ案内/);
  } finally {
    await app.close();
  }
});

test("auth pages honor English language context", async () => {
  const app = buildApp();
  try {
    const login = await app.inject({
      method: "GET",
      url: "/login?redirect=/profile&lang=en",
      headers: { accept: "text/html" },
    });
    assert.equal(login.statusCode, 200);
    assert.match(login.body, /<html lang="en">/);
    assert.match(login.body, /Log in to My page/);
    assert.match(login.body, /Email address/);
    assert.match(login.body, /Password/);
    assert.match(login.body, /Continue with Google/);
    assert.match(login.body, /data-endpoint="\/api\/v1\/auth\/login"/);
    assert.match(login.body, /href="\/en\/register\?redirect=%2Fprofile"/);
    assert.doesNotMatch(login.body, /ログインしてマイページへ/);
    assert.doesNotMatch(login.body, /メールアドレス/);

    const register = await app.inject({
      method: "GET",
      url: "/register?redirect=/record&lang=en",
      headers: { accept: "text/html" },
    });
    assert.equal(register.statusCode, 200);
    assert.match(register.body, /Create account and record/);
    assert.match(register.body, /Display name/);
    assert.match(register.body, /data-endpoint="\/api\/v1\/auth\/register"/);
    assert.match(register.body, /href="\/en\/login\?redirect=%2Frecord%3Fstart%3Dphoto"/);
    assert.doesNotMatch(register.body, /新しく登録して記録する/);
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
    assert.match(response.body, /ログインすると、残した記録と場所へ戻れます/);
    assert.match(response.body, /写真やメモ、関わった場所、公開範囲を一つのアカウントで管理できます/);
    assert.doesNotMatch(response.body, /表示イメージ|これはサンプルです|マイページでは、積み上げた時間/);
    assert.match(response.body, />ログイン<\/a>/);
    assert.match(response.body, /data-kpi-action="profile:logged_out:register"/);
    assert.match(response.body, /data-kpi-action="profile:logged_out:login"/);
    assert.match(response.body, /\/ja\/login\?redirect=%2Fprofile/);
    assert.match(response.body, /\/ja\/register\?redirect=%2Fprofile/);
  } finally {
    await app.close();
  }
});

test("profile guest entry keeps English auth links", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/profile?lang=en",
      headers: { accept: "text/html" },
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.body, /Sign in to return to your records and places/);
    assert.match(response.body, /Manage your photos, notes, places, and visibility in one account/);
    assert.doesNotMatch(response.body, /これはサンプルです|マイページでは/);
    assert.match(response.body, /\/en\/login\?redirect=%2Fprofile/);
    assert.match(response.body, /\/en\/register\?redirect=%2Fprofile/);
  } finally {
    await app.close();
  }
});

test("self profile hub leaves record browsing to the Records destination", async () => {
  const readRoute = await readFile(path.join(process.cwd(), "src", "routes", "read.ts"), "utf8");
  const selfProfileRoute = readRoute.slice(
    readRoute.indexOf('app.get("/profile", async'),
    readRoute.indexOf('app.get("/profile/settings"'),
  );

  assert.match(selfProfileRoute, /renderSelfProfileHub\(basePath, lang, snapshot\)/);
  assert.doesNotMatch(selfProfileRoute, /renderProfileSavedRecordPulse/);
  assert.doesNotMatch(selfProfileRoute, /profile:saved_record:/);
});

test("observation detail route has a saved fallback for public map records still preparing", async () => {
  const readRoute = await readFile(path.join(process.cwd(), "src", "routes", "read.ts"), "utf8");
  const observationRoute = readRoute.slice(
    readRoute.indexOf('app.get<{ Params: { id: string }; Querystring: { subject?: string; occurrence?: string } }>("/observations/:id"'),
    readRoute.indexOf("const mediaContext = mediaContextForSnapshot"),
  );

  assert.match(observationRoute, /findPublicMapObservationRecordById\(request\.params\.id\)/);
  assert.match(observationRoute, /findPublicMapObservationRecordById\(bundle\.visitId\)/);
  assert.match(observationRoute, /getObservationVisitBundle\(request\.params\.id, requestedSubjectId\)\.catch/);
  assert.match(observationRoute, /getObservationDetailSnapshot\(bundle\.canonicalSubjectId, \{ viewerUserId \}\)\.catch/);
  assert.match(readRoute, /function preparingObservationBody\(record: PublicMapObservationRecord\)/);
  assert.match(observationRoute, /記録は残っています。詳細表示を準備しています/);
  assert.match(readRoute, /マイページの記録一覧から確認してください。/);
  assert.match(readRoute, /escapeHtml\(record\.displayName\)/);
});

test("public observation detail links do not serialize a record location cell into URLs", async () => {
  const readRoute = await readFile(path.join(process.cwd(), "src", "routes", "read.ts"), "utf8");

  assert.doesNotMatch(readRoute, /buildPublicMapCellHref/);
  assert.match(readRoute, /const publicMapHref = withBasePath\(basePath, "\/map"\)/);
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
    assert.match(response.body, /\/ja\/login\?redirect=%2Fprofile%2Fsettings/);
    assert.match(response.body, /\/ja\/profile/);
  } finally {
    await app.close();
  }
});

test("profile settings guest entry keeps English auth links", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/profile/settings?lang=en",
      headers: { accept: "text/html" },
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.body, /\/en\/login\?redirect=%2Fprofile%2Fsettings/);
    assert.match(response.body, /\/en\/profile/);
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


test("record recovery start keeps a device draft through authentication", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/record?start=photo&draft=1&source=location_denied&lang=ja",
    });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /shell-record-recovery-start/);
    assert.match(response.body, /data-record-recovery-start/);
    assert.match(response.body, /data-source="location_denied"/);
    assert.match(response.body, /写真・入力内容はこの端末に残っています/);
    assert.match(response.body, /いま閉じても下書きは消しません/);
    assert.match(response.body, /ログインして続ける/);
    assert.match(response.body, /redirect=%2Frecord%3Fstart%3Dphoto%26draft%3D1%26source%3Dlocation_denied%26lang%3Dja/);
    assert.doesNotMatch(response.body, /<div class="start-guide-state-row"/);
  } finally {
    await app.close();
  }
});

test("signed-in record recovery renders focused restore controls", async () => {
  await withEnv({ ALLOW_QUERY_USER_ID: "1" }, async () => {
    const app = buildApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/record?userId=staging-user&start=photo&draft=1&source=location_denied",
      });
      assert.equal(response.statusCode, 200);
      assert.match(response.body, /record-page--recovery/);
      assert.match(response.body, /data-record-recovery-mode="1"/);
      assert.match(response.body, /data-record-recovery/);
      assert.match(response.body, /data-record-recovery-location/);
      assert.match(response.body, /data-record-recovery-save/);
      assert.match(response.body, /data-record-recovery-discard/);
      assert.match(response.body, /recordRecoveryCopy\.discardConfirm/);
      assert.match(response.body, /setRecordRecoveryState\('empty'\)/);
      assert.match(response.body, /setRecordRecoveryState\('ready'\)/);
      assert.match(response.body, /deleteRecordDraft\(\)/);
      assert.match(response.body, /recordRecoveryPanel\.hidden = true/);
    } finally {
      await app.close();
    }
  });
});
