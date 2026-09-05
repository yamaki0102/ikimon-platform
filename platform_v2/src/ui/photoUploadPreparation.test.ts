import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { PHOTO_UPLOAD_PREPARATION_SCRIPT } from "./photoUploadPreparation.js";

function fixture(options: { width?: number; height?: number; fail?: boolean; gif?: boolean } = {}) {
  let closed = 0;
  let decoded = 0;
  let drawn: number[] = [];
  let quality = 0;
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: (_: unknown, _x: number, _y: number, width: number, height: number) => { drawn = [width, height]; } }), toBlob: (callback: (blob: unknown) => void, _type: string, q: number) => { quality = q; callback({ data: "data:image/jpeg;base64,ZmFrZQ==" }); } };
  const file = { name: options.gif ? "photo.gif" : "field.photo.png", type: options.gif ? "image/gif" : "image/png", data: "data:image/png;base64,b3JpZ2luYWw=" };
  class Reader { result = ""; onload?: () => void; readAsDataURL(blob: { data: string }) { this.result = blob.data; this.onload?.(); } }
  const context = vm.createContext({ FileReader: Reader, window: { createImageBitmap: async () => { decoded++; return { width: options.width ?? 4000, height: options.height ?? 3000, close: () => { closed++; } }; } }, document: { createElement: () => { if (options.fail) throw new Error("canvas unavailable"); return canvas; } }, input: file });
  new vm.Script(PHOTO_UPLOAD_PREPARATION_SCRIPT + "\nresult = preparePhotoUpload(input);").runInContext(context);
  return { result: context.result as Promise<{ filename: string; mimeType: string; base64Data: string }>, facts: () => ({ closed, decoded, drawn, quality, canvas }) };
}

test("large photos use the established 2560px JPEG policy and release decoded/canvas memory", async () => {
  const f = fixture();
  const result = await f.result;
  assert.equal(result.filename, "field.photo.jpg");
  assert.equal(result.mimeType, "image/jpeg");
  assert.deepEqual(f.facts().drawn, [2560, 1920]);
  assert.equal(f.facts().quality, 0.88);
  assert.equal(f.facts().closed, 1);
  assert.equal(f.facts().canvas.width, 1);
  assert.equal(f.facts().canvas.height, 1);
});

test("small photos are not enlarged", async () => {
  const f = fixture({ width: 800, height: 600 }); await f.result;
  assert.deepEqual(f.facts().drawn, [800, 600]);
});

test("GIF and canvas failures retain the original media instead of discarding it", async () => {
  const gif = fixture({ gif: true });
  assert.equal((await gif.result).mimeType, "image/gif");
  assert.equal(gif.facts().decoded, 0);
  const failed = fixture({ fail: true });
  assert.equal((await failed.result).base64Data, "data:image/png;base64,b3JpZ2luYWw=");
  assert.equal(failed.facts().closed, 1);
});
