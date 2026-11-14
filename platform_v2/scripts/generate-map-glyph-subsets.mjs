import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const GLYPH_SOURCE_TEMPLATE =
  "https://tiles.openfreemap.org/fonts/Noto%20Sans%20Regular/{range}.pbf";

export const GLYPH_SUBSET_RANGES = ["12288-12543", "65280-65535"];

// Exact predicate from vendored MapLibre GL JS 4.7.1 (_doesCharSupportLocalGlyph).
export const MAPLIBRE_LOCAL_GLYPH_RE =
  /\p{Ideo}|\p{sc=Hang}|\p{sc=Hira}|\p{sc=Kana}/u;

export function shouldKeepGlyphCodePoint(codePoint) {
  return !MAPLIBRE_LOCAL_GLYPH_RE.test(String.fromCodePoint(codePoint));
}

function readVarint(buf, offset) {
  let value = 0;
  let shift = 0;
  let pos = offset;
  while (pos < buf.length) {
    const byte = buf[pos++];
    value += (byte & 0x7f) * 2 ** shift;
    if ((byte & 0x80) === 0) {
      return [value, pos];
    }
    shift += 7;
    if (shift > 49) {
      throw new Error(`Varint overflow at offset ${offset}`);
    }
  }
  throw new Error(`Truncated varint at offset ${offset}`);
}

function encodeVarint(value) {
  const bytes = [];
  let v = value >>> 0;
  while (v >= 0x80) {
    bytes.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  bytes.push(v);
  return Buffer.from(bytes);
}

function decodeSint32(value) {
  const n = value >>> 0;
  return (n >>> 1) ^ -(n & 1);
}

function readFields(buf, start = 0, end = buf.length) {
  const fields = [];
  let pos = start;
  while (pos < end) {
    const [tag, afterTag] = readVarint(buf, pos);
    pos = afterTag;
    const fieldNo = tag >>> 3;
    const wireType = tag & 0x07;
    if (wireType === 0) {
      const [val, afterVal] = readVarint(buf, pos);
      pos = afterVal;
      fields.push({ fieldNo, wireType, val });
    } else if (wireType === 2) {
      const [len, afterLen] = readVarint(buf, pos);
      pos = afterLen;
      if (pos + len > end) {
        throw new Error(`Truncated length-delimited field ${fieldNo}`);
      }
      fields.push({ fieldNo, wireType, buf: buf.subarray(pos, pos + len) });
      pos += len;
    } else {
      throw new Error(`Unsupported protobuf wireType ${wireType} on field ${fieldNo}`);
    }
  }
  return fields;
}

function encodeBytesField(fieldNo, payload) {
  const tag = encodeVarint((fieldNo << 3) | 2);
  const len = encodeVarint(payload.length);
  return Buffer.concat([tag, len, payload]);
}

export function parseGlyphMessage(buf) {
  const glyph = { id: 0, bitmap: Buffer.alloc(0), width: 0, height: 0, left: 0, top: 0, advance: 0 };
  for (const field of readFields(buf)) {
    if (field.fieldNo === 1) glyph.id = field.val;
    else if (field.fieldNo === 2) glyph.bitmap = field.buf;
    else if (field.fieldNo === 3) glyph.width = field.val;
    else if (field.fieldNo === 4) glyph.height = field.val;
    else if (field.fieldNo === 5) glyph.left = decodeSint32(field.val);
    else if (field.fieldNo === 6) glyph.top = decodeSint32(field.val);
    else if (field.fieldNo === 7) glyph.advance = field.val;
  }
  return glyph;
}

export function parseGlyphsPbf(buf) {
  const stacks = [];
  for (const topField of readFields(buf)) {
    if (topField.fieldNo !== 1) continue;
    let name = "";
    let range = "";
    const glyphs = [];
    for (const stackField of readFields(topField.buf)) {
      if (stackField.fieldNo === 1) name = stackField.buf.toString("utf8");
      else if (stackField.fieldNo === 2) range = stackField.buf.toString("utf8");
      else if (stackField.fieldNo === 3) {
        glyphs.push({ ...parseGlyphMessage(stackField.buf), raw: stackField.buf });
      }
    }
    stacks.push({ name, range, glyphs });
  }
  return { stacks };
}

export function subsetGlyphsPbf(buf, keepFn = shouldKeepGlyphCodePoint) {
  const parsed = parseGlyphsPbf(buf);
  const stackChunks = [];
  const keptIds = [];
  let totalInputGlyphs = 0;

  for (const stack of parsed.stacks) {
    const parts = [];
    if (stack.name) {
      parts.push(encodeBytesField(1, Buffer.from(stack.name, "utf8")));
    }
    if (stack.range) {
      parts.push(encodeBytesField(2, Buffer.from(stack.range, "utf8")));
    }
    for (const glyph of stack.glyphs) {
      totalInputGlyphs += 1;
      if (keepFn(glyph.id)) {
        keptIds.push(glyph.id);
        parts.push(encodeBytesField(3, glyph.raw));
      }
    }
    stackChunks.push(encodeBytesField(1, Buffer.concat(parts)));
  }

  return {
    buffer: Buffer.concat(stackChunks),
    totalInputGlyphs,
    keptIds,
  };
}

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const outDir = path.resolve(scriptDir, "../assets/fonts/noto-sans-regular");
  await mkdir(outDir, { recursive: true });

  const sourceDirArgIdx = process.argv.indexOf("--source-dir");
  const sourceDir = sourceDirArgIdx !== -1 ? process.argv[sourceDirArgIdx + 1] : null;

  for (const range of GLYPH_SUBSET_RANGES) {
    let raw;
    if (sourceDir) {
      raw = await readFile(path.join(sourceDir, `${range}.pbf`));
    } else {
      const url = GLYPH_SOURCE_TEMPLATE.replace("{range}", range);
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
      }
      raw = Buffer.from(await res.arrayBuffer());
    }
    const result = subsetGlyphsPbf(raw);
    const outPath = path.join(outDir, `${range}.pbf`);
    await writeFile(outPath, result.buffer);
    console.log(
      `${range}.pbf: ${raw.length} -> ${result.buffer.length} bytes (${result.keptIds.length}/${result.totalInputGlyphs} glyphs kept)`,
    );
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
