import assert from "node:assert/strict";
import test from "node:test";

import { renderGuideFlow } from "./guideFlow.js";

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

  assert.match(html, /getUserMedia\(\{\s*video: true,\s*audio: false\s*\}\)/);
  assert.match(html, /audio: \{ channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: false \}/);
  assert.match(html, /Started without microphone\. Video analysis continues\./);
  assert.doesNotMatch(html, /Camera & microphone access required/);
  assert.match(html, /Guide camera unavailable/);
});
