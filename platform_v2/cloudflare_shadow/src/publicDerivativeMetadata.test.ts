import assert from "node:assert/strict";
import test from "node:test";
import { inspectPublicDerivativeMetadata } from "./publicDerivativeMetadata.js";

function webp(chunks: Array<{ type: string; data: Uint8Array }>): ArrayBuffer {
  const bodyLength = 4 + chunks.reduce((sum, chunk) => sum + 8 + chunk.data.byteLength + (chunk.data.byteLength % 2), 0);
  const bytes = new Uint8Array(8 + bodyLength);
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode("RIFF"), 0);
  view.setUint32(4, bodyLength, true);
  bytes.set(new TextEncoder().encode("WEBP"), 8);
  let offset = 12;
  for (const chunk of chunks) {
    bytes.set(new TextEncoder().encode(chunk.type), offset);
    view.setUint32(offset + 4, chunk.data.byteLength, true);
    bytes.set(chunk.data, offset + 8);
    offset += 8 + chunk.data.byteLength + (chunk.data.byteLength % 2);
  }
  return bytes.buffer;
}

test("compressed WebP image bytes containing gps text do not masquerade as metadata", () => {
  const result = inspectPublicDerivativeMetadata(webp([
    { type: "VP8 ", data: new TextEncoder().encode("binary-gps-noise") },
  ]), "image/webp");

  assert.equal(result.scannedContainer, "webp");
  assert.equal(result.gpsExifPresent, false);
  assert.equal(result.inspectionVersion, "webp-chunk-v2");
});

test("WebP EXIF and XMP chunks remain blocked", () => {
  const result = inspectPublicDerivativeMetadata(webp([
    { type: "VP8 ", data: new Uint8Array([1, 2, 3]) },
    { type: "EXIF", data: new TextEncoder().encode("GPSLatitude=34.7") },
    { type: "XMP ", data: new TextEncoder().encode("metadata") },
  ]), "image/webp");

  assert.equal(result.exifPresent, true);
  assert.equal(result.xmpPresent, true);
  assert.equal(result.gpsExifPresent, true);
});

test("malformed WebP is not accepted as a parsed WebP container", () => {
  const bytes = new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WEBPVP8 ").buffer;
  const result = inspectPublicDerivativeMetadata(bytes, "image/webp");
  assert.equal(result.scannedContainer, "binary");
});
