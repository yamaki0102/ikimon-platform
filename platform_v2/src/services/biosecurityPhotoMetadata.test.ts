import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { BIOSECURITY_PHOTO_METADATA_MAX_BYTES, BIOSECURITY_PHOTO_METADATA_SCRIPT, readBiosecurityPhotoMetadata } from "./biosecurityPhotoMetadata.js";

const UNKNOWN = { time: { source: "unknown", localDateTime: null, offsetMinutes: null, instant: null, precision: "unknown" }, location: null };
const arrayBuffer = (bytes: Uint8Array) => Uint8Array.from(bytes).buffer;
type Rational = [number, number];
type Fixture = { little?: boolean; date?: string | null; offset?: string | null; latitude?: Rational[]; longitude?: Rational[]; latRef?: string; lngRef?: string; duplicateDate?: boolean; modifiedDate?: string };

// Small, deliberately structured CIPA TIFF fixtures; compressed pixel data is
// irrelevant to this local metadata reader and is validated by the upload path.
function tiff(options: Fixture = {}): Buffer {
  const little = options.little !== false;
  const b = Buffer.alloc(4096);
  const u16 = (value: number, at: number) => little ? b.writeUInt16LE(value, at) : b.writeUInt16BE(value, at);
  const u32 = (value: number, at: number) => little ? b.writeUInt32LE(value, at) : b.writeUInt32BE(value, at);
  type Tag = [number, number, string | number | Rational[]];
  const exif: Tag[] = [];
  if (options.date !== null) exif.push([0x9003, 2, options.date ?? "2026:10:11 15:24:36"]);
  if (options.offset !== null) exif.push([0x9011, 2, options.offset ?? "+09:00"]);
  if (options.duplicateDate) exif.push([0x9003, 2, "2025:01:01 01:01:01"]);
  const gps: Tag[] = [[1, 2, options.latRef ?? "N"], [2, 5, options.latitude ?? [[35, 1], [30, 1], [0, 1]]], [3, 2, options.lngRef ?? "E"], [4, 5, options.longitude ?? [[139, 1], [45, 1], [0, 1]]]];
  const i0: Tag[] = [[0x8769, 4, 0], [0x8825, 4, 0]];
  if (options.modifiedDate) i0.push([0x0132, 2, options.modifiedDate]);
  const exifStart = 8 + 2 + i0.length * 12 + 4;
  const gpsStart = exifStart + 2 + exif.length * 12 + 4;
  let dataAt = gpsStart + 2 + gps.length * 12 + 4;
  i0[0]![2] = exifStart; i0[1]![2] = gpsStart;
  const writeIfd = (start: number, tags: Tag[]) => {
    u16(tags.length, start);
    tags.forEach(([tag, type, value], index) => {
      const at = start + 2 + index * 12;
      u16(tag, at); u16(type, at + 2);
      const payload = typeof value === "string" ? Buffer.from(value + "\0", "ascii") : null;
      const count = payload ? payload.length : Array.isArray(value) ? value.length : 1;
      const length = payload ? payload.length : Array.isArray(value) ? value.length * 8 : 4;
      u32(count, at + 4);
      const target = length <= 4 ? at + 8 : dataAt;
      if (length > 4) { u32(target, at + 8); dataAt += length; }
      if (payload) payload.copy(b, target);
      else if (Array.isArray(value)) value.forEach(([n, d], i) => { u32(n, target + 8 * i); u32(d, target + 8 * i + 4); });
      else u32(value as number, target);
    });
  };
  b.write(little ? "II" : "MM"); u16(42, 2); u32(8, 4);
  writeIfd(8, i0); writeIfd(exifStart, exif); writeIfd(gpsStart, gps);
  return b.subarray(0, dataAt);
}
function jpeg(...metadata: Buffer[]): Buffer {
  return Buffer.concat([Buffer.from([0xff, 0xd8]), ...metadata.map(data => {
    const payload = Buffer.concat([Buffer.from("Exif\0\0"), data]);
    const head = Buffer.from([0xff, 0xe1, 0, 0]); head.writeUInt16BE(payload.length + 2, 2);
    return Buffer.concat([head, payload]);
  }), Buffer.from([0xff, 0xd9])]);
}
function crc32(b: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of b) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8), tail = Buffer.alloc(4);
  head.writeUInt32BE(data.length); head.write(type, 4); tail.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type), data])));
  return Buffer.concat([head, data, tail]);
}
function png(data: Buffer): Buffer {
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk("IHDR", Buffer.alloc(13)), pngChunk("eXIf", data), pngChunk("IEND", Buffer.alloc(0))]);
}
function webp(data: Buffer): Buffer {
  const chunk = Buffer.alloc(8); chunk.write("EXIF"); chunk.writeUInt32LE(data.length, 4);
  const body = Buffer.concat([Buffer.from("WEBP"), chunk, data, Buffer.alloc(data.length & 1)]);
  const head = Buffer.alloc(8); head.write("RIFF"); head.writeUInt32LE(body.length, 4);
  return Buffer.concat([head, body]);
}
function box(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8); head.writeUInt32BE(data.length + 8); head.write(type, 4);
  return Buffer.concat([head, data]);
}
function heif(data: Buffer, options: { idat?: boolean; external?: boolean; offset?: number; tiffOffset?: number } = {}): Buffer {
  const ftyp = box("ftyp", Buffer.from("heic\0\0\0\0mif1"));
  const infe = Buffer.alloc(13); infe[0] = 2; infe.writeUInt16BE(2, 4); infe.write("Exif", 8);
  const iinf = box("iinf", Buffer.concat([Buffer.from([0, 0, 0, 0, 0, 1]), box("infe", infe)]));
  const prefix = Buffer.alloc(4); prefix.writeUInt32BE(options.tiffOffset ?? 0);
  const payload = Buffer.concat([prefix, data]);
  const iloc = Buffer.alloc(options.idat ? 24 : 22);
  iloc[0] = options.idat ? 1 : 0; iloc[4] = 0x44; iloc.writeUInt16BE(1, 6); iloc.writeUInt16BE(2, 8);
  if (options.idat) iloc.writeUInt16BE(1, 10);
  const start = options.idat ? 12 : 10;
  iloc.writeUInt16BE(options.external ? 1 : 0, start); iloc.writeUInt16BE(1, start + 2); iloc.writeUInt32BE(payload.length, start + 8);
  const buildMeta = () => box("meta", Buffer.concat([Buffer.alloc(4), iinf, box("iloc", iloc), ...(options.idat ? [box("idat", payload)] : [])]));
  iloc.writeUInt32BE(options.offset ?? (options.idat ? 0 : ftyp.length + buildMeta().length + 8), start + 4);
  return Buffer.concat([ftyp, buildMeta(), ...(options.idat ? [] : [box("mdat", payload)])]);
}
const read = (b: Uint8Array) => readBiosecurityPhotoMetadata(arrayBuffer(b));

