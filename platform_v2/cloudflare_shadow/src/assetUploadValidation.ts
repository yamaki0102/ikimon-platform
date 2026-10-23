export const MAX_ASSET_UPLOAD_BYTES = 25 * 1024 * 1024;

export async function readAndValidateAssetUploadBody(
  body: ReadableStream<Uint8Array>,
  declaredMime: string,
  declaredBytes: number,
): Promise<Uint8Array<ArrayBuffer>> {
  if (!Number.isSafeInteger(declaredBytes) || declaredBytes <= 0 || declaredBytes > MAX_ASSET_UPLOAD_BYTES) {
    throw new Error("invalid_media_bytes");
  }
  const mime = declaredMime.trim().toLowerCase().split(";", 1)[0] ?? "";
  if (!mime || !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(mime)) {
    throw new Error("invalid_media_mime");
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_ASSET_UPLOAD_BYTES || size > declaredBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error("uploaded_media_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (size !== declaredBytes) throw new Error("uploaded_media_size_mismatch");

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (!matchesDeclaredMime(bytes, mime)) throw new Error("uploaded_media_type_mismatch");
  return bytes;
}

function matchesDeclaredMime(bytes: Uint8Array, mime: string): boolean {
  if (mime === "text/plain") return true;
  if (mime === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  if (mime === "image/webp") return bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP";
  if (mime === "video/webm" || mime === "audio/webm") return bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  if (mime === "audio/ogg") return bytes.length >= 4 && ascii(bytes, 0, 4) === "OggS";
  if (mime === "video/mp4" || mime === "audio/mp4") return bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp";
  // Preserve opaque legacy media types while enforcing byte limits and exact declared length.
  return true;
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}
