# Face privacy assets

These files support local, client-side face redaction before photo uploads.

- `mediapipe/vision_bundle.mjs` and `mediapipe/wasm/*` are copied from `@mediapipe/tasks-vision@0.10.35`.
- `blaze_face_short_range.tflite` is the MediaPipe short-range face detector model.

Run `npm run sync:face-privacy-assets` from `platform_v2/` after updating `@mediapipe/tasks-vision`.
