import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { PHOTO_UPLOAD_PREPARATION_SCRIPT } from "./photoUploadPreparation.js";

type Options = { width?: number; height?: number; fail?: boolean; gif?: boolean; type?: string; size?: number; unsupported?: boolean; blobNull?: boolean; noBlob?: boolean; invalidOutput?: boolean; nullContext?: boolean };
function fixture(options: Options = {}) {
  let closed = 0;
  let decoded = 0;
  let drawn: number[] = [];
  const encodings: { type: string; quality: number }[] = [];
  const encode = (type: string, quality: number) => {
    encodings.push({ type, quality });
    if (options.invalidOutput) return "data:,";
    const actual = options.unsupported && type === "image/webp" ? "image/png" : type;
    return "data:" + actual + ";base64,ZmFrZQ==";
  };
  const canvas = {
    width: 0, height: 0,
    getContext: () => options.nullContext ? null : ({ drawImage: (_: unknown, _x: number, _y: number, width: number, height: number) => { drawn = [width, height]; } }),
    toBlob: options.noBlob ? undefined : (callback: (blob: unknown) => void, type: string, quality: number) => { callback(options.blobNull ? null : { data: encode(type, quality) }); },
    toDataURL: encode,
  };
  const type = options.gif ? "image/gif" : options.type ?? "image/png";
  const file = { name: options.gif ? "photo.gif" : "field.photo." + (type === "image/jpeg" ? "jpg" : "png"), type, size: options.size, data: "data:" + type + ";base64,b3JpZ2luYWw=" };
  class Reader { result = ""; onload?: () => void; readAsDataURL(blob: { data: string }) { this.result = blob.data; this.onload?.(); } }
  const context = vm.createContext({ FileReader: Reader, window: { createImageBitmap: async () => { decoded++; return { width: options.width ?? 4000, height: options.height ?? 3000, close: () => { closed++; } }; } }, document: { createElement: () => { if (options.fail) throw new Error("canvas unavailable"); return canvas; } }, input: file });
  new vm.Script(PHOTO_UPLOAD_PREPARATION_SCRIPT + "\nresult = preparePhotoUpload(input);").runInContext(context);
  return { result: context.result as Promise<{ filename: string; mimeType: string; base64Data: string; facePrivacy?: { status: string; error: string | null } }>, facts: () => ({ closed, decoded, drawn, encodings, canvas }) };
}

test("large photos use WebP at the existing 2560px bound and release memory", async () => {
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

test("small photos are not enlarged", async () => {
  const f = fixture({ width: 800, height: 600 }); await f.result;
  assert.deepEqual(f.facts().drawn, [800, 600]);
});

test("portrait photos constrain the longest edge", async () => {
  const f = fixture({ width: 3000, height: 4000 }); await f.result;
  assert.deepEqual(f.facts().drawn, [1920, 2560]);
});

test("unsupported WebP keeps PNG for alpha-capable sources without mislabelling bytes", async () => {
  const f = fixture({ unsupported: true });
  const result = await f.result;
  assert.equal(result.filename, "field.photo.png");
  assert.equal(result.mimeType, "image/png");
  assert.match(result.base64Data, /^data:image\/png;base64,/);
  assert.equal(f.facts().encodings.length, 1);
});

test("unsupported WebP falls back to JPEG only for opaque JPEG input", async () => {
  const f = fixture({ unsupported: true, type: "image/jpeg" });
  const result = await f.result;
  assert.equal(result.filename, "field.photo.jpg");
  assert.equal(result.mimeType, "image/jpeg");
  assert.match(result.base64Data, /^data:image\/jpeg;base64,/);
  assert.deepEqual(f.facts().encodings.map((entry) => entry.type), ["image/webp", "image/jpeg"]);
});

test("null blob and older canvas APIs fall back to the actual data URL type", async () => {
  for (const options of [{ blobNull: true }, { noBlob: true }]) {
    const f = fixture(options);
    assert.equal((await f.result).mimeType, "image/webp");
    assert.equal(f.facts().closed, 1);
  }
});

test("already smaller originals stay unchanged only within the dimension limit", async () => {
  const small = fixture({ width: 800, height: 600, size: 1, type: "image/jpeg" });
  const result = await small.result;
  assert.equal(result.base64Data, "data:image/jpeg;base64,b3JpZ2luYWw=");
  assert.equal(result.filename, "field.photo.jpg");
  assert.equal(result.facePrivacy?.status, "pending");
  const large = fixture({ size: 1, type: "image/jpeg" });
  assert.equal((await large.result).mimeType, "image/webp");
});

test("GIF retains its original frames without decoding", async () => {
  const f = fixture({ gif: true });
  assert.equal((await f.result).mimeType, "image/gif");
  assert.equal(f.facts().decoded, 0);
});

test("canvas, context, invalid dimensions and encoder failures retain the original and release memory", async () => {
  for (const options of [{ fail: true }, { nullContext: true }, { width: 0 }, { invalidOutput: true }]) {
    const f = fixture(options);
    const result = await f.result;
    assert.equal(result.base64Data, "data:image/png;base64,b3JpZ2luYWw=");
    assert.equal(result.facePrivacy?.error, "photo_canvas_fallback");
    assert.equal(f.facts().closed, 1);
  }
});
