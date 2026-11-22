export type RgbImage = { width: number; height: number; data: Uint8Array };
export type PixelRect = { left: number; top: number; width: number; height: number };

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const MAX_PIXELS = 24_000_000;

const pipe = async (bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> =>
  new Uint8Array(await new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream as ReadableWritablePair<Uint8Array, Uint8Array>)).arrayBuffer());

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (bytes: Uint8Array): number => {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 255]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

export async function decodePngRgb(bytes: Uint8Array): Promise<RgbImage> {
  if (bytes.length < 33 || SIGNATURE.some((b, i) => bytes[i] !== b)) throw new Error("png_signature_invalid");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8, width = 0, height = 0, channels = 0, idatLength = 0;
  const idat: Uint8Array[] = [];
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(bytes[offset + 4]!, bytes[offset + 5]!, bytes[offset + 6]!, bytes[offset + 7]!);
    const body = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = view.getUint32(offset + 8);
      height = view.getUint32(offset + 12);
      if (body[8] !== 8 || (body[9] !== 2 && body[9] !== 6) || body[12] !== 0) throw new Error("png_format_unsupported");
      channels = body[9] === 2 ? 3 : 4;
    } else if (type === "IDAT") {
      idat.push(body);
      idatLength += body.length;
    } else if (type === "IEND") break;
    offset += 12 + length;
  }
  if (!width || !height || !channels || width * height > MAX_PIXELS || idat.length === 0) throw new Error("png_header_invalid");
  const packed = new Uint8Array(idatLength);
  let at = 0;
  for (const part of idat) { packed.set(part, at); at += part.length; }
  const raw = await pipe(packed, new DecompressionStream("deflate"));
  const stride = width * channels;
  if (raw.length < (stride + 1) * height) throw new Error("png_data_truncated");
  const data = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    const start = y * (stride + 1) + 1;
    const filter = raw[start - 1]!;
    const prior = y > 0 ? start - (stride + 1) : -1;
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? raw[start + i - channels]! : 0;
      const b = prior >= 0 ? raw[prior + i]! : 0;
      const c = prior >= 0 && i >= channels ? raw[prior + i - channels]! : 0;
      let add = 0;
      if (filter === 1) add = a;
      else if (filter === 2) add = b;
      else if (filter === 3) add = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filter !== 0) throw new Error("png_filter_invalid");
      raw[start + i] = (raw[start + i]! + add) & 255;
    }
    for (let x = 0; x < width; x++) {
      const from = start + x * channels, to = (y * width + x) * 3;
      data[to] = raw[from]!;
      data[to + 1] = raw[from + 1]!;
      data[to + 2] = raw[from + 2]!;
    }
  }
  return { width, height, data };
}

const chunk = (type: string, body: Uint8Array): Uint8Array => {
  const out = new Uint8Array(12 + body.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, body.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(body, 8);
  view.setUint32(8 + body.length, crc32(out.subarray(4, 8 + body.length)));
  return out;
};

export async function encodePngRgb(image: RgbImage): Promise<Uint8Array> {
  const stride = image.width * 3;
  const raw = new Uint8Array((stride + 1) * image.height);
  for (let y = 0; y < image.height; y++) {
    const from = y * stride, to = y * (stride + 1) + 1;
    raw[to - 1] = 1;
    for (let i = 0; i < stride; i++) raw[to + i] = (image.data[from + i]! - (i >= 3 ? image.data[from + i - 3]! : 0)) & 255;
  }
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, image.width);
  view.setUint32(4, image.height);
  header[8] = 8;
  header[9] = 2;
  const parts = [Uint8Array.from(SIGNATURE), chunk("IHDR", header), chunk("IDAT", await pipe(raw, new CompressionStream("deflate"))), chunk("IEND", new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let at = 0;
  for (const part of parts) { out.set(part, at); at += part.length; }
  return out;
}

export function cropRgb(image: RgbImage, rect: PixelRect): RgbImage {
  const left = Math.max(0, Math.min(image.width - 1, Math.round(rect.left)));
  const top = Math.max(0, Math.min(image.height - 1, Math.round(rect.top)));
  const width = Math.max(1, Math.min(image.width - left, Math.round(rect.width)));
  const height = Math.max(1, Math.min(image.height - top, Math.round(rect.height)));
  const data = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    const from = ((top + y) * image.width + left) * 3;
    data.set(image.data.subarray(from, from + width * 3), y * width * 3);
  }
  return { width, height, data };
}

export function tileRects(width: number, height: number, grid: number): PixelRect[] {
  const tw = Math.round((width / grid) * 1.2), th = Math.round((height / grid) * 1.2);
  return Array.from({ length: grid * grid }, (_unused, k) => {
    const x = k % grid, y = Math.floor(k / grid);
    return {
      left: Math.min(width - tw, Math.max(0, Math.round((width / grid) * x - (tw - width / grid) / 2))),
      top: Math.min(height - th, Math.max(0, Math.round((height / grid) * y - (th - height / grid) / 2))),
      width: tw,
      height: th,
    };
  });
}

export function wideRect(width: number, height: number, tile: PixelRect, factor = 2.5): PixelRect {
  const w = Math.min(width, Math.round(tile.width * factor)), h = Math.min(height, Math.round(tile.height * factor));
  return {
    left: Math.min(width - w, Math.max(0, Math.round(tile.left + tile.width / 2 - w / 2))),
    top: Math.min(height - h, Math.max(0, Math.round(tile.top + tile.height / 2 - h / 2))),
    width: w,
    height: h,
  };
}

export const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};