test("JPEG TIFF byte orders preserve original local time, its own UTC offset and GPS", () => {
  for (const little of [true, false]) {
    assert.deepEqual(read(jpeg(tiff({ little }))), {
      time: { source: "photo_exif", localDateTime: "2026-10-11T15:24:36", offsetMinutes: 540, instant: "2026-10-11T06:24:36.000Z", precision: "second" },
      location: { lat: 35.5, lng: 139.75, source: "photo_exif" },
    });
    assert.deepEqual(read(jpeg(tiff({ little, latRef: "S", lngRef: "W", offset: "-03:30" }))).location, { lat: -35.5, lng: -139.75, source: "photo_exif" });
    assert.equal(read(jpeg(tiff({ little, offset: "-03:30" }))).time.instant, "2026-10-11T18:54:36.000Z");
  }
});

test("missing offset and partial capture dates remain explicitly imprecise", () => {
  for (const offset of [null, "", "-00:00", "+15:00", "+14:01", "+09:60", "Z", "+09:00\n"]) {
    const result = read(jpeg(tiff({ offset })));
    assert.equal(result.time.localDateTime, "2026-10-11T15:24:36", String(offset));
    assert.equal(result.time.instant, null, String(offset));
    assert.equal(result.time.offsetMinutes, null, String(offset));
  }
  assert.deepEqual(read(jpeg(tiff({ date: "2024:02:29", offset: "+09:00" }))).time,
    { source: "photo_exif", localDateTime: "2024-02-29", offsetMinutes: 540, instant: null, precision: "date" });
  assert.equal(read(jpeg(tiff({ date: "2024:02:29 00:15", offset: "+09:00" }))).time.instant, "2024-02-28T15:15:00.000Z");
  assert.equal(read(jpeg(tiff({ date: "2024:02:29 00:15" }))).time.precision, "minute");
  assert.equal(read(jpeg(tiff({ offset: "+00:00" }))).time.offsetMinutes, 0);
});

