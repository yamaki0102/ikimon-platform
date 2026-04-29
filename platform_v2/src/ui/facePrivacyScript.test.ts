import assert from "node:assert/strict";
import test from "node:test";
import { FACE_PRIVACY_CLIENT_SCRIPT } from "./facePrivacyScript.js";

test("face privacy client script falls back to local MediaPipe WASM assets", () => {
  assert.match(FACE_PRIVACY_CLIENT_SCRIPT, /window\.FaceDetector/);
  assert.match(FACE_PRIVACY_CLIENT_SCRIPT, /mediapipe\/vision_bundle\.mjs/);
  assert.match(FACE_PRIVACY_CLIENT_SCRIPT, /mediapipe\/wasm/);
  assert.match(FACE_PRIVACY_CLIENT_SCRIPT, /blaze_face_short_range\.tflite/);
  assert.match(FACE_PRIVACY_CLIENT_SCRIPT, /mediapipe_wasm_face_detector/);
  assert.doesNotMatch(FACE_PRIVACY_CLIENT_SCRIPT, /cdn\.jsdelivr|storage\.googleapis/);
});
