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
  "zukan-favicon-16.png": [16, 16],
  "zukan-favicon-24.png": [24, 24],
  "zukan-favicon-32.png": [32, 32],
  "zukan-ogp-default.png": [1200, 630],
} as const;

const canonicalCommit = "c2833f0185fad87ce8ce16d853f74d57447a4898";
const canonicalSvgHashes = {
  "zukan-primary.svg": "79d7f07492a95a9f5a6e8dc6f62e7424a449e20840b652e417cdac4cb9575cd7",
  "zukan-icon.svg": "a851e5844e7bd99e7b54127745ac5274dc1fef8426b56bbad5a922cb714d36b8",
  "zukan-app-icon.svg": "b9a57fb1c880d848ff5867c4cc5a0daa478313cdd462f7aad9641acf2629c177",
  "zukan-icon-small.svg": "fc1f7d011fb3c659cf55882118432f23e213f807a4c01a8daa18bff78fa92bfa",
  "zukan-icon-mono.svg": "5486a874b48389b13ec04c9fa688844ed22d59b08a268d5fe5591c27d62b562c",
  "zukan-primary-mono.svg": "4e9e6bb45c6b1d4b25ed086d84f78fdb2292ec66bdd08f66c2f1c67f41c073f1",
} as const;
const canonicalTokenHash = "0fb9f2ab22a61d180c0843d5647366285b1d6d233cb4720bd2791b4289830d1f";

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

test("favicon sources follow the canonical app-icon rule at every browser size", async () => {
  const source = await readFile(generator, "utf8");
  assert.match(source, /"zukan-favicon-16\.png": \{[^\n]+source: "zukan-app-icon\.svg"/);
  assert.match(source, /"zukan-favicon-24\.png": \{[^\n]+source: "zukan-app-icon\.svg"/);
  assert.match(source, /"zukan-favicon-32\.png": \{[^\n]+source: "zukan-app-icon\.svg"/);
  assert.match(source, /"zukan-favicon-16\.png": await renderSquareIcon\(standardSource, 16\)/);
  assert.match(source, /"zukan-favicon-24\.png": await renderSquareIcon\(standardSource, 24\)/);
  assert.match(source, /"zukan-favicon-32\.png": await renderSquareIcon\(standardSource, 32\)/);
});

test("ZUKAN vector assets are byte-identical to the canonical GitHub brand set and render", async () => {
  for (const [name, expectedHash] of Object.entries(canonicalSvgHashes)) {
    const assetPath = path.join(brandDir, name);
    const bytes = await readFile(assetPath);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expectedHash, name);
    const metadata = await sharp(bytes, { density: 384 }).metadata();
    assert.equal(metadata.format, "svg", name);
    assert.ok((metadata.width ?? 0) > 0, name);
    assert.ok((metadata.height ?? 0) > 0, name);
  }

  assert.deepEqual(
    await readFile(path.join(brandDir, "zukan-symbol.svg")),
    await readFile(path.join(brandDir, "zukan-icon.svg")),
    "legacy symbol alias must not retain the old logo",
  );
  assert.deepEqual(
    await readFile(path.join(brandDir, "zukan-lockup.svg")),
    await readFile(path.join(brandDir, "zukan-primary.svg")),
    "legacy lockup alias must not retain the old logo",
  );
  assert.deepEqual(
    await readFile(path.join(brandDir, "zukan-app-icon-maskable.svg")),
    await readFile(path.join(brandDir, "zukan-app-icon.svg")),
    "maskable source alias must use the canonical app icon",
  );
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
});

test("manifest, runtime paths, MIME types, ICO payload, and maskable safe zone agree", async () => {
  await execFileAsync(process.execPath, [generator]);
  const manifest = JSON.parse(
    await readFile(path.join(brandDir, "brand-manifest.json"), "utf8"),
  ) as {
    brand: string;
    source: {
      repository: string;
      commit: string;
      canonicalDirectory: string;
      files: Record<string, { path: string; sha256: string }>;
    };
    primary: string;
    icon: string;
    smallIcon: string;
    monochrome: { primary: string; icon: string };
    ogpDefault: string;
    pwaIcons: Record<string, string>;
    browserIcons: Record<string, string>;
    rootFavicon: string;
  };

  assert.equal(manifest.brand, "ZUKAN");
  assert.equal(manifest.source.repository, "yamaki0102/all-projects-management");
  assert.equal(manifest.source.commit, canonicalCommit);
  assert.equal(manifest.source.canonicalDirectory, "docs/zukan/brand/final");
  for (const [name, sha256] of Object.entries(canonicalSvgHashes)) {
    assert.deepEqual(manifest.source.files[name], {
      path: `docs/zukan/brand/final/${name}`,
      sha256,
    });
  }
  assert.deepEqual(manifest.source.files["brand-tokens.json"], {
    path: "docs/zukan/brand/final/brand-tokens.json",
    sha256: canonicalTokenHash,
  });
  assert.equal(
    createHash("sha256").update(await readFile(path.join(brandDir, "brand-tokens.json"))).digest("hex"),
    canonicalTokenHash,
  );
  assert.equal(manifest.primary, BRAND_ASSETS.primary);
  assert.equal(manifest.icon, BRAND_ASSETS.icon);
  assert.equal(manifest.smallIcon, BRAND_ASSETS.smallIcon);
  assert.deepEqual(manifest.monochrome, {
    primary: BRAND_ASSETS.primaryMono,
    icon: BRAND_ASSETS.iconMono,
  });
  assert.equal(manifest.ogpDefault, BRAND_ASSETS.ogpDefault);
  assert.deepEqual(Object.values(manifest.pwaIcons), [
    BRAND_ASSETS.mark192,
    BRAND_ASSETS.mark512,
    BRAND_ASSETS.mark192Maskable,
    BRAND_ASSETS.mark512Maskable,
  ]);
  assert.deepEqual(Object.values(manifest.browserIcons), [
    BRAND_ASSETS.appleTouchIcon,
    BRAND_ASSETS.favicon16,
    BRAND_ASSETS.favicon24,
    BRAND_ASSETS.favicon32,
  ]);
  assert.equal(manifest.rootFavicon, "/favicon.ico");

  const ico = await readFile(path.join(publicRoot, "favicon.ico"));
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 3);
  assert.deepEqual([ico.readUInt8(6), ico.readUInt8(22), ico.readUInt8(38)], [16, 24, 32]);
  for (const entryOffset of [6, 22, 38]) {
    const payloadOffset = ico.readUInt32LE(entryOffset + 12);
    assert.deepEqual([...ico.subarray(payloadOffset, payloadOffset + 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  }

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
        Math.abs((data[offset] ?? 15) - 15)
        + Math.abs((data[offset + 1] ?? 74) - 74)
        + Math.abs((data[offset + 2] ?? 47) - 47);
      if (colorDistance > 24) {
        furthestForeground = Math.max(furthestForeground, Math.hypot(x - center, y - center));
      }
    }
  }
  assert.ok(furthestForeground > 0);
  assert.ok(furthestForeground <= info.width * 0.4 + 2, `${furthestForeground}px exceeds maskable safe zone`);
});
