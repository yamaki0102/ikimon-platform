import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { buildApp } from "../app.js";

async function withEnv(
  overrides: Record<string, string | undefined>,
  run: () => Promise<void>,
): Promise<void> {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    await run();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("legacy asset routes serve uploads from the legacy uploads root", async () => {
  const sandboxRoot = await mkdtemp(path.join(tmpdir(), "ikimon-legacy-assets-"));
  const publicRoot = path.join(sandboxRoot, "public");
  const uploadsRoot = path.join(sandboxRoot, "uploads");
  await mkdir(path.join(publicRoot, "assets"), { recursive: true });
  await mkdir(path.join(uploadsRoot, "photos"), { recursive: true });
  await writeFile(path.join(publicRoot, "assets", "brand.txt"), "brand");
  await writeFile(path.join(uploadsRoot, "photos", "sample.jpg"), "jpeg-bits");

  try {
    await withEnv(
      {
        LEGACY_PUBLIC_ROOT: publicRoot,
        LEGACY_UPLOADS_ROOT: uploadsRoot,
      },
      async () => {
        const app = buildApp();
        try {
          const assetResponse = await app.inject({
            method: "GET",
            url: "/assets/brand.txt",
          });
          assert.equal(assetResponse.statusCode, 200);
          assert.match(String(assetResponse.headers["content-type"] ?? ""), /^text\/plain/);
          assert.equal(assetResponse.body, "brand");

          const uploadResponse = await app.inject({
            method: "GET",
            url: "/uploads/photos/sample.jpg",
          });
          assert.equal(uploadResponse.statusCode, 200);
          assert.match(String(uploadResponse.headers["content-type"] ?? ""), /^image\/jpeg/);
          assert.equal(uploadResponse.body, "jpeg-bits");

          const legacyAliasResponse = await app.inject({
            method: "GET",
            url: "/data/uploads/photos/sample.jpg",
          });
          assert.equal(legacyAliasResponse.statusCode, 200);
          assert.match(String(legacyAliasResponse.headers["content-type"] ?? ""), /^image\/jpeg/);
          assert.equal(legacyAliasResponse.body, "jpeg-bits");
        } finally {
          await app.close();
        }
      },
    );
  } finally {
    await rm(sandboxRoot, { recursive: true, force: true });
  }
});

test("legacy asset routes fall back to public/uploads when uploads root env is stale", async () => {
  const sandboxRoot = await mkdtemp(path.join(tmpdir(), "ikimon-upload-fallback-"));
  const publicRoot = path.join(sandboxRoot, "public");
  const staleUploadsRoot = path.join(sandboxRoot, "stale-uploads");
  await mkdir(path.join(publicRoot, "uploads", "photos"), { recursive: true });
  await writeFile(path.join(publicRoot, "uploads", "photos", "fallback.jpg"), "jpeg-bits");

  await withEnv({
    LEGACY_PUBLIC_ROOT: publicRoot,
    LEGACY_UPLOADS_ROOT: staleUploadsRoot,
  }, async () => {
    const app = buildApp();
    try {
      const response = await app.inject({ method: "GET", url: "/uploads/photos/fallback.jpg" });
      assert.equal(response.statusCode, 200);
      assert.equal(response.body, "jpeg-bits");
    } finally {
      await app.close();
    }
  });
});

test("thumb route resizes image and blocks invalid preset / traversal", async () => {
  const sandboxRoot = await mkdtemp(path.join(tmpdir(), "ikimon-thumb-"));
  const uploadsRoot = path.join(sandboxRoot, "uploads");
  await mkdir(path.join(uploadsRoot, "photos"), { recursive: true });
  const sourcePng = await sharp({
    create: { width: 1000, height: 1000, channels: 3, background: { r: 120, g: 180, b: 90 } },
  })
    .png()
    .toBuffer();
  await writeFile(path.join(uploadsRoot, "photos", "big.png"), sourcePng);

  try {
    await withEnv(
      {
        LEGACY_PUBLIC_ROOT: path.join(sandboxRoot, "public"),
        LEGACY_UPLOADS_ROOT: uploadsRoot,
      },
      async () => {
        const app = buildApp();
        try {
          const thumbResponse = await app.inject({
            method: "GET",
            url: "/thumb/sm/photos/big.png",
          });
          assert.equal(thumbResponse.statusCode, 200);
          assert.equal(thumbResponse.headers["content-type"], "image/webp");
          assert.ok(thumbResponse.rawPayload.length < sourcePng.length);
          const meta = await sharp(thumbResponse.rawPayload).metadata();
          assert.equal(meta.format, "webp");
          assert.ok(meta.width && meta.width <= 192);

          const cachedResponse = await app.inject({
            method: "GET",
            url: "/thumb/sm/photos/big.png",
            headers: { "if-none-match": String(thumbResponse.headers.etag ?? "") },
          });
          assert.equal(cachedResponse.statusCode, 304);

          const badPreset = await app.inject({ method: "GET", url: "/thumb/xxl/photos/big.png" });
          assert.equal(badPreset.statusCode, 404);

          const traversal = await app.inject({ method: "GET", url: "/thumb/sm/../secret.txt" });
          assert.equal(traversal.statusCode, 404);

          const nonImageExt = await app.inject({ method: "GET", url: "/thumb/sm/photos/big.txt" });
          assert.equal(nonImageExt.statusCode, 404);
        } finally {
          await app.close();
        }
      },
    );
  } finally {
    await rm(sandboxRoot, { recursive: true, force: true });
  }
});

test("lg thumbnails preserve photo aspect ratio for detail pages", async () => {
  const sandboxRoot = await mkdtemp(path.join(tmpdir(), "ikimon-thumb-lg-"));
  const uploadsRoot = path.join(sandboxRoot, "uploads");
  await mkdir(path.join(uploadsRoot, "photos"), { recursive: true });
  const sourcePng = await sharp({
    create: { width: 1600, height: 900, channels: 3, background: { r: 90, g: 140, b: 210 } },
  })
    .png()
    .toBuffer();
  await writeFile(path.join(uploadsRoot, "photos", "wide.png"), sourcePng);

  try {
    await withEnv(
      {
        LEGACY_PUBLIC_ROOT: path.join(sandboxRoot, "public"),
        LEGACY_UPLOADS_ROOT: uploadsRoot,
      },
      async () => {
        const app = buildApp();
        try {
          const thumbResponse = await app.inject({
            method: "GET",
            url: "/thumb/lg/photos/wide.png",
          });
          assert.equal(thumbResponse.statusCode, 200);
          const meta = await sharp(thumbResponse.rawPayload).metadata();
          assert.equal(meta.format, "webp");
          assert.equal(meta.width, 1280);
          assert.equal(meta.height, 720);
        } finally {
          await app.close();
        }
      },
    );
  } finally {
    await rm(sandboxRoot, { recursive: true, force: true });
  }
});
