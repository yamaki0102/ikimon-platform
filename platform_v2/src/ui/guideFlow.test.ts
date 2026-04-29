import assert from "node:assert/strict";
import test from "node:test";

import { GUIDE_FLOW_STYLES, renderGuideFlow } from "./guideFlow.js";

test("guide flow exposes a photo fallback when camera access is unavailable", () => {
  const html = renderGuideFlow("", "ja");

  assert.match(html, /id="guide-photo-fallback" hidden/);
  assert.match(html, /id="guide-photo-btn" type="button"/);
  assert.match(html, /id="guide-photo-input" type="file" accept="image\/\*" hidden/);
  assert.match(html, /投稿用写真を選ぶ/);
  assert.match(html, /写真を解析中/);
  assert.match(html, /policy: 'photo_fallback_no_audio'/);
});

test("guide live capture starts video-only and asks for microphone separately", () => {
  const html = renderGuideFlow("", "en");

  assert.match(html, /id="guide-start-sheet" hidden/);
  assert.match(html, /Use the camera\?/);
  assert.match(html, /Camera on/);
  assert.match(html, /Camera off/);
  assert.match(html, /Record audio too\?/);
  assert.match(html, /Audio on/);
  assert.match(html, /Audio off/);
  assert.match(html, /Recommended setup/);
  assert.match(html, /Use recommended/);
  assert.match(html, /Start with these settings/);
  assert.match(html, /let audioOptIn = false/);
  assert.match(html, /let cameraOptIn = true/);
  assert.match(html, /let audioOnlyChunkCount = 0/);
  assert.match(html, /id="guide-audio-opt-btn" type="button" aria-pressed="false"/);
  assert.match(html, /Audio is saved only if you enable natural sound recording below\./);
  assert.match(html, /Field-like discoveries are saved automatically; indoor or person-first scenes are not kept\./);
  assert.match(html, /autoSaveView\(scene\)/);
  assert.match(html, /copy\.autoSaved/);
  assert.match(html, /copy\.manualSave/);
  assert.match(html, /requestEnvironmentCamera\(\)/);
  assert.match(html, /facingMode: \{ exact: 'environment' \}/);
  assert.match(html, /audio: \{ channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: false \}/);
  assert.match(html, /startBtn\.addEventListener\('click', openStartSheet\)/);
  assert.match(html, /recommendedApply\.addEventListener\('click', applyRecommendedSettings\)/);
  assert.match(html, /cameraOptIn = selectedChoice\('guide-camera-choice', 'on'\) === 'on'/);
  assert.match(html, /if \(cameraOptIn\) analyseTimer = setTimeout\(doAnalyse, 5000\)/);
  assert.match(html, /showSessionSummary\(\)/);
  assert.match(GUIDE_FLOW_STYLES, /height: min\(68dvh, 640px\)/);
  assert.match(html, /if \(audioOptIn\) void startOptionalAudioCapture\(\);/);
  assert.doesNotMatch(html, /\n\s+void startOptionalAudioCapture\(\);\n\s+void prepareLiveAssist/);
  assert.doesNotMatch(html, /Camera & microphone access required/);
  assert.match(html, /Guide camera unavailable/);
});

test("guide start sheet explains Japanese camera and audio choices gently", () => {
  const html = renderGuideFlow("", "ja");

  assert.match(html, /使うものを選んで開始します/);
  assert.match(html, /おすすめ設定/);
  assert.match(html, /歩きながら見たり、自転車でゆっくり移動するなら/);
  assert.match(html, /おすすめを使う/);
  assert.match(html, /ポケットに入れて使う日は/);
  assert.match(html, /ポケットに入れて音だけ集めるときはOFF/);
  assert.match(html, /外を歩いたり自転車で移動する場合/);
  assert.match(html, /人の声らしい音は保存しないよう除外します/);
  assert.match(html, /音声だけで記録中/);
  assert.match(html, /カメラ映像は取得していません/);
  assert.match(html, /カメラか音声のどちらかをONにすると開始できます/);
  assert.match(html, /今回のふりかえり/);
  assert.match(html, /保存されたもの/);
  assert.match(html, /保存しなかったもの/);
  assert.match(html, /音声だけで取れたもの/);
});
