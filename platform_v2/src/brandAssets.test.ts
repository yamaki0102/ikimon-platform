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

test("ZUKAN vector assets use the C2 book mark and outlined Nunito wordmark", async () => {
  const symbol = await readFile(path.join(brandDir, "zukan-symbol.svg"), "utf8");
  const wordmark = await readFile(path.join(brandDir, "zukan-wordmark.svg"), "utf8");
  const lockup = await readFile(path.join(brandDir, "zukan-lockup.svg"), "utf8");
  const darkWordmark = await readFile(path.join(brandDir, "zukan-wordmark-dark.svg"), "utf8");
  const darkLockup = await readFile(path.join(brandDir, "zukan-lockup-dark.svg"), "utf8");
  const appIcon = await readFile(path.join(brandDir, "zukan-app-icon.svg"), "utf8");
  const maskableIcon = await readFile(path.join(brandDir, "zukan-app-icon-maskable.svg"), "utf8");

  assert.match(symbol, /M48 24h4v16h-4z/);
  assert.match(symbol, /M47\.5 46C38 40 25 38 13 41/);
  assert.match(symbol, /M52\.5 46C62 40 75 38 87 41/);
  assert.equal((symbol.match(/<ellipse\b/g) ?? []).length, 2);
  assert.equal((wordmark.match(/<path\b/g) ?? []).length, 5, "Nunito 800 glyphs are embedded as outlines");
  assert.doesNotMatch(wordmark, /<text\b|font-family=/, "wordmark must not depend on a client font");
  const outlinePaths = (asset: string) => [...asset.matchAll(/<path\b(?=[^>]*\bd="([^"]+)")(?=[^>]*\btransform="([^"]+)")[^>]*\/>/g)]
    .map((match) => ({ d: match[1], transform: match[2] }));
  assert.deepEqual(outlinePaths(wordmark), outlinePaths(lockup).slice(-5), "light lockup must reuse the outlined wordmark");
  assert.deepEqual(outlinePaths(wordmark), outlinePaths(darkWordmark), "dark wordmark must preserve the same glyph outlines");
  assert.deepEqual(outlinePaths(wordmark), outlinePaths(darkLockup).slice(-5), "dark lockup must preserve the same glyph outlines");
  for (const [name, asset] of Object.entries({ wordmark, lockup, darkWordmark, darkLockup })) {
    assert.doesNotMatch(asset, /NaN|Infinity/, `${name} must contain finite glyph coordinates`);
  }
  assert.match(lockup, /stroke-width="4" stroke-linecap="round"/, "lockup must include the rounded divider");
  assert.match(darkLockup, /stroke-width="4" stroke-linecap="round"/);
  assert.doesNotMatch(lockup, /<rect\b|fill="#F7F7F3"/, "lockup artwork must have a transparent background");
  assert.doesNotMatch(darkLockup, /<rect\b|fill="#183B2A"/, "dark lockup artwork must have a transparent background");
  for (const [name, asset] of Object.entries({ lockup, darkLockup, appIcon, maskableIcon })) {
    assert.match(asset, /M47\.5 46C38 40 25 38 13 41/, `${name} must retain C2 geometry`);
  }
  assert.match(darkWordmark, /fill="#FFFFFF"/);
  assert.match(appIcon, /fill="#FFF9EC"/);
  assert.match(maskableIcon, /translate\(10 10\) scale\(0\.8\)/);
});

test("ZUKAN SVG materialization uses gateway-compatible XML metadata", async () => {
  const materializer = await readFile(
    path.join(process.cwd(), "cloudflare_shadow", "scripts", "materialize-original-ui-html.mjs"),
    "utf8",
  );

  assert.match(
    materializer,
    /contentType === "image\/svg\+xml" \? "application\/xml" : contentType/,
  );
  assert.match(
    materializer,
    /content_type: materializationGatewayContentType\(item\.contentType\)/,
  );
  assert.match(materializer, /"\/assets\/brand\/zukan-lockup-dark\.svg"/);
  assert.match(materializer, /"\/assets\/brand\/zukan-wordmark-dark\.svg"/);
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
        Math.abs((data[offset] ?? 36) - 36)
        + Math.abs((data[offset + 1] ?? 92) - 92)
        + Math.abs((data[offset + 2] ?? 58) - 58);
      if (colorDistance > 24) {
        furthestForeground = Math.max(furthestForeground, Math.hypot(x - center, y - center));
      }
    }
  }
  assert.ok(furthestForeground > 0);
  assert.ok(furthestForeground <= info.width * 0.4 + 2, `${furthestForeground}px exceeds maskable safe zone`);
});
