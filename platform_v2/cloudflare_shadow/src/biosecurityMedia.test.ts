import assert from "node:assert/strict";
import test from "node:test";
import { removePhotoMetadata } from "./biosecurityMedia";

// Small raster fixtures generated locally. Metadata is injected as container segments,
// so assertions exercise the binary sanitizer rather than a mocked image transform.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGPUyLNhYGBgYmBgYGBgAAAJ7gDW/OIFpQAAAABJRU5ErkJggg==", "base64");
const WEBP = Buffer.from("UklGRjQAAABXRUJQVlA4ICgAAABwAQCdASoCAAIAAUAmJZgCdAF1AAD+8PorXFzZEUf/CtfytfytW+AA", "base64");
const JPEG = Buffer.from("/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDkqKKK4zwz/9k=", "base64");
const PRIVATE = Buffer.from("Exif\0\0GPSLatitude=35.123456;GPSLongitude=139.654321;Owner=private-person");
const bytes = (value: Uint8Array): ArrayBuffer => Uint8Array.from(value).buffer;
function jpegSegment(marker: number, payload: Buffer) {
  const head = Buffer.alloc(4); head[0] = 0xff; head[1] = marker; head.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([head, payload]);
}
function crc32(value: Buffer) {
  let crc = 0xffffffff;
  for (const byte of value) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(kind: string, payload: Buffer) {
  const head = Buffer.alloc(8); head.writeUInt32BE(payload.length); head.write(kind, 4, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(kind), payload])));
  return Buffer.concat([head, payload, crc]);
}
function webpChunk(kind: string, payload: Buffer) {
  const head = Buffer.alloc(8); head.write(kind, 0, "ascii"); head.writeUInt32LE(payload.length, 4);
  return Buffer.concat([head, payload, Buffer.alloc(payload.length % 2)]);
}
function webpContainer(chunks: Buffer[]) {
  const content = Buffer.concat([Buffer.from("WEBP"), ...chunks]); const head = Buffer.alloc(8);
  head.write("RIFF"); head.writeUInt32LE(content.length, 4); return Buffer.concat([head, content]);
}

test("JPEG APP/EXIF/XMP/comment metadata is removed while compressed photo data remains unchanged", () => {
  const clean = removePhotoMetadata(bytes(JPEG), "image/jpeg");
  const withMetadata = Buffer.concat([JPEG.subarray(0, 2), jpegSegment(0xe1, PRIVATE), jpegSegment(0xe1, Buffer.from("http://ns.adobe.com/xap/1.0/\0private-xmp")), jpegSegment(0xfe, Buffer.from("private-comment")), JPEG.subarray(2)]);
  const sanitized = removePhotoMetadata(bytes(withMetadata), "image/jpeg");
  assert.equal(sanitized.mime, "image/jpeg"); assert.deepEqual(sanitized.bytes, clean.bytes);
  assert.equal(Buffer.from(sanitized.bytes).includes(PRIVATE), false);
  assert.deepEqual(withMetadata.subarray(0, 2), Buffer.from([0xff, 0xd8]), "input remains unchanged");
});

test("late JPEG metadata following an entropy scan is stripped or rejected instead of returned", () => {
  const withLateMetadata = Buffer.concat([JPEG.subarray(0, -2), jpegSegment(0xe1, PRIVATE), jpegSegment(0xfe, Buffer.from("private-comment")), JPEG.subarray(-2)]);
  let result: ReturnType<typeof removePhotoMetadata>;
  try { result = removePhotoMetadata(bytes(withLateMetadata), "image/jpeg"); }
  catch (error) { assert.match(String(error), /photo_format_invalid/); return; }
  assert.equal(Buffer.from(result.bytes).includes(PRIVATE), false, "no metadata may survive after the first SOS marker");
  assert.equal(Buffer.from(result.bytes).includes(Buffer.from("private-comment")), false);
});

