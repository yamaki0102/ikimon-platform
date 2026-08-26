import assert from "node:assert/strict";
import test from "node:test";

import { GUIDE_FLOW_STYLES, renderGuideFlow } from "./guideFlow.js";

test("guide flow exposes a photo fallback when camera access is unavailable", () => {
  const html = renderGuideFlow("", "ja");

  assert.match(html, /id="guide-photo-fallback" hidden/);
  assert.match(html, /id="guide-photo-btn" type="button"/);
  assert.match(html, /id="guide-photo-input" type="file" accept="image\/\*" hidden/);
  assert.match(html, /記録用写真を選ぶ/);
  assert.match(html, /写真を解析中/);
  assert.match(html, /audioPrivacyPolicy: 'photo_fallback_no_audio'/);
});

test("guide flow keeps the live guide plumbing while simplifying the entry UI", () => {
  const html = renderGuideFlow("", "en");

  assert.match(html, /id="guide-start-sheet" hidden/);
  assert.match(html, /Walk and look/);
  assert.match(html, /Pocket audio/);
  assert.match(html, /Bike \/ open car/);
  assert.match(html, /Car \/ train \/ bus/);
  assert.match(html, /Drivers must not operate this/);
  assert.match(html, /Outcome sample/);
  assert.match(html, /Possible clue: moist ground and low leaves near a water edge/);
  assert.match(html, /Before you allow access, camera and microphone stay off/);
  assert.match(html, /Before permissions/);
  assert.match(html, /camera permission is enough to begin/);
  assert.match(html, /Weak signal is queued on this device/);
  assert.match(html, /Fine-tune settings/);
  assert.match(html, /id="guide-audio-opt-btn" type="button" aria-pressed="false" hidden/);
  assert.match(html, /Speech-like audio is not saved/);
  assert.match(html, /How Guide works/);
  assert.match(html, /Audio connects each discovery to four shelves/);
  assert.doesNotMatch(html, /Recommended setup/);
  assert.doesNotMatch(html, /Use recommended/);
  assert.doesNotMatch(html, /gdi-ai-models/);

  assert.match(html, /let audioOptIn = false/);
  assert.match(html, /let cameraOptIn = true/);
  assert.match(html, /const OFFLINE_DB_NAME = 'ikimon-guide-offline-v1'/);
  assert.match(html, /const OFFLINE_STORE = 'queue'/);
  assert.match(html, /const OFFLINE_MEDIA_TTL_MS = 72 \* 60 \* 60 \* 1000/);
  assert.match(html, /const OFFLINE_TELEMETRY_TTL_MS = 24 \* 60 \* 60 \* 1000/);
  assert.match(html, /function captureGuideConsentSnapshot\(\)/);
  assert.match(html, /function hasActiveCurrentConsent\(\)/);
  assert.match(html, /function canReplayCapturedScene\(item\)/);
  assert.match(html, /if \(!canReplayCapturedScene\(item\)\) return 'dropped';/);
  assert.match(html, /capturedConsentSnapshot: captureGuideConsentSnapshot\(\)/);
  assert.match(html, /return 'deferred'/);
  assert.match(html, /if \(replayState === 'deferred'\) continue;/);
  assert.match(html, /canReplayWithCurrentConsent\(item, 'audio'\)/);
  assert.match(html, /hasCapturedConsent\(item, 'camera'\)/);
  assert.match(html, /canReplayWithCurrentConsent\(item, 'location'\)/);
  assert.match(html, /window\.addEventListener\('ikimon-guide-consent-reset'/);
  assert.match(html, /window\.addEventListener\('ikimon-auth-logout'/);
  assert.match(html, /rawAudioPolicy: 'analysis_only_delete_after_detection'/);
  assert.match(html, /mirrorAppOutboxItem\(item, 'queued'\)/);
  assert.match(html, /window\.addEventListener\('online'/);
  assert.match(html, /window\.addEventListener\('offline'/);
  assert.match(html, /id="guide-offline-queued" hidden/);
  assert.match(html, /id="guide-summary-queued">0<\/strong>/);

  assert.match(html, /function selectedStartSummary\(\)/);
  assert.match(html, /Start with camera only/);
  assert.match(html, /applyMissionPreset\(selectedChoice\('guide-mission-choice', 'quick'\)\)/);
  assert.match(html, /setRadioChoice\('guide-audio-choice', 'off'\)/);
  assert.match(html, /if \(audioOptBtn\) audioOptBtn\.hidden = false/);
  assert.match(html, /if \(audioOptBtn\) audioOptBtn\.hidden = true/);

  assert.match(html, /autoSaveView\(scene\)/);
  assert.match(html, /const trailBundles = new Map\(\)/);
  assert.match(html, /function upsertTrailBundle\(scene\)/);
  assert.match(html, /scene-bundle-/);
  assert.match(html, /<details class="gdi-details">/);
  assert.match(html, /copy\.autoSaved/);
  assert.match(html, /copy\.manualSave/);
  assert.match(GUIDE_FLOW_STYLES, /\.gdi-bundle/);
  assert.match(GUIDE_FLOW_STYLES, /position: fixed; z-index: 70/);

  assert.match(html, /clientSceneId: payload\.clientSceneId/);
  assert.match(html, /externalId: newQueueId\('guide-audio'\)/);
  assert.match(html, /await queueScenePayload\(payload, 'offline'\)/);
  assert.match(html, /await queueAudioPayload\(payload, blob, 'offline'\)/);
  assert.match(html, /if \(vad\.speechLikely\)/);
  assert.match(html, /const AUDIO_CHUNK_TARGET_MS = 2000/);
  assert.match(html, /validateAudioChunkQuality\(blob, chunkMeta\)/);
  assert.match(html, /webm_header_missing/);
  assert.match(html, /hasWebmEbmlHeader\(header\)/);
  assert.match(html, /requestEnvironmentCamera\(\)/);
  assert.match(html, /facingMode: \{ exact: 'environment' \}/);
  assert.match(html, /navigator\.geolocation\.watchPosition/);
  assert.match(html, /function startLocationWatch\(\)/);
  assert.match(html, /sessionDistanceM: Math\.round\(sessionDistanceM\)/);
  assert.match(html, /audio: \{ channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: false \}/);

  assert.match(html, /const TELEMETRY_INTERVAL_MS = 1500/);
  assert.match(html, /const VISUAL_SAMPLE_INTERVAL_MS = 5000/);
  assert.match(html, /const GUIDE_FRAME_BUNDLE_SIZE = 3/);
  assert.match(html, /const AI_MIN_INTERVAL_MS = 15000/);
  assert.match(html, /candidateCount >= GUIDE_FRAME_BUNDLE_SIZE/);
  assert.match(html, /const LOCAL_COVERAGE_CELL_M = 10/);
  assert.match(html, /function guideEffortSummary\(frameCount\)/);
  assert.match(html, /function guideCoverageSummary\(\)/);
  assert.match(html, /\/api\/v1\/guide\/telemetry/);
  assert.match(html, /visualCandidates\.slice\(-GUIDE_FRAME_BUNDLE_SIZE\)/);
  assert.match(html, /frames: frames/);
  assert.match(html, /frameBundleSummary: payload\.frameBundleSummary/);
  assert.match(html, /id="guide-coverage"/);
  assert.match(html, /id="guide-coverage-map"/);
  assert.match(html, /guide-coverage-missing/);
  assert.match(html, /guide-coverage-visited/);
  assert.match(html, /maplibre-gl@4\.7\.1/);
  assert.match(html, /function applyReadySceneToCoverage\(scene\)/);

  const addPendingDiscovery = html.slice(
    html.indexOf("function addPendingDiscovery(scene)"),
    html.indexOf("function addQueuedDiscovery(scene)"),
  );
  assert.doesNotMatch(addPendingDiscovery, /\brepresentative\b/);
  assert.doesNotMatch(html, /const capturedAt = bundle \? framePayload\.capturedAt/);
  assert.match(html, /const capturedAt = new Date\(\)\.toISOString\(\);/);
  assert.doesNotMatch(html, /setTimeout\(doAnalyse, 5000\)/);
  assert.match(html, /stopLocationWatch\(\)/);
  assert.match(html, /showSessionSummary\(\)/);
  assert.match(GUIDE_FLOW_STYLES, /height: min\(68dvh, 640px\)/);
  assert.match(html, /if \(audioOptIn\) void startOptionalAudioCapture\(\);/);
  assert.doesNotMatch(html, /Camera & microphone access required/);
  assert.match(html, /Guide camera unavailable/);
});

test("guide start sheet presents the Japanese field UX as one clear decision", () => {
  const html = renderGuideFlow("", "ja");

  assert.match(html, /歩いた場所の自然の手がかりを、AIと一緒に残します/);
  assert.match(html, /まずはカメラだけで歩き始める/);
  assert.match(html, /記録にするものはあとで選べます/);
  assert.match(html, /今日のミッション/);
  assert.match(html, /迷ったら「歩きながら見る」で始めてください/);
  assert.match(html, /🚶 歩きながら見る/);
  assert.match(html, /🎧 ポケット音声/);
  assert.match(html, /🔎 1地点を詳しく見る/);
  assert.match(html, /🚲 自転車・オープンカー/);
  assert.match(html, /🚌 車内・電車・バス/);
  assert.match(html, /運転者は操作しないでください/);
  assert.match(html, /成果サンプル/);
  assert.match(html, /候補: 水辺の草地で、湿った地面と低い葉が見えます/);
  assert.match(html, /許可するまでカメラとマイクは起動しません/);
  assert.match(html, /記録として残すかはあとで選びます/);
  assert.match(html, /開始前の許可/);
  assert.match(html, /まずカメラだけ許可すれば始められます/);
  assert.match(html, /電波が弱い時は端末に一時保存/);
  assert.match(html, /30分ごとに電池と通信を確認/);
  assert.match(html, /細かく調整する/);
  assert.match(html, /カメラだけで開始する/);
  assert.match(html, /自然音も使いますか？/);
  assert.match(html, /声らしい音は保存候補から外すよう処理します/);
  assert.match(html, /見つけたものは、あとから自分の記録として残せます/);
  assert.match(html, /公開記録には正確な移動軌跡を出しません/);
  assert.match(html, /仕組みを見る/);
  assert.match(html, /音声ONで、録った音が研究まで届きます/);
  assert.match(html, /残す → 整理する → 人が確かめる → 研究に渡す/);
  assert.doesNotMatch(html, /bundle \/ cluster/);
  assert.doesNotMatch(html, /BioMonWeek 型の観測データ/);
  assert.match(html, /今回のふりかえり/);
  assert.match(html, /今日見えたもの/);
  assert.match(html, /次回見るもの/);
  assert.match(html, /記録にならなかった場面/);
  assert.match(html, /未同期のもの/);
  assert.match(html, /フィールド状況/);
  assert.match(html, /見た範囲/);
  assert.match(html, /気づき/);
  assert.doesNotMatch(html, /おすすめ設定/);
  assert.doesNotMatch(html, /保存しなかったもの/);
  assert.match(html, /href="\/guide\/outcomes"/);
  assert.match(html, /ガイド成果を確認する/);
  assert.match(html, /オフライン中/);
  assert.match(html, /端末に一時保存中/);
});
