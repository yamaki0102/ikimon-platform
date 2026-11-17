import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { PHOTO_UPLOAD_PREPARATION_SCRIPT } from "./photoUploadPreparation.js";

type FaceResult = { available: boolean; redacted: boolean; faceCount: number; error: string | null; detector: string };
type Options = { width?: number; height?: number; fail?: boolean; gif?: boolean; type?: string; size?: number; unsupported?: boolean; nullContext?: boolean; faceDetector?: () => Promise<FaceResult> };

function fixture(options: Options = {}) {
  let closed = 0;
  let decoded = 0;
  let drawn: number[] = [];
  const encodings: { type: string; quality: number }[] = [];
  const encode = (type: string, quality: number) => {
    encodings.push({ type, quality });
    const actual = options.unsupported && type === "image/webp" ? "image/png" : type;
    return { data: `data:${actual};base64,ZmFrZQ==`, type: actual };
  };
  const canvas = {
    width: 0, height: 0,
    getContext: () => options.nullContext ? null : ({ drawImage: (_: unknown, _x: number, _y: number, width: number, height: number) => { drawn = [width, height]; } }),
    toBlob: (callback: (blob: unknown) => void, type: string, quality: number) => callback(encode(type, quality)),
    toDataURL: (type: string) => encode(type, 0.88).data,
  };
  const type = options.gif ? "image/gif" : options.type ?? "image/png";
  const file = { name: options.gif ? "photo.gif" : `field.photo.${type === "image/jpeg" ? "jpg" : "png"}`, type, size: options.size, data: `data:${type};base64,b3JpZ2luYWw=` };
  class Reader { result = ""; onload?: () => void; onerror?: () => void; readAsDataURL(blob: { data: string }) { this.result = blob.data; this.onload?.(); } }
  let created = 0;
  const scratchSizes: number[][] = [];
  const faceDetector = options.faceDetector;
  const context = vm.createContext({
    FileReader: Reader,
    window: {
      createImageBitmap: async () => { decoded++; return { width: options.width ?? 4000, height: options.height ?? 3000, close: () => { closed++; } }; },
      ...(faceDetector ? {
        ikimonFacePrivacy: {
          redactCanvasFaces: async (scratch: { width: number; height: number }) => { scratchSizes.push([scratch.width, scratch.height]); return faceDetector(); },
          summarizeFacePrivacy: (raw: FaceResult) => ({ detector: raw.detector, status: raw.redacted ? "redacted" : raw.available ? "no_faces" : "unavailable", faceCount: raw.faceCount, error: raw.error }),
        },
      } : {}),
    },
    document: {
      createElement: () => {
        if (options.fail) throw new Error("canvas unavailable");
        created++;
        // The first canvas is the upload canvas; later ones are face-check scratch copies.
        return created === 1 ? canvas : { width: 0, height: 0, getContext: () => ({ drawImage: () => undefined }) };
      },
    },
    input: file,
  });
  new vm.Script(PHOTO_UPLOAD_PREPARATION_SCRIPT + "\nresult = preparePhotoUpload(input);").runInContext(context);
  return { result: context.result as Promise<{ filename: string; mimeType: string; base64Data: string; facePrivacy?: { status: string; error: string | null; faceCount?: number; detector?: string } }>, facts: () => ({ closed, decoded, drawn, encodings, canvas, scratchSizes }) };
}

test("large photos use WebP and release decoded/canvas memory", async () => {
  const f = fixture();
  const result = await f.result;
  assert.equal(result.filename, "field.photo.webp");
  assert.equal(result.mimeType, "image/webp");
  assert.match(result.base64Data, /^data:image\/webp;base64,/);
  assert.deepEqual(f.facts().drawn, [2560, 1920]);
  assert.deepEqual(f.facts().encodings, [{ type: "image/webp", quality: 0.88 }]);
  assert.equal(result.facePrivacy?.status, "pending");
  assert.equal(f.facts().closed, 1);
  assert.equal(f.facts().canvas.width, 1);
  assert.equal(f.facts().canvas.height, 1);
});

test("small and portrait photos do not upscale and respect the longest edge", async () => {
  const small = fixture({ width: 800, height: 600 }); await small.result;
  assert.deepEqual(small.facts().drawn, [800, 600]);
  const portrait = fixture({ width: 3000, height: 4000 }); await portrait.result;
  assert.deepEqual(portrait.facts().drawn, [1920, 2560]);
});

test("unsupported WebP preserves alpha-safe PNG without MIME mislabelling", async () => {
  const f = fixture({ unsupported: true });
  const result = await f.result;
  assert.equal(result.filename, "field.photo.png");
  assert.equal(result.mimeType, "image/png");
  assert.match(result.base64Data, /^data:image\/png;base64,/);
  assert.deepEqual(f.facts().encodings.map(({ type }) => type), ["image/webp", "image/webp", "image/png"]);
});

