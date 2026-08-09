import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const BRAND_DIR = resolve(REPOSITORY_ROOT, "upload_package/public_html/assets/brand");
const PUBLIC_ROOT = resolve(REPOSITORY_ROOT, "upload_package/public_html");
const BRAND_BACKGROUND = { r: 15, g: 74, b: 47, alpha: 1 };
const OGP_BACKGROUND = { r: 247, g: 247, b: 243, alpha: 1 };
const MASKABLE_SOURCE_SIZE = 1024;
const MASKABLE_ARTBOARD_SIZE = 720;

export const GENERATED_ASSET_SPECS = Object.freeze({
  "zukan-app-icon-192.png": { width: 192, height: 192, source: "zukan-app-icon.svg" },
  "zukan-app-icon-512.png": { width: 512, height: 512, source: "zukan-app-icon.svg" },
  "zukan-app-icon-192-maskable.png": { width: 192, height: 192, source: "zukan-app-icon.svg" },
  "zukan-app-icon-512-maskable.png": { width: 512, height: 512, source: "zukan-app-icon.svg" },
  "zukan-apple-touch-icon.png": { width: 180, height: 180, source: "zukan-app-icon.svg" },
  "zukan-favicon-16.png": { width: 16, height: 16, source: "zukan-app-icon.svg" },
  "zukan-favicon-24.png": { width: 24, height: 24, source: "zukan-app-icon.svg" },
  "zukan-favicon-32.png": { width: 32, height: 32, source: "zukan-app-icon.svg" },
  "zukan-ogp-default.png": { width: 1200, height: 630, source: "zukan-primary.svg" },
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

function pngsAsIco(entries) {
  const directorySize = 6 + entries.length * 16;
  const header = Buffer.alloc(directorySize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  let payloadOffset = directorySize;
  entries.forEach(({ size, png }, index) => {
    const offset = 6 + index * 16;
    header.writeUInt8(size, offset);
    header.writeUInt8(size, offset + 1);
    header.writeUInt8(0, offset + 2);
    header.writeUInt8(0, offset + 3);
    header.writeUInt16LE(1, offset + 4);
    header.writeUInt16LE(32, offset + 6);
    header.writeUInt32LE(png.length, offset + 8);
    header.writeUInt32LE(payloadOffset, offset + 12);
    payloadOffset += png.length;
  });
  return Buffer.concat([header, ...entries.map(({ png }) => png)]);
}

export async function generateZukanBrandAssets() {
  const standardSource = await readFile(resolve(BRAND_DIR, "zukan-app-icon.svg"));
  const primarySource = await readFile(resolve(BRAND_DIR, "zukan-primary.svg"));

  const outputs = {
    "zukan-app-icon-192.png": await renderSquareIcon(standardSource, 192),
    "zukan-app-icon-512.png": await renderSquareIcon(standardSource, 512),
    "zukan-app-icon-192-maskable.png": await renderMaskableIcon(standardSource, 192),
    "zukan-app-icon-512-maskable.png": await renderMaskableIcon(standardSource, 512),
    "zukan-apple-touch-icon.png": await renderSquareIcon(standardSource, 180),
    "zukan-favicon-16.png": await renderSquareIcon(standardSource, 16),
    "zukan-favicon-24.png": await renderSquareIcon(standardSource, 24),
    "zukan-favicon-32.png": await renderSquareIcon(standardSource, 32),
    "zukan-ogp-default.png": await renderOgp(primarySource),
  };

  await Promise.all(
    Object.entries(outputs).map(([name, data]) => writeFile(resolve(BRAND_DIR, name), data)),
  );
  await writeFile(resolve(PUBLIC_ROOT, "favicon.ico"), pngsAsIco([
    { size: 16, png: outputs["zukan-favicon-16.png"] },
    { size: 24, png: outputs["zukan-favicon-24.png"] },
    { size: 32, png: outputs["zukan-favicon-32.png"] },
  ]));
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  await generateZukanBrandAssets();
}