test("PNG strips EXIF and text chunks while preserving the original raster chunks", () => {
  const withMetadata = Buffer.concat([PNG.subarray(0, 33), pngChunk("eXIf", PRIVATE), pngChunk("tEXt", Buffer.from("Comment\0private-person")), pngChunk("iTXt", Buffer.from("XML:com.adobe.xmp\0\0\0\0\0private-xmp")), PNG.subarray(33)]);
  const sanitized = removePhotoMetadata(bytes(withMetadata), "image/png");
  assert.equal(sanitized.mime, "image/png"); assert.deepEqual(Buffer.from(sanitized.bytes), PNG);
});

test("WebP strips EXIF/XMP/ICC and clears corresponding VP8X flags without altering image payload", () => {
  const extended = Buffer.alloc(10); extended[0] = 0x2c; extended[4] = 1; extended[7] = 1;
  const withMetadata = webpContainer([webpChunk("VP8X", extended), webpChunk("ICCP", Buffer.from("private-profile")), WEBP.subarray(12), webpChunk("EXIF", PRIVATE), webpChunk("XMP ", Buffer.from("private-xmp"))]);
  const sanitized = removePhotoMetadata(bytes(withMetadata), "image/webp");
  const result = Buffer.from(sanitized.bytes);
  assert.equal(sanitized.mime, "image/webp"); assert.equal(result.readUInt32LE(4), result.length - 8); assert.equal(result[20], 0);
  assert.equal(result.includes(PRIVATE), false); assert.equal(result.includes(Buffer.from("private-xmp")), false);
  assert.deepEqual(result.subarray(30), WEBP.subarray(12));
});

test("declared MIME mismatch, truncated containers, animation and executable formats fail closed", () => {
  for (const [image, mime] of [[PNG, "image/jpeg"], [JPEG, "image/webp"], [WEBP, "image/png"], [Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"), "image/svg+xml"], [Buffer.from("<html><script>secret()</script></html>"), "image/png"]] as const) {
    assert.throws(() => removePhotoMetadata(bytes(image), mime), /photo_format_invalid/);
  }
  for (const [image, mime] of [[JPEG, "image/jpeg"], [PNG, "image/png"], [WEBP, "image/webp"]] as const) {
    assert.throws(() => removePhotoMetadata(bytes(image.subarray(0, -3)), mime), /photo_format_invalid/);
  }
  const animatedPng = Buffer.concat([PNG.subarray(0, 33), pngChunk("acTL", Buffer.alloc(8)), PNG.subarray(33)]);
  assert.throws(() => removePhotoMetadata(bytes(animatedPng), "image/png"), /photo_format_invalid/);
  assert.throws(() => removePhotoMetadata(bytes(webpContainer([webpChunk("ANIM", Buffer.alloc(6)), WEBP.subarray(12)])), "image/webp"), /photo_format_invalid/);
  const unknownCritical = Buffer.concat([PNG.subarray(0, 33), pngChunk("EVIL", PRIVATE), PNG.subarray(33)]);
  assert.throws(() => removePhotoMetadata(bytes(unknownCritical), "image/png"), /photo_format_invalid/);
});

test("small containers cannot advertise oversized decoded raster dimensions", () => {
  const hugePng=Buffer.from(PNG); hugePng.writeUInt32BE(65535,16); hugePng.writeUInt32BE(65535,20);
  assert.throws(()=>removePhotoMetadata(bytes(hugePng),"image/png"),/photo_format_invalid/);
  const hugeJpeg=Buffer.from(JPEG); const frame=hugeJpeg.indexOf(Buffer.from([0xff,0xc0]));assert.ok(frame>0);
  hugeJpeg.writeUInt16BE(65535,frame+5);hugeJpeg.writeUInt16BE(65535,frame+7);
  assert.throws(()=>removePhotoMetadata(bytes(hugeJpeg),"image/jpeg"),/photo_format_invalid/);
  const hugeWebp=Buffer.from(WEBP);hugeWebp.writeUInt16LE(16383,26);hugeWebp.writeUInt16LE(16383,28);
  assert.throws(()=>removePhotoMetadata(bytes(hugeWebp),"image/webp"),/photo_format_invalid/);
});
