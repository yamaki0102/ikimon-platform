import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import sharp from "sharp";
import { BRAND_ASSETS } from "./brandAssets.js";

const execFileAsync = promisify(execFile);
const repoRoot = path.join(process.cwd(), "..");
const brandDir = path.join(repoRoot, "upload_package", "public_html", "assets", "brand");
const publicRoot = path.join(repoRoot, "upload_package", "public_html");
const generator = path.join(process.cwd(), "scripts", "generate-zukan-brand-assets.mjs");

const expected = {
  "zukan-app-icon-192.png": [192, 192],
  "zukan-app-icon-512.png": [512, 512],
  "zukan-app-icon-192-maskable.png": [192, 192],
  "zukan-app-icon-512-maskable.png": [512, 512],
  "zukan-apple-touch-icon.png": [180, 180],
  "zukan-favicon-32.png": [32, 32],
  "zukan-ogp-default.png": [1200, 630],
} as const;

async function assetHashes(): Promise<Record<string, string>> {
  return Object.fromEntries(
    await Promise.all(
      Object.keys(expected).map(async (name) => [
        name,
        createHash("sha256").update(await readFile(path.join(brandDir, name))).digest("hex"),
      ]),
    ),
  );
}

test("generated ZUKAN raster assets are deterministic PNGs with declared dimensions", async () => {
  await execFileAsync(process.execPath, [generator]);
  const firstHashes = await assetHashes();
  await execFileAsync(process.execPath, [generator]);
  assert.deepEqual(await assetHashes(), firstHashes);

  for (const [name, [width, height]] of Object.entries(expected)) {
    const metadata = await sharp(path.join(brandDir, name)).metadata();
    assert.equal(metadata.format, "png", name);
    assert.equal(metadata.width, width, name);
    assert.equal(metadata.height, height, name);
  }

  const ogp = await sharp(path.join(brandDir, "zukan-ogp-default.png")).metadata();
  assert.equal(ogp.hasAlpha, false);
});

test("manifest, runtime paths, MIME types, ICO payload, and maskable safe zone agree", async () => {
  await execFileAsync(process.execPath, [generator]);
  const manifest = JSON.parse(
    await readFile(path.join(brandDir, "brand-manifest.json"), "utf8"),
  ) as {
    brand: string;
    ogpDefault: string;
    pwaIcons: Record<string, string>;
    browserIcons: Record<string, string>;
    rootFavicon: string;
  };

  assert.equal(manifest.brand, "ZUKAN");
  assert.equal(manifest.ogpDefault, BRAND_ASSETS.ogpDefault);
  assert.deepEqual(Object.values(manifest.pwaIcons), [
    BRAND_ASSETS.mark192,
    BRAND_ASSETS.mark512,
    BRAND_ASSETS.mark192Maskable,
    BRAND_ASSETS.mark512Maskable,
  ]);
  assert.deepEqual(Object.values(manifest.browserIcons), [
    BRAND_ASSETS.appleTouchIcon,
    BRAND_ASSETS.favicon32,
  ]);
  assert.equal(manifest.rootFavicon, "/favicon.ico");

  const ico = await readFile(path.join(publicRoot, "favicon.ico"));
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 1);
  assert.equal(ico.readUInt8(6), 32);
  assert.equal(ico.readUInt8(7), 32);
  assert.deepEqual([...ico.subarray(22, 30)], [137, 80, 78, 71, 13, 10, 26, 10]);

  const { data, info } = await sharp(path.join(brandDir, "zukan-app-icon-512-maskable.png"))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const center = (info.width - 1) / 2;
  let furthestForeground = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * 4;
      const colorDistance =
        Math.abs((data[offset] ?? 20) - 20)
        + Math.abs((data[offset + 1] ?? 63) - 63)
        + Math.abs((data[offset + 2] ?? 46) - 46);
      if (colorDistance > 24) {
        furthestForeground = Math.max(furthestForeground, Math.hypot(x - center, y - center));
      }
    }
  }
  assert.ok(furthestForeground > 0);
  assert.ok(furthestForeground <= info.width * 0.4 + 2, `${furthestForeground}px exceeds maskable safe zone`);
});
