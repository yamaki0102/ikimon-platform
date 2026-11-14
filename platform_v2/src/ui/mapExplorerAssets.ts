import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const MAPLIBRE_VERSION = "4.7.1";
export const MAPLIBRE_JS_SRI = "sha384-SYKAG6cglRMN0RVvhNeBY0r3FYKNOJtznwA0v7B5Vp9tr31xAHsZC0DqkQ/pZDmj";
export const MAPLIBRE_CSS_SRI = "sha384-MinO0mNliZ3vwppuPOUnGa+iq619pfMhLVUXfC4LHwSCvF9H+6P/KO4Q7qBOYV5V";

export interface HashedStaticAsset {
  readonly path: string;
  readonly content: Buffer;
  readonly contentType: string;
  readonly etag: string;
  readonly sri: string;
}

function loadPinnedVendorAsset(
  relativePath: string,
  ext: "js" | "css",
  expectedSri: string,
  contentType: string,
): HashedStaticAsset {
  const fullPath = fileURLToPath(new URL(`../../assets/vendor/maplibre-gl-${MAPLIBRE_VERSION}/${relativePath}`, import.meta.url));
  const content = readFileSync(fullPath);
  const actualSri = `sha384-${createHash("sha384").update(content).digest("base64")}`;
  if (actualSri !== expectedSri) {
    throw new Error(`Pinned MapLibre ${ext} integrity mismatch: got ${actualSri}, expected ${expectedSri}`);
  }
  const sha256 = createHash("sha256").update(content).digest("hex");
  return {
    path: `/assets/vendor/maplibre-gl-${MAPLIBRE_VERSION}.${sha256.slice(0, 12)}.${ext}`,
    content,
    contentType,
    etag: `"${sha256.slice(0, 24)}"`,
    sri: expectedSri,
  };
}

export const MAPLIBRE_SELF_HOSTED_JS = loadPinnedVendorAsset(
  "maplibre-gl.js",
  "js",
  MAPLIBRE_JS_SRI,
  "application/javascript; charset=utf-8",
);

export const MAPLIBRE_SELF_HOSTED_CSS = loadPinnedVendorAsset(
  "maplibre-gl.css",
  "css",
  MAPLIBRE_CSS_SRI,
  "text/css; charset=utf-8",
);

export const MAP_GLYPH_SUBSET_RANGES = ["12288-12543", "65280-65535"] as const;
export type MapGlyphSubsetRange = (typeof MAP_GLYPH_SUBSET_RANGES)[number];

function loadHashedGlyphSubsetAsset(range: MapGlyphSubsetRange): HashedStaticAsset {
  const fullPath = fileURLToPath(
    new URL(`../../assets/fonts/noto-sans-regular/${range}.pbf`, import.meta.url),
  );
  const content = readFileSync(fullPath);
  const sha256 = createHash("sha256").update(content).digest("hex");
  const sri = `sha384-${createHash("sha384").update(content).digest("base64")}`;
  return {
    path: `/assets/fonts/noto-sans-regular/${range}.${sha256.slice(0, 12)}.pbf`,
    content,
    contentType: "application/x-protobuf",
    etag: `"${sha256.slice(0, 24)}"`,
    sri,
  };
}

export const MAP_GLYPH_SUBSET_ASSETS: Record<MapGlyphSubsetRange, HashedStaticAsset> = {
  "12288-12543": loadHashedGlyphSubsetAsset("12288-12543"),
  "65280-65535": loadHashedGlyphSubsetAsset("65280-65535"),
};

export const MAP_GLYPH_SUBSET_ASSET_LIST: readonly HashedStaticAsset[] =
  MAP_GLYPH_SUBSET_RANGES.map((range) => MAP_GLYPH_SUBSET_ASSETS[range]);
