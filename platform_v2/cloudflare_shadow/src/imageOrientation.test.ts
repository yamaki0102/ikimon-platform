import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  addDisplayRotation,
  classifyOrientationBackfill,
  exifCorrectionRotation,
  exifOrientationRotation,
  exifOrientationSwapsAxes,
  normalizeDisplayRotation,
  planDerivativeOrientation,
  readJpegDimensions,
  readJpegExifOrientation,
} from "./imageOrientation";

const jpegWithOrientation = async (orientation: number | null): Promise<Uint8Array> => {
  const image = sharp({ create: { width: 40, height: 30, channels: 3, background: { r: 200, g: 60, b: 60 } } });
  const buffer = await (orientation === null ? image.jpeg() : image.withMetadata({ orientation }).jpeg()).toBuffer();
  return new Uint8Array(buffer);
};

test("reads EXIF Orientation=6 and the raw pixel size from a JPEG fixture", async () => {
  const jpeg = await jpegWithOrientation(6);
  assert.equal(readJpegExifOrientation(jpeg), 6);
  assert.deepEqual(readJpegDimensions(jpeg), { width: 40, height: 30 });
  assert.equal(exifOrientationSwapsAxes(6), true);
  assert.equal(exifOrientationRotation(6), 90);
});

test("reads every orientation and reports none for plain JPEGs and non-JPEGs", async () => {
  for (const orientation of [1, 3, 6, 8]) assert.equal(readJpegExifOrientation(await jpegWithOrientation(orientation)), orientation);
  assert.equal(readJpegExifOrientation(await jpegWithOrientation(null)), null);
  assert.equal(readJpegExifOrientation(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0])), null);
  assert.equal(readJpegExifOrientation(new Uint8Array(0)), null);
  assert.equal(exifOrientationRotation(8), 270);
  assert.equal(exifOrientationRotation(3), 180);
  assert.equal(exifOrientationRotation(1), 0);
  assert.equal(exifOrientationRotation(5), 0);
});

test("display rotation is normalized to quarter turns and accumulates", () => {
  assert.equal(normalizeDisplayRotation(null), 0);
  assert.equal(normalizeDisplayRotation(90), 90);
  assert.equal(normalizeDisplayRotation(450), 90);
  assert.equal(normalizeDisplayRotation(-90), 270);
  assert.equal(normalizeDisplayRotation(40), 0);
  assert.equal(addDisplayRotation(270, 90), 0);
  assert.equal(addDisplayRotation(90, 90), 180);
  assert.equal(addDisplayRotation(undefined, 90), 90);
});

test("derivative plan swaps axes for orientation 6 and for a stored 90 degree rotation", () => {
  const plain = planDerivativeOrientation({ rawWidth: 4000, rawHeight: 3000, exifOrientation: null, displayRotation: 0, maxWidth: 1600 });
  assert.deepEqual(plain, { rotate: 0, targetWidth: 1600, expectLandscape: true });
  const exif = planDerivativeOrientation({ rawWidth: 4000, rawHeight: 3000, exifOrientation: 6, displayRotation: 0, maxWidth: 1600 });
  assert.equal(exif.expectLandscape, false);
  assert.equal(exif.targetWidth, 1600);
  const rotated = planDerivativeOrientation({ rawWidth: 1920, rawHeight: 2560, exifOrientation: null, displayRotation: 90, maxWidth: 1600 });
  assert.deepEqual(rotated, { rotate: 90, targetWidth: 1600, expectLandscape: true });
  const both = planDerivativeOrientation({ rawWidth: 4000, rawHeight: 3000, exifOrientation: 6, displayRotation: 90, maxWidth: 1600 });
  assert.equal(both.expectLandscape, true);
  const small = planDerivativeOrientation({ rawWidth: 800, rawHeight: 600, exifOrientation: 6, displayRotation: 0, maxWidth: 1600 });
  assert.equal(small.targetWidth, 600);
});

test("a derivative that ignored EXIF Orientation=6 is corrected, an honored one is left alone", () => {
  assert.equal(exifCorrectionRotation({ exifOrientation: 6, displayRotation: 0, expectLandscape: false, derivativeWidth: 1600, derivativeHeight: 1200 }), 90);
  assert.equal(exifCorrectionRotation({ exifOrientation: 6, displayRotation: 0, expectLandscape: false, derivativeWidth: 1200, derivativeHeight: 1600 }), null);
  assert.equal(exifCorrectionRotation({ exifOrientation: 8, displayRotation: 90, expectLandscape: true, derivativeWidth: 1200, derivativeHeight: 1600 }), 0);
  assert.equal(exifCorrectionRotation({ exifOrientation: null, displayRotation: 0, expectLandscape: true, derivativeWidth: 1200, derivativeHeight: 1600 }), null);
  assert.equal(exifCorrectionRotation({ exifOrientation: 6, displayRotation: 0, expectLandscape: null, derivativeWidth: 1600, derivativeHeight: 1200 }), null);
});

test("backfill classification flags only derivatives that ignored an axis-swapping EXIF orientation", () => {
  const base = { rawWidth: 4000, rawHeight: 3000 };
  assert.equal(classifyOrientationBackfill({ ...base, exifOrientation: 6, derivativeWidth: 1600, derivativeHeight: 1200 }), "regenerate");
  assert.equal(classifyOrientationBackfill({ ...base, exifOrientation: 6, derivativeWidth: 1200, derivativeHeight: 1600 }), "ok");
  assert.equal(classifyOrientationBackfill({ ...base, exifOrientation: 8, derivativeWidth: 1200, derivativeHeight: 1600 }), "ok");
  assert.equal(classifyOrientationBackfill({ ...base, exifOrientation: null, derivativeWidth: 1200, derivativeHeight: 1600 }), "no_exif_orientation");
  assert.equal(classifyOrientationBackfill({ ...base, exifOrientation: 1, derivativeWidth: 1600, derivativeHeight: 1200 }), "no_exif_orientation");
  assert.equal(classifyOrientationBackfill({ rawWidth: 3000, rawHeight: 3000, exifOrientation: 6, derivativeWidth: 1200, derivativeHeight: 1200 }), "ok");
});
