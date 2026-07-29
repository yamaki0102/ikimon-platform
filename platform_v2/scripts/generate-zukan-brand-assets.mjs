import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const BRAND_DIR = resolve(REPOSITORY_ROOT, "upload_package/public_html/assets/brand");
const PUBLIC_ROOT = resolve(REPOSITORY_ROOT, "upload_package/public_html");
const BRAND_BACKGROUND = { r: 20, g: 63, b: 46, alpha: 1 };
const OGP_BACKGROUND = { r: 247, g: 247, b: 243, alpha: 1 };
const MASKABLE_SOURCE_SIZE = 1024;
const MASKABLE_ARTBOARD_SIZE = 720;

export const GENERATED_ASSET_SPECS = Object.freeze({
  "zukan-app-icon-192.png": { width: 192, height: 192, source: "zukan-app-icon.svg" },
  "zukan-app-icon-512.png": { width: 512, height: 512, source: "zukan-app-icon.svg" },
  "zukan-app-icon-192-maskable.png": { width: 192, height: 192, source: "zukan-app-icon-maskable.svg" },
  "zukan-app-icon-512-maskable.png": { width: 512, height: 512, source: "zukan-app-icon-maskable.svg" },
  "zukan-apple-touch-icon.png": { width: 180, height: 180, source: "zukan-app-icon.svg" },
  "zukan-favicon-32.png": { width: 32, height: 32, source: "zukan-app-icon.svg" },
  "zukan-ogp-default.png": { width: 1200, height: 630, source: "zukan-lockup.svg" },
});

const PNG_OPTIONS = Object.freeze({
  compressionLevel: 9,
  adaptiveFiltering: true,
  effort: 10,
});

async function renderSquareIcon(source, size) {
  return sharp(source, { density: 384 })
    .resize(size, size, { fit: "fill" })
    .png(PNG_OPTIONS)
    .toBuffer();
}

async function renderMaskableIcon(source, size) {
  const insetSource = await sharp(source, { density: 384 })
    .resize(MASKABLE_ARTBOARD_SIZE, MASKABLE_ARTBOARD_SIZE, { fit: "fill" })
    .png(PNG_OPTIONS)
    .toBuffer();
  const canvas = await sharp({
    create: {
      width: MASKABLE_SOURCE_SIZE,
      height: MASKABLE_SOURCE_SIZE,
      channels: 4,
      background: BRAND_BACKGROUND,
    },
  })
    .composite([{ input: insetSource, gravity: "centre" }])
    .png(PNG_OPTIONS)
    .toBuffer();
  return sharp(canvas)
    .resize(size, size, { fit: "fill" })
    .png(PNG_OPTIONS)
    .toBuffer();
}

async function renderOgp(source) {
  const lockup = await sharp(source, { density: 384 })
    .resize({ width: 900, height: 250, fit: "inside", withoutEnlargement: false })
    .png(PNG_OPTIONS)
    .toBuffer();
  return sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 4,
      background: OGP_BACKGROUND,
    },
  })
    .composite([{ input: lockup, gravity: "centre" }])
    .removeAlpha()
    .png(PNG_OPTIONS)
    .toBuffer();
}

function pngAsIco(png) {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header.writeUInt8(32, 6);
  header.writeUInt8(32, 7);
  header.writeUInt8(0, 8);
  header.writeUInt8(0, 9);
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(header.length, 18);
  return Buffer.concat([header, png]);
}

export async function generateZukanBrandAssets() {
  const standardSource = await readFile(resolve(BRAND_DIR, "zukan-app-icon.svg"));
  const maskableSource = await readFile(resolve(BRAND_DIR, "zukan-app-icon-maskable.svg"));
  const lockupSource = await readFile(resolve(BRAND_DIR, "zukan-lockup.svg"));

  const outputs = {
    "zukan-app-icon-192.png": await renderSquareIcon(standardSource, 192),
    "zukan-app-icon-512.png": await renderSquareIcon(standardSource, 512),
    "zukan-app-icon-192-maskable.png": await renderMaskableIcon(maskableSource, 192),
    "zukan-app-icon-512-maskable.png": await renderMaskableIcon(maskableSource, 512),
    "zukan-apple-touch-icon.png": await renderSquareIcon(standardSource, 180),
    "zukan-favicon-32.png": await renderSquareIcon(standardSource, 32),
    "zukan-ogp-default.png": await renderOgp(lockupSource),
  };

  await Promise.all(
    Object.entries(outputs).map(([name, data]) => writeFile(resolve(BRAND_DIR, name), data)),
  );
  await writeFile(resolve(PUBLIC_ROOT, "favicon.ico"), pngAsIco(outputs["zukan-favicon-32.png"]));
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  await generateZukanBrandAssets();
}