test("unsupported WebP falls back to JPEG only for opaque JPEG input", async () => {
  const f = fixture({ unsupported: true, type: "image/jpeg" });
  const result = await f.result;
  assert.equal(result.filename, "field.photo.jpg");
  assert.equal(result.mimeType, "image/jpeg");
  assert.match(result.base64Data, /^data:image\/jpeg;base64,/);
  assert.deepEqual(f.facts().encodings.map(({ type }) => type), ["image/webp", "image/webp", "image/jpeg"]);
});

test("GIF bypass and preparation failures retain the original with privacy state", async () => {
  const gif = fixture({ gif: true });
  assert.equal((await gif.result).mimeType, "image/gif");
  assert.equal(gif.facts().decoded, 0);
  for (const options of [{ fail: true }, { nullContext: true }, { width: 0 }]) {
    const f = fixture(options);
    const result = await f.result;
    assert.equal(result.base64Data, "data:image/png;base64,b3JpZ2luYWw=");
    assert.equal(result.facePrivacy?.error, "photo_canvas_fallback");
    assert.equal(f.facts().closed, 1);
  }
});

test("already smaller originals can be reused without dropping privacy metadata", async () => {
  const f = fixture({ width: 800, height: 600, size: 1, type: "image/jpeg" });
  const result = await f.result;
  assert.equal(result.base64Data, "data:image/jpeg;base64,b3JpZ2luYWw=");
  assert.equal(result.filename, "field.photo.jpg");
  assert.equal(result.mimeType, "image/jpeg");
  assert.equal(result.facePrivacy?.status, "pending");
});

test("does not reuse an original that is larger than the encoded payload", async () => {
  const f = fixture({ width: 800, height: 600, size: 5, type: "image/jpeg" });
  const result = await f.result;
  assert.equal(result.filename, "field.photo.webp");
  assert.equal(result.mimeType, "image/webp");
  assert.match(result.base64Data, /^data:image\/webp;base64,/);
});

test("does not reuse an AVIF original that the upload API does not accept", async () => {
  const f = fixture({ width: 800, height: 600, size: 1, type: "image/avif" });
  const result = await f.result;
  assert.equal(result.filename, "field.photo.webp");
  assert.equal(result.mimeType, "image/webp");
  assert.match(result.base64Data, /^data:image\/webp;base64,/);
});

test("face check marks face-free photos no_faces on a downscaled copy without changing the upload", async () => {
  const f = fixture({ faceDetector: async () => ({ available: true, redacted: false, faceCount: 0, error: null, detector: "mediapipe_wasm_face_detector" }) });
  const result = await f.result;
  assert.equal(result.facePrivacy?.status, "no_faces");
  assert.equal(result.facePrivacy?.detector, "mediapipe_wasm_face_detector");
  assert.deepEqual(f.facts().scratchSizes, [[1280, 960]]);
  assert.deepEqual(f.facts().drawn, [2560, 1920]);
  assert.match(result.base64Data, /^data:image\/webp;base64,/);
});

test("detected faces keep the photo pending so it is never syndicated externally", async () => {
  const f = fixture({ faceDetector: async () => ({ available: true, redacted: true, faceCount: 2, error: null, detector: "mediapipe_wasm_face_detector" }) });
  const result = await f.result;
  assert.equal(result.facePrivacy?.status, "pending");
  assert.equal(result.facePrivacy?.error, "faces_detected");
  assert.equal(result.facePrivacy?.faceCount, 2);
});

test("an unavailable or failing detector never reports no_faces", async () => {
  const unavailable = await fixture({ faceDetector: async () => ({ available: false, redacted: false, faceCount: 0, error: "wasm_face_detector_failed", detector: "mediapipe_wasm_face_detector" }) }).result;
  assert.equal(unavailable.facePrivacy?.status, "unavailable");
  const throwing = await fixture({ faceDetector: async () => { throw new Error("boom"); } }).result;
  assert.equal(throwing.facePrivacy?.status, "unavailable");
  assert.equal(throwing.facePrivacy?.error, "face_check_failed");
});

test("the upload request carries only a server-accepted face privacy status", () => {
  const context = vm.createContext({ window: {}, document: {}, FileReader: class {} });
  new vm.Script(PHOTO_UPLOAD_PREPARATION_SCRIPT + "\nstatuses = [photoFacePrivacyStatus({ facePrivacy: { status: 'no_faces' } }), photoFacePrivacyStatus({ facePrivacy: { status: 'unavailable' } }), photoFacePrivacyStatus({ facePrivacy: { status: 'redacted' } }), photoFacePrivacyStatus({}), photoFacePrivacyStatus(null)];").runInContext(context);
  assert.equal(JSON.stringify(context.statuses), JSON.stringify(["no_faces", "unavailable", "pending", "pending", "pending"]));
});
