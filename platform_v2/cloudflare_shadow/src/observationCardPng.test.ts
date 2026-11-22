import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { bytesToBase64, cropRgb, decodePngRgb, encodePngRgb, tileRects, wideRect } from "./observationCardPng";

const gradient = (width: number, height: number, channels: 3 | 4): Buffer => {
  const data = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * channels;
    data[i] = (x * 7 + y * 3) & 255;
    data[i + 1] = (x * x + y) & 255;
    data[i + 2] = (x ^ (y * 5)) & 255;
    if (channels === 4) data[i + 3] = 255;
  }
  return data;
};

const rgbOf = (data: Buffer, channels: 3 | 4): Uint8Array => channels === 3 ? new Uint8Array(data) : Uint8Array.from({ length: (data.length / 4) * 3 }, (_unused, i) => data[Math.floor(i / 3) * 4 + (i % 3)]!);

test("png decode matches sharp for rgb and rgba with adaptive filters", async () => {
  for (const channels of [3, 4] as const) {
    const raw = gradient(97, 61, channels);
    const png = await sharp(raw, { raw: { width: 97, height: 61, channels } }).png({ adaptiveFiltering: true }).toBuffer();
    const decoded = await decodePngRgb(new Uint8Array(png));
    assert.equal(decoded.width, 97);
    assert.equal(decoded.height, 61);
    assert.deepEqual(decoded.data, rgbOf(raw, channels));
  }
});

test("png encode round-trips through sharp and crop keeps pixels", async () => {
  const raw = gradient(120, 80, 3);
  const image = { width: 120, height: 80, data: new Uint8Array(raw) };
  const tile = cropRgb(image, { left: 30, top: 20, width: 50, height: 40 });
  const png = await encodePngRgb(tile);
  const back = await sharp(Buffer.from(png)).raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([back.info.width, back.info.height, back.info.channels], [50, 40, 3]);
  const expected = await sharp(raw, { raw: { width: 120, height: 80, channels: 3 } }).extract({ left: 30, top: 20, width: 50, height: 40 }).raw().toBuffer();
  assert.deepEqual(new Uint8Array(back.data), new Uint8Array(expected));
  assert.deepEqual((await decodePngRgb(png)).data, new Uint8Array(expected));
});

test("png decode rejects unsupported input instead of guessing", async () => {
  const palette = await sharp(gradient(16, 16, 3), { raw: { width: 16, height: 16, channels: 3 } }).png({ palette: true }).toBuffer();
  await assert.rejects(decodePngRgb(new Uint8Array(palette)), /png_format_unsupported/);
  await assert.rejects(decodePngRgb(new Uint8Array(40)), /png_signature_invalid/);
});

test("tile grid covers the image with overlap and wide crops stay inside", () => {
  const rects = tileRects(1024, 1820, 5);
  assert.equal(rects.length, 25);
  for (const r of rects) {
    assert.ok(r.left >= 0 && r.top >= 0 && r.left + r.width <= 1024 && r.top + r.height <= 1820);
    const wide = wideRect(1024, 1820, r);
    assert.ok(wide.left >= 0 && wide.top >= 0 && wide.left + wide.width <= 1024 && wide.top + wide.height <= 1820);
    assert.ok(wide.width >= r.width && wide.height >= r.height);
  }
  assert.equal(rects[0]!.left, 0);
  assert.equal(rects[24]!.left + rects[24]!.width, 1024);
  assert.equal(bytesToBase64(Uint8Array.from([104, 105])), "aGk=");
});
