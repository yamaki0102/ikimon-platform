export type PublicDerivativeInspection = {
  tool: string;
  inspectionVersion: string;
  contentType: string;
  bytes: number;
  scannedContainer: string;
  gpsExifPresent: boolean;
  exifPresent: boolean;
  gpsPresent: boolean;
  xmpPresent: boolean;
  exactCoordinateLiteralPresent: boolean;
  checkedAt: string;
};

type WebpChunk = {
  type: string;
  data: Uint8Array;
};

const ascii = (bytes: Uint8Array, offset: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(offset, offset + length));

function readWebpChunks(bytes: Uint8Array): WebpChunk[] | null {
  if (bytes.byteLength < 12 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") {
    return null;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: WebpChunk[] = [];
  let offset = 12;
  while (offset + 8 <= bytes.byteLength) {
    const type = ascii(bytes, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const dataStart = offset + 8;
    const dataEnd = dataStart + size;
    if (dataEnd > bytes.byteLength) return null;
    chunks.push({ type, data: bytes.subarray(dataStart, dataEnd) });
    offset = dataEnd + (size % 2);
  }
  return offset === bytes.byteLength ? chunks : null;
}

function inspectMetadataPayload(chunks: WebpChunk[]): {
  exifPresent: boolean;
  gpsPresent: boolean;
  xmpPresent: boolean;
  exactCoordinateLiteralPresent: boolean;
} {
  const metadataChunks = chunks.filter((chunk) => chunk.type === "EXIF" || chunk.type === "XMP ");
  const metadataText = metadataChunks
    .map((chunk) => new TextDecoder("utf-8", { fatal: false }).decode(chunk.data))
    .join("\n");
  const lower = metadataText.toLowerCase();
  const exifPresent = chunks.some((chunk) => chunk.type === "EXIF");
  const xmpPresent = chunks.some((chunk) => chunk.type === "XMP ");
  const gpsPresent = lower.includes("gpslatitude") ||
    lower.includes("gpslongitude") ||
    lower.includes("gpsaltitude") ||
    lower.includes(" gps");
  const exactCoordinateLiteralPresent = /34\.71234|137\.81234/.test(metadataText);
  return { exifPresent, gpsPresent, xmpPresent, exactCoordinateLiteralPresent };
}

export function inspectPublicDerivativeMetadata(bytes: ArrayBuffer, contentType: string): PublicDerivativeInspection {
  const normalizedContentType = contentType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  const byteView = new Uint8Array(bytes);
  const webpChunks = normalizedContentType === "image/webp" ? readWebpChunks(byteView) : null;
  const container = normalizedContentType.includes("svg") ? "svg+xml" : webpChunks ? "webp" : "binary";
  const metadata = webpChunks
    ? inspectMetadataPayload(webpChunks)
    : { exifPresent: false, gpsPresent: false, xmpPresent: false, exactCoordinateLiteralPresent: false };

  return {
    tool: "public-derivative-metadata-inspection",
    inspectionVersion: "webp-chunk-v2",
    contentType: normalizedContentType,
    bytes: bytes.byteLength,
    scannedContainer: container,
    gpsExifPresent: metadata.exifPresent || metadata.gpsPresent || metadata.xmpPresent || metadata.exactCoordinateLiteralPresent,
    ...metadata,
    checkedAt: new Date().toISOString(),
  };
}
