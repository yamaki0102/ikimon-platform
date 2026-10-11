/** Bounded static WebP, with metadata and trailing bytes rejected, not merely hidden. */
export function publicPortraitBytes(dataUrl: unknown): Uint8Array | null {
  if (typeof dataUrl !== "string" || dataUrl.length > 400_024
    || !/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/u.test(dataUrl)) return null;
  let raw: string;
  try { raw = atob(dataUrl.slice(23)); } catch { return null; }
  if (raw.length < 20 || raw.length > 300_000 || raw.slice(0, 4) !== "RIFF" || raw.slice(8, 12) !== "WEBP") return null;
  const bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
  const read32 = (at: number): number => new DataView(bytes.buffer).getUint32(at, true);
  if (read32(4) + 8 !== bytes.length) return null;
  let image = false; let extended = false; let alpha = false;
  for (let offset = 12; offset < bytes.length;) {
    if (offset + 8 > bytes.length) return null;
    const kind = raw.slice(offset, offset + 4), length = read32(offset + 4);
    const end = offset + 8 + length + (length % 2);
    if (end > bytes.length || (length % 2 === 1 && bytes[end - 1] !== 0) || !["VP8 ", "VP8L", "VP8X", "ALPH"].includes(kind)) return null;
    // ICC, EXIF, XMP, animation, reserved flags, and their associated chunks are forbidden.
    if (kind === "VP8X" && (offset !== 12 || extended || length !== 10 || (bytes[offset + 8]! & 0xef) !== 0
      || bytes[offset + 9] !== 0 || bytes[offset + 10] !== 0 || bytes[offset + 11] !== 0)) return null;
    if (kind === "VP8X") extended = true;
    if (kind === "ALPH") { if (!extended || image || alpha || length < 2) return null; alpha = true; }
    if (kind === "VP8 " || kind === "VP8L") {
      if (image || length < (kind === "VP8 " ? 10 : 5) || (kind === "VP8L" && alpha)) return null;
      if (kind === "VP8 " && (raw.slice(offset + 11, offset + 14) !== "\x9d\x01\x2a" || (bytes[offset + 8]! & 1) !== 0)) return null;
      if (kind === "VP8L" && (bytes[offset + 8] !== 0x2f || (bytes[offset + 12]! & 0xe0) !== 0)) return null;
      image = true;
    }
    offset = end;
  }
  return image ? bytes : null;
}