test("invalid calendars, rollover times and duplicate original-time tags never become capture time", () => {
  for (const date of ["2023:02:29 12:00:00", "2026:02:30 12:00:00", "0000:01:01 00:00:00", "2026:13:01 00:00:00", "2026:01:00 00:00:00", "2026:01:01 24:00:00", "2026:01:01 12:60:00", "2026:01:01 12:00:60", "2026:01:01 12:00:00<script>", "2026:01:01 12:00:00\0other", "    :  :     :  :  "]) {
    assert.deepEqual(read(jpeg(tiff({ date }))).time, UNKNOWN.time, date);
  }
  assert.deepEqual(read(jpeg(tiff({ duplicateDate: true }))).time, UNKNOWN.time);
  const malformedDuplicate = tiff({ duplicateDate: true });
  const exifStart = malformedDuplicate.readUInt32LE(18);
  malformedDuplicate.writeUInt16LE(7, exifStart + 2 + 2 * 12 + 2);
  assert.deepEqual(read(jpeg(malformedDuplicate)).time, UNKNOWN.time);
  assert.deepEqual(read(jpeg(tiff({ date: null, modifiedDate: "2026:10:11 12:00:00" }))).time, UNKNOWN.time);
});

test("GPS rejects invalid hemispheres, denominator zero, overflowing components and half locations", () => {
  for (const options of [
    { latRef: "E" }, { lngRef: "N" }, { latRef: "" }, { lngRef: "e" },
    { latitude: [[35, 0], [0, 1], [0, 1]] }, { latitude: [[91, 1], [0, 1], [0, 1]] },
    { longitude: [[180, 1], [0, 1], [1, 1]] }, { latitude: [[35, 1], [60, 1], [0, 1]] },
    { longitude: [[139, 1], [0, 1], [60, 1]] }, { latitude: [[35, 1]] },
  ] as Fixture[]) assert.equal(read(jpeg(tiff(options))).location, null, JSON.stringify(options));
  assert.deepEqual(read(jpeg(tiff({ latitude: [[0, 1], [0, 1], [0, 1]], longitude: [[0, 1], [0, 1], [0, 1]] }))).location, { lat: 0, lng: 0, source: "photo_exif" });
});

test("PNG CRC and WebP chunk boundaries carry the same TIFF metadata", () => {
  const expected = read(jpeg(tiff()));
  assert.deepEqual(read(png(tiff())), expected);
  assert.deepEqual(read(webp(tiff())), expected);
  assert.deepEqual(read(webp(Buffer.concat([Buffer.from("Exif\0\0"), tiff()]))), expected);
  const corrupted = png(tiff()); corrupted[45] = corrupted[45]! ^ 1;
  assert.deepEqual(read(corrupted), UNKNOWN);
  const overflow = webp(tiff()); overflow.writeUInt32LE(0xffffffff, 16);
  assert.deepEqual(read(overflow), UNKNOWN);
});

