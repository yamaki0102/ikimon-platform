/** Metadata removal without a provider call or recompression. Only raster image containers are accepted. */
const text = (b: Uint8Array, from: number, size: number) => String.fromCharCode(...b.subarray(from, from + size));
const join = (chunks: Uint8Array[]) => {
  const result = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
};
const invalid = (): never => { throw new Error("photo_format_invalid"); };
const validDimensions = (width:number,height:number) => width > 0 && height > 0 && width <= 8192 && height <= 8192 && width*height <= 8_388_608;

export function removePhotoMetadata(input: ArrayBuffer, declaredMime: string): { bytes: ArrayBuffer; mime: string } {
  const b = new Uint8Array(input);
  if (b.length < 16) return invalid();
  let clean: Uint8Array;
  let mime: string;
  if (b[0] === 0xff && b[1] === 0xd8) {
    mime = "image/jpeg";
    const chunks = [b.subarray(0, 2)];
    let offset = 2; let imageFound = false; let scanFound = false; let ended = false;
    while (offset < b.length) {
      if (b[offset] !== 0xff || offset + 1 >= b.length) return invalid();
      const start = offset;
      while (b[offset] === 0xff) offset++;
      const marker = b[offset++]!;
      if (marker === 0xd9) {
        if (!imageFound || !scanFound || offset !== b.length) return invalid();
        chunks.push(b.subarray(start, offset)); ended = true; break;
      }
      const metadata = (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe;
      if (!metadata && ![0xc0,0xc1,0xc2,0xc4,0xdb,0xdd,0xda].includes(marker)) return invalid();
      if (offset + 2 > b.length) return invalid();
      const length = b[offset]! * 256 + b[offset + 1]!;
      if (length < 2 || offset + length > b.length) return invalid();
      if ([0xc0, 0xc1, 0xc2].includes(marker)) {
        if (length < 8 || !validDimensions(b[offset + 5]! * 256 + b[offset + 6]!,b[offset + 3]! * 256 + b[offset + 4]!)) return invalid();
        imageFound = true;
      }
      if (!metadata) chunks.push(b.subarray(start, offset + length));
      offset += length;
      if (marker === 0xda) {
        if (!imageFound || length < 6) return invalid();
        scanFound = true;
        // Scan entropy bytes, respecting stuffed FF00 and restart markers. Metadata can
        // legally occur between progressive scans, so never copy the remaining file whole.
        const entropyStart = offset;
        while (offset < b.length) {
          if (b[offset] !== 0xff) { offset++; continue; }
          const markerStart = offset;
          while (b[offset] === 0xff) offset++;
          const next = b[offset];
          if (next === undefined) return invalid();
          if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) { offset++; continue; }
          chunks.push(b.subarray(entropyStart, markerStart));
          offset = markerStart; break;
        }
      }
    }
    if (!ended) return invalid();
    clean = join(chunks);
  } else if (b[0] === 137 && text(b, 1, 3) === "PNG" && b[4] === 13 && b[5] === 10 && b[6] === 26 && b[7] === 10) {
    mime = "image/png";
    const chunks = [b.subarray(0, 8)];
    const view = new DataView(input);
    let offset = 8; let data = false; let end = false; let header = false;
    const keep = new Set(["IHDR", "PLTE", "IDAT", "IEND", "tRNS", "sRGB", "gAMA", "cHRM"]);
    while (offset + 12 <= b.length) {
      const size = view.getUint32(offset); const kind = text(b, offset + 4, 4);
      if (offset + size + 12 > b.length) return invalid();
      if (!header && (kind !== "IHDR" || size !== 13 || !validDimensions(view.getUint32(offset + 8),view.getUint32(offset + 12)))) return invalid();
      if (header && kind === "IHDR") return invalid();
      header = true;
      if (kind === "acTL" || kind === "fcTL" || kind === "fdAT") return invalid();
      if (!keep.has(kind) && /^[A-Z]/.test(kind)) return invalid();
      if (keep.has(kind)) chunks.push(b.subarray(offset, offset + size + 12));
      if (kind === "IDAT") data = true;
      offset += size + 12;
      if (kind === "IEND") { end = size === 0 && offset === b.length; break; }
    }
    if (!header || !data || !end) return invalid();
    clean = join(chunks);
  } else if (text(b, 0, 4) === "RIFF" && text(b, 8, 4) === "WEBP") {
    mime = "image/webp";
    const view = new DataView(input);
    if (view.getUint32(4, true) !== b.length - 8) return invalid();
    const chunks: Uint8Array[] = [b.slice(0, 12)];
    let offset = 12; let data = false;
    while (offset + 8 <= b.length) {
      const kind = text(b, offset, 4); const size = view.getUint32(offset + 4, true);
      const end = offset + 8 + size + size % 2;
      if (end > b.length || kind === "ANIM" || kind === "ANMF") return invalid();
      if (kind === "VP8 ") {
        if (size < 10 || b[offset+11] !== 0x9d || b[offset+12] !== 0x01 || b[offset+13] !== 0x2a || !validDimensions(view.getUint16(offset+14,true)&0x3fff,view.getUint16(offset+16,true)&0x3fff)) return invalid();
        data = true;
      }
      if (kind === "VP8L") {
        if (size < 5 || b[offset+8] !== 0x2f) return invalid();
        const dimensions=view.getUint32(offset+9,true);
        if ((dimensions>>>29) !== 0 || !validDimensions((dimensions&0x3fff)+1,((dimensions>>>14)&0x3fff)+1)) return invalid();
        data = true;
      }
      if (["VP8 ", "VP8L", "ALPH", "VP8X"].includes(kind)) {
        const chunk = b.slice(offset, end);
        if (kind === "VP8X") {
          if (size !== 10 || (chunk[8]! & 2) || !validDimensions(1+chunk[12]!+256*chunk[13]!+65536*chunk[14]!,1+chunk[15]!+256*chunk[16]!+65536*chunk[17]!)) return invalid();
          chunk[8] = chunk[8]! & ~0x2c;
        }
        chunks.push(chunk);
      } else if (!["EXIF", "XMP ", "ICCP"].includes(kind)) return invalid();
      offset = end;
    }
    if (offset !== b.length || !data) return invalid();
    clean = join(chunks); new DataView(clean.buffer).setUint32(4, clean.length - 8, true);
  } else return invalid();
  if (declaredMime.split(";", 1)[0]?.toLowerCase() !== mime) return invalid();
  return { bytes: clean.buffer as ArrayBuffer, mime };
}