test("HEIF resolves bounded file/idat Exif extents, never external data or a scanned TIFF signature", () => {
  const expected = read(jpeg(tiff()));
  assert.deepEqual(read(heif(tiff())), expected);
  assert.deepEqual(read(heif(tiff(), { idat: true })), expected);
  assert.deepEqual(read(heif(Buffer.concat([Buffer.from("Exif\0\0"), tiff()]), { tiffOffset: 6 })), expected);
  for (const options of [{ external: true }, { idat: true, external: true }, { offset: 1 }, { offset: 0xffffffff }, { tiffOffset: 0xffffffff }]) assert.deepEqual(read(heif(tiff(), options)), UNKNOWN);
  assert.deepEqual(read(heif(Buffer.concat([Buffer.from("unrelated"), tiff()]))), UNKNOWN);
  assert.deepEqual(read(Buffer.concat([box("ftyp", Buffer.from("mp42\0\0\0\0mp42")), box("mdat", tiff())])), UNKNOWN);
});

test("conflicting metadata is not averaged or selected arbitrarily", () => {
  const conflict = read(jpeg(tiff(), tiff({ date: "2025:01:01 12:00:00", latitude: [[36, 1], [0, 1], [0, 1]] })));
  assert.deepEqual(conflict, UNKNOWN);
  assert.deepEqual(read(jpeg(tiff(), tiff())), read(jpeg(tiff())));
  assert.deepEqual(read(jpeg(...Array.from({ length: 5 }, () => tiff()))), UNKNOWN);
});

test("truncated, oversized, looping and out-of-container TIFF offsets are bounded and harmless", () => {
  const good = jpeg(tiff());
  for (let size = 0; size < good.length - 3; size++) assert.doesNotThrow(() => read(good.subarray(0, size)));
  const outside = tiff(); outside.writeUInt32LE(0xfffffff0, 4); assert.deepEqual(read(jpeg(outside)), UNKNOWN);
  const crossContainer = tiff(); crossContainer.writeUInt32LE(crossContainer.length + 8, 18);
  assert.deepEqual(read(jpeg(crossContainer)).time, UNKNOWN.time);
  const loop = tiff(); loop.writeUInt32LE(8, 18); assert.deepEqual(read(jpeg(loop)).time, UNKNOWN.time);
  const count = tiff(); count.writeUInt16LE(0xffff, 8); assert.deepEqual(read(jpeg(count)), UNKNOWN);
  const beyondBudget = Buffer.concat([Buffer.alloc(BIOSECURITY_PHOTO_METADATA_MAX_BYTES), good]);
  assert.deepEqual(read(beyondBudget), UNKNOWN);
  assert.deepEqual(read(Buffer.from("DateTimeOriginal=2026:10:11 12:00:00 GPSLatitude=35")), UNKNOWN);
});

test("the exact browser helper runs without imports, network, local clock or file fallbacks", () => {
  const context = vm.createContext({ window: {}, ArrayBuffer, Uint8Array, DataView });
  vm.runInContext(BIOSECURITY_PHOTO_METADATA_SCRIPT, context, { timeout: 1000 });
  const browser = (context.window as { readBiosecurityPhotoMetadata: typeof readBiosecurityPhotoMetadata; BIOSECURITY_PHOTO_METADATA_MAX_BYTES: number });
  assert.equal(browser.BIOSECURITY_PHOTO_METADATA_MAX_BYTES, BIOSECURITY_PHOTO_METADATA_MAX_BYTES);
  for (const fixture of [jpeg(tiff()), png(tiff()), webp(tiff()), heif(tiff()), jpeg(tiff({ offset: null })), Buffer.alloc(0)]) {
    assert.deepEqual(JSON.parse(JSON.stringify(browser.readBiosecurityPhotoMetadata(arrayBuffer(fixture)))), read(fixture));
  }
  assert.doesNotMatch(BIOSECURITY_PHOTO_METADATA_SCRIPT, /\bfetch\s*\(|lastModified|Date\.now\s*\(|new Date\(\)/);
  assert.deepEqual(read(Buffer.alloc(0)), UNKNOWN);
});
